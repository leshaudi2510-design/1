// Generates the site's icons and share cards, all from our own artwork:
//
//   src/public/favicon.svg             the opal mark (#opal in src/lib/art.mjs), simplified for 16px
//   src/public/favicon.ico             16, 32 and 48 px
//   src/public/assets/icons/           apple-touch-icon.png (180), icon-192.png, icon-512.png and
//                                      icon-maskable-512.png: the opal on process yellow, in an ink ring
//   src/public/assets/img/og-*.png     1200 × 630 share cards: og-home.png, and og-<slug>.png for every
//                                      game in ctx.games with the Pragmatic Play demos on and off
//
// The share cards are rendered by Chromium from the BUILT site, so the fonts,
// the stylesheet and the cover colours are the real ones. The script serves
// the build folder and writes a temporary same-origin page (__og.html, with
// its layout in __og.css) into it. The page carries the site's own CSP, so
// the stylesheet and fonts load from 'self' and any inline style would be
// refused (and fail the run). Every request that leaves the local server is
// blocked, so nothing is fetched from anywhere else, least of all Pragmatic
// Play: the cards show only our own cover art.
//
//   npm run build && npm run images && npm run build
//   node tools/make-images.mjs [build-dir] [--only icons|cards]
//
// build-dir defaults to $OUT_DIR, then dist/. If it holds no build, or one
// older than the styles, fonts or artwork, the site is built into it first.
// Run the build again afterwards: the game pages point og:image at their own
// card only once the file exists.
//
// Needs sharp and Playwright's Chromium (both dev dependencies).
import fs from 'node:fs/promises';
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { SPRITE } from '../src/lib/art.mjs';
import { makeContext } from '../src/lib/context.mjs';
import { cover } from '../src/lib/ui/tiles.mjs';
import { esc } from '../src/lib/html.mjs';
import { csp } from '../src/lib/layout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'src/public');
const IMG = path.join(PUB, 'assets/img');
const ICONS = path.join(PUB, 'assets/icons');

const args = process.argv.slice(2);
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? args[onlyAt + 1] : '';
if (only && !['icons', 'cards'].includes(only)) throw new Error(`--only takes "icons" or "cards", not "${only}"`);
const dirArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--only');
const DIST = path.resolve(ROOT, dirArg || process.env.OUT_DIR || 'dist');

const cfg = JSON.parse(await fs.readFile(path.resolve(ROOT, process.env.SITE_CONFIG || 'site.config.json'), 'utf8'));

const INK = '#18122B';
const YELLOW = '#FFE11A';

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// ======================================================================
// 1. The opal mark, taken from the sprite in art.mjs
// ======================================================================

function pick(re, what) {
  const m = SPRITE.match(re);
  if (!m) throw new Error(`art.mjs: can't find ${what} in SPRITE (tools/make-images.mjs reads it from there)`);
  return m[1];
}
const OPAL_BODY = pick(/<symbol id="opal" viewBox="0 0 48 48">([\s\S]*?)<\/symbol>/, 'the #opal symbol').trim();
const OPAL_CLIP = pick(/<clipPath id="opal-clip">([\s\S]*?)<\/clipPath>/, 'the #opal-clip path').trim();
const DOTS = pick(/(<pattern id="p-dots"[\s\S]*?<\/pattern>)/, 'the #p-dots pattern');
const EGG = pick(/<clipPath id="opal-clip"><path d="([^"]+)"/, 'the opal outline');
const DOTS_RECT = /<rect[^>]*fill="url\(#p-dots\)"[^>]*\/>\s*/;
const OUTLINE = `<path d="${EGG}" fill="none" stroke="${INK}" stroke-width="3"/>`;
if (!DOTS_RECT.test(OPAL_BODY) || !OPAL_BODY.includes(OUTLINE)) {
  throw new Error('art.mjs: the #opal symbol has changed shape; update the favicon tweaks in tools/make-images.mjs');
}

/**
 * The opal, drawn in its own 48-unit box. `small` drops the halftone dots
 * (they turn to mush below 64px) and thickens the outline, for the favicon.
 */
function opal({ small = false, id = 'o' } = {}) {
  let body = OPAL_BODY;
  if (small) body = body.replace(DOTS_RECT, '').replace(OUTLINE, OUTLINE.replace('stroke-width="3"', 'stroke-width="3.6"'));
  body = body
    .replaceAll('url(#opal-clip)', `url(#${id}-clip)`)
    .replaceAll('url(#p-dots)', `url(#${id}-dots)`)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n  ');
  const defs = `<clipPath id="${id}-clip">${OPAL_CLIP}</clipPath>${small ? '' : DOTS.replace('id="p-dots"', `id="${id}-dots"`)}`;
  return { defs, body };
}

// favicon.svg: the opal alone, with a white halo outside its ink outline so
// the shape stays solid on dark browser chrome as well as light. Presentation
// attributes only: no <style>, which the site's CSP header would block.
function faviconSvg() {
  const o = opal({ small: true, id: 'f' });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <title>${esc(cfg.brand)}</title>
  <defs>${o.defs}</defs>
  <path d="${EGG}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="7.5" stroke-linejoin="round"/>
  ${o.body}
</svg>
`;
}

/**
 * An app icon: the opal on process yellow inside an ink ring, with white
 * sunburst rays behind it and a hard ink shadow under the stone.
 *   full   yellow to the edges (apple-touch-icon, maskable); otherwise a disc
 *   ring   the ring's centre-line radius, as a share of the icon's width
 *   stone  the stone's height, as a share of the icon's width
 */
function iconSvg(size, { full, ring, ringWidth, stone }) {
  const S = 512;
  const c = S / 2;
  const R = ring * S;
  const w = ringWidth * S;
  const inner = R - w / 2;
  const rays = [];
  for (let a = 0; a < 360; a += 20) {
    const p = (deg) => `${(c + 2 * S * Math.sin((deg * Math.PI) / 180)).toFixed(1)},${(c - 2 * S * Math.cos((deg * Math.PI) / 180)).toFixed(1)}`;
    rays.push(`${c},${c} ${p(a - 3.5)} ${p(a + 3.5)}`);
  }
  // the stone's outline spans 4–44 units high, so scale by its 40-unit height
  const k = (stone * S) / 40;
  const o = opal({ id: 'i' });
  const at = (dx, dy) => `translate(${(c - 24 * k + dx).toFixed(2)} ${(c - 24 * k + dy).toFixed(2)}) scale(${k.toFixed(4)})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${S} ${S}">
  <defs>
    ${o.defs}
    <clipPath id="ring-in"><circle cx="${c}" cy="${c}" r="${inner}"/></clipPath>
  </defs>
  ${full ? `<rect width="${S}" height="${S}" fill="${YELLOW}"/>` : `<circle cx="${c}" cy="${c}" r="${R + w / 2}" fill="${YELLOW}"/>`}
  <g clip-path="url(#ring-in)"><polygon points="${rays.join(' ')}" fill="#FFFFFF" fill-opacity=".55"/></g>
  <circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${INK}" stroke-width="${w}"/>
  <path transform="${at(2.2 * k, 2.2 * k)}" d="${EGG}" fill="${INK}" stroke="${INK}" stroke-width="3"/>
  <g transform="${at(0, 0)}">${o.body}</g>
</svg>`;
}

const ICON_SPECS = [
  // "any" icons: a yellow disc with an ink rim; transparent corners
  { file: 'icon-192.png', size: 192, full: false, ring: 0.455, ringWidth: 0.07, stone: 0.5 },
  { file: 'icon-512.png', size: 512, full: false, ring: 0.465, ringWidth: 0.055, stone: 0.5 },
  // iOS fills transparency with black and rounds the corners itself
  { file: 'apple-touch-icon.png', size: 180, full: true, ring: 0.4, ringWidth: 0.06, stone: 0.46 },
  // maskable: everything that matters sits inside the 40%-radius safe zone
  { file: 'icon-maskable-512.png', size: 512, full: true, ring: 0.37, ringWidth: 0.045, stone: 0.43 },
];

const png = (input) => sharp(Buffer.from(input)).png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 100, effort: 10 }).toBuffer();

async function makeIcons() {
  const fav = faviconSvg();
  await fs.writeFile(path.join(PUB, 'favicon.svg'), fav);

  // favicon.ico: PNG entries at 16, 32 and 48 px, each rasterised straight
  // from the SVG at its own size (crisper than scaling one bitmap down)
  const sizes = [16, 32, 48];
  const entries = await Promise.all(
    sizes.map((s) => sharp(Buffer.from(fav.replace('<svg ', `<svg width="${s}" height="${s}" `))).png({ compressionLevel: 9 }).toBuffer()),
  );
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(s, e); // width (0 would mean 256)
    header.writeUInt8(s, e + 1); // height
    header.writeUInt8(0, e + 2); // palette colours
    header.writeUInt8(0, e + 3); // reserved
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(entries[i].length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += entries[i].length;
  });
  const ico = Buffer.concat([header, ...entries]);
  await fs.writeFile(path.join(PUB, 'favicon.ico'), ico);
  console.log(`favicon.svg ${kb(Buffer.byteLength(fav))}, favicon.ico ${kb(ico.length)} (16, 32, 48)`);

  await fs.mkdir(ICONS, { recursive: true });
  for (const spec of ICON_SPECS) {
    const buf = await png(iconSvg(spec.size, spec));
    await fs.writeFile(path.join(ICONS, spec.file), buf);
    console.log(`${spec.file} ${spec.size}×${spec.size} ${kb(buf.length)}`);
  }
}

// ======================================================================
// 2. Share cards (1200 × 630), rendered from the built site
// ======================================================================

/** The built stylesheet's URL: build.mjs publishes it under /assets/v<version>/css/. */
function siteCss() {
  try {
    return readFileSync(path.join(DIST, 'index.html'), 'utf8').match(/<link rel="stylesheet" href="(\/assets\/v\w+\/css\/site\.css)"/)?.[1] || null;
  } catch {
    return null;
  }
}

/** The build to render from: build it first if it's missing or older than its sources. */
function ensureBuild() {
  const url = siteCss();
  const css = url ? path.join(DIST, url) : path.join(DIST, 'assets/css/site.css');
  const newest = (dir) => {
    let t = 0;
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      t = Math.max(t, f.isDirectory() ? newest(p) : statSync(p).mtimeMs);
    }
    return t;
  };
  const sources = Math.max(newest(path.join(ROOT, 'src/styles')), newest(path.join(PUB, 'assets/fonts')), statSync(path.join(ROOT, 'src/lib/art.mjs')).mtimeMs);
  if (existsSync(css) && statSync(css).mtimeMs >= sources) return;
  console.log(`building the site into ${path.relative(process.cwd(), DIST) || '.'}/ first`);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'build.mjs')], { cwd: ROOT, env: { ...process.env, OUT_DIR: DIST }, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('the build failed');
}

/** A static server for the build folder, on a free port. */
async function serve(dir) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(dir, p);
    if (!file.startsWith(dir + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const data = await fs.readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

// Every game the site can list: the Pragmatic Play demos (on) and our own slot (off).
function allGames() {
  const on = makeContext({ ...cfg, pragmatic: { ...cfg.pragmatic, enabled: true } });
  const off = makeContext({ ...cfg, pragmatic: { ...cfg.pragmatic, enabled: false } });
  const seen = new Map();
  for (const g of [...on.games, ...off.games]) if (!seen.has(g.slug)) seen.set(g.slug, g);
  return { ctx: on, games: [...seen.values()] };
}

const opalMark = (cls) => `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true"><use href="#opal"/></svg>`;
const burst = (cls) => `<div class="${cls} burst" aria-hidden="true"><svg><use href="#burst-b"/></svg></div>`;
const cmyk = `<div class="cmyk" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;

function brandLockup() {
  const [name, tag] = cfg.brand.split(/ (?=\S+$)/);
  return `<p class="og__brand">${opalMark('og__opal')}<span class="brand__name"><b>${esc(name)}</b>${tag ? `<span>${esc(tag)}</span>` : ''}</span></p>`;
}

/** Game names as display lettering: hyphenated words and " – " never break badly. */
const displayName = (name) =>
  esc(name)
    .replace(/ – /g, '\u00a0– ')
    .replace(/(\S+-\S+)/g, '<span class="nobr">$1</span>');

function gameCard(ctx, g) {
  const demo = g.provider === 'pragmatic';
  const line = demo ? 'Free demo · Demo credits, no cash value · 18+' : `Free to play · ${ctx.cur.plural} have no value · 18+`;
  const from = demo
    ? `<i class="dot dot--pp" aria-hidden="true"></i>Pragmatic Play`
    : `<i class="dot dot--oq" aria-hidden="true"></i>Our own ${g.table ? 'table' : 'slot'}`;
  const facts = (g.tileFacts || []).filter(Boolean).map((f) => `<span class="fact">${esc(f)}</span>`).join('');
  return `<section class="og og--game" id="og-${esc(g.slug)}">
  ${cmyk}
  <div class="og__panel">
    <div class="og__copy">
      ${brandLockup()}
      <div class="og__main">
        <p class="og__kicker"><span class="sticker">${demo ? 'Free demo' : 'Free to play'}</span><span class="og__from">${from}</span></p>
        <h1 class="display og__title" data-fit>${displayName(g.name)}</h1>
        ${facts ? `<p class="og__facts">${facts}</p>` : ''}
      </div>
    </div>
    <div class="og__art">
      ${burst('og__burst')}
      ${cover(ctx, g, { cls: 'og__cover' })}
    </div>
  </div>
  <p class="og__ribbon"><span class="age-mark" aria-hidden="true">18+</span><span class="og__line">${esc(line)}</span><b class="og__domain">${esc(cfg.domain)}</b></p>
</section>`;
}

// The home cards: the hero line and a fan of three covers. og-home.png is for
// the site with the Pragmatic demos (two slots, one table); og-home-house.png is
// for the site on our own three games (site.config.json "pragmatic.enabled": false).
const HOME_FAN = ['big-bass-bonanza', 'lapidary-wheel', 'gates-of-olympus'];
const HOUSE_FAN = ['seven-systems', 'lapidary-wheel', 'brilliant-twenty-one'];

function homeCard(ctx, games, { house = false } = {}) {
  const fan = (house ? HOUSE_FAN : HOME_FAN).map((slug) => games.find((g) => g.slug === slug)).filter(Boolean);
  const [lead, ...rest] = ctx.disclaimer.split(/(?<=\.) /);
  return `<section class="og og--home" id="${house ? 'og-home-house' : 'og-home'}">
  ${cmyk}
  <div class="og__panel">
    <div class="og__copy">
      ${brandLockup()}
      <div class="og__main">
        <p class="og__kicker"><span class="sticker">Free to play</span></p>
        <h1 class="display og__title og__title--home">${house ? 'Slots and tables in full colour.' : 'Slot demos in full colour.'} <span class="hl">Played for fun.</span></h1>
      </div>
    </div>
    <div class="og__art og__art--fan">
      ${burst('og__burst')}
      ${fan.map((g, i) => cover(ctx, g, { cls: `og__cover og__cover--${i + 1}` })).join('\n      ')}
    </div>
  </div>
  <p class="og__ribbon og__ribbon--long"><span class="age-mark" aria-hidden="true">18+</span><span class="og__line"><strong>${esc(lead)}</strong> ${esc(rest.join(' '))}</span><b class="og__domain">${esc(cfg.domain)}</b></p>
</section>`;
}

// The card layout. Tokens, fonts, covers, stickers, fact tags and the 18+
// mark all come from the site's own stylesheet; this only places them.
const CARD_CSS = `
html{scroll-padding-top:0}
body{margin:0;background:#777}
.og{box-sizing:border-box;width:1200px;height:630px;display:grid;grid-template-rows:12px 1fr auto;
  overflow:hidden;background:var(--k);border:10px solid var(--k);color:var(--k)}
.og + .og{margin-top:20px}
.one .og{margin:0}
.one .og:not(.is-on){display:none}
.og .cmyk{height:12px}

/* the yellow print: sunburst rays and a Ben-Day field, both centred on the art */
.og__panel{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:640px 1fr;background:var(--y)}
.og--home .og__panel{grid-template-columns:660px 1fr}
.og__panel::before{content:"";position:absolute;inset:0;z-index:-2;
  background:repeating-conic-gradient(from 2deg at 74% 50%, rgb(255 255 255 / .55) 0 5deg, transparent 5deg 14deg);
  -webkit-mask-image:radial-gradient(circle at 74% 50%, #000 20%, transparent 78%);mask-image:radial-gradient(circle at 74% 50%, #000 20%, transparent 78%)}
.og__panel::after{content:"";position:absolute;inset:0;z-index:-1;
  background-image:radial-gradient(circle, rgb(255 46 147 / .42) 30%, transparent 32%);background-size:14px 14px;
  -webkit-mask-image:linear-gradient(100deg, transparent 52%, #000 98%);mask-image:linear-gradient(100deg, transparent 52%, #000 98%)}

.og__copy{display:flex;flex-direction:column;padding:34px 0 34px 50px;min-width:0}
.og__brand{display:flex;align-items:center;gap:14px}
.og__opal{width:62px;height:62px;flex:none}
.og .brand__name b{font-size:31px}
.og .brand__name span{font-size:15px;margin-top:6px;padding:4px 7px 4px 10px;border:2px solid var(--k)}
.og__main{margin-top:auto;margin-bottom:auto;padding-top:8px}
.og__kicker{display:flex;align-items:center;gap:18px;margin-bottom:24px}
/* tilted boxes cast a drop-shadow, not a box-shadow: a box-shadow leaves a hairline of yellow along a rotated edge */
.og .sticker{font-size:21px;padding:10px 15px 9px;box-shadow:none;filter:drop-shadow(4px 4px 0 var(--k))}
.og__from{display:inline-flex;align-items:center;gap:9px;font:700 22px/1.2 var(--f-ui);font-stretch:106%}
.og .dot{width:15px;height:15px;border-width:2.5px;border-color:var(--k)}
.og__domain{font:800 21px/1.2 var(--f-ui);font-stretch:108%;letter-spacing:.01em}

.og__title{font-size:88px;color:var(--k);text-wrap:balance;max-width:568px;margin:0} /* fitTitles() sets the size that fits */
.og__title--home{font-size:64px;max-width:600px}
.og .hl{display:inline-block;margin-top:.16em;padding:.1em .24em .08em;background:var(--c);color:var(--k);border:4px solid var(--k);
  transform:rotate(-2deg);text-shadow:none;filter:drop-shadow(6px 6px 0 var(--k))}
.og__facts{display:flex;gap:10px;margin-top:30px}
.og .fact{min-height:44px;padding:9px 16px;font-size:21px;border-width:3px;border-color:var(--k);background:var(--w);color:var(--k);box-shadow:3px 3px 0 var(--k)}

/* the art: our cover on a magenta starburst */
.og__art{position:relative}
.og__burst{position:absolute;left:50%;top:50%;width:488px;height:488px;margin:-244px 0 0 -246px;--bf:var(--m)}
.og__burst svg{transform:rotate(8deg)}
.og__cover{position:absolute;left:50%;top:50%;width:364px;aspect-ratio:5/6;margin:-218px 0 0 -186px;
  border:5px solid var(--k);border-radius:22px;filter:drop-shadow(12px 12px 0 var(--k));transform:rotate(3deg)}
.og .badge{top:16px;left:16px;font-size:18px;padding:7px 13px 6px;border-width:3px}

/* the home fan: two covers behind, the featured one in front */
.og__art--fan .og__cover{width:262px;margin:-157px 0 0 -131px;filter:drop-shadow(9px 9px 0 var(--k))}
.og__art--fan .og__cover--1{transform:translate(-150px, 18px) rotate(-11deg)}
.og__art--fan .og__cover--2{transform:translate(150px, 24px) rotate(10deg)}
.og__art--fan .og__cover--3{width:300px;margin:-184px 0 0 -150px;transform:translate(0, -4px) rotate(-1.5deg);filter:drop-shadow(12px 12px 0 var(--k))}
.og__art--fan .og__burst{width:470px;height:470px;margin:-235px 0 0 -235px}

/* the ribbon: the line every card carries, on ink */
.og__ribbon{display:flex;align-items:center;gap:18px;min-height:82px;padding:10px 26px 12px 22px;background:var(--k);color:var(--cream)}
.og__ribbon .age-mark{--am:54px;--mark-bg:var(--cream);--mark-text:var(--k);box-shadow:0 0 0 3px var(--cream)}
.og__line{font:600 27px/1.3 var(--f-body);letter-spacing:.005em}
.og__ribbon .og__domain{margin-left:auto;color:var(--y)}
.og__ribbon--long{min-height:98px}
.og__ribbon--long .og__line{font-size:24px;font-weight:500;line-height:1.3;text-wrap:balance}
.og__ribbon--long strong{font-weight:700}
`;

function cardPage(ctx, cards) {
  return `<!doctype html>
<html lang="en-GB" data-theme="light">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp(ctx)}">
<meta name="robots" content="noindex">
<title>Share cards</title>
<link rel="stylesheet" href="${siteCss()}">
<link rel="stylesheet" href="/__og.css">
</head>
<body>
${SPRITE}
${cards.join('\n')}
</body>
</html>
`;
}

/**
 * Runs in the page: sets each game title to the largest size (88px down to
 * 56px) at which it fits on two lines without a word overrunning the column;
 * a name too long for that gets three lines, from 64px down.
 */
function fitTitles() {
  for (const h of document.querySelectorAll('[data-fit]')) {
    const lines = () => Math.round(h.getBoundingClientRect().height / (parseFloat(getComputedStyle(h).fontSize) * 0.98));
    const fits = (max) => lines() <= max && h.scrollWidth <= h.clientWidth;
    let size = 88;
    const at = (px) => ((h.style.fontSize = `${px}px`), px);
    while (at(size) > 56 && !fits(2)) size -= 2;
    if (!fits(2)) for (size = 64; at(size) > 44 && !fits(3); ) size -= 2;
  }
}

/** Quantise to a 256-colour palette when that stays faithful; otherwise keep full colour. */
async function squeeze(buf) {
  const full = await sharp(buf).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  const pal = await sharp(buf).png({ palette: true, colours: 256, quality: 100, effort: 10, dither: 0.6, compressionLevel: 9 }).toBuffer();
  return pal.length < full.length ? pal : full;
}

async function makeCards() {
  ensureBuild();
  const { chromium } = await import('playwright');
  const { ctx, games } = allGames();
  const cards = [
    { id: 'home', file: 'og-home.png', html: homeCard(ctx, games) },
    { id: 'home-house', file: 'og-home-house.png', html: homeCard(ctx, games, { house: true }) },
  ].concat(
    games.map((g) => ({ id: g.slug, file: path.basename(g.image), html: gameCard(ctx, g) })),
  );
  for (const c of cards) if (!/^og-[a-z0-9-]+\.png$/.test(c.file)) throw new Error(`unexpected share card name ${c.file}`);

  const page1 = path.join(DIST, '__og.html');
  const css1 = path.join(DIST, '__og.css');
  await fs.writeFile(page1, cardPage(ctx, cards.map((c) => c.html)));
  await fs.writeFile(css1, CARD_CSS);
  const { server, base } = await serve(DIST);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
    // Nothing leaves the local server: no web fonts, no game art, no analytics.
    await context.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text())); // CSP refusals land here
    await page.goto(`${base}/__og.html`, { waitUntil: 'networkidle' });
    const fonts = await page.evaluate(async () => {
      await Promise.all(['900 40px Archivo', '800 20px Archivo', '600 20px "Radio Canada"', '700 20px "Radio Canada"'].map((f) => document.fonts.load(f)));
      await document.fonts.ready;
      return [...document.fonts].map((f) => `${f.family.replace(/"/g, '')}: ${f.status}`);
    });
    if (fonts.length < 2 || fonts.some((f) => !f.endsWith('loaded'))) throw new Error(`the site fonts didn't load (${fonts.join(', ')})`);
    if (errors.length) throw new Error(errors.join('\n'));

    await fs.mkdir(IMG, { recursive: true });
    await page.evaluate(fitTitles);
    // Then one card at a time, alone at the top left of a 1200 × 630 viewport.
    for (const c of cards) {
      const box = await page.evaluate((id) => {
        document.body.classList.add('one');
        for (const el of document.querySelectorAll('.og')) el.classList.toggle('is-on', el.id === `og-${id}`);
        const r = document.getElementById(`og-${id}`).getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      }, c.id);
      if (box.x !== 0 || box.y !== 0 || box.width !== 1200 || box.height !== 630) {
        throw new Error(`${c.file}: the card sits at ${box.x}, ${box.y} and is ${box.width} × ${box.height}, not 1200 × 630 at 0, 0`);
      }
      const shot = await page.screenshot({ clip: box, animations: 'disabled' });
      const out = await squeeze(shot);
      await fs.writeFile(path.join(IMG, c.file), out);
      console.log(`${c.file} ${kb(out.length)}`);
    }
  } finally {
    await browser.close();
    server.close();
    await fs.rm(page1, { force: true });
    await fs.rm(css1, { force: true });
  }
}

if (only !== 'cards') await makeIcons();
if (only !== 'icons') await makeCards();
