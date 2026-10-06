#!/usr/bin/env node
// Static site build for one site folder. No dependencies: Node 20 or later.
//
//   node engine/build.mjs <site-dir>                  build into <site-dir>/dist/
//   node engine/build.mjs <site-dir> --strict         the launch build: placeholders and
//                                                     sign-off gaps (warnings in a plain
//                                                     build) fail it
//   node engine/build.mjs <site-dir> --no-pragmatic   build with the Pragmatic Play demos
//                                                     switched off
//   node engine/build.mjs <site-dir> --out DIR        build somewhere else (inside the site,
//                                                     reports/, a dist* folder in the repo,
//                                                     or the temp/scratch directories)
//   node engine/build.mjs <site-dir> --json           print { ok, problems, warnings, out,
//                                                     pages, … } on stdout; the usual
//                                                     report goes to stderr
//
//   SITE_DIR=path     the site folder when no <site-dir> is given (default: the working directory)
//   SITE_CONFIG=path  read another config file instead of <site-dir>/site.config.json
//   OUT_DIR=path      like --out, relative to the site folder
//
// Three roots: ENGINE (this folder), SITE (the argument) and TYPES
// (<repo>/types). The site's "type" (site.config.json) picks the type pack,
// types/<type>/pack.mjs, which supplies the page list, the stylesheet
// partials, its lint rules and its check builds (engine/lib/pack.mjs).
//
// Reads the site's config, renders every page to plain HTML, copies the
// engine's client scripts and the site's public files, and writes sitemap,
// robots, manifest, service worker and hosting headers. Then it lints the
// output (engine rules here, the pack's rules at fixed points, see PHASES in
// engine/lib/pack.mjs) and ends with "Lint: no problems found." or exits 1.
//
// Caching: scripts and the stylesheet are published under
// /assets/v<version>/, where the version is a hash of every script, the
// stylesheet and the client config, and fonts get content-hashed names. A
// changed file therefore always has a new URL, so those URLs can be cached
// for a year, and a returning visitor never runs old scripts against new
// pages. Source files keep plain paths (/assets/js/app.js); the build
// rewrites them in the pages it writes.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { makeContext, siteFolder } from './lib/context.mjs';
import { longDate } from './lib/html.mjs';
import { layout, setAssetVersion, csp } from './lib/layout.mjs';
import { coverCss } from './lib/art.mjs';
import { loadPack, typeOf } from './lib/pack.mjs';
import { createReport, printableWarnings } from './lint/report.mjs';
import { visibleText, tagsOf, cspOf } from './lint/markup.mjs';
import { validateConfig } from './schema/validate.mjs';
import { parseHeaders, cacheControlFor } from './tools/lib/headers.mjs';
import { pageText, scriptStrings, styleText, uncovered, describe, unknownEntities } from './tools/lib/glyphs.mjs';
import about from './pages/about.mjs';
import terms from './pages/terms.mjs';
import privacy from './pages/privacy.mjs';
import cookies from './pages/cookies.mjs';
import contact from './pages/contact.mjs';
import { notFound, offline } from './pages/misc.mjs';

const ENGINE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(ENGINE);
const TYPES = path.join(REPO, 'types');

// ---------- arguments ----------
const USAGE = 'usage: node engine/build.mjs <site-dir> [--strict] [--no-pragmatic] [--out DIR] [--json]';
function parseArgs(argv) {
  const o = { strict: false, noPragmatic: false, json: false, out: null, site: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') o.strict = true;
    else if (a === '--no-pragmatic') o.noPragmatic = true;
    else if (a === '--json') o.json = true;
    else if (a === '--no-derived-check') {} // accepted: the config-derived lint arrives in Phase 2
    else if (a === '--out') {
      o.out = argv[++i];
      if (!o.out) throw new UsageError('--out needs a directory');
    } else if (a.startsWith('--out=')) o.out = a.slice('--out='.length);
    else if (a === '--help' || a === '-h') throw new UsageError(null);
    else if (a.startsWith('-')) throw new UsageError(`unknown option ${a}`);
    else if (o.site === null) o.site = a;
    else throw new UsageError(`unexpected argument ${a}`);
  }
  return o;
}
class UsageError extends Error {}

const inside = (child, parent) => {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};
/**
 * Where a build may write. The build empties OUT first, so it must not be a
 * source folder: inside the site folder, inside reports/, a dist* folder in
 * the repository, or under the temp and scratch directories. Never a folder
 * that holds the repository, the engine, the types or the site.
 */
function outRefusal(OUT, SITE) {
  for (const [name, dir] of [['the repository', REPO], ['the engine', ENGINE], ['the types', TYPES], ['the site', SITE]]) {
    if (OUT === dir || inside(dir, OUT)) return `--out ${OUT} is or holds ${name}`;
  }
  const scratch = [os.tmpdir(), process.env.TMPDIR, process.env.CLAUDE_SCRATCHPAD, process.env.RUNNER_TEMP].filter(Boolean).map((d) => path.resolve(d));
  if (scratch.some((d) => inside(OUT, d))) return null;
  if (inside(OUT, SITE)) return null;
  if (inside(OUT, path.join(REPO, 'reports'))) return null;
  if (inside(OUT, REPO) && /^dist/.test(path.basename(OUT)) && !inside(OUT, ENGINE) && !(inside(OUT, TYPES) && !inside(OUT, SITE))) return null;
  return `--out ${OUT} is outside the site, reports/, a dist* folder of the repository and the temp directories`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const strict = opts.strict;
  // In --json mode stdout carries only the JSON; the report goes to stderr.
  const say = opts.json ? (...a) => console.error(...a) : (...a) => console.log(...a);

  const SITE = path.resolve(opts.site || process.env.SITE_DIR || process.cwd());
  const configFile = path.resolve(SITE, process.env.SITE_CONFIG || 'site.config.json');
  if (!existsSync(configFile)) throw new UsageError(`${configFile} doesn't exist (is ${SITE} a site folder?)`);
  const OUT = opts.out ? path.resolve(opts.out) : path.resolve(SITE, process.env.OUT_DIR || 'dist');
  const refusal = outRefusal(OUT, SITE);
  if (refusal) throw new UsageError(`refusing to build: ${refusal}`);
  const PUBLIC = path.join(SITE, 'public');
  const site = siteFolder(SITE);

  const cfg = JSON.parse(await fs.readFile(configFile, 'utf8'));
  const report = createReport({ strict });

  // ---------- 0. type pack and config schema ----------
  const { type, defaulted } = typeOf(cfg);
  if (defaulted) report.warn('type-missing', `site.config.json: no "type"; building as "${type}" (Phase 1 default). Add "type" to the config.`);
  const pack = await loadPack(TYPES, type);
  if (pack.status === 'stub') {
    report.strict('type-stub', `types/${type}: this type pack is a stub (contract v0: generic pages, the engine's default chrome and legal pages). Sites of this type can't launch until the pack is complete.`);
  }
  const schema = await validateConfig(cfg, { REPO });
  for (const e of schema.errors) {
    // Phase 1: a missing "type" is the type-missing warning above, not a schema error.
    if (defaulted && e.missing === 'type') continue;
    report.error('config-schema', `site.config.json: ${e.message}`);
  }

  if (opts.noPragmatic) cfg.pragmatic = { ...cfg.pragmatic, enabled: false };
  const ctx = makeContext(cfg, site);
  ctx.strict = strict;
  ctx.type = type;
  ctx.pack = pack;

  // Pack lint rules by phase, in the pack's order.
  const rulesBy = new Map();
  for (const r of pack.lint?.rules || []) {
    if (!rulesBy.has(r.phase)) rulesBy.set(r.phase, []);
    rulesBy.get(r.phase).push(r);
  }
  const runPhase = async (phase, input) => {
    for (const r of rulesBy.get(phase) || []) await r.run({ ...input, ctx, cfg, site, out: OUT }, report.rule(r.id));
  };

  // ---------- helpers ----------
  async function walk(dir) {
    const out = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await walk(p)));
      else out.push(p);
    }
    return out;
  }
  const write = async (rel, data) => {
    const p = path.join(OUT, rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  };
  /** A script and every module it imports statically, as paths relative to OUT. */
  async function moduleGraph(entries) {
    const seen = new Set();
    const queue = [...entries];
    while (queue.length) {
      const rel = queue.shift();
      if (seen.has(rel)) continue;
      seen.add(rel);
      let src;
      try { src = await fs.readFile(path.join(OUT, rel), 'utf8'); } catch { continue; }
      for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]/g)) {
        queue.push(path.posix.join(path.posix.dirname(rel), m[1] || m[2]));
      }
    }
    return [...seen];
  }
  const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const hash = (...parts) => {
    const h = crypto.createHash('sha256');
    for (const p of parts) h.update(p);
    return h.digest('hex').slice(0, 10);
  };
  const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  // What the service worker may download on a first visit, in KB gzip (the home first view is about 60).
  const PRECACHE_BUDGET = 220;
  const today = new Date().toISOString().slice(0, 10);

  // ---------- 1. copy public files ----------
  // The engine's client scripts, then the site's public files over them.
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  await fs.cp(path.join(ENGINE, 'client'), path.join(OUT, 'assets/js'), { recursive: true });
  await fs.cp(path.join(ENGINE, 'games/_legacy'), path.join(OUT, 'assets/js/games'), { recursive: true });
  if (existsSync(PUBLIC)) await fs.cp(PUBLIC, OUT, { recursive: true });
  // With the demos switched off, nothing of theirs ships: not the demo script,
  // not the address builder, and no share card that shows their games (the
  // home page then uses og-home-house.png).
  if (!ctx.pragmaticOn) {
    const theirs = ['assets/js/games/pragmatic.js', 'assets/js/lib/pragmatic-url.js', 'assets/img/og-home.png', ...(ctx.pragmaticData.games || []).map((g) => `assets/img/og-${g.slug}.png`)];
    for (const rel of theirs) await fs.rm(path.join(OUT, rel), { force: true });
  }

  /**
   * A safe, dependency-free CSS minifier: drops comments, collapses runs of
   * whitespace and trims it around { } ; and , only. Strings (and so every
   * quoted url(), including the data: URI in 80-tables.css) pass untouched;
   * whitespace inside values such as calc(100% - 7px) stays as one space.
   */
  function minifyCss(css) {
    let out = '';
    for (let i = 0; i < css.length; ) {
      const c = css[i];
      if (c === '/' && css[i + 1] === '*') {
        const end = css.indexOf('*/', i + 2);
        i = end < 0 ? css.length : end + 2;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < css.length && css[j] !== c) j += css[j] === '\\' ? 2 : 1;
        out += css.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      if (/\s/.test(c)) {
        while (i < css.length && /\s/.test(css[i])) i++;
        if (out && !/[{};,\s]$/.test(out) && !/^[{};,]/.test(css[i] || '')) out += ' ';
        continue;
      }
      out += c;
      i++;
    }
    return out.replace(/;}/g, '}').trim() + '\n';
  }

  // Fonts get content-hashed names (archivo.<hash>.woff2). /assets/fonts/* is
  // cached for a year as immutable, so a regenerated font must have a new URL.
  const FONTS = path.join(OUT, 'assets/fonts');
  const fontUrls = new Map();
  for (const f of (await fs.readdir(FONTS).catch(() => [])).filter((f) => f.endsWith('.woff2')).sort()) {
    const hashed = f.replace(/\.woff2$/, `.${hash(await fs.readFile(path.join(FONTS, f)))}.woff2`);
    await fs.rename(path.join(FONTS, f), path.join(FONTS, hashed));
    fontUrls.set(`/assets/fonts/${f}`, `/assets/fonts/${hashed}`);
  }

  // The stylesheet: the site's theme/tokens.css first, then the pack's engine
  // partials (engine/styles/) in order, with the site's theme/concept.css, if
  // any, before the 9x partials, joined into one minified file.
  const tokensFile = path.join(SITE, 'theme/tokens.css');
  const conceptFile = path.join(SITE, 'theme/concept.css');
  const styleFiles = [];
  if (existsSync(tokensFile)) styleFiles.push(tokensFile);
  let conceptAdded = !existsSync(conceptFile);
  for (const p of pack.styles.partials) {
    if (!conceptAdded && /^9/.test(p)) {
      styleFiles.push(conceptFile);
      conceptAdded = true;
    }
    styleFiles.push(path.join(ENGINE, 'styles', p));
  }
  if (!conceptAdded) styleFiles.push(conceptFile);
  if (styleFiles.length) {
    const parts = await Promise.all(styleFiles.map(async (f) => `${(await fs.readFile(f, 'utf8')).trim()}\n`));
    // Per-game cover colours, generated as rules because the CSP blocks inline styles.
    parts.push(`${coverCss()}\n`);
    // @font-face URLs name the fonts' content-hashed files.
    const css = minifyCss(parts.join('\n')).replace(/\/assets\/fonts\/[\w.-]+\.woff2/g, (u) => fontUrls.get(u) || u);
    await write('assets/css/site.css', `/* ${cfg.brand}. Built from src/styles/*.css by build.mjs */\n${css}`);
  }

  // Client config, generated from site.config.json so the browser code has
  // the same brand, currency and analytics settings as the pages.
  await write(
    'assets/js/config.js',
    `// Generated by build.mjs from site.config.json. Don't edit by hand.\nexport default ${JSON.stringify(
      {
        brand: cfg.brand,
        currency: cfg.currency,
        analytics: cfg.analytics,
        contactEndpoint: cfg.contactEndpoint,
        pragmatic: ctx.pragmaticOn ? { enabled: true, demoUrl: cfg.pragmatic.demoUrl, params: cfg.pragmatic.params } : { enabled: false },
      },
      null,
      2,
    )};\n`,
  );

  // Asset version: a hash of every script, the stylesheet and the client
  // config written just above, so a change to any of them (a new analytics ID
  // or contact endpoint included) gives every script and style a new URL.
  const assetFiles = (await walk(path.join(OUT, 'assets'))).filter((f) => /\.(css|js)$/.test(f)).sort();
  const version = hash(...(await Promise.all(assetFiles.map((f) => fs.readFile(f)))));
  setAssetVersion(version);
  const VERSIONED = `assets/v${version}`;
  await fs.mkdir(path.join(OUT, VERSIONED), { recursive: true });
  for (const dir of ['js', 'css']) await fs.rename(path.join(OUT, 'assets', dir), path.join(OUT, VERSIONED, dir)).catch(() => {});

  /**
   * The URLs the build publishes. Pages and page modules name scripts and
   * styles by their source paths (/assets/js/app.js, perhaps with ?v=); the
   * files live under /assets/v<version>/. Fonts get their hashed names.
   */
  const assetUrl = (s) =>
    s
      .replace(/\/assets\/(js|css)\/([\w./-]+?\.(?:js|css))(?:\?v=\w+)?(?![\w./-])/g, `/${VERSIONED}/$1/$2`)
      .replace(/\/assets\/fonts\/[\w.-]+\.woff2/g, (u) => fontUrls.get(u) || u);

  // ---------- 2. pages ----------
  // Legal pages carry their own "Updated" date (site.config.json "legalUpdated",
  // by page), falling back to "lastUpdated" like every other page.
  const LEGAL = ['terms', 'privacy', 'cookies'];
  const dateOf = (key) => cfg.legalUpdated?.[key] || cfg.lastUpdated;
  const datedCtx = (key) => (dateOf(key) === ctx.updatedIso ? ctx : { ...ctx, updatedIso: dateOf(key), updated: longDate(dateOf(key)) });

  // The engine's pages every type shares; the pack orders them among its own.
  const common = {
    about: about(ctx),
    terms: { ...terms(datedCtx('terms')), legal: 'terms' },
    privacy: { ...privacy(datedCtx('privacy')), legal: 'privacy' },
    cookies: { ...cookies(datedCtx('cookies')), legal: 'cookies' },
    contact: contact(ctx),
    notFound: notFound(ctx),
    offline: offline(ctx),
  };
  const pages = pack.pages(ctx, common);

  for (const page of pages) {
    const file = page.file || path.join(page.path, 'index.html');
    page.outFile = file;
    page.lastmod = page.legal ? dateOf(page.legal) : cfg.lastUpdated;
    page.html = assetUrl(
      layout(page.legal ? datedCtx(page.legal) : ctx, page)
        // Wide tables scroll sideways on phones; make each scroll box reachable by keyboard and named after its caption.
        .replace(/<div class="table-wrap">(\s*<table[^>]*>\s*<caption[^>]*>([\s\S]*?)<\/caption>)/g, (m, rest, cap) =>
          `<div class="table-wrap" tabindex="0" role="region" aria-label="${cap.replace(/<[^>]+>/g, '').replace(/"/g, '&quot;').trim()}">${rest}`),
    );
    await write(file, page.html);
  }

  // ---------- 3. site files ----------
  const indexed = pages.filter((p) => p.sitemap !== false);
  await write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexed
      .map((p) => `  <url><loc>${ctx.origin}${p.path}</loc><lastmod>${p.lastmod}</lastmod></url>`)
      .join('\n')}\n</urlset>\n`,
  );
  await write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ctx.origin}/sitemap.xml\n`);
  await write('CNAME', `${cfg.domain}\n`);

  // The pack may adjust the web app manifest (pack.manifest(ctx, manifest)); shortcuts name only games that have a page.
  const manifestOf = (m) => (typeof pack.manifest === 'function' ? pack.manifest(ctx, m) : m);
  await write(
    'manifest.webmanifest',
    JSON.stringify(
      manifestOf({
        name: cfg.brand,
        short_name: cfg.shortName,
        description: `Free-to-play games with virtual ${cfg.currency.plural}. No real money, no prizes. Adults 18+.`,
        id: '/',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        lang: 'en-GB',
        dir: 'ltr',
        background_color: cfg.themeColor.dark,
        theme_color: cfg.themeColor.dark,
        categories: ['games', 'entertainment'],
        icons: [
          { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/assets/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: ctx.games.filter((g) => pages.some((p) => p.path === g.path)).map((g) => ({ name: g.name, url: g.path, icons: [{ src: '/assets/icons/icon-192.png', sizes: '192x192' }] })),
      }),
      null,
      2,
    ),
  );

  // Cloudflare Pages headers. GitHub Pages ignores this file; the pages
  // carry the same Content-Security-Policy in a meta tag.
  //
  // Cloudflare applies every rule whose path matches, in file order, and joins
  // a header that is set twice with a comma. So the broad /assets/* rule comes
  // first, and each narrower rule removes Cache-Control ("! Cache-Control")
  // before setting its own. The lint below keeps it that way.
  await write(
    '_headers',
    `/*
  Content-Security-Policy: ${csp(ctx)}; frame-ancestors 'none'; upgrade-insecure-requests
  Strict-Transport-Security: max-age=63072000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
  Cross-Origin-Opener-Policy: same-origin

/assets/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=604800

/assets/v*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable

/assets/fonts/*.woff2
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable

/assets/img/*
  ! Cache-Control
  Cache-Control: public, max-age=2592000

/sw.js
  Cache-Control: no-cache
`,
  );

  // Service worker. It precaches what the offline page promises works without
  // a connection: the home page, our own games, the safer-play tools and the
  // offline page itself, with every script, style and font they use. Other
  // pages are saved as they're visited. The Pragmatic Play demo pages stay
  // out: their demos need a connection anyway.
  const OFFLINE_PAGES = ['/', '/offline/', '/responsible-gaming/', ...ctx.houseGames.map((g) => g.path)];
  // data-game="…" → the module app.js loads for it, read from app.js's GAMES table.
  const appJs = await fs.readFile(path.join(OUT, VERSIONED, 'js/app.js'), 'utf8');
  const gameModules = new Map(
    [...appJs.matchAll(/['"]?([\w-]+)['"]?\s*:\s*\(\)\s*=>\s*import\(\s*['"]\.\/([^'"]+)['"]\s*\)/g)].map((m) => [m[1], `${VERSIONED}/js/${m[2]}`]),
  );
  const precacheEntries = new Set(['/favicon.svg', '/manifest.webmanifest', '/assets/icons/icon-192.png']);
  const offlineModules = [];
  for (const p of OFFLINE_PAGES) {
    const page = pages.find((x) => x.path === p);
    if (!page) continue;
    precacheEntries.add(p);
    // The stylesheet, fonts, theme-boot.js, app.js and the page's modulepreloads…
    for (const m of page.html.matchAll(/(?:href|src)="\/((?:assets\/v[^/"]+|assets\/fonts)\/[^"#?]+)"/g)) {
      if (m[1].endsWith('.js')) offlineModules.push(m[1]);
      else precacheEntries.add(`/${m[1]}`);
    }
    // …the game modules app.js loads for the page's data-game roots, and the lobby.
    for (const m of page.html.matchAll(/\sdata-game="([\w-]+)"/g)) if (gameModules.has(m[1])) offlineModules.push(gameModules.get(m[1]));
    for (const m of page.budgetModules || []) offlineModules.push(assetUrl(m).slice(1));
  }
  // …and everything those modules import.
  for (const m of await moduleGraph(offlineModules)) precacheEntries.add(`/${m}`);
  const precache = [...precacheEntries].sort();
  const fileOf = (u) => path.join(OUT, u.endsWith('/') ? `${u}index.html` : u);
  const swTemplate = await fs.readFile(path.join(ENGINE, 'sw.template.js'), 'utf8');
  // The worker's version covers the bytes of everything it precaches, so any change to them installs a new worker.
  const swHash = hash(swTemplate, ...(await Promise.all(precache.map((u) => fs.readFile(fileOf(u)).catch(() => `missing ${u}`)))));
  await write('sw.js', swTemplate.replace('__VERSION__', swHash).replace('__PRECACHE__', JSON.stringify(precache, null, 2)));

  // ---------- 4. lint ----------
  // Engine rules report here with bare ids; the pack's rules run at the
  // phases named below (engine/lib/pack.mjs PHASES), so every message keeps
  // its place in the report.
  const AMERICAN = [/\bcolor\b/i, /\bfavor/i, /\bcenter\b/i, /\bbehavior/i, /\bgray\b/i, /\borganization\b/i, /\bcatalog\b/i, /\blicense\b/i, /\banalyz/i, /\bcustomiz/i, /\boptimiz/i, /\bjewelry\b/i];

  // Apostrophes: the copy uses ’ (U+2019); a straight ' beside it looks
  // different in the self-hosted fonts. Checked in the text people see or
  // hear on every page (entities decoded first, plus the attributes that are
  // shown or read out) and in the strings the scripts show at run time.
  // Straight apostrophes in the chrome's own scripts fail the build; the rest
  // are counted in one warning until that copy has been converted. Paths are
  // the source ones (assets/js/…): the build publishes scripts under
  // assets/v<version>/js/, and webPath() maps them back.
  const STRICT_APOSTROPHES = /^assets\/js\/(app|age-boot)\.js$|^assets\/js\/lib\/(rg|ui|age|consent|settings|store|session|format)\.js$/;
  const apostrophes = new Map(); // file → examples
  const webPath = (rel) => rel.split(path.sep).join('/').replace(/^assets\/v[^/]+\//, 'assets/');
  const SHOWN_ATTRS = /\s(?:aria-label|title|alt|placeholder)="([^"]*)"|<meta\s+(?:name|property)="(?:description|og:[a-z:_]+|twitter:[a-z:_]+)"\s+content="([^"]*)"/g;
  function straightApostrophes(rel, src) {
    const found = [];
    if (/\.html$/.test(rel)) {
      const decoded = src.replace(/&#39;|&#x27;|&apos;/gi, "'");
      const text = [
        visibleText(decoded),
        ...[...decoded.replace(/<script[\s\S]*?<\/script>/g, ' ').matchAll(SHOWN_ATTRS)].map((m) => m[1] ?? m[2]),
        (decoded.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '',
      ].join(' ');
      for (const m of text.matchAll(/'/g)) found.push(text.slice(Math.max(0, m.index - 24), m.index + 24).replace(/\s+/g, ' ').trim());
    } else if (/^assets\/js\/.*\.js$/.test(rel)) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
      for (const m of code.matchAll(/[A-Za-z]\\?'[A-Za-z]/g)) found.push(code.slice(Math.max(0, m.index - 24), m.index + 24).trim());
    }
    return found;
  }

  // Glyph coverage: every character above U+007E that a page shows, a script
  // puts on screen or the stylesheet draws must be in both self-hosted fonts
  // (data/font-coverage.json in the site folder, written by
  // engine/tools/subset-fonts.py). Otherwise the browser draws it in a
  // fallback face.
  const coverageFile = path.join(SITE, 'data/font-coverage.json');
  const coverage = JSON.parse(await fs.readFile(coverageFile, 'utf8').catch(() => '{}'));
  const covered = new Set((coverage.codepoints || []).map((u) => parseInt(String(u).replace(/^U\+/i, ''), 16)));
  if (!covered.size) report.error('font-coverage', `${path.relative(SITE, coverageFile)}: missing or empty (run engine/tools/subset-fonts.py)`);
  const GLYPH_HINTS = {
    0x2011: 'use a plain hyphen inside <span class="nobr">',
    0x2009: 'use a normal or no-break space',
  };

  // The theme's tokens: the site's theme/tokens.css defines every custom
  // property in engine/styles/tokens.contract.json.
  {
    const contract = JSON.parse(await fs.readFile(path.join(ENGINE, 'styles/tokens.contract.json'), 'utf8'));
    const tokens = await fs.readFile(tokensFile, 'utf8').catch(() => null);
    if (tokens === null) report.error('token-contract', 'theme/tokens.css: missing (every site defines the engine\'s design tokens there)');
    else {
      const defined = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
      const missing = contract.properties.filter((p) => !defined.has(p));
      if (missing.length) report.error('token-contract', `theme/tokens.css: doesn't define ${missing.length} contract properties: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`);
    }
  }

  const files = await walk(OUT);
  for (const f of files) {
    if (!/\.(html|js|json|webmanifest|css|txt|xml)$/.test(f)) continue;
    const rel = path.relative(OUT, f);
    const src = await fs.readFile(f, 'utf8');
    const isHtml = /\.html$/.test(f);
    const text = isHtml ? visibleText(src) : src;
    await runPhase('file', { file: f, rel, src, text, isHtml });
    if (isHtml) for (const re of AMERICAN) if (re.test(text)) report.error('spelling', `${rel}: American spelling ${re}`);
    // Glyph coverage (see GLYPH_HINTS above for U+2011, the non-breaking hyphen).
    const drawn = isHtml ? pageText(src) : /\.js$/.test(f) && rel !== 'sw.js' ? scriptStrings(src) : /\.css$/.test(f) ? styleText(src) : '';
    if (isHtml) for (const e of unknownEntities(src)) report.error('html-entity', `${rel}: the entity &${e}; (write the character itself, so the glyph check can see it)`);
    if (covered.size) {
      for (const [cp, n] of uncovered(drawn, covered)) {
        report.error('glyph-coverage', `${rel}: ${describe(cp)} (${n}×) isn't in the self-hosted fonts, so it would be drawn in a fallback face${GLYPH_HINTS[cp] ? `; ${GLYPH_HINTS[cp]}` : '; reword, or add it to engine/tools/subset-fonts.py and regenerate the fonts'}`);
      }
    }
    const web = webPath(rel);
    const straight = straightApostrophes(web, src);
    if (straight.length && STRICT_APOSTROPHES.test(web)) report.error('apostrophes', `${rel}: straight apostrophe in a UI string (use ’): ${straight.slice(0, 3).map((t) => `"${t}"`).join(', ')}`);
    else if (straight.length) apostrophes.set(rel, straight);
    await runPhase('file-end', { file: f, rel, src, text, isHtml });
  }
  if (apostrophes.size) {
    const n = [...apostrophes.values()].reduce((a, l) => a + l.length, 0);
    const [file, [example]] = apostrophes.entries().next().value;
    report.warn('apostrophes', `${n} straight apostrophes (') in the copy of ${apostrophes.size} files, for example ${file}: "${example}" (use ’)`);
  }

  for (const page of pages) {
    const s = page.html;
    const rel = page.outFile;
    const h1s = (s.match(/<h1[\s>]/g) || []).length;
    if (h1s !== 1) report.error('h1', `${rel}: ${h1s} <h1> elements`);
    if (page.title.length > 60) report.error('title-length', `${rel}: title is ${page.title.length} characters`);
    if (page.description.length > 155) report.error('description-length', `${rel}: description is ${page.description.length} characters`);
    if (!s.includes('lang="en-GB"')) report.error('lang', `${rel}: missing lang="en-GB"`);
    if (page.canonical !== false && !s.includes('rel="canonical"')) report.error('canonical', `${rel}: no canonical`);
    await runPhase('page', { page, html: s, rel });
    for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let data;
      try { data = JSON.parse(m[1]); } catch (e) { report.error('jsonld', `${rel}: invalid JSON-LD (${e.message})`); continue; }
      // Every {"@id"} reference resolves to a node in the same page's graph (validators don't follow an @id to another page).
      const defined = new Set();
      const refs = new Set();
      const walkLd = (v) => {
        if (Array.isArray(v)) return v.forEach(walkLd);
        if (!v || typeof v !== 'object') return;
        const keys = Object.keys(v);
        if (keys.length === 1 && keys[0] === '@id') refs.add(v['@id']);
        else if (v['@id']) defined.add(v['@id']);
        keys.forEach((k) => walkLd(v[k]));
      };
      walkLd(data);
      for (const id of refs) if (!defined.has(id)) report.error('jsonld', `${rel}: JSON-LD points at {"@id": "${id}"}, which this page doesn't define`);
      for (const node of data['@graph'] || [data]) {
        if (node['@type'] === 'VideoGame') {
          const ok = node.isAccessibleForFree === true && node.offers?.price === 0 && node.gamePlatform === 'Web browser' && node.name && node.url;
          if (!ok) report.error('jsonld', `${rel}: VideoGame JSON-LD is missing isAccessibleForFree, offers.price 0 or gamePlatform`);
        }
        if (node['@type'] === 'BreadcrumbList' && !node.itemListElement?.every((i, k) => i.position === k + 1 && i.item?.startsWith(ctx.origin))) {
          report.error('jsonld', `${rel}: BreadcrumbList positions or URLs are wrong`);
        }
      }
    }
    // internal links and assets must exist
    for (const m of s.matchAll(/(?:href|src|srcset)="(\/[^"#?]*)/g)) {
      for (const part of m[1].split(/,\s*/)) {
        const url = part.split(' ')[0];
        if (!url.startsWith('/')) continue;
        const target = url.endsWith('/') ? path.join(OUT, url, 'index.html') : path.join(OUT, url);
        try { await fs.access(target); } catch {
          if (!/\/assets\/(img|icons)\/|favicon\.ico/.test(url)) report.error('broken-link', `${rel}: broken link ${url}`);
          else report.warn('missing-image', `${rel}: missing image ${url} (run npm run images)`);
        }
      }
    }
  }

  // ---------- 4b. markup: ids, CSP-safe markup, the notices, share images ----------
  // The CSP is script-src 'self' and style-src 'self': no style attributes (in
  // HTML or SVG), no <style> elements, no inline event handlers and no inline
  // scripts other than JSON-LD and the ones the CSP names by hash.
  const IDREFS = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage', 'for', 'popovertarget', 'list', 'form'];
  const idsByPage = new Map(pages.map((p) => [p.path, new Set(tagsOf(p.html).map((t) => t.attrs.id).filter(Boolean))]));
  const pngSize = async (file) => {
    const b = await fs.readFile(file);
    return b.toString('ascii', 1, 4) === 'PNG' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
  };

  for (const page of pages) {
    const s = page.html;
    const rel = page.outFile;
    const tags = tagsOf(s);
    const ids = idsByPage.get(page.path);

    // ids: unique, and every reference to one points at something on the page
    const seen = new Map();
    for (const t of tags) if ('id' in t.attrs) seen.set(t.attrs.id, (seen.get(t.attrs.id) || 0) + 1);
    for (const [id, n] of seen) {
      if (!id) report.error('ids', `${rel}: empty id attribute`);
      else if (n > 1) report.error('ids', `${rel}: duplicate id "${id}" (${n} times)`);
    }
    for (const t of tags) {
      for (const a of IDREFS) {
        if (!(a in t.attrs) || (a === 'for' && t.name === 'output')) continue;
        for (const ref of t.attrs[a].split(/\s+/).filter(Boolean)) if (!ids.has(ref)) report.error('ids', `${rel}: <${t.name} ${a}="${t.attrs[a]}"> points at no id "${ref}"`);
      }
      const href = t.name === 'a' ? t.attrs.href : undefined;
      if (href?.includes('#') && href.length > 1) {
        const [where, frag] = href.split('#');
        const target = where === '' ? page.path : where.startsWith('/') ? where : null;
        const theirs = target && idsByPage.get(target);
        if (theirs && frag && !theirs.has(decodeURIComponent(frag))) report.error('fragment-link', `${rel}: link ${href} points at no id "${frag}" on ${target}`);
      }
      // CSP: nothing inline
      if ('style' in t.attrs) report.error('csp-inline', `${rel}: inline style attribute on <${t.name}${t.attrs.class ? ` class="${t.attrs.class}"` : ''}> (the CSP blocks it)`);
      for (const a of Object.keys(t.attrs)) if (/^on[a-z]+$/.test(a)) report.error('csp-inline', `${rel}: inline event handler ${a} on <${t.name}> (the CSP blocks it)`);
      if (/^\s*javascript:/i.test(t.attrs.href || '')) report.error('csp-inline', `${rel}: javascript: link (the CSP blocks it)`);
      if (t.name === 'style') report.error('csp-inline', `${rel}: <style> element (the CSP blocks it; put the rules in engine/styles/ or the site's theme/)`);
      // Nothing is fetched from another origin before the visitor asks for it.
      const fetched = { img: 'src', script: 'src', iframe: 'src', source: 'src', video: 'src', audio: 'src', embed: 'src', object: 'data' }[t.name]
        || (t.name === 'link' && /\b(stylesheet|preload|modulepreload|prefetch|preconnect|dns-prefetch|icon|manifest|apple-touch-icon)\b/.test(t.attrs.rel || '') ? 'href' : null);
      if (fetched && /^(https?:)?\/\//.test(t.attrs[fetched] || '')) report.error('third-party-before-interaction', `${rel}: <${t.name} ${fetched}="${t.attrs[fetched]}"> loads from another origin before interaction`);
    }

    // The type's notices that open every page (social casino: the age ribbon).
    await runPhase('markup-chrome', { page, html: s, rel, tags });

    // Share images exist, at the size the page says.
    const meta = (p) => tags.find((t) => t.name === 'meta' && (t.attrs.property === p || t.attrs.name === p))?.attrs.content;
    for (const key of ['og:image', 'twitter:image']) {
      const url = meta(key);
      if (!url) {
        report.error('share-image', `${rel}: no ${key}`);
        continue;
      }
      if (!url.startsWith(`${ctx.origin}/`)) {
        report.error('share-image', `${rel}: ${key} ${url} is not on ${ctx.origin}`);
        continue;
      }
      const file = path.join(OUT, url.slice(ctx.origin.length));
      const size = await pngSize(file).catch(() => undefined);
      if (size === undefined) report.error('share-image', `${rel}: ${key} ${url.slice(ctx.origin.length)} is not in the build`);
      else if (key === 'og:image' && size && (size.w !== Number(meta('og:image:width')) || size.h !== Number(meta('og:image:height')))) {
        report.error('share-image', `${rel}: og:image is ${size.w}×${size.h}, the page says ${meta('og:image:width')}×${meta('og:image:height')}`);
      }
    }
    for (const m of s.matchAll(/"(?:image|logo)":"(https:[^"]+)"/g)) {
      if (m[1].startsWith(`${ctx.origin}/`)) await fs.access(path.join(OUT, m[1].slice(ctx.origin.length))).catch(() => report.error('share-image', `${rel}: JSON-LD image ${m[1]} is not in the build`));
    }

    const policy = tags.find((t) => t.name === 'meta' && t.attrs['http-equiv'] === 'Content-Security-Policy')?.attrs.content;
    // An inline script runs only if the CSP names the hash of its exact text (JSON-LD is data and isn't run).
    const scriptSrc = policy ? cspOf(policy)['script-src'] || [] : [];
    for (const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/\ssrc=/.test(m[1]) || /type="application\/ld\+json"/.test(m[1])) continue;
      const scriptHash = `'sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}'`;
      if (!scriptSrc.includes(scriptHash)) report.error('csp-inline', `${rel}: inline <script${m[1]}> whose hash isn't in the CSP's script-src (the CSP blocks it)`);
    }
    if (!policy) report.error('csp-meta', `${rel}: no Content-Security-Policy meta tag`);

    // The type's page rules on the finished markup (social casino: demo hosts in the CSP, footer trademark line, demo stages).
    await runPhase('markup', { page, html: s, rel, tags, policy });
  }

  // The type's site-wide rules (social casino: the hosting headers' demo hosts, data/pragmatic-games.json).
  await runPhase('site', { files, pages });

  for (const [k, v] of Object.entries(cfg.operator)) {
    if (/\[.*\]/.test(v)) report.strict('placeholder', `site.config.json: operator.${k} is still a placeholder: "${v}"`);
  }

  // The type's config rules (social casino: written consent, Ads with demos, lobby filters).
  await runPhase('config', { pages });

  // Dates. Legal pages may carry their own ("legalUpdated"); a legal page whose
  // source or whose deciding config (the demos, analytics) changed after its
  // date gets a warning, from git history when it's there.
  {
    const REL = 'site.config.json';
    if (!ISO_DATE.test(cfg.lastUpdated || '')) report.error('dates', `${REL}: lastUpdated must be a date like "2026-09-26"`);
    else if (cfg.lastUpdated > today) report.error('dates', `${REL}: lastUpdated (${cfg.lastUpdated}) is in the future`);
    for (const [k, v] of Object.entries(cfg.legalUpdated || {})) {
      if (!LEGAL.includes(k)) report.error('dates', `${REL}: legalUpdated.${k} isn't a legal page (${LEGAL.join(', ')})`);
      else if (!ISO_DATE.test(v)) report.error('dates', `${REL}: legalUpdated.${k} must be a date like "2026-09-26"`);
      else if (v > today) report.error('dates', `${REL}: legalUpdated.${k} (${v}) is in the future`);
    }
    const git = (cwd, ...args) => {
      const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
      return r.status === 0 ? r.stdout.trim() : null;
    };
    /** The date of the last commit that changed a file's content (renames don't count). */
    const lastContentChange = (cwd, file) => {
      const log = git(cwd, 'log', '--follow', '--format=%x00%as', '--numstat', '--', file);
      for (const entry of (log || '').split('\0').slice(1)) {
        const [date, ...stats] = entry.trim().split('\n');
        if (stats.some((l) => /^(\d+|-)\t(\d+|-)\t/.test(l) && !/^0\t0\t/.test(l))) return date;
      }
      return null;
    };
    // A shallow clone (as in CI) has no history to go by.
    if (git(SITE, 'rev-parse', '--is-shallow-repository') === 'false') {
      const DECIDING = /^[+-].*"(enabled|ga4|adsConversionId)"/m;
      const configChanged = DECIDING.test(git(SITE, 'diff', '-U0', 'HEAD', '--', 'site.config.json') || '') ? today : git(SITE, 'log', '-1', '--follow', '--format=%as', '-G', '"(enabled|ga4|adsConversionId)"', '--', 'site.config.json');
      for (const key of LEGAL) {
        const file = `pages/${key}.mjs`;
        const pageChanged = git(ENGINE, 'status', '--porcelain', '--', file) ? today : lastContentChange(ENGINE, file);
        const changed = [pageChanged, configChanged].filter(Boolean).sort().at(-1);
        if (changed && changed > dateOf(key)) {
          report.warn('legal-date', `engine/${file}: the ${key} page changed on ${changed}, after its "Updated" date (${dateOf(key)}). Set ${REL} "legalUpdated": { "${key}": "${changed}" } or "lastUpdated", and rebuild.`);
        }
      }
    }
  }

  // Asset URLs: every script and style a page names is under /assets/v<version>/,
  // and no script builds an unversioned one itself.
  for (const page of pages) {
    for (const m of page.html.matchAll(/["'(=]((?:https?:\/\/[^/"']+)?\/assets\/(?:js|css)\/[^"')\s]*|\/[^"')\s]*\?v=[^"')\s]*)/g)) {
      report.error('unversioned-asset', `${page.outFile}: unversioned script or style URL ${m[1]} (the build moves /assets/js/ and /assets/css/ to /${VERSIONED}/)`);
    }
  }
  for (const f of files.filter((f) => f.endsWith('.js'))) {
    for (const m of (await fs.readFile(f, 'utf8')).matchAll(/['"`](\/assets\/(?:js|css)\/[^'"`]*)/g)) {
      report.error('unversioned-asset', `${path.relative(OUT, f)}: names ${m[1]}, which doesn't exist in the build (import it relatively, e.g. './lib/x.js')`);
    }
  }

  // Hosting headers: exactly one max-age for every file (Cloudflare would join
  // two rules' values with a comma), and year-long immutable caching only
  // where the URL changes with the content.
  {
    const rules = parseHeaders(await fs.readFile(path.join(OUT, '_headers'), 'utf8'));
    const urls = files.map((f) => `/${path.relative(OUT, f).split(path.sep).join('/')}`);
    for (const u of new Set([...urls, ...rules.map((r) => r.path.replace(/\*/g, 'x'))])) {
      const cc = cacheControlFor(rules, u);
      if ((cc.match(/max-age=/g) || []).length > 1) report.error('headers', `_headers: ${u} would be sent "Cache-Control: ${cc}". Put the broad rule first and start the narrower one with "! Cache-Control".`);
    }
    for (const u of urls) {
      const fingerprinted = u.startsWith(`/${VERSIONED}/`) || [...fontUrls.values()].includes(u);
      if (/immutable/.test(cacheControlFor(rules, u)) && !fingerprinted) report.error('headers', `_headers: ${u} is cached for a year as immutable, but its URL doesn't change with its content`);
    }
  }

  // First-view budget on the home page: HTML + CSS + every JS module it loads.
  const homePage = pages[0];
  const firstView = await moduleGraph([`${VERSIONED}/js/age-boot.js`, `${VERSIONED}/js/app.js`, ...[...(homePage.modules || []), ...(homePage.budgetModules || [])].map((m) => assetUrl(m).slice(1))]);
  let budget = gz(Buffer.from(homePage.html)) + gz(await fs.readFile(path.join(OUT, VERSIONED, 'css/site.css')));
  for (const m of firstView) {
    try { budget += gz(await fs.readFile(path.join(OUT, m))); } catch {}
  }
  if (budget > 150 * 1024) report.error('first-view-budget', `home first view is ${kb(budget)} gzip, over the 150 KB budget`);

  // The service worker's precache: every file exists, and a first visit
  // doesn't download much more than it looked at.
  let precacheBytes = 0;
  for (const u of precache) {
    try {
      precacheBytes += gz(await fs.readFile(fileOf(u)));
    } catch {
      report.error('precache', `sw.js: precaches ${u}, which isn't in the build`);
    }
  }
  if (precacheBytes > PRECACHE_BUDGET * 1024) report.error('precache-budget', `sw.js: the precache is ${kb(precacheBytes)} gzip, over its ${PRECACHE_BUDGET} KB budget (${precache.length} files)`);

  // ---------- 5. report ----------
  say(`Built ${pages.length} pages into ${(path.relative(process.cwd(), OUT).startsWith('..') ? OUT : path.relative(process.cwd(), OUT)) || '.'}/ (assets v${version}, sw ${swHash})`);
  say(`Home first view (HTML + CSS + ${firstView.length} JS modules): ${kb(budget)} gzip of 150 KB budget`);
  say(`Service worker precache (${precache.length} files for offline use): ${kb(precacheBytes)} gzip of ${PRECACHE_BUDGET} KB budget`);
  const warnings = printableWarnings(report.warnings);
  for (const w of warnings) console.warn(`warning: ${w.message}`);
  const { problems } = report;
  for (const p of problems) console.error(`error: ${p.message}`);
  if (!problems.length) say('Lint: no problems found.');
  if (opts.json) {
    const result = {
      ok: problems.length === 0,
      site: SITE,
      type,
      pack: { id: pack.id, version: pack.version, status: pack.status },
      strict,
      out: OUT,
      version,
      sw: swHash,
      schema: schema.validator,
      pages: pages.map((p) => ({ id: p.id, path: p.path, file: p.outFile })),
      budgets: { firstViewKb: Number((budget / 1024).toFixed(1)), precacheKb: Number((precacheBytes / 1024).toFixed(1)), precacheFiles: precache.length },
      problems,
      warnings,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
  if (problems.length) process.exitCode = 1;
}

main().catch((e) => {
  const usage = e instanceof UsageError;
  const message = usage ? e.message || USAGE : e && e.stack ? e.stack : String(e);
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ ok: false, problems: [{ rule: usage ? 'usage' : 'build-crash', level: 'error', message }], warnings: [], out: null, pages: [] }, null, 2)}\n`);
  }
  console.error(usage ? `${e.message ? `error: ${e.message}\n` : ''}${USAGE}` : `error: ${message}`);
  process.exit(usage ? 2 : 1);
});
