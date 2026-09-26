#!/usr/bin/env node
// Static site build. No dependencies: Node 20 or later.
//
//   node build.mjs                  build into dist/
//   node build.mjs --strict         also fail on placeholder operator details
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

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { makeContext } from './src/lib/context.mjs';
import { layout, setAssetVersion, csp } from './src/lib/layout.mjs';
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
const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// ---------- 1. copy public files ----------
await fs.rm(OUT, { recursive: true, force: true });
await fs.cp(PUBLIC, OUT, { recursive: true });

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

// The stylesheet is written as partials in src/styles/, joined in file-name
// order (00-tokens.css, 10-base.css, …) into one minified file for the browser.
const STYLES = path.join(ROOT, 'src/styles');
const partials = (await fs.readdir(STYLES).catch(() => [])).filter((f) => f.endsWith('.css')).sort();
if (partials.length) {
  const parts = await Promise.all(partials.map(async (f) => `${(await fs.readFile(path.join(STYLES, f), 'utf8')).trim()}\n`));
  // Per-game cover colours, generated as rules because the CSP blocks inline styles.
  parts.push(`${coverCss()}\n`);
  await write('assets/css/site.css', `/* Opal Quest Lounge. Built from src/styles/*.css by build.mjs */\n${minifyCss(parts.join('\n'))}`);
}

// Asset version: a hash of every CSS and JS file, for cache busting.
const assetFiles = (await walk(path.join(OUT, 'assets'))).filter((f) => /\.(css|js)$/.test(f)).sort();
const h = crypto.createHash('sha256');
for (const f of assetFiles) h.update(await fs.readFile(f));
const version = h.digest('hex').slice(0, 10);
setAssetVersion(version);

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
      pragmatic: { demoUrl: cfg.pragmatic?.demoUrl, params: cfg.pragmatic?.params },
      version,
    },
    null,
    2,
  )};\n`,
);

// ---------- 2. pages ----------
const HOUSE_PAGES = { 'seven-systems': sevenSystems, 'lapidary-wheel': lapidaryWheel, 'brilliant-twenty-one': brilliant21 };
const pages = [
  home(ctx),
  gamesIndex(ctx),
  ...ctx.games.map((g) => (g.provider === 'pragmatic' ? pragmaticGame(ctx, g) : HOUSE_PAGES[g.slug](ctx))),
  about(ctx),
  responsibleGaming(ctx),
  terms(ctx),
  privacy(ctx),
  cookies(ctx),
  contact(ctx),
  notFound(ctx),
  offline(ctx),
];

for (const page of pages) {
  const file = page.file || path.join(page.path, 'index.html');
  page.outFile = file;
  page.html = layout(ctx, page)
    // Wide tables scroll sideways on phones; make each scroll box reachable by keyboard and named after its caption.
    .replace(/<div class="table-wrap">(\s*<table[^>]*>\s*<caption[^>]*>([\s\S]*?)<\/caption>)/g, (m, rest, cap) =>
      `<div class="table-wrap" tabindex="0" role="region" aria-label="${cap.replace(/<[^>]+>/g, '').replace(/"/g, '&quot;').trim()}">${rest}`);
  await write(file, page.html);
}

// ---------- 3. site files ----------
const indexed = pages.filter((p) => p.sitemap !== false);
await write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexed
    .map((p) => `  <url><loc>${ctx.origin}${p.path}</loc><lastmod>${cfg.lastUpdated}</lastmod></url>`)
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

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/img/*
  Cache-Control: public, max-age=2592000

/assets/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=604800

/sw.js
  Cache-Control: no-cache
`,
);

// Service worker: precache everything the site needs to run offline.
const allFiles = (await walk(OUT)).map((f) => '/' + path.relative(OUT, f).split(path.sep).join('/'));
const precache = allFiles
  .filter((f) => !/^\/(_headers|CNAME|robots\.txt|sitemap\.xml|sw\.js)$/.test(f))
  .filter((f) => !/\/og-[^/]+\.png$/.test(f))
  .map((f) => f.replace(/index\.html$/, ''))
  .sort();
const swTemplate = await fs.readFile(path.join(ROOT, 'src/sw.template.js'), 'utf8');
const swHash = crypto.createHash('sha256').update(version + precache.join()).digest('hex').slice(0, 10);
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

const FORBIDDEN = [/\bdeposit/i, /\bwithdraw/i, /cash[\s-]?out/i, /bonus code/i, /real[\s-]money wins?/i, /win big/i, /jackpot/i, /\bhurry\b/i, /don[’']t miss out/i];
const AMERICAN = [/\bcolor\b/i, /\bfavor/i, /\bcenter\b/i, /\bbehavior/i, /\bgray\b/i, /\borganization\b/i, /\bcatalog\b/i, /\blicense\b/i, /\banalyz/i, /\bcustomiz/i, /\boptimiz/i, /\bjewelry\b/i];

// Apostrophes: the copy uses ’ (U+2019); a straight ' beside it looks
// different in Archivo and Radio Canada. Checked in the text people see or
// hear on every page (entities decoded first, plus the attributes that are
// shown or read out) and in the strings the scripts show at run time.
// Straight apostrophes in the chrome's own scripts fail the build; the rest
// are counted in one warning until that copy has been converted.
const STRICT_APOSTROPHES = /^assets\/js\/(app|age-boot)\.js$|^assets\/js\/lib\/(rg|ui|age|consent|settings|store|session|format)\.js$/;
const apostrophes = new Map(); // file → examples
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

const files = await walk(OUT);
for (const f of files) {
  if (!/\.(html|js|json|webmanifest|css|txt|xml)$/.test(f)) continue;
  const rel = path.relative(OUT, f);
  const src = await fs.readFile(f, 'utf8');
  const text = /\.html$/.test(f) ? visibleText(src) : src;
  for (const re of FORBIDDEN) if (re.test(text)) problems.push(`${rel}: forbidden wording ${re}`);
  if (/\.html$/.test(f)) for (const re of AMERICAN) if (re.test(text)) problems.push(`${rel}: American spelling ${re}`);
  // U+2011 (non-breaking hyphen) is missing from the subset fonts and reads oddly aloud; keep words together with .nobr instead.
  const nbh = src.split('\u2011').length - 1;
  if (nbh) problems.push(`${rel}: ${nbh} U+2011 non-breaking hyphen${nbh === 1 ? '' : 's'} (use a plain hyphen inside <span class="nobr">)`);
  const web = rel.split(path.sep).join('/');
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
const IDREFS = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage', 'for', 'popovertarget', 'list', 'form'];
const TRADEMARK = 'Pragmatic Play and game names are trademarks of their owners; we are not affiliated. Megaways is a trademark of Big Time Gaming. Nobody named here endorses this site.';
const pragmaticJson = JSON.parse(await fs.readFile(path.join(ROOT, 'src/data/pragmatic-games.json'), 'utf8'));
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

  // frame-src names Pragmatic Play's host only while the demos are on.
  const policy = tags.find((t) => t.name === 'meta' && t.attrs['http-equiv'] === 'Content-Security-Policy')?.attrs.content;
  // An inline script runs only if the CSP names the hash of its exact text (JSON-LD is data and isn't run).
  const scriptSrc = policy ? cspOf(policy)['script-src'] || [] : [];
  for (const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\ssrc=/.test(m[1]) || /type="application\/ld\+json"/.test(m[1])) continue;
    const hash = `'sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}'`;
    if (!scriptSrc.includes(hash)) problems.push(`${rel}: inline <script${m[1]}> whose hash isn't in the CSP's script-src (the CSP blocks it)`);
  }
  if (!policy) problems.push(`${rel}: no Content-Security-Policy meta tag`);
  else {
    const frames = cspOf(policy)['frame-src'] || [];
    const hosts = ctx.pragmaticOn ? ctx.cfg.pragmatic.frameHosts || [] : ["'none'"];
    if (frames.join(' ') !== hosts.join(' ')) problems.push(`${rel}: CSP frame-src is "${frames.join(' ')}", expected "${hosts.join(' ')}"`);
  }

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
  for (const hook of ['data-stage', 'data-action="load"', 'data-action="unload"', 'data-status', 'data-fallback', 'data-blocked']) {
    if (!stageHtml.includes(hook)) problems.push(`${rel}: the stage has no [${hook}] (pragmatic.js needs it)`);
  }
  if (/<iframe\b/.test(stageHtml)) problems.push(`${rel}: the stage ships an iframe; it must be created only when Play is pressed`);
}

// frame-src in the hosting headers matches the pages, and the demo host is one of the allowed frame hosts.
{
  const headers = await fs.readFile(path.join(OUT, '_headers'), 'utf8');
  const frames = cspOf(headers.match(/Content-Security-Policy: (.*)/)?.[1] || '')['frame-src'] || [];
  const hosts = ctx.pragmaticOn ? ctx.cfg.pragmatic.frameHosts || [] : ["'none'"];
  if (frames.join(' ') !== hosts.join(' ')) problems.push(`_headers: CSP frame-src is "${frames.join(' ')}", expected "${hosts.join(' ')}"`);
  if (ctx.pragmaticOn) {
    let origin = '';
    try {
      origin = new URL(cfg.pragmatic.demoUrl).origin;
    } catch {}
    if (!hosts.includes(origin)) problems.push(`site.config.json: pragmatic.demoUrl's origin "${origin}" isn't in pragmatic.frameHosts, so the CSP would block the demo`);
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
    if (str(g.slug) && !COVERS[g.slug]) problems.push(`${at}: no cover for "${g.slug}" in src/lib/art.mjs COVERS`);
    if (ctx.houseGames.some((h) => h.slug === g.slug)) problems.push(`${at}: slug "${g.slug}" is taken by one of our own games`);
  });
  dupes('slug');
  dupes('symbol');
  dupes('name');
}

for (const [k, v] of Object.entries(cfg.operator)) {
  if (/\[.*\]/.test(v)) (strict ? problems : warnings).push(`site.config.json: operator.${k} is still a placeholder: "${v}"`);
}

// First-view budget on the home page: HTML + CSS + every JS module it loads.
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
const homePage = pages[0];
const firstView = await moduleGraph(['assets/js/age-boot.js', 'assets/js/app.js', ...[...(homePage.modules || []), ...(homePage.budgetModules || [])].map((m) => m.slice(1))]);
let budget = gz(Buffer.from(homePage.html)) + gz(await fs.readFile(path.join(OUT, 'assets/css/site.css')));
for (const m of firstView) {
  try { budget += gz(await fs.readFile(path.join(OUT, m))); } catch {}
}
if (budget > 150 * 1024) problems.push(`home first view is ${kb(budget)} gzip, over the 150 KB budget`);

// ---------- 5. report ----------
console.log(`Built ${pages.length} pages into ${(path.relative(process.cwd(), OUT).startsWith('..') ? OUT : path.relative(process.cwd(), OUT)) || '.'}/ (assets v${version}, sw ${swHash})`);
console.log(`Home first view (HTML + CSS + ${firstView.length} JS modules): ${kb(budget)} gzip of 150 KB budget`);
for (const w of new Set(warnings.map((w) => w.replace(/^[^:]+: (missing image)/, '$1')))) console.warn(`warning: ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`error: ${p}`);
  process.exit(1);
}
console.log('Lint: no problems found.');
