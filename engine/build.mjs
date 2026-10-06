#!/usr/bin/env node
// Static site build. No dependencies: Node 20 or later.
//
//   node build.mjs                  build into dist/
//   node build.mjs --strict         the launch build: also fail on placeholder
//                                   operator details and, while the Pragmatic
//                                   Play demos are on, on an empty
//                                   pragmatic.writtenConsent, a Google Ads ID
//                                   or any demo whose facts nobody has checked
//                                   ("checked" in src/data/pragmatic-games.json)
//   node build.mjs --no-pragmatic   build with the Pragmatic Play demos switched
//                                   off (our own slot, Seven Systems, instead)
//
//   SITE_CONFIG=path  read another config file instead of site.config.json
//   OUT_DIR=path      build somewhere other than dist/
//
// Reads site.config.json, renders every page to plain HTML, copies
// src/public, and writes sitemap, robots, manifest, service worker and
// hosting headers. Then it lints the output against the site's rules and
// ends with "Lint: no problems found." or exits 1.
//
// Caching: scripts and the stylesheet are published under
// /assets/v<version>/, where the version is a hash of every script, the
// stylesheet and the client config, and fonts get content-hashed names. A
// changed file therefore always has a new URL, so those URLs can be cached
// for a year, and a returning visitor never runs old scripts against new
// pages. Source files keep plain paths (/assets/js/app.js); the build
// rewrites them in the pages it writes.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { makeContext } from './src/lib/context.mjs';
import { longDate } from './src/lib/html.mjs';
import { FILTERS } from './src/lib/ui/tiles.mjs';
import { layout, setAssetVersion, csp } from './src/lib/layout.mjs';
import { parseHeaders, cacheControlFor } from './tools/lib/headers.mjs';
import { pageText, scriptStrings, styleText, uncovered, describe, unknownEntities } from './tools/lib/glyphs.mjs';
import home from './src/pages/home.mjs';
import gamesIndex from './src/pages/games-index.mjs';
import sevenSystems from './src/pages/seven-systems.mjs';
import pragmaticGame from './src/pages/pragmatic-game.mjs';
import { coverCss, COVERS } from './src/lib/art.mjs';
import lapidaryWheel from './src/pages/lapidary-wheel.mjs';
import brilliant21 from './src/pages/brilliant-twenty-one.mjs';
import about from './src/pages/about.mjs';
import responsibleGaming from './src/pages/responsible-gaming.mjs';
import terms from './src/pages/terms.mjs';
import privacy from './src/pages/privacy.mjs';
import cookies from './src/pages/cookies.mjs';
import contact from './src/pages/contact.mjs';
import { notFound, offline } from './src/pages/misc.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(ROOT, process.env.OUT_DIR || 'dist');
const PUBLIC = path.join(ROOT, 'src/public');
const strict = process.argv.includes('--strict');

const cfg = JSON.parse(await fs.readFile(path.resolve(ROOT, process.env.SITE_CONFIG || 'site.config.json'), 'utf8'));
if (process.argv.includes('--no-pragmatic')) cfg.pragmatic = { ...cfg.pragmatic, enabled: false };
const ctx = makeContext(cfg);

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
// The facts a Pragmatic Play page can mark with data-verify (src/pages/pragmatic-game.mjs).
const VERIFIABLE = ['grid', 'pays', 'volatility', 'topPayout', 'rtp', 'released', 'bonus'];

const pragmaticJson = JSON.parse(await fs.readFile(path.join(ROOT, 'src/data/pragmatic-games.json'), 'utf8'));

// ---------- 1. copy public files ----------
await fs.rm(OUT, { recursive: true, force: true });
await fs.cp(PUBLIC, OUT, { recursive: true });
// With the demos switched off, nothing of theirs ships: not the demo script,
// not the address builder, and no share card that shows their games (the
// home page then uses og-home-house.png).
if (!ctx.pragmaticOn) {
  const theirs = ['assets/js/games/pragmatic.js', 'assets/js/lib/pragmatic-url.js', 'assets/img/og-home.png', ...(pragmaticJson.games || []).map((g) => `assets/img/og-${g.slug}.png`)];
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

// The stylesheet is written as partials in src/styles/, joined in file-name
// order (00-tokens.css, 10-base.css, …) into one minified file for the browser.
const STYLES = path.join(ROOT, 'src/styles');
const partials = (await fs.readdir(STYLES).catch(() => [])).filter((f) => f.endsWith('.css')).sort();
if (partials.length) {
  const parts = await Promise.all(partials.map(async (f) => `${(await fs.readFile(path.join(STYLES, f), 'utf8')).trim()}\n`));
  // Per-game cover colours, generated as rules because the CSP blocks inline styles.
  parts.push(`${coverCss()}\n`);
  // @font-face URLs name the fonts' content-hashed files.
  const css = minifyCss(parts.join('\n')).replace(/\/assets\/fonts\/[\w.-]+\.woff2/g, (u) => fontUrls.get(u) || u);
  await write('assets/css/site.css', `/* Opal Quest Lounge. Built from src/styles/*.css by build.mjs */\n${css}`);
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
for (const dir of ['js', 'css']) await fs.rename(path.join(OUT, 'assets', dir), path.join(OUT, VERSIONED, dir));

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

const HOUSE_PAGES = { 'seven-systems': sevenSystems, 'lapidary-wheel': lapidaryWheel, 'brilliant-twenty-one': brilliant21 };
const pages = [
  home(ctx),
  gamesIndex(ctx),
  ...ctx.games.map((g) => (g.provider === 'pragmatic' ? pragmaticGame(ctx, g) : HOUSE_PAGES[g.slug](ctx))),
  about(ctx),
  responsibleGaming(ctx),
  { ...terms(datedCtx('terms')), legal: 'terms' },
  { ...privacy(datedCtx('privacy')), legal: 'privacy' },
  { ...cookies(datedCtx('cookies')), legal: 'cookies' },
  contact(ctx),
  notFound(ctx),
  offline(ctx),
];

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

await write(
  'manifest.webmanifest',
  JSON.stringify(
    {
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
      shortcuts: ctx.games.map((g) => ({ name: g.name, url: g.path, icons: [{ src: '/assets/icons/icon-192.png', sizes: '192x192' }] })),
    },
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
const swTemplate = await fs.readFile(path.join(ROOT, 'src/sw.template.js'), 'utf8');
// The worker's version covers the bytes of everything it precaches, so any change to them installs a new worker.
const swHash = hash(swTemplate, ...(await Promise.all(precache.map((u) => fs.readFile(fileOf(u)).catch(() => `missing ${u}`)))));
await write('sw.js', swTemplate.replace('__VERSION__', swHash).replace('__PRECACHE__', JSON.stringify(precache, null, 2)));

// ---------- 4. lint ----------
const problems = [];
const warnings = [];
const visibleText = (s) =>
  s
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<code>[\s\S]*?<\/code>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');

// The last one: no ranking the games against each other ("the highest of the
// games here"). It draws attention to the biggest payout, and the line-up changes.
const FORBIDDEN = [/\bdeposit/i, /\bwithdraw/i, /cash[\s-]?out/i, /bonus code/i, /real[\s-]money wins?/i, /win big/i, /jackpot/i, /\bhurry\b/i, /don[’']t miss out/i,
  /\b(highest|biggest|largest|best)\b[^.]{0,40}\b(of the games|on the site|here)\b/i];
const AMERICAN = [/\bcolor\b/i, /\bfavor/i, /\bcenter\b/i, /\bbehavior/i, /\bgray\b/i, /\borganization\b/i, /\bcatalog\b/i, /\blicense\b/i, /\banalyz/i, /\bcustomiz/i, /\boptimiz/i, /\bjewelry\b/i];

// Apostrophes: the copy uses ’ (U+2019); a straight ' beside it looks
// different in Archivo and Radio Canada. Checked in the text people see or
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
// (src/data/font-coverage.json, written by tools/subset-fonts.py).
// Otherwise the browser draws it in a fallback face.
const coverageFile = path.join(ROOT, 'src/data/font-coverage.json');
const coverage = JSON.parse(await fs.readFile(coverageFile, 'utf8').catch(() => '{}'));
const covered = new Set((coverage.codepoints || []).map((u) => parseInt(String(u).replace(/^U\+/i, ''), 16)));
if (!covered.size) problems.push(`${path.relative(ROOT, coverageFile)}: missing or empty (run tools/subset-fonts.py)`);
const GLYPH_HINTS = {
  0x2011: 'use a plain hyphen inside <span class="nobr">',
  0x2009: 'use a normal or no-break space',
};

const files = await walk(OUT);
for (const f of files) {
  if (!/\.(html|js|json|webmanifest|css|txt|xml)$/.test(f)) continue;
  const rel = path.relative(OUT, f);
  const src = await fs.readFile(f, 'utf8');
  const text = /\.html$/.test(f) ? visibleText(src) : src;
  for (const re of FORBIDDEN) if (re.test(text)) problems.push(`${rel}: forbidden wording ${re} ("${text.match(re)[0].replace(/\s+/g, ' ')}")`);
  // With the demos off, no script or data file points at Pragmatic Play's servers (pages: see 4b).
  if (!ctx.pragmaticOn && !/\.html$/.test(f) && /pragmaticplay\.net/.test(src)) problems.push(`${rel}: mentions pragmaticplay.net while the demos are switched off`);
  // With them on, the pages still carry no playable demo address: a demo opened
  // outside our page would escape the session clock, reality checks and limits.
  if (/\.html$/.test(f) && /openGame\.do/.test(src)) problems.push(`${rel}: contains a playable Pragmatic Play demo address (openGame.do); only pragmatic.js builds it, after Play`);
  if (/\.html$/.test(f)) for (const re of AMERICAN) if (re.test(text)) problems.push(`${rel}: American spelling ${re}`);
  // Glyph coverage (see GLYPH_HINTS above for U+2011, the non-breaking hyphen).
  const drawn = /\.html$/.test(f) ? pageText(src) : /\.js$/.test(f) && rel !== 'sw.js' ? scriptStrings(src) : /\.css$/.test(f) ? styleText(src) : '';
  if (/\.html$/.test(f)) for (const e of unknownEntities(src)) problems.push(`${rel}: the entity &${e}; (write the character itself, so the glyph check can see it)`);
  if (covered.size) {
    for (const [cp, n] of uncovered(drawn, covered)) {
      problems.push(`${rel}: ${describe(cp)} (${n}\u00d7) isn't in the self-hosted fonts, so it would be drawn in a fallback face${GLYPH_HINTS[cp] ? `; ${GLYPH_HINTS[cp]}` : '; reword, or add it to tools/subset-fonts.py and regenerate the fonts'}`);
    }
  }
  const web = webPath(rel);
  const straight = straightApostrophes(web, src);
  if (straight.length && STRICT_APOSTROPHES.test(web)) problems.push(`${rel}: straight apostrophe in a UI string (use ’): ${straight.slice(0, 3).map((t) => `"${t}"`).join(', ')}`);
  else if (straight.length) apostrophes.set(rel, straight);
  // GambleAware closed on 31 March 2026: signpost GamCare and the NHS instead.
  if (/\.html$/.test(f) && /href="https?:\/\/(?:www\.)?(?:be)?gambleaware\.org/i.test(src)) problems.push(`${rel}: links to (Be)GambleAware, which closed in March 2026 (use GamCare or the NHS)`);
}
if (apostrophes.size) {
  const n = [...apostrophes.values()].reduce((a, l) => a + l.length, 0);
  const [file, [example]] = apostrophes.entries().next().value;
  warnings.push(`${n} straight apostrophes (') in the copy of ${apostrophes.size} files, for example ${file}: "${example}" (use ’)`);
}

for (const page of pages) {
  const s = page.html;
  const rel = page.outFile;
  const h1s = (s.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) problems.push(`${rel}: ${h1s} <h1> elements`);
  if (page.title.length > 60) problems.push(`${rel}: title is ${page.title.length} characters`);
  if (page.description.length > 155) problems.push(`${rel}: description is ${page.description.length} characters`);
  if (!s.includes('lang="en-GB"')) problems.push(`${rel}: missing lang="en-GB"`);
  if (page.canonical !== false && !s.includes('rel="canonical"')) problems.push(`${rel}: no canonical`);
  if (!s.includes(ctx.disclaimer)) problems.push(`${rel}: disclaimer missing`);
  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try { data = JSON.parse(m[1]); } catch (e) { problems.push(`${rel}: invalid JSON-LD (${e.message})`); continue; }
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
    for (const id of refs) if (!defined.has(id)) problems.push(`${rel}: JSON-LD points at {"@id": "${id}"}, which this page doesn't define`);
    for (const node of data['@graph'] || [data]) {
      if (node['@type'] === 'VideoGame') {
        const ok = node.isAccessibleForFree === true && node.offers?.price === 0 && node.gamePlatform === 'Web browser' && node.name && node.url;
        if (!ok) problems.push(`${rel}: VideoGame JSON-LD is missing isAccessibleForFree, offers.price 0 or gamePlatform`);
      }
      if (node['@type'] === 'BreadcrumbList' && !node.itemListElement?.every((i, k) => i.position === k + 1 && i.item?.startsWith(ctx.origin))) {
        problems.push(`${rel}: BreadcrumbList positions or URLs are wrong`);
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
        if (!/\/assets\/(img|icons)\/|favicon\.ico/.test(url)) problems.push(`${rel}: broken link ${url}`);
        else warnings.push(`${rel}: missing image ${url} (run npm run images)`);
      }
    }
  }
}

// ---------- 4b. markup: ids, CSP-safe markup, the notices, share images ----------
// The CSP is script-src 'self' and style-src 'self': no style attributes (in
// HTML or SVG), no <style> elements, no inline event handlers and no inline
// scripts other than JSON-LD and the ones the CSP names by hash.
const decode = (s) =>
  s.replace(/&(amp|quot|#39|lt|gt|nbsp);/g, (_, e) => ({ amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>', nbsp: '\u00a0' })[e]);
const plainText = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
const ATTR = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
/** Every start tag outside scripts and comments, as { name, attrs }. */
function tagsOf(s) {
  const markup = s.replace(/<!--[\s\S]*?-->/g, '').replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/g, '$1</script>');
  return [...markup.matchAll(TAG)].map((m) => {
    const attrs = {};
    for (const a of m[2].matchAll(ATTR)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    return { name: m[1].toLowerCase(), attrs };
  });
}
const cspOf = (policy) => Object.fromEntries(policy.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));
/**
 * The demo hosts in a CSP: frame-src is exactly the frame hosts while the
 * demos are on ('none' while they're off), and connect-src lists them too
 * (pragmatic.js checks the demo can be reached) only while they're on.
 */
function demoCspProblems(policy, where) {
  const out = [];
  const csp = cspOf(policy);
  const hosts = ctx.pragmaticOn ? ctx.cfg.pragmatic.frameHosts || [] : [];
  const frames = csp['frame-src'] || [];
  const wantFrames = hosts.length ? hosts : ["'none'"];
  if (frames.join(' ') !== wantFrames.join(' ')) out.push(`${where}: CSP frame-src is "${frames.join(' ')}", expected "${wantFrames.join(' ')}"`);
  const connect = csp['connect-src'] || [];
  for (const h of hosts) if (!connect.includes(h)) out.push(`${where}: CSP connect-src lacks the demo host ${h}, so the demo's reachability check would fail`);
  for (const h of ctx.cfg.pragmatic?.frameHosts || []) if (!ctx.pragmaticOn && connect.includes(h)) out.push(`${where}: CSP connect-src names the demo host ${h} while the demos are switched off`);
  return out;
}
const IDREFS = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage', 'for', 'popovertarget', 'list', 'form'];
const TRADEMARK = 'Pragmatic Play and game names are trademarks of their owners; we are not affiliated. Megaways is a trademark of Big Time Gaming. Nobody named here endorses this site.';
const symbolOf = new Map((pragmaticJson.games || []).map((g) => [g.slug, g.symbol]));
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
    if (!id) problems.push(`${rel}: empty id attribute`);
    else if (n > 1) problems.push(`${rel}: duplicate id "${id}" (${n} times)`);
  }
  for (const t of tags) {
    for (const a of IDREFS) {
      if (!(a in t.attrs) || (a === 'for' && t.name === 'output')) continue;
      for (const ref of t.attrs[a].split(/\s+/).filter(Boolean)) if (!ids.has(ref)) problems.push(`${rel}: <${t.name} ${a}="${t.attrs[a]}"> points at no id "${ref}"`);
    }
    const href = t.name === 'a' ? t.attrs.href : undefined;
    if (href?.includes('#') && href.length > 1) {
      const [where, frag] = href.split('#');
      const target = where === '' ? page.path : where.startsWith('/') ? where : null;
      const theirs = target && idsByPage.get(target);
      if (theirs && frag && !theirs.has(decodeURIComponent(frag))) problems.push(`${rel}: link ${href} points at no id "${frag}" on ${target}`);
    }
    // CSP: nothing inline
    if ('style' in t.attrs) problems.push(`${rel}: inline style attribute on <${t.name}${t.attrs.class ? ` class="${t.attrs.class}"` : ''}> (the CSP blocks it)`);
    for (const a of Object.keys(t.attrs)) if (/^on[a-z]+$/.test(a)) problems.push(`${rel}: inline event handler ${a} on <${t.name}> (the CSP blocks it)`);
    if (/^\s*javascript:/i.test(t.attrs.href || '')) problems.push(`${rel}: javascript: link (the CSP blocks it)`);
    if (t.name === 'style') problems.push(`${rel}: <style> element (the CSP blocks it; put the rules in src/styles/)`);
    // Nothing is fetched from another origin before the visitor asks for it.
    const fetched = { img: 'src', script: 'src', iframe: 'src', source: 'src', video: 'src', audio: 'src', embed: 'src', object: 'data' }[t.name]
      || (t.name === 'link' && /\b(stylesheet|preload|modulepreload|prefetch|preconnect|dns-prefetch|icon|manifest|apple-touch-icon)\b/.test(t.attrs.rel || '') ? 'href' : null);
    if (fetched && /^(https?:)?\/\//.test(t.attrs[fetched] || '')) problems.push(`${rel}: <${t.name} ${fetched}="${t.attrs[fetched]}"> loads from another origin before interaction`);
  }

  // The age notice ribbon opens every page, with the disclaimer verbatim.
  const ribbon = s.search(/<[a-z]+ class="age-notice"/);
  const head = s.indexOf('<header class="masthead"');
  if (ribbon < 0) problems.push(`${rel}: no .age-notice ribbon`);
  else {
    if (head >= 0 && ribbon > head) problems.push(`${rel}: the .age-notice ribbon comes after the masthead`);
    const block = s.slice(ribbon, head > ribbon ? head : undefined);
    if (!plainText(block).includes(ctx.disclaimer)) problems.push(`${rel}: the .age-notice ribbon doesn't carry the disclaimer verbatim`);
  }

  // Share images exist, at the size the page says.
  const meta = (p) => tags.find((t) => t.name === 'meta' && (t.attrs.property === p || t.attrs.name === p))?.attrs.content;
  for (const key of ['og:image', 'twitter:image']) {
    const url = meta(key);
    if (!url) {
      problems.push(`${rel}: no ${key}`);
      continue;
    }
    if (!url.startsWith(`${ctx.origin}/`)) {
      problems.push(`${rel}: ${key} ${url} is not on ${ctx.origin}`);
      continue;
    }
    const file = path.join(OUT, url.slice(ctx.origin.length));
    const size = await pngSize(file).catch(() => undefined);
    if (size === undefined) problems.push(`${rel}: ${key} ${url.slice(ctx.origin.length)} is not in the build`);
    else if (key === 'og:image' && size && (size.w !== Number(meta('og:image:width')) || size.h !== Number(meta('og:image:height')))) {
      problems.push(`${rel}: og:image is ${size.w}×${size.h}, the page says ${meta('og:image:width')}×${meta('og:image:height')}`);
    }
  }
  for (const m of s.matchAll(/"(?:image|logo)":"(https:[^"]+)"/g)) {
    if (m[1].startsWith(`${ctx.origin}/`)) await fs.access(path.join(OUT, m[1].slice(ctx.origin.length))).catch(() => problems.push(`${rel}: JSON-LD image ${m[1]} is not in the build`));
  }

  // frame-src and connect-src name Pragmatic Play's host only while the demos are on.
  const policy = tags.find((t) => t.name === 'meta' && t.attrs['http-equiv'] === 'Content-Security-Policy')?.attrs.content;
  // An inline script runs only if the CSP names the hash of its exact text (JSON-LD is data and isn't run).
  const scriptSrc = policy ? cspOf(policy)['script-src'] || [] : [];
  for (const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\ssrc=/.test(m[1]) || /type="application\/ld\+json"/.test(m[1])) continue;
    const hash = `'sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}'`;
    if (!scriptSrc.includes(hash)) problems.push(`${rel}: inline <script${m[1]}> whose hash isn't in the CSP's script-src (the CSP blocks it)`);
  }
  if (!policy) problems.push(`${rel}: no Content-Security-Policy meta tag`);
  else problems.push(...demoCspProblems(policy, rel));

  // Pragmatic Play: each demo page has one stage for its own game, with the markup pragmatic.js needs.
  const stages = tags.filter((t) => t.attrs['data-game'] === 'pragmatic');
  const game = ctx.games.find((g) => g.path === page.path);
  if (!ctx.pragmaticOn) {
    if (stages.length) problems.push(`${rel}: a Pragmatic Play stage while the demos are switched off`);
    if (/pragmaticplay\.net/.test(s)) problems.push(`${rel}: mentions pragmaticplay.net while the demos are switched off`);
    continue;
  }
  const footer = s.slice(s.indexOf('<footer class="colophon"'), s.indexOf('</footer>') + 9);
  if (!plainText(footer).includes(TRADEMARK)) problems.push(`${rel}: the footer lacks the trademark line "${TRADEMARK.slice(0, 48)}…"`);
  const want = game?.provider === 'pragmatic' ? game : page.path === '/' ? ctx.featured : null;
  if (!want) {
    if (stages.length) problems.push(`${rel}: a Pragmatic Play stage on a page that isn't a demo page`);
    continue;
  }
  if (stages.length !== 1) {
    problems.push(`${rel}: ${stages.length} Pragmatic Play stages, expected one for ${want.name}`);
    continue;
  }
  const st = stages[0].attrs;
  const symbol = symbolOf.get(want.slug);
  if (st['data-symbol'] !== symbol) problems.push(`${rel}: stage data-symbol "${st['data-symbol']}" doesn't match pragmatic-games.json ("${symbol}" for ${want.slug})`);
  if (st['data-name'] !== want.name) problems.push(`${rel}: stage data-name "${st['data-name']}" isn't "${want.name}"`);
  if (st['data-state'] !== 'idle') problems.push(`${rel}: stage starts in state "${st['data-state']}", not idle`);
  const stageHtml = s.slice(s.search(/<figure [^>]*data-game="pragmatic"/), s.indexOf('</figure>', s.search(/<figure [^>]*data-game="pragmatic"/)));
  for (const hook of ['data-stage', 'data-action="load"', 'data-action="unload"', 'data-status', 'data-blocked']) {
    if (!stageHtml.includes(hook)) problems.push(`${rel}: the stage has no [${hook}] (pragmatic.js needs it)`);
  }
  if (/<iframe\b/.test(stageHtml)) problems.push(`${rel}: the stage ships an iframe; it must be created only when Play is pressed`);
}

// frame-src and connect-src in the hosting headers match the pages, and the demo host is one of the allowed frame hosts.
{
  const headers = await fs.readFile(path.join(OUT, '_headers'), 'utf8');
  problems.push(...demoCspProblems(headers.match(/Content-Security-Policy: (.*)/)?.[1] || '', '_headers'));
  if (ctx.pragmaticOn) {
    let origin = '';
    try {
      origin = new URL(cfg.pragmatic.demoUrl).origin;
    } catch {}
    if (!(ctx.cfg.pragmatic.frameHosts || []).includes(origin)) problems.push(`site.config.json: pragmatic.demoUrl's origin "${origin}" isn't in pragmatic.frameHosts, so the CSP would block the demo`);
  }
}

// src/data/pragmatic-games.json: checked whether or not the demos are on.
{
  const REL = 'src/data/pragmatic-games.json';
  const list = Array.isArray(pragmaticJson.games) ? pragmaticJson.games : [];
  if (!list.length) problems.push(`${REL}: no "games" list`);
  const str = (v) => typeof v === 'string' && v.trim() !== '';
  const strList = (v) => Array.isArray(v) && v.length > 0 && v.every(str);
  const dupes = (key) => {
    const counts = new Map();
    for (const g of list) counts.set(g[key], (counts.get(g[key]) || 0) + 1);
    for (const [v, n] of counts) if (n > 1) problems.push(`${REL}: ${key} "${v}" is used by ${n} games`);
  };
  list.forEach((g, i) => {
    const at = `${REL}: games[${i}]${str(g.slug) ? ` (${g.slug})` : ''}`;
    for (const k of ['slug', 'name', 'symbol', 'grid', 'pays', 'summary']) if (!str(g[k])) problems.push(`${at}: "${k}" is required`);
    for (const k of ['tags', 'howItPlays']) if (!strList(g[k])) problems.push(`${at}: "${k}" must be a non-empty list of strings`);
    if (str(g.slug) && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug)) problems.push(`${at}: slug must be lower-case words joined by hyphens`);
    if (str(g.symbol) && !/^[a-z0-9]+$/i.test(g.symbol)) problems.push(`${at}: symbol "${g.symbol}" isn't a Pragmatic gameSymbol`);
    if (!['low', 'medium'].includes(g.appeal)) problems.push(`${at}: appeal must be "low" or "medium" (games with strong appeal to under-18s are left out: UK CAP)`);
    if (g.rtp != null && !(typeof g.rtp === 'number' && g.rtp > 80 && g.rtp < 100)) problems.push(`${at}: rtp must be a percentage between 80 and 100, or null`);
    if (g.released != null && !(Number.isInteger(g.released) && g.released >= 1990 && g.released <= 2100)) problems.push(`${at}: released must be a year, or null`);
    if (g.topPayout != null && !(typeof g.topPayout === 'number' && g.topPayout > 0)) problems.push(`${at}: topPayout must be a positive number, or null`);
    for (const k of ['features', 'verify']) if (g[k] != null && !(Array.isArray(g[k]) && g[k].every(str))) problems.push(`${at}: "${k}" must be a list of strings`);
    for (const k of Array.isArray(g.verify) ? g.verify : []) {
      if (str(k) && !VERIFIABLE.includes(k)) problems.push(`${at}: verify lists "${k}", which the page can't mark (use ${VERIFIABLE.join(', ')})`);
    }
    if (g.checked != null && !(typeof g.checked === 'string' && ISO_DATE.test(g.checked))) problems.push(`${at}: "checked" must be a date like "2026-10-01", or left out`);
    else if (g.checked > today) problems.push(`${at}: "checked" (${g.checked}) is in the future`);
    if (str(g.slug) && !COVERS[g.slug]) problems.push(`${at}: no cover for "${g.slug}" in src/lib/art.mjs COVERS`);
    if (ctx.houseGames.some((h) => h.slug === g.slug)) problems.push(`${at}: slug "${g.slug}" is taken by one of our own games`);
  });
  dupes('slug');
  dupes('symbol');
  dupes('name');

  // Sign-off. "verify" lists the facts the research couldn't confirm, and the
  // page only marks them with an invisible data-verify. So while the demos
  // are on, the launch build (--strict) needs every game's "checked" date:
  // the day someone opened that demo from a UK browser, saw it load and
  // compared the page's figures with the game's own information screen.
  const unchecked = list.filter((g) => !g.checked);
  if (ctx.pragmaticOn && unchecked.length) {
    const WAYS_OUT = `open each demo from a UK browser, see it load and compare its facts with the game's information screen (the i button), then set "checked": "YYYY-MM-DD"; or set any figure you can't confirm to null; or build with "pragmatic.enabled": false`;
    if (strict) {
      for (const g of unchecked) problems.push(`${REL}: ${g.slug} has no "checked" date${g.verify?.length ? ` (unconfirmed: ${g.verify.join(', ')})` : ''}`);
      problems.push(`${REL}: before launch, ${WAYS_OUT}`);
    } else {
      warnings.push(`${REL}: ${unchecked.length} of ${list.length} demos have no "checked" date, so the launch build (--strict) fails: ${unchecked.map((g) => g.slug).join(', ')}. Before launch, ${WAYS_OUT}${unchecked.some((g) => g.verify?.length) ? `. Facts the research couldn't confirm ("verify"):\n${unchecked.filter((g) => g.verify?.length).map((g) => `           ${g.name}: ${g.verify.join(', ')}`).join('\n')}` : ''}`);
    }
  }
}

for (const [k, v] of Object.entries(cfg.operator)) {
  if (/\[.*\]/.test(v)) (strict ? problems : warnings).push(`site.config.json: operator.${k} is still a placeholder: "${v}"`);
}

// The Pragmatic Play demos: open decisions (COMPLIANCE.md, section 0, "Режим Pragmatic").
// Unchecked facts are the sign-off's business (src/data/pragmatic-games.json, above).
if (ctx.pragmaticOn) {
  // Pragmatic's terms allow its games only with its express written consent.
  if (!String(cfg.pragmatic.writtenConsent || '').trim()) {
    (strict ? problems : warnings).push('site.config.json: pragmatic.writtenConsent is empty. Record Pragmatic Play\'s written consent (reference and date) before launch, or build with --no-pragmatic');
  }
  // Google's social casino policy bars names associated with real-money gambling brands.
  if (cfg.analytics?.adsConversionId) {
    (strict ? problems : warnings).push('site.config.json: Google Ads measurement is set while the Pragmatic Play demos are on. Advertise a --no-pragmatic build instead (COMPLIANCE.md, section 0, "Режим Pragmatic")');
  }
  // A demo signed off as "checked" whose "verify" list still names facts: the page still marks them as unconfirmed.
  const stale = (pragmaticJson.games || []).filter((g) => g.checked && g.verify?.length);
  if (stale.length) {
    warnings.push(`src/data/pragmatic-games.json: facts still marked "verify" in ${stale.length} checked games. Remove each fact you confirmed in the demo's i screen from "verify", or set it to null:\n${stale.map((g) => `           ${g.name}: ${g.verify.join(', ')}`).join('\n')}`);
  }
}

// Lobby filter tags on our own games: real filters only, and none of the slot
// features (free spins, tumbles, Megaways) that only the Pragmatic Play demos have.
{
  const keys = FILTERS.map((f) => f.key).filter((k) => k !== 'all');
  const SLOT_FEATURES = ['freespins', 'tumble', 'megaways'];
  for (const g of ctx.houseGames) {
    for (const t of g.tags) {
      if (!keys.includes(t)) problems.push(`src/lib/context.mjs: ${g.slug} has the tag "${t}", which isn't a lobby filter (${keys.join(', ')})`);
      else if (SLOT_FEATURES.includes(t)) problems.push(`src/lib/context.mjs: ${g.slug} has the tag "${t}", but our own games have no free spins, tumbles or Megaways`);
    }
  }
}

// Dates. Legal pages may carry their own ("legalUpdated"); a legal page whose
// source or whose deciding config (the demos, analytics) changed after its
// date gets a warning, from git history when it's there.
{
  const REL = 'site.config.json';
  if (!ISO_DATE.test(cfg.lastUpdated || '')) problems.push(`${REL}: lastUpdated must be a date like "2026-09-26"`);
  else if (cfg.lastUpdated > today) problems.push(`${REL}: lastUpdated (${cfg.lastUpdated}) is in the future`);
  for (const [k, v] of Object.entries(cfg.legalUpdated || {})) {
    if (!LEGAL.includes(k)) problems.push(`${REL}: legalUpdated.${k} isn't a legal page (${LEGAL.join(', ')})`);
    else if (!ISO_DATE.test(v)) problems.push(`${REL}: legalUpdated.${k} must be a date like "2026-09-26"`);
    else if (v > today) problems.push(`${REL}: legalUpdated.${k} (${v}) is in the future`);
  }
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  // A shallow clone (as in CI) has no history to go by.
  if (git('rev-parse', '--is-shallow-repository') === 'false') {
    const DECIDING = /^[+-].*"(enabled|ga4|adsConversionId)"/m;
    const configChanged = DECIDING.test(git('diff', '-U0', 'HEAD', '--', 'site.config.json') || '') ? today : git('log', '-1', '--format=%as', '-G', '"(enabled|ga4|adsConversionId)"', '--', 'site.config.json');
    for (const key of LEGAL) {
      const file = `src/pages/${key}.mjs`;
      const pageChanged = git('status', '--porcelain', '--', file) ? today : git('log', '-1', '--format=%as', '--', file);
      const changed = [pageChanged, configChanged].filter(Boolean).sort().at(-1);
      if (changed && changed > dateOf(key)) {
        warnings.push(`${file}: the ${key} page changed on ${changed}, after its "Updated" date (${dateOf(key)}). Set ${REL} "legalUpdated": { "${key}": "${changed}" } or "lastUpdated", and rebuild.`);
      }
    }
  }
}

// Asset URLs: every script and style a page names is under /assets/v<version>/,
// and no script builds an unversioned one itself.
for (const page of pages) {
  for (const m of page.html.matchAll(/["'(=]((?:https?:\/\/[^/"']+)?\/assets\/(?:js|css)\/[^"')\s]*|\/[^"')\s]*\?v=[^"')\s]*)/g)) {
    problems.push(`${page.outFile}: unversioned script or style URL ${m[1]} (the build moves /assets/js/ and /assets/css/ to /${VERSIONED}/)`);
  }
}
for (const f of files.filter((f) => f.endsWith('.js'))) {
  for (const m of (await fs.readFile(f, 'utf8')).matchAll(/['"`](\/assets\/(?:js|css)\/[^'"`]*)/g)) {
    problems.push(`${path.relative(OUT, f)}: names ${m[1]}, which doesn't exist in the build (import it relatively, e.g. './lib/x.js')`);
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
    if ((cc.match(/max-age=/g) || []).length > 1) problems.push(`_headers: ${u} would be sent "Cache-Control: ${cc}". Put the broad rule first and start the narrower one with "! Cache-Control".`);
  }
  for (const u of urls) {
    const fingerprinted = u.startsWith(`/${VERSIONED}/`) || [...fontUrls.values()].includes(u);
    if (/immutable/.test(cacheControlFor(rules, u)) && !fingerprinted) problems.push(`_headers: ${u} is cached for a year as immutable, but its URL doesn't change with its content`);
  }
}

// First-view budget on the home page: HTML + CSS + every JS module it loads.
const homePage = pages[0];
const firstView = await moduleGraph([`${VERSIONED}/js/age-boot.js`, `${VERSIONED}/js/app.js`, ...[...(homePage.modules || []), ...(homePage.budgetModules || [])].map((m) => assetUrl(m).slice(1))]);
let budget = gz(Buffer.from(homePage.html)) + gz(await fs.readFile(path.join(OUT, VERSIONED, 'css/site.css')));
for (const m of firstView) {
  try { budget += gz(await fs.readFile(path.join(OUT, m))); } catch {}
}
if (budget > 150 * 1024) problems.push(`home first view is ${kb(budget)} gzip, over the 150 KB budget`);

// The service worker's precache: every file exists, and a first visit
// doesn't download much more than it looked at.
let precacheBytes = 0;
for (const u of precache) {
  try {
    precacheBytes += gz(await fs.readFile(fileOf(u)));
  } catch {
    problems.push(`sw.js: precaches ${u}, which isn't in the build`);
  }
}
if (precacheBytes > PRECACHE_BUDGET * 1024) problems.push(`sw.js: the precache is ${kb(precacheBytes)} gzip, over its ${PRECACHE_BUDGET} KB budget (${precache.length} files)`);

// ---------- 5. report ----------
console.log(`Built ${pages.length} pages into ${(path.relative(process.cwd(), OUT).startsWith('..') ? OUT : path.relative(process.cwd(), OUT)) || '.'}/ (assets v${version}, sw ${swHash})`);
console.log(`Home first view (HTML + CSS + ${firstView.length} JS modules): ${kb(budget)} gzip of 150 KB budget`);
console.log(`Service worker precache (${precache.length} files for offline use): ${kb(precacheBytes)} gzip of ${PRECACHE_BUDGET} KB budget`);
for (const w of new Set(warnings.map((w) => w.replace(/^[^:]+: (missing image)/, '$1')))) console.warn(`warning: ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`error: ${p}`);
  process.exit(1);
}
console.log('Lint: no problems found.');
