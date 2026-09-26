// End-to-end checks in a real browser (Playwright's Chromium).
//
//   npm run build && npm run check            checks dist/
//   npm run check -- --shots                   also saves screenshots to check-shots/
//
// 1. Every page at 360, 768 and 1440 px: one h1, no sideways scrolling,
//    no console errors, no request to any other origin.
// 2. Consent: builds a copy of the site with a test GA4 ID, confirms nothing
//    from Google loads before consent and that gtag loads after "Accept all".
// 3. Every game played start to finish with the keyboard only.
// 4. Reduced motion and forced dark theme load cleanly.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots') ? path.join(ROOT, 'check-shots') : null;
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.avif': 'image/avif', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
function serve(dir) {
  const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    try {
      const data = await fs.readFile(path.join(dir, p));
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(await fs.readFile(path.join(dir, '404.html')));
    }
  });
  return new Promise((r) => server.listen(0, () => r({ server, base: `http://localhost:${server.address().port}` })));
}

const agePassed = () => localStorage.setItem('oql.age', JSON.stringify({ answer: 'yes', at: Date.now() }));
const IGNORED_CONSOLE = /software WebGL|GPU stall|GL Driver Message/;

const browser = await chromium.launch();
if (SHOTS) await fs.mkdir(SHOTS, { recursive: true });

// ---------- 1. pages at three widths ----------
{
  console.log('Pages at 360, 768 and 1440 px');
  const { server, base } = await serve(path.join(ROOT, 'dist'));
  const sitemap = await fs.readFile(path.join(ROOT, 'dist/sitemap.xml'), 'utf8');
  const paths = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]).concat(['/no-such-page/']);
  for (const width of [360, 768, 1440]) {
    // Screenshots inject a style to unhide lazy sections, which needs CSP bypassed.
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, bypassCSP: Boolean(SHOTS) });
    await ctx.addInitScript(agePassed);
    for (const p of paths) {
      const page = await ctx.newPage();
      const errors = [];
      const foreign = [];
      page.on('console', (m) => m.type() === 'error' && !IGNORED_CONSOLE.test(m.text()) && !/404/.test(m.text()) && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('request', (r) => !r.url().startsWith(base) && !r.url().startsWith('data:') && foreign.push(r.url()));
      await page.goto(base + p, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => ({
        h1: document.querySelectorAll('h1').length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        wide: [...document.querySelectorAll('body *')]
          .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !el.closest('.table-wrap, [popover], dialog, .visually-hidden, .skip'))
          .slice(0, 3)
          .map((el) => el.className || el.tagName),
      }));
      const tag = `${width}px ${p}`;
      if (r.h1 !== 1) fail(`${tag}: ${r.h1} h1 elements`);
      if (r.overflow > 0 || r.wide.length) fail(`${tag}: scrolls sideways by ${r.overflow}px (${r.wide.join(', ')})`);
      if (errors.length) fail(`${tag}: console errors: ${errors.join(' | ')}`);
      if (foreign.length) fail(`${tag}: requests to other origins: ${foreign.join(', ')}`);
      if (SHOTS) {
        // Scroll through first so lazily rendered sections are drawn in the capture.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
            scrollTo(0, y);
            await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
          }
          scrollTo(0, 0);
        });
        await page.addStyleTag({ content: '.section, .prose-grid, .colophon { content-visibility: visible !important } *, *::before { animation: none !important }' });
        await page.screenshot({ path: path.join(SHOTS, `${width}${p.replace(/\//g, '_') || '_'}.png`), fullPage: true });
      }
      await page.close();
    }
    await ctx.close();
    pass(`${paths.length} pages at ${width}px checked`);
  }
  server.close();
}

// ---------- 2. consent with analytics switched on ----------
{
  console.log('Consent with a test GA4 ID');
  const tmpConfig = path.join(ROOT, 'site.config.check.json');
  const cfg = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
  cfg.analytics = { ga4: 'G-TEST000000', adsConversionId: '' };
  await fs.writeFile(tmpConfig, JSON.stringify(cfg));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, SITE_CONFIG: 'site.config.check.json', OUT_DIR: 'dist-check' }, stdio: 'ignore' });
  await fs.rm(tmpConfig);
  const { server, base } = await serve(path.join(ROOT, 'dist-check'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(agePassed);
  const page = await ctx.newPage();
  const foreign = [];
  page.on('request', (r) => !r.url().startsWith(base) && foreign.push(r.url()));
  await ctx.route(/googletagmanager|google-analytics/, (route) => route.fulfill({ status: 204, body: '' }));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => ({
    banner: !document.querySelector('.consent-banner')?.hidden,
    defaults: (window.dataLayer || []).map((a) => Array.from(a)).find((a) => a[0] === 'consent' && a[1] === 'default')?.[2],
    cookies: document.cookie,
  }));
  before.banner ? pass('banner shown on first visit') : fail('banner not shown');
  const denied = before.defaults && Object.values(before.defaults).every((v) => v === 'denied');
  denied ? pass(`Consent Mode v2 defaults all "denied" (${Object.keys(before.defaults).length} signals)`) : fail(`consent defaults: ${JSON.stringify(before.defaults)}`);
  foreign.length ? fail(`requests before consent: ${foreign.join(', ')}`) : pass('no requests to other origins before consent');
  before.cookies ? fail(`cookies before consent: ${before.cookies}`) : pass('no cookies before consent');
  const buttons = await page.$$eval('.consent-banner button', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return { text: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), bg: s.backgroundColor, border: s.borderColor, weight: s.fontWeight }; }));
  const [rej, , acc] = buttons;
  rej && acc && rej.h === acc.h && rej.bg === acc.bg && rej.weight === acc.weight && rej.border === acc.border
    ? pass(`"${rej.text}" and "${acc.text}" carry the same visual weight`)
    : fail(`reject/accept differ: ${JSON.stringify(buttons)}`);
  await page.click('.consent-banner [data-consent="reject"]');
  await page.waitForTimeout(400);
  foreign.length ? fail(`requests after "Reject all": ${foreign.join(', ')}`) : pass('nothing loads after "Reject all"');
  await page.click('.colophon [data-open="consent"]');
  await page.click('#consent [data-consent="accept"]');
  await page.waitForTimeout(600);
  foreign.some((u) => u.includes('googletagmanager.com/gtag/js?id=G-TEST000000')) ? pass('gtag.js loads only after "Accept all"') : fail('gtag.js did not load after accept');
  await ctx.close();
  server.close();
  await fs.rm(path.join(ROOT, 'dist-check'), { recursive: true, force: true });
}

// ---------- 3. games by keyboard ----------
{
  console.log('Games, keyboard only');
  const { server, base } = await serve(path.join(ROOT, 'dist'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(base + '/games/seven-systems/', { waitUntil: 'networkidle' });
  (await page.evaluate(() => document.getElementById('age-gate').open)) ? pass('age gate opens on first visit') : fail('age gate missing');
  await page.keyboard.press('Escape');
  (await page.evaluate(() => document.getElementById('age-gate').open)) ? pass('Escape does not skip the age question') : fail('age gate closed by Escape');
  await page.focus('[data-age="yes"]');
  await page.keyboard.press('Enter');

  const result = (g) => page.textContent(`[data-game="${g}"] [data-result]`);
  const busy = (sel) => page.waitForFunction((s) => document.querySelector(s).getAttribute('aria-busy') !== 'true', sel, { timeout: 10000 });
  await page.focus('[data-game="seven-systems"] [data-action="spin"]');
  await page.keyboard.press('3');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press(i === 2 ? 's' : 'Enter');
    await page.waitForTimeout(100);
    await busy('[data-game="seven-systems"] [data-action="spin"]');
  }
  const slot = await result('seven-systems');
  /Balance/.test(slot) && (await page.evaluate(() => document.activeElement.dataset.action)) === 'spin'
    ? pass(`slot: three spins by keyboard, focus kept on Spin ("${slot.slice(0, 60)}…")`)
    : fail(`slot keyboard play: "${slot}"`);

  await page.goto(base + '/games/lapidary-wheel/', { waitUntil: 'networkidle' });
  await page.focus('.bet');
  for (const key of ['Enter', 'ArrowRight', 'ArrowDown', 'Enter', 'Enter', 'Backspace', 's']) await page.keyboard.press(key);
  await page.waitForTimeout(100);
  await busy('[data-game="lapidary-wheel"] [data-action="spin"]');
  const wheel = await result('lapidary-wheel');
  /The ball lands on \d+ (Garnet|Jet|Malachite)/.test(wheel) ? pass(`wheel: bets placed and spun by keyboard ("${wheel.slice(0, 60)}…")`) : fail(`wheel keyboard play: "${wheel}"`);

  await page.goto(base + '/games/brilliant-twenty-one/', { waitUntil: 'networkidle' });
  await page.focus('[data-game="brilliant-twenty-one"] [data-action="deal"]');
  let hands = 0;
  for (let h = 0; h < 4; h++) {
    await page.keyboard.press('d');
    await page.waitForTimeout(1400);
    for (let k = 0; k < 6; k++) {
      if ((await page.getAttribute('[data-action="stand"]', 'aria-disabled')) === 'true') break;
      const t = await page.textContent('[data-player-total]');
      const n = Number((t.match(/\d+/g) || ['21']).pop());
      await page.keyboard.press(n < 16 ? 'h' : 's');
      await page.waitForTimeout(n < 16 ? 500 : 2800);
    }
    await page.waitForTimeout(600);
    if (/Balance/.test(await result('brilliant-twenty-one'))) hands++;
  }
  hands === 4 ? pass('twenty-one: four hands dealt and played by keyboard') : fail(`twenty-one: only ${hands} of 4 hands finished`);
  errors.length ? fail(`page errors: ${errors.join(' | ')}`) : pass('no page errors while playing');
  await ctx.close();

  // ---------- 4. preferences ----------
  console.log('Preferences');
  const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: 'dark', forcedColors: 'none' });
  await rm.addInitScript(agePassed);
  const p2 = await rm.newPage();
  const errs = [];
  p2.on('pageerror', (e) => errs.push(e.message));
  await p2.goto(base + '/', { waitUntil: 'networkidle' });
  await p2.click('[data-game="seven-systems"] [data-action="spin"]');
  await p2.waitForTimeout(300);
  const instant = await p2.textContent('[data-game="seven-systems"] [data-result]');
  /Balance/.test(instant) ? pass('reduced motion: a spin settles at once') : fail(`reduced motion spin: "${instant}"`);
  errs.length ? fail(`errors with reduced motion: ${errs.join(' | ')}`) : pass('dark theme and reduced motion load cleanly');
  await rm.close();

  for (const [w, sel] of [[1280, '.masthead [data-open="settings"]'], [390, '.dock [data-open="settings"]']]) {
    const c = await browser.newContext({ viewport: { width: w, height: 844 } });
    await c.addInitScript(agePassed);
    const pg = await c.newPage();
    const e = [];
    pg.on('pageerror', (x) => e.push(x.message));
    await pg.goto(base + '/games/seven-systems/', { waitUntil: 'networkidle' });
    await pg.click(sel);
    await pg.waitForTimeout(300);
    const open = await pg.evaluate(() => document.getElementById('settings').open);
    open && !e.length ? pass(`settings dialog opens at ${w}px`) : fail(`settings dialog at ${w}px: open=${open} ${e.join(' | ')}`);
    // Centred on wide screens, a sheet on the bottom edge on narrow ones.
    const gap = await pg.evaluate(() => {
      const r = document.getElementById('settings').getBoundingClientRect();
      const { clientWidth: vw, clientHeight: vh } = document.documentElement;
      return { left: r.left, right: vw - r.right, bottom: vh - r.bottom };
    });
    const placed = w >= 640 ? gap.left > 24 && Math.abs(gap.left - gap.right) < 24 : Math.abs(gap.bottom) < 2;
    placed ? pass(`settings dialog placed correctly at ${w}px`) : fail(`settings dialog misplaced at ${w}px: ${JSON.stringify(gap)}`);

    // Confirmations use the site's own dialog, whose buttons name the action.
    pg.on('dialog', (d) => (e.push(`native dialog: ${d.message()}`), d.dismiss()));
    await pg.click('[data-action="reset-balance"]');
    await pg.waitForTimeout(300);
    const asked = await pg.evaluate(() => ({
      open: document.getElementById('confirm').open,
      yes: document.querySelector('#confirm [value="yes"]').textContent,
      focus: document.activeElement.textContent,
    }));
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(150);
    const after = await pg.evaluate(() => ({ confirm: document.getElementById('confirm').open, settings: document.getElementById('settings').open }));
    asked.open && /^Reset to /.test(asked.yes) && asked.focus === 'Keep my balance' && !after.confirm && after.settings && !e.length
      ? pass(`reset asks first, names the action, Escape keeps the balance (${w}px)`)
      : fail(`reset confirmation at ${w}px: ${JSON.stringify({ asked, after, e })}`);
    await c.close();
  }
  server.close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} check(s) failed.` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
