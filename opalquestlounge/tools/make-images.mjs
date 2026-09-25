// Generates every raster image the site uses, from the site itself:
//   - game previews (AVIF + WebP, 480 and 960 wide), screenshots of the real game canvases
//   - Open Graph cards (1200 × 630 PNG) for the home page and each game
//   - app icons and favicon.ico, rasterised from favicon.svg
//
//   npm install && npm run build && npm run images && npm run build
//
// Needs Playwright's Chromium and sharp (both dev dependencies).
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PUB = path.join(ROOT, 'src/public');
const IMG = path.join(PUB, 'assets/img');
const ICONS = path.join(PUB, 'assets/icons');
const cfg = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
await fs.mkdir(IMG, { recursive: true });
await fs.mkdir(ICONS, { recursive: true });

// ---------- icons (no browser needed) ----------
const svg = await fs.readFile(path.join(PUB, 'favicon.svg'));
const JET = '#10131b';
async function onBackground(size, scale, background) {
  const inner = Math.round(size * scale);
  const art = await sharp(svg, { density: 600 }).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toBuffer();
}
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
await fs.writeFile(path.join(ICONS, 'icon-192.png'), await onBackground(192, 1, clear));
await fs.writeFile(path.join(ICONS, 'icon-512.png'), await onBackground(512, 1, clear));
await fs.writeFile(path.join(ICONS, 'icon-maskable-512.png'), await onBackground(512, 0.62, JET));
await fs.writeFile(path.join(ICONS, 'apple-touch-icon.png'), await onBackground(180, 0.78, JET));

// favicon.ico holding 16, 32 and 48 px PNGs
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => sharp(svg, { density: 300 }).resize(s, s, { fit: 'contain', background: clear }).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt8(0, e + 2);
  header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
await fs.writeFile(path.join(PUB, 'favicon.ico'), Buffer.concat([header, ...pngs]));
console.log('icons: done');

// ---------- a local server for dist/ ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const data = await fs.readFile(path.join(DIST, p));
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
await ctx.addInitScript(() => {
  localStorage.setItem('oql.age', JSON.stringify({ answer: 'yes', at: Date.now() }));
  localStorage.setItem('oql.settings', JSON.stringify({ theme: 'light', sound: false, haptics: false }));
});
const page = await ctx.newPage();

async function idle(selector) {
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('aria-busy') !== 'true', selector, { timeout: 15000 });
  await page.waitForTimeout(300);
}

// ---------- previews from the real games ----------
const shots = {};
await page.goto(`${BASE}/games/seven-systems/`, { waitUntil: 'networkidle' });
for (let i = 0; i < 30; i++) {
  await page.click('[data-action="spin"]');
  await idle('[data-action="spin"]');
  const label = await page.getAttribute('.slot__canvas', 'aria-label');
  if (/Middle row: [^.]*Opal/.test(label)) break;
}
shots['seven-systems'] = await page.locator('.slot__stage').screenshot();

await page.goto(`${BASE}/games/lapidary-wheel/`, { waitUntil: 'networkidle' });
await page.click('[data-bet="garnet"]');
await page.click('[data-bet="n17"]');
await page.click('[data-action="spin"]');
await idle('[data-action="spin"]');
shots['lapidary-wheel'] = await page.locator('.wheel__stage canvas').screenshot();

await page.goto(`${BASE}/games/brilliant-twenty-one/`, { waitUntil: 'networkidle' });
for (let i = 0; i < 12; i++) {
  await page.click('[data-action="deal"]');
  await page.waitForTimeout(1500);
  const court = await page.getAttribute('.twentyone__canvas', 'aria-label');
  if (/You: (King|Queen|Jack|Ace)/.test(court) && (await page.getAttribute('[data-action="hit"]', 'aria-disabled')) === 'false') break;
  if ((await page.getAttribute('[data-action="stand"]', 'aria-disabled')) === 'false') {
    await page.click('[data-action="stand"]');
    await page.waitForTimeout(2500);
  }
}
shots['brilliant-twenty-one'] = await page.locator('.twentyone__stage').screenshot();

for (const [slug, buf] of Object.entries(shots)) {
  for (const w of [480, 960]) {
    const h = Math.round((w * 2) / 3);
    const base = sharp(buf).resize(w, h, { fit: 'cover', position: 'centre' });
    await base.clone().avif({ quality: 52, effort: 6 }).toFile(path.join(IMG, `preview-${slug}-${w}.avif`));
    await base.clone().webp({ quality: 78 }).toFile(path.join(IMG, `preview-${slug}-${w}.webp`));
  }
}
console.log('previews: done');

// ---------- Open Graph cards ----------
const disclaimer = 'Free-to-play social casino game. No real-money gambling and no prizes of real-world value. For adults 18+.';
const cards = [
  { file: 'og-home.png', eyebrow: 'No. 000 · The lounge · Free to play', title: `Play for ${cfg.currency.plural}, <em>never for cash.</em>`, sub: 'Slots, roulette and twenty-one in a Victorian mineral cabinet.', img: shots['seven-systems'] },
  { file: 'og-seven-systems.png', eyebrow: 'No. 001 · Slot · 3 reels, 5 lines', title: 'Seven Systems', sub: 'A free crystal slot. Opal is wild. RTP 96.02%.', img: shots['seven-systems'] },
  { file: 'og-lapidary-wheel.png', eyebrow: 'No. 002 · European roulette', title: 'Lapidary Wheel', sub: 'Single-zero roulette in garnet, jet and malachite. RTP 97.30%.', img: shots['lapidary-wheel'] },
  { file: 'og-brilliant-twenty-one.png', eyebrow: 'No. 003 · Blackjack · 6 decks', title: 'Brilliant Twenty-One', sub: 'Free blackjack. A Brilliant pays 3 to 2. RTP about 99.6%.', img: shots['brilliant-twenty-one'] },
];
const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const c of cards) {
  const html = `<!doctype html><html lang="en-GB" data-theme="light"><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/css/site.css">
<style>
  body { margin: 0; padding: 0; }
  .card { box-sizing: border-box; width: 1200px; height: 630px; padding: 44px 56px; display: grid; grid-template-columns: 1fr 470px; gap: 48px; align-items: center; background: var(--paper); border: 14px solid var(--jet); }
  .text { display: grid; gap: 18px; align-content: center; }
  .brand { font-family: var(--display); font-size: 30px; font-weight: 600; display: flex; gap: 14px; align-items: center; }
  .brand img { width: 46px; height: 46px; }
  h1 { font-size: ${c.title.length > 40 ? 70 : 84}px; line-height: 0.98; letter-spacing: -0.02em; font-weight: 480; max-width: 11ch; }
  .sub { font-size: 26px; line-height: 1.35; color: var(--ink-2); }
  .label { font-size: 19px; line-height: 1.4; }
  .shot { width: 470px; border: 1.5px solid var(--ink); background: var(--paper); }
  .eyebrow { font-size: 17px; }
</style></head><body><div class="card">
  <div class="text">
    <p class="brand"><img src="/favicon.svg" alt="">${cfg.brand}</p>
    <p class="eyebrow">${c.eyebrow}</p>
    <h1>${c.title}</h1>
    <p class="sub">${c.sub}</p>
    <p class="label">${disclaimer}</p>
  </div>
  <img class="shot" src="data:image/png;base64,${c.img.toString('base64')}" alt="">
</div></body></html>`;
  // Render from a same-origin page so the site's fonts load.
  await fs.writeFile(path.join(DIST, '__og.html'), html);
  await og.goto(`${BASE}/__og.html`, { waitUntil: 'networkidle' });
  await og.evaluate(() => document.fonts.ready);
  await og.screenshot({ path: path.join(IMG, c.file) });
  const opt = await sharp(path.join(IMG, c.file)).png({ palette: false, compressionLevel: 9 }).toBuffer();
  await fs.writeFile(path.join(IMG, c.file), opt);
}
await fs.rm(path.join(DIST, '__og.html'), { force: true });
console.log('open graph cards: done');

await browser.close();
server.close();
