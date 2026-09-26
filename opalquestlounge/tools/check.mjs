// End-to-end checks in a real browser (Playwright's Chromium).
//
//   npm run check                        build three copies of the site and check them
//   npm run check -- --only=stage,axe    run some sections only (see SECTIONS below)
//   npm run check -- --shots             also save full-page screenshots to check-shots/
//   npm run check -- --keep              keep the temporary builds and say where they are
//
// It builds what it needs into a temporary folder:
//   pragmatic  the site as configured, with the Pragmatic Play demos on
//   fallback   "pragmatic.enabled": false, where our own slot Seven Systems
//              takes the demos' place
//   ga         a copy with a test GA4 ID, for the consent checks
//
// Nothing here reaches the internet. Pragmatic Play's demo host and Google's
// tag host are answered by stubs; a request to any other origin fails a check.
// Every wait is on page state (a data-state, an aria-disabled, a changed
// result line), never a fixed pause. Exits 1 if any check fails.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import {
  ROOT, fail, pass, expect, section, failures, summary, buildSite, sitePaths, serve, cleanTemp, tempDir,
  context, watch, until, mounted, focused, lostFocus, scrollThrough, pool, within, PRAGMATIC_HOST,
} from './lib/harness.mjs';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const SECTIONS = ['pages', 'stage', 'keyboard', 'lobby', 'consent', 'dialogs', 'prefs', 'chrome', 'axe'];
const ONLY = arg('only')?.split(',').filter(Boolean);
if (ONLY?.some((s) => !SECTIONS.includes(s))) {
  console.error(`Unknown section in --only. Choose from: ${SECTIONS.join(', ')}`);
  process.exit(2);
}
const want = (s) => !ONLY || ONLY.includes(s);
const SHOTS = process.argv.includes('--shots') ? path.join(ROOT, 'check-shots') : null;
const KEEP = process.argv.includes('--keep');

const t0 = Date.now();
// CHECK_TRACE=1 prints timestamps, for finding slow steps.
const trace = /^(1|true|yes)$/i.test(process.env.CHECK_TRACE || '') ? (m) => console.log(`    · ${((Date.now() - t0) / 1000).toFixed(1)} s ${m}`) : () => {};
// A run that stops making progress fails rather than hanging CI or a terminal.
const LIMIT_MIN = Number(process.env.CHECK_TIMEOUT_MIN || 30);
setTimeout(() => {
  console.log(`\nStopped after ${LIMIT_MIN} minutes (CHECK_TIMEOUT_MIN). ${failures.length} check(s) had failed by then.`);
  process.exit(1);
}, LIMIT_MIN * 60000).unref();

// ---------- builds ----------
console.log('Builds');
const withPragmatic = (on) => (c) => ({ ...c, pragmatic: { ...c.pragmatic, enabled: on } });
const builds = {};
const needed = [
  ['pragmatic', withPragmatic(true), SECTIONS.filter((s) => s !== 'consent')],
  ['fallback', withPragmatic(false), ['pages', 'keyboard', 'lobby', 'prefs', 'chrome', 'axe']],
  ['ga', (c) => ({ ...withPragmatic(true)(c), analytics: { ga4: 'G-TEST000000', adsConversionId: '' } }), ['consent', 'axe']],
];
for (const [name, edit, uses] of needed) {
  if (!uses.some(want)) continue;
  const b = await buildSite(name, edit);
  expect(b.ok, `${name} build ends with "Lint: no problems found."`, b.output.split('\n').filter((l) => /^error/.test(l)).slice(0, 12).join(' | ') || b.output.slice(-600));
  try {
    await fs.access(path.join(b.dir, 'index.html'));
    Object.assign(b, await serve(b.dir));
    builds[name] = b;
  } catch {
    fail(`${name} build wrote no pages; its checks are skipped`);
  }
}
const { pragmatic: PP, fallback: FB, ga: GA } = builds;
const modes = [PP, FB].filter(Boolean);

const browser = await chromium.launch();
if (SHOTS) await fs.mkdir(SHOTS, { recursive: true });

const STAGE = 'figure.stage[data-game="pragmatic"]';
const DEMO_PAGES = ['/', '/games/gates-of-olympus/', '/games/big-bass-bonanza/', '/games/wolf-gold/'];

// A stand-in for Pragmatic Play's demo host. The response to openGame.do can
// be held back so the loading state can be inspected. (The real host
// redirects to html5Game.do on the same host; Playwright can't route a
// redirect inside a cross-origin frame, so the stub answers directly.)
const STUB = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Stub demo</title></head><body><p>Stand-in for a Pragmatic Play demo.</p></body></html>`;
async function stubPragmatic(ctx) {
  const stub = { hits: [], hold: null };
  await ctx.route((u) => PRAGMATIC_HOST.test(u.hostname), async (route) => {
    const url = new URL(route.request().url());
    stub.hits.push(url.href);
    if (url.pathname.endsWith('/openGame.do') && stub.hold) await stub.hold;
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: STUB });
  });
  /** Hold the next openGame.do until the returned function is called. */
  stub.holdNext = () => {
    let release;
    stub.hold = new Promise((r) => (release = r));
    return () => {
      stub.hold = null;
      release();
    };
  };
  return stub;
}
// Every other origin is refused; watch() records the attempt.
const refuseOthers = (ctx, base) =>
  ctx.route((u) => !u.href.startsWith(base) && !PRAGMATIC_HOST.test(u.hostname) && /^https?:$/.test(u.protocol), (r) => r.abort('blockedbyclient'));

/** The stage's state as the checks read it. */
const stageInfo = (page) =>
  page.evaluate((S) => {
    const root = document.querySelector(S);
    const fs = root.querySelector('[data-action="fullscreen"]');
    const close = root.querySelector('[data-action="unload"]');
    const play = root.querySelector('.stage__over [data-action="load"]');
    const frame = root.querySelector('[data-stage] iframe');
    const shown = (el) => Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    let url = null;
    try {
      url = frame && new URL(frame.src);
    } catch {}
    return {
      state: root.dataset.state,
      symbol: root.dataset.symbol,
      framesInStage: root.querySelectorAll('iframe').length,
      framesOnPage: document.querySelectorAll('iframe').length,
      origin: url?.origin || '',
      params: url ? Object.fromEntries(url.searchParams) : {},
      allow: frame?.getAttribute('allow') || '',
      title: frame?.title || '',
      fs: fs ? fs.getAttribute('aria-disabled') : null,
      playShown: shown(play),
      closeShown: shown(close),
      focusClose: document.activeElement === close,
      focusPlay: document.activeElement === play,
      status: root.querySelector('[data-status]')?.textContent || '',
      blockedTitle: root.querySelector('[data-blocked-title]')?.textContent || '',
      blocked: root.querySelector('[data-blocked]')?.textContent || '',
    };
  }, STAGE);
const stageIs = (page, state, timeout) => until(page, ([S, s]) => document.querySelector(S)?.dataset.state === s, [STAGE, state], timeout);
const pressOn = async (page, selector) => {
  await page.focus(selector);
  await page.keyboard.press('Enter');
};
const settingsOpen = (page) => until(page, () => document.getElementById('settings')?.open);
/** The toast's text while it shows, or ''. */
const toastText = (page) => page.evaluate(() => (document.getElementById('toast').matches(':popover-open') ? document.querySelector('#toast .toast__msg').textContent : ''));

// ---------- a. every page at 360, 768 and 1440 px; b. no third-party requests ----------
if (want('pages'))
  await section('Pages at 360, 768 and 1440 px, both modes: no sideways scroll, no errors, nothing from other origins', async () => {
    for (const site of modes) {
      const paths = await sitePaths(site.dir);
      let loads = 0;
      const foreign = new Set();
      const pragmaticHits = new Set();
      for (const width of [360, 768, 1440]) {
        // Service workers stay on here: registering one is part of every page load.
        const ctx = await context(browser, { viewport: { width, height: 900 }, serviceWorkers: 'allow' });
        await refuseOthers(ctx, site.base);
        await ctx.route((u) => PRAGMATIC_HOST.test(u.hostname), (r) => r.abort('blockedbyclient'));
        const bad = [];
        const checkPage = async (page, p) => {
          const w = watch(page, site.base, { allow404: p === '/no-such-page/' });
          try {
            await page.goto(site.base + p, { waitUntil: 'networkidle', timeout: 30000 });
          } catch (e) {
            w.errors.push(`navigation: ${e.message.split('\n')[0]}`);
          }
          trace(`${site.name} ${width}px ${p} loaded`);
          await scrollThrough(page);
          trace(`${site.name} ${width}px ${p} scrolled`);
          const r = await page.evaluate(() => {
            const de = document.documentElement;
            const vw = de.clientWidth;
            const clippedBy = (el) => {
              for (let a = el.parentElement; a && a !== de; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') return a;
              return null;
            };
            const wide = [...document.body.querySelectorAll('*')].filter((el) => {
              const b = el.getBoundingClientRect();
              return b.width > 0 && b.right > vw + 1 && !clippedBy(el) && !el.closest('dialog:not([open]), [popover]:not(:popover-open)');
            });
            const outer = wide.filter((el) => !wide.includes(el.parentElement));
            const masked = [de, document.body].filter((el) => /hidden|clip/.test(getComputedStyle(el).overflowX)).map((el) => el.tagName.toLowerCase());
            return {
              h1: document.querySelectorAll('h1').length,
              overflow: de.scrollWidth - vw,
              masked,
              wide: outer.slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).trim().split(/\s+/).join('.')} (right ${Math.round(el.getBoundingClientRect().right)})`),
            };
          });
          const where = `${site.name} ${width}px ${p}`;
          if (r.h1 !== 1) bad.push(`${where}: ${r.h1} h1 elements`);
          if (r.overflow > 0) bad.push(`${where}: scrolls sideways by ${r.overflow}px (${r.wide.join(', ') || 'no single element found'})`);
          if (r.masked.length) bad.push(`${where}: overflow-x is hidden or clipped on ${r.masked.join(' and ')}, which masks sideways overflow`);
          if (w.errors.length) bad.push(`${where}: console or page errors: ${[...new Set(w.errors)].join(' | ')}`);
          w.foreign.forEach((u) => foreign.add(`${u} (from ${p})`));
          w.pragmatic.forEach((u) => pragmaticHits.add(`${u} (from ${p})`));
          if (SHOTS) {
            await fs.mkdir(path.join(SHOTS, site.name), { recursive: true });
            await page.screenshot({ path: path.join(SHOTS, site.name, `${width}${p.replace(/\//g, '_')}.png`), fullPage: true, animations: 'disabled' });
          }
          loads++;
        };
        await pool(paths, 3, async (p) => {
          const page = await ctx.newPage();
          await within(checkPage(page, p), 90000, 'the page').catch((e) => bad.push(`${site.name} ${width}px ${p}: ${e.message}`));
          await page.close();
        });
        await ctx.close();
        if (bad.length) bad.forEach(fail);
        else pass(`${site.name}: ${paths.length} pages at ${width}px: one h1, no sideways scroll, no console or page errors`);
      }
      expect(!foreign.size, `${site.name}: no request to another origin on any page before interaction (${loads} page loads)`, [...foreign].slice(0, 8).join(', '));
      expect(!pragmaticHits.size, `${site.name}: nothing requested from *.pragmaticplay.net before Play is pressed`, [...pragmaticHits].slice(0, 8).join(', '));
    }
  });

// ---------- a2. the home first screen on phones, and one name for demo credits ----------
if (want('pages'))
  await section('Home first screen on phones (both modes): the play control above the dock; demo credits by one name', async () => {
    for (const site of modes) {
      // Spec 13: ribbon, H1 and the stage with its play button above the dock
      // at the spec's phone sizes (0: 390×844 and 360×780), demos on or off.
      for (const [width, height] of [[360, 780], [390, 844]]) {
        const ctx = await context(browser, { viewport: { width, height } });
        await refuseOthers(ctx, site.base);
        await ctx.route((u) => PRAGMATIC_HOST.test(u.hostname), (r) => r.abort('blockedbyclient'));
        const page = await ctx.newPage();
        await page.goto(site.base + '/', { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const r = await page.evaluate(() => {
          const play = document.querySelector('.hero .stage .btn--play, .hero [data-action="spin"]');
          const dock = document.querySelector('.dock');
          return {
            play: play ? `${play.className} "${play.textContent.trim().replace(/\s+/g, ' ')}"` : null,
            bottom: play && Math.round(play.getBoundingClientRect().bottom),
            dock: dock && Math.round(dock.getBoundingClientRect().top),
            scrollY: Math.round(scrollY),
          };
        });
        expect(r.play && r.dock && r.scrollY === 0 && r.bottom <= r.dock - 4,
          `${site.name} ${width}×${height}: the hero's play control ends above the dock (${r.bottom} ≤ ${r.dock} − 4)`, JSON.stringify(r));
        await ctx.close();
      }
      // The demos' play money is "demo credits" everywhere (spec 12), never a second name.
      const hits = [];
      const files = (await fs.readdir(site.dir, { recursive: true })).filter((f) => /\.(html|js)$/.test(f));
      for (const f of files) if (/practice credit/i.test(await fs.readFile(path.join(site.dir, f), 'utf8'))) hits.push(f);
      expect(!hits.length, `${site.name}: no page or script calls demo credits "practice credits" (${files.length} files)`, hits.join(', '));
    }
  });

// ---------- c. the Pragmatic Play demo stage ----------
if (want('stage') && PP)
  await section('Pragmatic Play demo stage (host stubbed)', async () => {
    for (const p of DEMO_PAGES) {
      const ctx = await context(browser, { viewport: { width: 1280, height: 900 } });
      await refuseOthers(ctx, PP.base);
      const stub = await stubPragmatic(ctx);
      const page = await ctx.newPage();
      const w = watch(page, PP.base);
      await page.goto(PP.base + p, { waitUntil: 'networkidle' });
      const n = await page.locator(STAGE).count();
      if (n !== 1) {
        fail(`${p}: expected one demo stage, found ${n}`);
        await ctx.close();
        continue;
      }
      if (!(await mounted(page, STAGE))) {
        fail(`${p}: pragmatic.js never started on the stage`);
        await ctx.close();
        continue;
      }
      const idle = await stageInfo(page);
      const T = `${p} (${idle.symbol})`;
      trace(`${T} mounted`);
      expect(idle.state === 'idle' && idle.framesOnPage === 0 && !stub.hits.length && idle.playShown && !idle.closeShown,
        `${T}: idle, with Play shown, no iframe and nothing asked of Pragmatic Play`, JSON.stringify({ ...idle, hits: stub.hits }));
      const hasFs = idle.fs !== null;
      if (hasFs) expect(idle.fs === 'true', `${T}: fullscreen is aria-disabled before the demo loads`, `aria-disabled=${idle.fs}`);

      // Play, from the keyboard. The demo host is held so the loading state can be seen.
      const release = stub.holdNext();
      await pressOn(page, `${STAGE} .stage__over [data-action="load"]`);
      const loading = await stageIs(page, 'loading');
      const l = await stageInfo(page);
      expect(loading && l.focusClose && (!hasFs || l.fs === 'true'),
        `${T}: loading: focus moves to Close demo${hasFs ? ' and fullscreen stays aria-disabled' : ''}`, JSON.stringify({ state: l.state, focus: await focused(page), fs: l.fs }));
      release();
      const ready = await stageIs(page, 'ready', 15000);
      trace(`${T} ready`);
      const r = await stageInfo(page);
      const allow = r.allow.split(/\s*;\s*/).map((s) => s.split(' ')[0]);
      let site = '';
      try {
        site = new URL(r.params.websiteUrl).origin;
      } catch {}
      expect(ready && r.framesOnPage === 1 && r.framesInStage === 1, `${T}: Play creates exactly one iframe and the stage becomes ready`, JSON.stringify({ state: r.state, frames: r.framesOnPage }));
      expect(r.params.gameSymbol === idle.symbol && r.params.lang === 'en' && r.params.cur === 'FUN' && r.params.jurisdiction === 'UK' && Boolean(site),
        `${T}: iframe src has gameSymbol, lang=en, cur=FUN, jurisdiction=UK and websiteUrl`, JSON.stringify(r.params));
      expect(PRAGMATIC_HOST.test(r.origin ? new URL(r.origin).hostname : ''), `${T}: iframe loads from Pragmatic Play's demo host`, r.origin);
      expect(allow.includes('fullscreen'), `${T}: iframe allow includes fullscreen`, `allow="${r.allow}"`);
      expect(Boolean(r.title), `${T}: iframe has a title`);
      expect(r.focusClose, `${T}: ready: focus is on Close demo`, await focused(page));
      if (hasFs) expect(r.fs === 'false', `${T}: fullscreen is enabled once ready`, `aria-disabled=${r.fs}`);
      expect(/loaded/.test(r.status), `${T}: the status region says the demo loaded`, `"${r.status}"`);

      // Close demo, from the keyboard.
      await pressOn(page, `${STAGE} [data-action="unload"]`);
      const closed = await stageIs(page, 'idle');
      const c = await stageInfo(page);
      expect(closed && c.framesOnPage === 0 && c.focusPlay && (!hasFs || c.fs === 'true'),
        `${T}: Close demo returns to idle, removes the iframe and puts focus back on Play`, JSON.stringify({ state: c.state, frames: c.framesOnPage, focus: await focused(page), fs: c.fs }));

      trace(`${T} closed`);
      // The game's own Home button posts omni-api.goTo to the parent in demo mode.
      await pressOn(page, `${STAGE} .stage__over [data-action="load"]`);
      await stageIs(page, 'ready', 15000);
      const goTo = JSON.stringify({ action: 'omni-api.goTo', actionData: 'lobby' });
      // A message from any other origin is ignored. (This listener runs after pragmatic.js's own.)
      await page.evaluate((m) => new Promise((res) => {
        addEventListener('message', () => res(), { once: true });
        postMessage(m, '*');
      }), goTo);
      const ignored = await stageInfo(page);
      expect(ignored.state === 'ready' && ignored.framesInStage === 1, `${T}: omni-api.goTo from our own origin is ignored`, ignored.state);
      const game = page.frames().find((f) => {
        try {
          return PRAGMATIC_HOST.test(new URL(f.url()).hostname);
        } catch {
          return false;
        }
      });
      if (!game) fail(`${T}: no Pragmatic frame to post from`);
      else {
        await game.evaluate((m) => parent.postMessage(m, '*'), goTo);
        const home = await stageIs(page, 'idle');
        const h = await stageInfo(page);
        expect(home && h.framesOnPage === 0, `${T}: the demo's {"action":"omni-api.goTo","actionData":"lobby"} message closes it`, JSON.stringify({ state: h.state, frames: h.framesOnPage }));
      }

      trace(`${T} goTo done`);
      // A 5-minute break from Settings removes the demo and shows the blocked state.
      await pressOn(page, `${STAGE} .stage__over [data-action="load"]`);
      await stageIs(page, 'ready', 15000);
      await page.click('.masthead [data-open="settings"]');
      if (!(await settingsOpen(page))) fail(`${T}: Settings did not open`);
      else {
        await page.click('#settings [data-action="break-5"]');
        const blocked = await stageIs(page, 'blocked');
        const b = await stageInfo(page);
        const paused = await page.evaluate(() => JSON.parse(localStorage.getItem('oql.pause') || 'null'));
        expect(blocked && b.framesOnPage === 0 && !b.playShown && /break/i.test(b.blockedTitle) && /break/i.test(b.blocked) && paused?.kind === 'break',
          `${T}: a 5-minute break removes the iframe and shows the blocked state`, JSON.stringify({ state: b.state, frames: b.framesOnPage, title: b.blockedTitle, text: b.blocked, paused }));
        await page.keyboard.press('Escape');
        await until(page, () => !document.getElementById('settings').open);
        expect((await focused(page)) !== 'body', `${T}: closing Settings returns focus to the page`, 'focus is on <body>');
      }
      trace(`${T} break done`);
      const lost = await lostFocus(page);
      expect(!lost.length, `${T}: focus never fell to <body>`, lost.join(', '));
      expect(!w.errors.length, `${T}: no console or page errors`, w.errors.join(' | '));
      expect(!w.foreign.filter((u) => !PRAGMATIC_HOST.test(new URL(u).hostname)).length, `${T}: no other origin contacted`, w.foreign.join(', '));
      await ctx.close();
    }

    // Age not confirmed: the stage is blocked and even a scripted click asks nothing of Pragmatic Play.
    for (const [answer, title] of [[null, /confirm your age/i], ['no', /locked/i]]) {
      const ctx = await context(browser, { age: false });
      await refuseOthers(ctx, PP.base);
      const stub = await stubPragmatic(ctx);
      const page = await ctx.newPage();
      const w = watch(page, PP.base);
      await page.goto(PP.base + '/games/gates-of-olympus/', { waitUntil: 'networkidle' });
      await until(page, () => document.getElementById('age-gate')?.open);
      await mounted(page, STAGE);
      if (answer) await page.click(`[data-age="${answer}"]`);
      const blocked = await stageIs(page, 'blocked');
      await page.evaluate((S) => document.querySelector(`${S} .stage__over [data-action="load"]`).click(), STAGE);
      const b = await stageInfo(page);
      const label = answer ? 'after answering "No" to the age question' : 'with the age not confirmed';
      expect(blocked && b.state === 'blocked' && !b.playShown && title.test(b.blockedTitle) && b.framesOnPage === 0 && !stub.hits.length,
        `Play is blocked ${label}, even when clicked by script`, JSON.stringify({ state: b.state, title: b.blockedTitle, frames: b.framesOnPage, hits: stub.hits }));
      if (!answer) {
        await page.click('[data-age="yes"]');
        const open = await stageIs(page, 'idle');
        expect(open && (await stageInfo(page)).playShown, 'answering "Yes" to the age question opens the stage');
      }
      expect(!w.errors.length, `no console or page errors ${label}`, w.errors.join(' | '));
      await ctx.close();
    }
  });

// ---------- d. keyboard-only play ----------
if (want('keyboard'))
  await section('Keyboard-only play', async () => {
    const tick = (page) => page.evaluate(() => window.__oql.results);
    const resultOf = (page, game) => page.textContent(`[data-game="${game}"] [data-result]`);

    if (PP) {
      // Lapidary Wheel: chips placed and lifted on the board with the keyboard, then S spins.
      const ctx = await context(browser);
      await refuseOthers(ctx, PP.base);
      const page = await ctx.newPage();
      const w = watch(page, PP.base);
      await page.goto(PP.base + '/games/lapidary-wheel/', { waitUntil: 'networkidle' });
      const G = '[data-game="lapidary-wheel"]';
      if (!(await mounted(page, G))) fail('wheel: the game never started');
      else {
        await page.focus(`${G} .bet[tabindex="0"]`);
        const keys = ['Enter', 'ArrowRight', 'ArrowDown', 'Enter', 'Enter', 'Backspace'];
        for (const k of keys) await page.keyboard.press(k);
        const total = await page.textContent(`${G} [data-total]`);
        const onBoard = await page.$$eval(`${G} .bet__chip`, (els) => els.filter((e) => e.textContent.trim()).length);
        expect(total === '2' && onBoard === 2, 'wheel: arrows move around the board, Enter places chips, Backspace lifts one', `on the table: ${total} Carats on ${onBoard} bets`);
        const before = await tick(page);
        await page.keyboard.press('s');
        const done = await until(page, ([G, n]) => {
          const r = document.querySelector(`${G} [data-result]`);
          return window.__oql.results > n && /The ball lands on \d+ (Garnet|Jet|Malachite)/.test(r.textContent) && document.querySelector(`${G} [data-action="spin"]`).getAttribute('aria-busy') === 'false';
        }, [G, before], 20000);
        const res = await resultOf(page, 'lapidary-wheel');
        const live = await page.getAttribute(`${G} [data-result]`, 'aria-live');
        const history = await page.$$eval(`${G} [data-history] li`, (l) => l.map((li) => li.getAttribute('aria-label')));
        expect(done && live === 'polite' && history.length === 1, 'wheel: S spins, and the result is announced in a polite live region', `"${res.slice(0, 90)}", aria-live=${live}, history=${history}`);
        const f = await focused(page);
        expect(f !== 'body' && (await page.evaluate((G) => document.querySelector(G).contains(document.activeElement), G)), 'wheel: focus stays in the game', f);
      }
      const lost = await lostFocus(page);
      expect(!lost.length && !w.errors.length, 'wheel: focus never fell to <body>, no errors', [...lost, ...w.errors].join(' | '));
      await ctx.close();
    }

    if (PP) {
      // Brilliant Twenty-One: four hands. Hit below 17, otherwise stand. Each
      // move waits until the table is steady again: Deal on offer (the hand is
      // over) or Stand on offer with the hand still under 21.
      const ctx = await context(browser);
      await refuseOthers(ctx, PP.base);
      const page = await ctx.newPage();
      const w = watch(page, PP.base);
      await page.goto(PP.base + '/games/brilliant-twenty-one/', { waitUntil: 'networkidle' });
      const G = '[data-game="brilliant-twenty-one"]';
      const steady = ([G, n]) => {
        const root = document.querySelector(G);
        if (window.__oql.results <= n) return false;
        if (root.querySelector('[data-action="deal"]').getAttribute('aria-disabled') === 'false') return 'over';
        const total = Number((root.querySelector('[data-player-total]').textContent.match(/\d+/g) || ['99']).pop());
        return root.querySelector('[data-action="stand"]').getAttribute('aria-disabled') === 'false' && total < 21 ? 'player' : false;
      };
      const move = async (key) => {
        const n = await tick(page);
        await page.keyboard.press(key);
        if (!(await until(page, steady, [G, n], 20000))) return 'stuck';
        return page.evaluate(steady, [G, -1]);
      };
      await mounted(page, G);
      const dealReady = await until(page, (G) => document.querySelector(`${G} [data-action="deal"]`).getAttribute('aria-disabled') === 'false', G);
      if (!dealReady) fail('twenty-one: Deal never became available');
      else {
        await page.focus(`${G} [data-action="deal"]`);
        let hands = 0;
        const log = [];
        for (let h = 0; h < 4; h++) {
          let state = await move('d');
          for (let k = 0; state === 'player' && k < 10; k++) {
            const t = await page.textContent(`${G} [data-player-total]`);
            const total = Number((t.match(/\d+/g) || ['21']).pop());
            state = await move(total < 17 ? 'h' : 's');
          }
          const res = await resultOf(page, 'brilliant-twenty-one');
          if (state === 'over' && /Balance/.test(res)) hands++;
          else log.push(`hand ${h + 1}: ${state}, "${res.slice(0, 80)}"`);
          const f = await focused(page);
          if (f === 'body') log.push(`hand ${h + 1}: focus on <body>`);
        }
        expect(hands === 4 && !log.length, 'twenty-one: four hands dealt and played by keyboard (D, H, S)', log.join(' | '));
        const f = await focused(page);
        expect(/data-action=deal/.test(f), 'twenty-one: focus is back on Deal after the last hand', f);

        // A hit that busts or makes 21 ends the hand after a short pause. A key
        // pressed in that pause must do nothing: the hand is settled once. Hit
        // until the hand ends (it always does), then press S straight away.
        await page.evaluate((G) => {
          const r = document.querySelector(`${G} [data-result]`);
          window.__oqlSaid = [];
          new MutationObserver(() => window.__oqlSaid.push(r.textContent)).observe(r, { childList: true, characterData: true, subtree: true });
        }, G);
        const total = () => page.evaluate((G) => Number((document.querySelector(`${G} [data-player-total]`).textContent.match(/\d+/g) || ['0']).pop()), G);
        const seen = [];
        for (let h = 0; h < 8 && seen.length < 2; h++) {
          const before = await page.evaluate(() => JSON.parse(localStorage.getItem('oql.wallet')).balance);
          await page.evaluate(() => (window.__oqlSaid.length = 0));
          if ((await move('d')) !== 'player') continue; // a Brilliant: no hit to make
          for (let k = 0; k < 12; k++) {
            await page.keyboard.press('h');
            if ((await total()) < 21) continue;
            const standOff = await page.getAttribute(`${G} [data-action="stand"]`, 'aria-disabled');
            await page.keyboard.press('s');
            await until(page, (G) => document.querySelector(`${G} [data-action="deal"]`).getAttribute('aria-disabled') === 'false', G);
            // Let a second, stray settlement (if any) land before counting.
            await until(page, () => window.__oqlSaid.filter((t) => /Balance/.test(t)).length > 1, undefined, 1500);
            const said = await page.evaluate(() => window.__oqlSaid.slice());
            const after = await page.evaluate(() => JSON.parse(localStorage.getItem('oql.wallet')).balance);
            const last = said.filter((t) => /Balance/.test(t)).at(-1) || '';
            const back = Number((last.match(/([\d,]+) back/) || [0, '0'])[1].replace(/,/g, ''));
            seen.push({
              total: await total(),
              standOff,
              dealerTurns: said.filter((t) => /^The dealer turns over/.test(t)).length,
              settlements: said.filter((t) => /Balance/.test(t)).length,
              balance: `${before} → ${after}, expected ${before - 10 + back}`,
              ok: after === before - 10 + back,
            });
            break;
          }
        }
        const once = seen.length === 2 && seen.every((x) => x.dealerTurns === 1 && x.settlements === 1 && x.ok);
        expect(once, 'twenty-one: S pressed in the pause after a hand-ending hit is ignored; the hand settles once', JSON.stringify(seen));
      }
      const lost = await lostFocus(page);
      expect(!lost.length && !w.errors.length, 'twenty-one: focus never fell to <body>, no errors', [...lost, ...w.errors].join(' | '));
      await ctx.close();
    }

    if (FB) {
      // Seven Systems (fallback build only): stake 3, then three spins with Enter and S.
      const ctx = await context(browser);
      await refuseOthers(ctx, FB.base);
      const page = await ctx.newPage();
      const w = watch(page, FB.base);
      await page.goto(FB.base + '/games/seven-systems/', { waitUntil: 'networkidle' });
      const G = '[data-game="seven-systems"]';
      if (!(await mounted(page, G))) fail('slot: the game never started');
      else {
        await until(page, (G) => document.querySelector(`${G} [data-action="spin"]`).getAttribute('aria-disabled') === 'false', G);
        await page.focus(`${G} [data-action="spin"]`);
        await page.keyboard.press('3');
        const stake = await page.evaluate((G) => document.querySelector(`${G} .stake input:checked`)?.value, G);
        let spins = 0;
        for (const key of ['Enter', 's', 'Enter']) {
          const n = await tick(page);
          await page.keyboard.press(key);
          const ok = await until(page, ([G, n]) => {
            const spin = document.querySelector(`${G} [data-action="spin"]`);
            return window.__oql.results > n && spin.getAttribute('aria-busy') === 'false' && /Balance/.test(document.querySelector(`${G} [data-result]`).textContent);
          }, [G, n], 20000);
          if (ok) spins++;
        }
        const f = await focused(page);
        expect(spins === 3 && stake === (await page.$$eval(`${G} .stake input`, (r) => r[2].value)) && /data-action=spin/.test(f),
          'slot: 3 picks the third stake, then three spins by keyboard with focus kept on Spin', `${spins} spins, stake ${stake}, focus ${f}, "${(await resultOf(page, 'seven-systems')).slice(0, 80)}"`);
      }
      const lost = await lostFocus(page);
      expect(!lost.length && !w.errors.length, 'slot: focus never fell to <body>, no errors', [...lost, ...w.errors].join(' | '));
      await ctx.close();
    }
  });

// ---------- e. lobby filters on /games/ ----------
if (want('lobby'))
  await section('Lobby filters on /games/', async () => {
    for (const site of modes) {
      const ctx = await context(browser);
      await refuseOthers(ctx, site.base);
      const page = await ctx.newPage();
      const w = watch(page, site.base);
      await page.goto(site.base + '/games/', { waitUntil: 'networkidle' });
      const ready = await until(page, () => document.querySelector('[data-filters][data-ready]'));
      if (!ready) {
        fail(`${site.name}: the filter bar never started`);
        await ctx.close();
        continue;
      }
      const chips = await page.$$eval('[data-filters] button.chip[data-filter]', (b) => b.map((x) => x.dataset.filter));
      const read = () =>
        page.evaluate(() => {
          const tiles = [...document.querySelectorAll('[data-lobby] li[data-tags]')];
          const count = document.querySelector('[data-filter-count]');
          return {
            pressed: [...document.querySelectorAll('[data-filters] .chip')].filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.filter),
            tiles: tiles.map((t) => ({ tags: t.dataset.tags.split(/\s+/).filter(Boolean), hidden: t.hidden })),
            count: count?.textContent.trim(),
            live: count?.getAttribute('aria-live'),
            emptyGroupsShown: [...document.querySelectorAll('[data-lobby-group]')].filter((g) => !g.hidden && !g.querySelector('li[data-tags]:not([hidden])')).length,
            fullGroupsHidden: [...document.querySelectorAll('[data-lobby-group]')].filter((g) => g.hidden && g.querySelector('li[data-tags]:not([hidden])')).length,
            focus: document.activeElement?.dataset?.filter,
          };
        });
      const judge = (s, filter) => {
        const total = s.tiles.length;
        const wrong = s.tiles.filter((t) => t.hidden === (filter === 'all' || t.tags.includes(filter)));
        const shown = s.tiles.filter((t) => !t.hidden).length;
        const text = shown === total ? `Showing all ${total} games` : `Showing ${shown} of ${total} games`;
        return {
          ok: s.pressed.length === 1 && s.pressed[0] === filter && !wrong.length && s.count === text && s.live === 'polite' && !s.emptyGroupsShown && !s.fullGroupsHidden,
          why: JSON.stringify({ pressed: s.pressed, wrongTiles: wrong.length, count: s.count, expected: text, live: s.live, emptyGroupsShown: s.emptyGroupsShown }),
        };
      };
      const start = judge(await read(), 'all');
      expect(start.ok && chips[0] === 'all' && chips.length > 1, `${site.name}: starts on All with every tile shown (${chips.join(', ')})`, start.why);
      // Each chip in turn: by click, then (for the next) by arrow key and Enter.
      for (const [i, f] of chips.entries()) {
        if (f === 'all') continue;
        if (i % 2) await page.click(`[data-filters] .chip[data-filter="${f}"]`);
        else {
          await page.focus(`[data-filters] .chip[data-filter="${chips[i - 1]}"]`);
          await page.keyboard.press('ArrowRight');
          await page.keyboard.press('Enter');
        }
        await until(page, (f) => document.querySelector(`[data-filters] .chip[data-filter="${f}"]`).getAttribute('aria-pressed') === 'true', f);
        const s = await read();
        const j = judge(s, f);
        expect(j.ok, `${site.name}: "${f}" chip pressed: tiles, groups and the live count follow its tag${i % 2 ? '' : ' (reached with the arrow key)'}`, j.why);
      }
      // Pressing the pressed chip again goes back to All.
      const last = chips.at(-1);
      await page.click(`[data-filters] .chip[data-filter="${last}"]`);
      await until(page, () => document.querySelector('[data-filters] .chip[data-filter="all"]').getAttribute('aria-pressed') === 'true');
      const back = judge(await read(), 'all');
      expect(back.ok, `${site.name}: pressing the pressed chip again goes back to All`, back.why);
      expect(!w.errors.length, `${site.name}: no errors on the lobby`, w.errors.join(' | '));
      await ctx.close();
    }
  });

// ---------- e2. links into a group the filter has hidden ----------
if (want('lobby'))
  await section('Lobby on /games/: nav and dock links into a group the filter has hidden', async () => {
    for (const site of modes) {
      const ctx = await context(browser);
      await refuseOthers(ctx, site.base);
      await ctx.route((u) => PRAGMATIC_HOST.test(u.hostname), (r) => r.abort('blockedbyclient'));
      const page = await ctx.newPage();
      const w = watch(page, site.base);
      await page.goto(site.base + '/games/', { waitUntil: 'networkidle' });
      if (!(await until(page, () => document.querySelector('[data-filters][data-ready]')))) {
        fail(`${site.name}: the filter bar never started`);
        await ctx.close();
        continue;
      }
      // A chip that empties each group: any slot feature empties #tables, Table games empties #slots.
      const hiding = await page.evaluate(() => {
        const out = {};
        for (const id of ['slots', 'tables']) {
          const tags = [...document.querySelectorAll(`#${id} li[data-tags]`)].map((t) => t.dataset.tags.split(/\s+/));
          out[id] = [...document.querySelectorAll('[data-filters] .chip[data-filter]')].map((c) => c.dataset.filter).find((f) => f !== 'all' && !tags.some((t) => t.includes(f)));
        }
        return out;
      });
      // Choose a filter (a click on the chip already pressed would go back to All).
      const press = async (f) => {
        const chip = `[data-filters] .chip[data-filter="${f}"]`;
        if ((await page.getAttribute(chip, 'aria-pressed')) !== 'true') await page.click(chip);
        await until(page, (f) => document.querySelector(`[data-filters] .chip[data-filter="${f}"]`).getAttribute('aria-pressed') === 'true', f);
      };
      const state = (id) =>
        page.evaluate((id) => {
          const g = document.getElementById(id);
          return {
            hash: location.hash,
            hidden: g.hidden,
            top: Math.round(g.getBoundingClientRect().top),
            pressed: document.querySelector('[data-filters] .chip[aria-pressed="true"]')?.dataset.filter,
            count: document.querySelector('[data-filter-count]').textContent,
          };
        }, id);
      // Shown, scrolled to (under the sticky header, not far below it), and the filter back on All.
      const landed = async (id, what) => {
        await until(page, (id) => {
          const g = document.getElementById(id);
          const t = g.getBoundingClientRect().top;
          return !g.hidden && t >= 0 && t < 240;
        }, id, 3000);
        const s = await state(id);
        expect(s.hash === `#${id}` && !s.hidden && s.top >= 0 && s.top < 240 && s.pressed === 'all' && /^Showing all /.test(s.count),
          `${site.name}: ${what}: #${id} is shown and scrolled to, and the filter is back on All ("${s.count}")`, JSON.stringify(s));
      };
      if (!hiding.tables || !hiding.slots) {
        fail(`${site.name}: no chip empties a group (${JSON.stringify(hiding)})`);
        await ctx.close();
        continue;
      }
      await press(hiding.tables);
      await page.click('.nav a[href="/games/#tables"]');
      await landed('tables', `"${hiding.tables}" chip, then the nav's Table games`);
      // The same link again, with #tables already in the address (no hashchange).
      await page.evaluate(() => scrollTo(0, 0));
      await press(hiding.tables);
      await page.click('.nav a[href="/games/#tables"]');
      await landed('tables', `"${hiding.tables}" chip, then Table games again with #tables already in the address`);
      // From the keyboard, the other way round.
      await press(hiding.slots);
      await page.focus('.nav a[href="/games/#slots"]');
      await page.keyboard.press('Enter');
      await landed('slots', `"${hiding.slots}" chip, then Enter on the nav's Slots`);
      // Back to #tables while a filter hides it.
      await press(hiding.tables);
      await page.goBack();
      await landed('tables', `"${hiding.tables}" chip, then Back to #tables`);
      // Back from a game page still brings the filter back, #tables in the address or not.
      await press(hiding.tables);
      const tile = await page.$eval('#slots li[data-tags]:not([hidden]) .tile__title a', (a) => a.getAttribute('href'));
      await Promise.all([page.waitForURL((u) => u.pathname === tile), page.click(`#slots .tile__title a[href="${tile}"]`)]);
      await page.goBack();
      await until(page, () => document.querySelector('[data-filters][data-ready]'));
      const back = await state('tables');
      expect(back.pressed === hiding.tables && back.hidden && back.hash === '#tables',
        `${site.name}: Back from a game page to /games/#tables keeps the "${hiding.tables}" filter`, JSON.stringify(back));
      expect(!w.errors.length, `${site.name}: no errors`, w.errors.join(' | '));
      await ctx.close();

      // Phones: the dock's Tables.
      const phone = await context(browser, { viewport: { width: 390, height: 844 } });
      await refuseOthers(phone, site.base);
      const mob = await phone.newPage();
      await mob.goto(site.base + '/games/', { waitUntil: 'networkidle' });
      await until(mob, () => document.querySelector('[data-filters][data-ready]'));
      await mob.click(`[data-filters] .chip[data-filter="${hiding.tables}"]`);
      await until(mob, () => document.getElementById('tables').hidden);
      await mob.click('.dock a[href="/games/#tables"]');
      await until(mob, () => {
        const t = document.getElementById('tables');
        return !t.hidden && t.getBoundingClientRect().top < 240 && t.getBoundingClientRect().top >= 0;
      }, undefined, 3000);
      const ph = await mob.evaluate(() => ({ hidden: document.getElementById('tables').hidden, top: Math.round(document.getElementById('tables').getBoundingClientRect().top) }));
      expect(!ph.hidden && ph.top >= 0 && ph.top < 240, `${site.name} 390px: "${hiding.tables}" chip, then the dock's Tables: #tables is shown and scrolled to`, JSON.stringify(ph));
      await phone.close();
    }
  });

// ---------- e3. lobby layout at every width ----------
// Spec 7.7 and 5: a tile's two tags are never cut short (one that doesn't fit
// drops to a second row whole), a tile's body stays inside the tile, and
// every row of the lobby reaches its right edge, from 320 to 1440 px.
if (want('lobby'))
  await section('Lobby layout on / and /games/, 320–1440 px in 1 px steps: whole tags, bodies inside tiles, rows that close', async () => {
    const measure = () => {
      const shown = (el) => el.getClientRects().length > 0;
      const out = [];
      for (const s of document.querySelectorAll('[data-lobby] .tile__facts span')) {
        if (shown(s) && s.scrollWidth > s.clientWidth) out.push(`tag "${s.textContent}" cut short on ${s.closest('.tile').dataset.cover}`);
      }
      for (const t of document.querySelectorAll('[data-lobby] li.tile')) {
        if (!shown(t)) continue;
        const over = t.querySelector('.tile__body').getBoundingClientRect().right - t.getBoundingClientRect().right;
        if (over > 0.5) out.push(`body wider than the tile on ${t.dataset.cover}`);
      }
      for (const lobby of document.querySelectorAll('[data-lobby]')) {
        const right = lobby.getBoundingClientRect().right;
        const rows = new Map();
        for (const t of lobby.querySelectorAll('li.tile')) {
          if (!shown(t)) continue;
          const r = t.getBoundingClientRect();
          rows.set(Math.round(r.top), Math.max(rows.get(Math.round(r.top)) ?? -Infinity, r.right));
        }
        const short = [...rows.values()].filter((r) => right - r > 2).length;
        if (short) out.push(`${short} row(s) of ${rows.size} end short of the lobby's right edge`);
      }
      return out;
    };
    const runs = modes.flatMap((site) => ['/', '/games/'].map((p) => ({ site, p })));
    await pool(runs, 4, async ({ site, p }) => {
      const ctx = await context(browser, { viewport: { width: 1440, height: 900 } });
      await refuseOthers(ctx, site.base);
      await ctx.route((u) => PRAGMATIC_HOST.test(u.hostname), (r) => r.abort('blockedbyclient'));
      const page = await ctx.newPage();
      await page.goto(site.base + p, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const seen = new Map(); // problem → widths
      for (let width = 320; width <= 1440; width++) {
        await page.setViewportSize({ width, height: 900 });
        for (const problem of await page.evaluate(measure)) {
          if (!seen.has(problem)) seen.set(problem, []);
          seen.get(problem).push(width);
        }
      }
      const span = (ws) => ws.reduce((acc, x) => {
        const last = acc.at(-1);
        if (last && x === last[1] + 1) last[1] = x;
        else acc.push([x, x]);
        return acc;
      }, []).map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');
      if (!seen.size) pass(`${site.name} ${p}: 1,121 widths: every tag whole, every tile body inside its tile, every row closed`);
      for (const [problem, ws] of seen) fail(`${site.name} ${p}: ${problem} at ${span(ws)} px`);
      await ctx.close();
    });
  });

// ---------- f. consent with a test GA4 ID ----------
if (want('consent') && GA)
  await section('Consent with a test GA4 ID', async () => {
    const ctx = await context(browser);
    // Routes registered later run first: Google's stub goes after the refusal of everything else.
    await refuseOthers(ctx, GA.base);
    const google = [];
    await ctx.route(/^https:\/\/([a-z0-9-]+\.)*(googletagmanager|google-analytics|analytics\.google|doubleclick|google)\.[a-z.]+\//, (route) => {
      google.push(route.request().url());
      return /gtag\/js/.test(route.request().url())
        ? route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.dataLayer = window.dataLayer || [];' })
        : route.fulfill({ status: 204, body: '' });
    });
    const page = await ctx.newPage();
    const w = watch(page, GA.base);
    await page.goto(GA.base + '/', { waitUntil: 'networkidle' });
    const shown = await until(page, () => document.querySelector('.consent-banner') && !document.querySelector('.consent-banner').hidden);
    expect(shown, 'the cookie banner shows on the first visit');
    const before = await page.evaluate(() => ({
      defaults: (window.dataLayer || []).map((a) => Array.from(a)).find((a) => a[0] === 'consent' && a[1] === 'default')?.[2],
      cookies: document.cookie,
      tag: Boolean(document.querySelector('script[src*="googletagmanager"]')),
    }));
    const d = before.defaults || {};
    const v2 = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'];
    expect(v2.every((k) => d[k] === 'denied') && Object.values(d).every((v) => v === 'denied'),
      `Consent Mode v2 defaults are all "denied" (${Object.keys(d).length} signals)`, JSON.stringify(before.defaults));
    expect(!w.foreign.length && !before.tag, 'nothing from Google (or anyone else) before a choice', w.foreign.join(', '));
    expect(!before.cookies, 'no cookies before a choice', before.cookies);

    const weigh = (sel) =>
      page.$$eval(sel, (bs) => bs.map((b) => {
        const r = b.getBoundingClientRect();
        const s = getComputedStyle(b);
        return { text: b.textContent.trim(), kind: b.dataset.consent || b.dataset.open, w: Math.round(r.width), h: Math.round(r.height), look: [s.backgroundColor, s.color, s.borderTopColor, s.borderTopWidth, s.borderTopStyle, s.fontWeight, s.fontSize, s.boxShadow, s.textDecorationLine].join(' ') };
      }));
    const equal = (list) => {
      const rej = list.find((b) => b.kind === 'reject');
      const acc = list.find((b) => b.kind === 'accept');
      return rej && acc && rej.look === acc.look && rej.h === acc.h && Math.abs(rej.w - acc.w) <= 1;
    };
    const banner = await weigh('.consent-banner button');
    expect(equal(banner), '"Reject all" and "Accept all" carry equal visual weight in the banner', JSON.stringify(banner));

    await page.click('.consent-banner [data-consent="reject"]');
    await until(page, () => document.querySelector('.consent-banner').hidden && localStorage.getItem('oql.consent'));
    const after = await page.evaluate(() => ({ tag: Boolean(document.querySelector('script[src*="googletagmanager"]')), stored: JSON.parse(localStorage.getItem('oql.consent')) }));
    expect(!after.tag && !google.length && !w.foreign.length && after.stored?.analytics === false, 'nothing loads after "Reject all"', JSON.stringify({ ...after, google }));

    await page.click('.colophon [data-open="consent"]');
    await until(page, () => document.getElementById('consent').open);
    const dialog = await weigh('#consent .consent__actions button');
    expect(equal(dialog), '"Reject all" and "Accept all" carry equal visual weight in Cookie settings', JSON.stringify(dialog));
    const gtag = page.waitForRequest((r) => /googletagmanager\.com\/gtag\/js\?id=G-TEST000000/.test(r.url()), { timeout: 10000 }).then(() => true, () => false);
    await page.click('#consent [data-consent="accept"]');
    expect(await gtag, 'gtag.js loads only after "Accept all"');
    const other = w.foreign.filter((u) => !/googletagmanager\.com/.test(u));
    expect(!other.length, 'no other origin contacted', other.join(', '));
    expect(!w.errors.length, 'no console or page errors', w.errors.join(' | '));
    await ctx.close();

    // The banner is fixed at the bottom but first in the Tab order, never covers a focused control,
    // and a choice made in it (or in Manage) leaves focus on the page, not on <body>.
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const vw = viewport.width;
      const fresh = await context(browser, { viewport });
      await refuseOthers(fresh, GA.base);
      const pg = await fresh.newPage();
      await pg.goto(GA.base + '/', { waitUntil: 'networkidle' });
      await until(pg, () => !document.querySelector('.consent-banner').hidden);
      const covered = [];
      let first = null;
      for (let i = 0; i < 80; i++) {
        await pg.keyboard.press('Tab');
        const r = await pg.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return { end: true };
          const banner = document.querySelector('.consent-banner');
          if (banner.contains(el)) return { inBanner: true };
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height) return {};
          let seen = 0;
          for (let x = 0; x < 5; x++) for (let y = 0; y < 3; y++) {
            const hit = document.elementFromPoint(b.left + ((x + 0.5) / 5) * b.width, b.top + ((y + 0.5) / 3) * b.height);
            if (hit && !banner.contains(hit)) seen++;
          }
          return seen ? {} : { covered: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) };
        });
        if (r.end) break;
        if (r.inBanner && first === null) first = i + 1;
        if (r.covered) covered.push(r.covered);
      }
      expect(first !== null && first <= 3 && !covered.length, `${vw}px: the cookie banner comes first in the Tab order and never covers a focused control`, JSON.stringify({ first, covered: covered.slice(0, 6) }));

      await pg.focus('.consent-banner [data-consent="reject"]');
      await pg.keyboard.press('Enter');
      await until(pg, () => document.querySelector('.consent-banner').hidden);
      const afterReject = await pg.evaluate(() => ({ focus: document.activeElement?.id || document.activeElement?.tagName, toast: document.querySelector('#toast .toast__msg').textContent }));
      await until(pg, () => /Analytics are off/.test(document.querySelector('#toast .toast__msg').textContent));
      const said = await toastText(pg);
      expect(afterReject.focus === 'main' && /Saved\. Analytics are off\./.test(said), `${vw}px: "Reject all" in the banner hides it, moves focus to the content and says what was saved`, JSON.stringify({ ...afterReject, said }));

      await pg.evaluate(() => localStorage.removeItem('oql.consent'));
      await pg.reload({ waitUntil: 'networkidle' });
      await until(pg, () => !document.querySelector('.consent-banner').hidden);
      await pressOn(pg, '.consent-banner [data-open="consent"]');
      await until(pg, () => document.getElementById('consent').open);
      await pressOn(pg, '#consent [data-consent="save"]');
      await until(pg, () => !document.getElementById('consent').open && document.querySelector('.consent-banner').hidden);
      await until(pg, () => document.activeElement?.id === 'main', undefined, 2000);
      const afterSave = await pg.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
      const lost = await lostFocus(pg);
      expect(afterSave === 'main' && !lost.length, `${vw}px: "Save choices" in Manage (opened from the banner) moves focus to the content, not <body>`, JSON.stringify({ afterSave, lost }));
      await fresh.close();
    }
  });

// ---------- g. dialogs ----------
if (want('dialogs') && PP)
  await section('Dialogs', async () => {
    for (const [width, opener, where] of [[1280, '.masthead [data-open="settings"]', 'the header'], [390, '.dock [data-open="settings"]', 'the dock']]) {
      const ctx = await context(browser, { viewport: { width, height: 844 } });
      await refuseOthers(ctx, PP.base);
      const page = await ctx.newPage();
      const w = watch(page, PP.base);
      page.on('dialog', (d) => {
        w.errors.push(`native dialog: ${d.message()}`);
        d.dismiss();
      });
      await page.goto(PP.base + '/games/lapidary-wheel/', { waitUntil: 'networkidle' });
      // A balance that isn't the starting one, so a reset would show.
      await page.evaluate(() => localStorage.setItem('oql.wallet', JSON.stringify({ balance: 420 })));
      await page.reload({ waitUntil: 'networkidle' });
      await pressOn(page, opener);
      const open = await settingsOpen(page);
      const inside = await page.evaluate(() => document.getElementById('settings').contains(document.activeElement));
      expect(open && inside, `${width}px: Settings opens from ${where}, with focus inside it`, await focused(page));
      const box = await page.evaluate(() => {
        const r = document.getElementById('settings').getBoundingClientRect();
        const { clientWidth: vw, clientHeight: vh } = document.documentElement;
        return { left: Math.round(r.left), right: Math.round(vw - r.right), top: Math.round(r.top), bottom: Math.round(vh - r.bottom), width: Math.round(r.width), vw };
      });
      // SPEC 7.13: dialogs are centred cards at every width (on phones with a
      // small gap on each side), never pinned to a corner.
      const placed = width >= 721
        ? box.left > 24 && Math.abs(box.left - box.right) <= 2 && (Math.abs(box.top - box.bottom) <= 2 || box.top <= 16)
        : box.left >= 8 && Math.abs(box.left - box.right) <= 2 && box.top >= 0 && box.bottom >= 0;
      expect(placed, `${width}px: Settings is ${width >= 721 ? 'centred' : 'a centred card inside the screen'}`, JSON.stringify(box));

      // Reality-check interval: 15, 30 or 60 minutes, kept across page loads.
      for (const m of ['15', '60', '30']) {
        await page.check(`#settings input[name="rc"][value="${m}"]`);
        await until(page, (m) => document.querySelector('#settings [data-rg-state="reality"]').textContent === `Every ${m} min`, m);
        await page.reload({ waitUntil: 'networkidle' });
        await pressOn(page, opener);
        await settingsOpen(page);
        const kept = await page.evaluate(() => ({
          checked: document.querySelector('#settings input[name="rc"]:checked')?.value,
          pill: document.querySelector('#settings [data-rg-state="reality"]').textContent,
          stored: JSON.parse(localStorage.getItem('oql.limits') || '{}').reality,
        }));
        expect(kept.checked === m && kept.pill === `Every ${m} min` && String(kept.stored) === m, `${width}px: a ${m}-minute reality check is kept after a reload`, JSON.stringify(kept));
      }

      // Reset balance asks first, with buttons that name the action; Escape keeps the balance.
      await pressOn(page, '#settings [data-action="reset-balance"]');
      await until(page, () => document.getElementById('confirm').open);
      const asked = await page.evaluate(() => ({
        title: document.getElementById('confirm-title').textContent,
        yes: document.querySelector('#confirm [value="yes"]').textContent,
        no: document.querySelector('#confirm [value="no"]').textContent,
        focus: document.activeElement.textContent,
      }));
      // A dialog's close event fires a frame after it closes; wait for it, so
      // the next question can't be answered by this one's (see the race check below).
      await page.evaluate(() => {
        window.__oqlClosed = false;
        document.getElementById('confirm').addEventListener('close', () => (window.__oqlClosed = true), { once: true });
      });
      await page.keyboard.press('Escape');
      await until(page, () => !document.getElementById('confirm').open && window.__oqlClosed);
      const kept = await page.evaluate(() => ({
        settings: document.getElementById('settings').open,
        stored: JSON.parse(localStorage.getItem('oql.wallet')).balance,
        shown: document.querySelector('.masthead [data-balance]').textContent,
      }));
      expect(/^Reset to 1,000 Carats$/.test(asked.yes) && asked.no === 'Keep my balance' && asked.focus === 'Keep my balance' && /reset/i.test(asked.title),
        `${width}px: Reset asks first, names the action, and starts on "Keep my balance"`, JSON.stringify(asked));
      expect(kept.settings && kept.stored === 420 && kept.shown === '420', `${width}px: Escape keeps the balance and leaves Settings open`, JSON.stringify(kept));
      await pressOn(page, '#settings [data-action="reset-balance"]');
      await until(page, () => document.getElementById('confirm').open);
      await page.keyboard.press('Shift+Tab');
      const onYes = await focused(page);
      await page.keyboard.press('Enter');
      const reset = await until(page, () => document.querySelector('.masthead [data-balance]').textContent === '1,000' && JSON.parse(localStorage.getItem('oql.wallet')).balance === 1000);
      expect(reset, `${width}px: Shift+Tab, Enter on "Reset to 1,000 Carats" resets the balance`,
        `focus was on ${onYes}; ${JSON.stringify(await page.evaluate(() => ({ confirm: document.getElementById('confirm').open, value: document.getElementById('confirm').returnValue, shown: document.querySelector('.masthead [data-balance]').textContent, stored: localStorage.getItem('oql.wallet') })))}`);
      expect(!w.errors.length, `${width}px: no native dialogs, console or page errors`, w.errors.join(' | '));
      await ctx.close();
    }

    // A question asked again straight after the last one closed (Escape, then
    // Enter within a frame) must get its own answer. The browser fires a
    // dialog's close event a frame after it closes, so a stale close event
    // must not settle the new question.
    {
      const ctx = await context(browser);
      await refuseOthers(ctx, PP.base);
      const page = await ctx.newPage();
      await page.goto(PP.base + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.setItem('oql.wallet', JSON.stringify({ balance: 420 })));
      await page.reload({ waitUntil: 'networkidle' });
      await page.click('.masthead [data-open="settings"]');
      await settingsOpen(page);
      const r = await within(page.evaluate(() => new Promise((done) => {
        const d = document.getElementById('confirm');
        const reset = document.querySelector('#settings [data-action="reset-balance"]');
        const frames = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));
        reset.click(); // asked
        d.close(); // closed, as Escape does
        reset.click(); // asked again before the first close event has fired
        frames(() => {
          const open = d.open;
          d.querySelector('[value="yes"]').click(); // "Reset to 1,000 Carats"
          frames(() => done({ openAfterStaleClose: open, balance: JSON.parse(localStorage.getItem('oql.wallet')).balance }));
        });
      })), 10000, 'the page').catch((e) => ({ error: e.message }));
      expect(r.openAfterStaleClose && r.balance === 1000, 'a confirmation asked again at once gets its own answer (a stale close event does not settle it)', JSON.stringify(r));
      await ctx.close();
    }

    // The age question on a first visit. Escape doesn't skip it.
    const ctx = await context(browser, { age: false, viewport: { width: 390, height: 844 } });
    await refuseOthers(ctx, PP.base);
    const page = await ctx.newPage();
    const w = watch(page, PP.base);
    await page.goto(PP.base + '/', { waitUntil: 'networkidle' });
    const asked = await until(page, () => document.getElementById('age-gate')?.open);
    const inside = await page.evaluate(() => document.getElementById('age-gate').contains(document.activeElement));
    expect(asked && inside, 'the age question opens on the first visit, with focus inside it');
    // Wait for Escape's cancel event to have been handled, then see whether the question is still open.
    await page.evaluate(() => {
      window.__oqlCancel = false;
      document.getElementById('age-gate').addEventListener('cancel', () => setTimeout(() => (window.__oqlCancel = true)), { once: true });
    });
    await page.keyboard.press('Escape');
    const cancelled = await until(page, () => window.__oqlCancel);
    expect(cancelled && (await page.evaluate(() => document.getElementById('age-gate').open)), 'Escape does not skip the age question', cancelled ? 'the dialog closed' : 'Escape never reached the dialog');
    await page.click('[data-age="yes"]');
    await until(page, () => !document.getElementById('age-gate').open);
    await page.reload({ waitUntil: 'networkidle' });
    // The stage mounts after app.js has run startAgeGate(), so by then the question would be open.
    await mounted(page, STAGE);
    expect(!(await page.evaluate(() => document.getElementById('age-gate').open)), 'once answered, the age question is not asked again');
    expect(!w.errors.length, 'no console or page errors around the age question', w.errors.join(' | '));
    await ctx.close();
  });

// ---------- h. preferences ----------
if (want('prefs'))
  await section('Preferences: reduced motion and the dark theme', async () => {
    for (const site of modes) {
      // Reduced motion: a wheel spin settles at once (the full animation takes 4.6 s).
      const ctx = await context(browser, { reducedMotion: 'reduce' });
      await refuseOthers(ctx, site.base);
      const page = await ctx.newPage();
      const w = watch(page, site.base);
      await page.goto(site.base + '/games/lapidary-wheel/', { waitUntil: 'networkidle' });
      const G = '[data-game="lapidary-wheel"]';
      await mounted(page, G);
      await page.click(`${G} .bet[data-bet="garnet"]`);
      await page.click(`${G} [data-action="spin"]`);
      const settled = await until(page, (G) => /The ball lands on/.test(document.querySelector(`${G} [data-result]`).textContent), G, 1000);
      expect(settled, `${site.name}: reduced motion: a wheel spin settles at once`, `"${await page.textContent(`${G} [data-result]`)}"`);
      expect(!w.errors.length, `${site.name}: no errors with reduced motion`, w.errors.join(' | '));
      await ctx.close();

      // Night: from the device setting, and from Settings on a light device.
      const pagesToTry = ['/', '/games/', '/games/lapidary-wheel/', '/games/brilliant-twenty-one/', site === PP ? '/games/gates-of-olympus/' : '/games/seven-systems/'];
      const dark = await context(browser, { colorScheme: 'dark' });
      await refuseOthers(dark, site.base);
      const bad = [];
      for (const p of pagesToTry) {
        const pg = await dark.newPage();
        const pw = watch(pg, site.base);
        await pg.goto(site.base + p, { waitUntil: 'networkidle' });
        const bg = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const lum = luminance(bg);
        if (!(lum < 0.1)) bad.push(`${p}: body background ${bg} is not dark`);
        if (pw.errors.length) bad.push(`${p}: ${pw.errors.join(' | ')}`);
        await pg.close();
      }
      await dark.close();
      expect(!bad.length, `${site.name}: the dark theme (device setting) loads cleanly on ${pagesToTry.length} pages`, bad.join('; '));

      const light = await context(browser, { colorScheme: 'light' });
      await refuseOthers(light, site.base);
      const pg = await light.newPage();
      const pw = watch(pg, site.base);
      await pg.goto(site.base + '/', { waitUntil: 'networkidle' });
      const dayBg = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
      await pg.click('.masthead [data-open="settings"]');
      await settingsOpen(pg);
      await pg.check('#settings input[name="theme"][value="dark"]');
      await pg.keyboard.press('Escape');
      await pg.reload({ waitUntil: 'networkidle' });
      const night = await pg.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor }));
      expect(luminance(dayBg) > 0.5 && night.theme === 'dark' && luminance(night.bg) < 0.1 && !pw.errors.length,
        `${site.name}: Night chosen in Settings on a light device is kept after a reload`, JSON.stringify({ dayBg, ...night, errors: pw.errors }));
      await light.close();
    }
  });

function luminance(css) {
  const m = css.match(/rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (!m) return NaN;
  const [r, g, b] = m.slice(1, 4).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---------- i. site chrome ----------
// The header, the dock and the dialogs, and the safer play tools over time
// (Playwright's fake clock stands in for the minutes and the midnight).
const LONDON = { timezoneId: 'Europe/London' };
/** Tab forward through a page; report the stops that end up wholly under the fixed dock (none of them visible). */
async function tabUnderDock(page, max = 90) {
  const hidden = [];
  let stops = 0;
  await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      const dock = document.querySelector('.dock');
      if (!el || el === document.body) return { end: true };
      if (!dock || dock.contains(el) || getComputedStyle(dock).position !== 'fixed') return { skip: true };
      const top = dock.getBoundingClientRect().top;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || b.top < top - 4) return { ok: true };
      // Wholly under the dock: no sampled point of it shows above the dock.
      for (let x = 0; x < 5; x++) for (let y = 0; y < 3; y++) {
        const px = b.left + ((x + 0.5) / 5) * b.width;
        const py = b.top + ((y + 0.5) / 3) * b.height;
        if (py < top - 4 && el.contains(document.elementFromPoint(px, py))) return { ok: true };
      }
      return { bad: `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}" (top ${Math.round(b.top)}, dock ${Math.round(top)})` };
    });
    if (r.end) break;
    stops++;
    if (r.bad) hidden.push(r.bad);
  }
  return { stops, hidden };
}

if (want('chrome') && PP)
  await section('Site chrome: the header, the dock, Settings, breaks and limits over time, the age question, no JavaScript', async () => {
    // A break taken in an open tab ends by itself: the games and the demo open again, and a toast says so.
    for (const p of ['/games/gates-of-olympus/', '/games/lapidary-wheel/']) {
      const ctx = await context(browser, LONDON);
      await refuseOthers(ctx, PP.base);
      await stubPragmatic(ctx);
      const page = await ctx.newPage();
      const w = watch(page, PP.base);
      await page.clock.install({ time: new Date('2026-09-26T14:00:00+01:00') });
      await page.goto(PP.base + p, { waitUntil: 'networkidle' });
      const G = p.includes('lapidary') ? '[data-game="lapidary-wheel"]' : STAGE;
      await page.clock.runFor(2000);
      await mounted(page, G);
      await page.click('.masthead [data-open="settings"]');
      await settingsOpen(page);
      await page.click('#settings [data-action="break-5"]');
      await page.keyboard.press('Escape');
      const read = () => page.evaluate((G) => {
        const root = document.querySelector(G);
        return { state: root.dataset.state, locked: root.hasAttribute('data-locked'), pause: localStorage.getItem('oql.pause') };
      }, G);
      await page.clock.runFor(2000);
      const during = await read();
      await page.clock.runFor(5 * 60 * 1000);
      const after = await read();
      const said = await toastText(page);
      const locked = (s) => s.state === 'blocked' || s.locked;
      expect(locked(during) && !locked(after) && !after.pause && /break is over/i.test(said),
        `${p}: a 5-minute break locks the game, and 5 minutes later it opens again by itself with a toast`, JSON.stringify({ during, after, said }));
      expect(!w.errors.length, `${p}: no errors while the break runs out`, w.errors.join(' | '));
      await ctx.close();
    }

    // The daily limit in a tab left open over midnight: blocked before, open after, and blocked again (demo closed) at the next day's limit.
    {
      const ctx = await context(browser, LONDON);
      await refuseOthers(ctx, PP.base);
      await stubPragmatic(ctx);
      await ctx.addInitScript(() => {
        if (window.top !== window) return;
        localStorage.setItem('oql.limits', JSON.stringify({ minutes: 30, pending: null }));
        localStorage.setItem('oql.playtime', JSON.stringify({ date: '2026-09-26', seconds: 1795 }));
      });
      const page = await ctx.newPage();
      const w = watch(page, PP.base);
      await page.clock.install({ time: new Date('2026-09-26T23:58:00+01:00') });
      await page.goto(PP.base + '/games/gates-of-olympus/', { waitUntil: 'networkidle' });
      await page.clock.runFor(10000);
      const before = await stageInfo(page);
      await page.clock.runFor(112000); // to 00:00:02
      const said = await toastText(page);
      await page.clock.runFor(70000);
      const midnight = await stageInfo(page);
      expect(before.state === 'blocked' && /daily limit/i.test(before.blockedTitle) && midnight.state === 'idle' && midnight.playShown && /new day/i.test(said),
        'a daily limit reached before midnight lifts at midnight in an open tab, with no reload', JSON.stringify({ before: before.state, midnight: midnight.state, said }));
      await pressOn(page, `${STAGE} .stage__over [data-action="load"]`);
      await page.clock.runFor(2000);
      const ready = (await stageInfo(page)).state;
      await page.clock.runFor(31 * 60 * 1000);
      const next = await stageInfo(page);
      expect(ready === 'ready' && next.state === 'blocked' && next.framesOnPage === 0,
        'the next day, reaching the limit again closes the open demo', JSON.stringify({ ready, after: next.state, frames: next.framesOnPage }));
      expect(!w.errors.length, 'no errors around midnight', w.errors.join(' | '));
      await ctx.close();
    }

    // Settings' daily limit saves only on its button: arrowing through the closed select changes nothing.
    {
      const ctx = await context(browser);
      await refuseOthers(ctx, PP.base);
      const page = await ctx.newPage();
      const w = watch(page, PP.base);
      await page.goto(PP.base + '/games/lapidary-wheel/', { waitUntil: 'networkidle' });
      await pressOn(page, '.masthead [data-open="settings"]');
      await settingsOpen(page);
      const S = '#settings select[name="limit"]';
      const B = '#settings [data-action="save-limit"]';
      const limitsNow = () => page.evaluate(() => JSON.parse(localStorage.getItem('oql.limits') || 'null'));
      await page.focus(S);
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
      const picked = { value: await page.inputValue(S), stored: await limitsNow(), label: await page.textContent(B), toast: await toastText(page) };
      expect(picked.value === '120' && !picked.stored?.minutes && /2 hours/.test(picked.label) && !picked.toast,
        'Settings: arrowing to "2 hours" saves nothing, and the button says what saving will do', JSON.stringify(picked));
      await pressOn(page, B);
      await until(page, () => JSON.parse(localStorage.getItem('oql.limits') || '{}').minutes === 120);
      const saved = { stored: await limitsNow(), pill: await page.textContent('#settings [data-rg-state="limit"]'), off: await page.getAttribute(B, 'aria-disabled') };
      expect(saved.stored?.minutes === 120 && !saved.stored.pending && saved.pill === '2 hours a day' && saved.off === 'true',
        'Settings: "Save limit" applies 2 hours a day', JSON.stringify(saved));
      await page.focus(S);
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
      const up = { value: await page.inputValue(S), stored: await limitsNow(), label: await page.textContent(B) };
      await page.keyboard.press('Escape');
      await until(page, () => !document.getElementById('settings').open);
      await pressOn(page, '.masthead [data-open="settings"]');
      await settingsOpen(page);
      const reopened = { value: await page.inputValue(S), stored: await limitsNow() };
      expect(up.value === '0' && up.stored.minutes === 120 && /off from tomorrow/i.test(up.label) && reopened.value === '120' && reopened.stored.minutes === 120 && !reopened.stored.pending,
        'Settings: arrowing up to "No limit" and closing unsaved keeps 2 hours; reopening shows it', JSON.stringify({ up, reopened }));

      // Confirmations from inside Settings reach screen readers: the page's toast is inert behind the modal, so they go to the dialog's own status line.
      await pressOn(page, '#settings [data-action="break-5"]');
      await until(page, () => /Break started/.test(document.querySelector('#settings [data-dialog-status]').textContent));
      const cdp = await ctx.newCDPSession(page);
      const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#settings [data-dialog-status]' });
      const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
      const node = nodes[0] || {};
      const status = { role: node.role?.value, ignored: node.ignored, text: await page.textContent('#settings [data-dialog-status]'), toastOpen: Boolean(await toastText(page)) };
      expect(status.role === 'status' && !status.ignored && /Break started/.test(status.text) && !status.toastOpen,
        'Settings: "Take a 5-minute break" is confirmed in a status line inside the dialog (not the inert toast)', JSON.stringify(status));
      expect(!w.errors.length, 'no errors in Settings', w.errors.join(' | '));
      await ctx.close();
    }

    // The responsible gaming page: the playtime keeps ticking, and a limit set in Settings shows on the page too.
    {
      const ctx = await context(browser);
      await refuseOthers(ctx, PP.base);
      await ctx.addInitScript(() => {
        if (window.top === window && !sessionStorage.getItem('seeded')) {
          sessionStorage.setItem('seeded', '1');
          const d = new Date();
          const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          localStorage.setItem('oql.playtime', JSON.stringify({ date: day, seconds: 115 }));
        }
      });
      const page = await ctx.newPage();
      await page.goto(PP.base + '/responsible-gaming/', { waitUntil: 'networkidle' });
      const ticks = await until(page, () => /2 minutes/.test(document.querySelector('[data-rg-limit-status] [data-playtime]')?.textContent || ''));
      await page.click('.masthead [data-open="settings"]');
      await settingsOpen(page);
      await page.selectOption('#settings select[name="limit"]', '60');
      await page.click('#settings [data-action="save-limit"]');
      await page.keyboard.press('Escape');
      const shown = await page.evaluate(() => ({
        text: document.querySelector('[data-rg-limit-text]').textContent,
        pill: document.querySelector('#limits [data-rg-state="limit"]').textContent,
        select: document.querySelector('[data-rg="limit"] select').value,
      }));
      expect(ticks && shown.text === 'Your limit is 1 hour a day.' && shown.pill === '1 hour a day' && shown.select === '60',
        '/responsible-gaming/: "Today" keeps counting, and a limit set in Settings shows in the sentence, the pill and the form', JSON.stringify({ ticks, ...shown }));
      await ctx.close();
    }

    // The header's balance pill at phone widths: a big balance and a long session never push the page sideways.
    {
      const ctx = await context(browser, { viewport: { width: 320, height: 740 } });
      await refuseOthers(ctx, PP.base);
      await ctx.addInitScript(() => {
        if (window.top !== window) return;
        const now = Date.now();
        localStorage.setItem('oql.wallet', JSON.stringify({ balance: 1234567 }));
        const elapsed = 10 * 3600 + 23 * 60;
        sessionStorage.setItem('oql.session', JSON.stringify({ start: now - elapsed * 1000, seen: now, staked: 0, returned: 0, reminders: 1, remindedAt: elapsed }));
      });
      const page = await ctx.newPage();
      await page.goto(PP.base + '/', { waitUntil: 'networkidle' });
      const bad = [];
      for (const width of [320, 342, 360, 390, 414, 460]) {
        await page.setViewportSize({ width, height: 740 });
        await until(page, () => /^10:23:/.test(document.querySelector('.masthead [data-session]').textContent));
        const r = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          short: document.querySelector('.masthead [data-balance-short]').textContent,
          full: document.querySelector('.masthead .status__balance .visually-hidden').textContent,
          session: document.querySelector('.masthead [data-session]').textContent,
        }));
        if (r.overflow > 0 || r.short !== '1.23M' || !r.full.includes('1,234,567')) bad.push(`${width}px: ${JSON.stringify(r)}`);
      }
      expect(!bad.length, 'the header fits 1,234,567 Carats ("1.23M", read out in full) and a 10-hour session from 320 to 460px', bad.join('; '));
      await ctx.close();
    }

    // Focus is never hidden under the fixed dock on phones (WCAG 2.4.11), including a desktop at 200% zoom.
    for (const [site, viewport, dsf] of [[PP, { width: 390, height: 844 }, 1], [PP, { width: 640, height: 400 }, 2], [FB, { width: 390, height: 844 }, 1]]) {
      if (!site) continue;
      const ctx = await context(browser, { viewport, deviceScaleFactor: dsf });
      await refuseOthers(ctx, site.base);
      await ctx.route((u) => PRAGMATIC_HOST.test(u.hostname), (r) => r.abort('blockedbyclient'));
      const bad = [];
      let stops = 0;
      for (const p of ['/', '/games/', '/responsible-gaming/', '/games/lapidary-wheel/']) {
        const page = await ctx.newPage();
        await page.goto(site.base + p, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const r = await tabUnderDock(page);
        stops += r.stops;
        r.hidden.forEach((h) => bad.push(`${p}: ${h}`));
        await page.close();
      }
      expect(!bad.length && stops > 100, `${site.name} ${viewport.width}×${viewport.height}: no Tab stop is hidden under the dock (${stops} stops on 4 pages)`, bad.slice(0, 8).join('; '));
      await ctx.close();
    }

    // Short screens (400% zoom on a 1280 × 1024 screen, or a phone on its side): the dock scrolls with the page.
    {
      const ctx = await context(browser, { viewport: { width: 320, height: 256 } });
      await refuseOthers(ctx, PP.base);
      const page = await ctx.newPage();
      await page.goto(PP.base + '/games/lapidary-wheel/', { waitUntil: 'networkidle' });
      const r = await page.evaluate(() => ({
        dock: getComputedStyle(document.querySelector('.dock')).position,
        header: Math.round(document.querySelector('.masthead').getBoundingClientRect().height),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(r.dock === 'static' && r.header <= 60 && r.overflow <= 0, '320×256: the dock scrolls with the page and the sticky header is compact', JSON.stringify(r));
      await ctx.close();
    }

    // WCAG 1.4.12 text spacing: the one-row header wraps its nav instead of pushing Settings off screen.
    {
      const ctx = await context(browser, { bypassCSP: true });
      await refuseOthers(ctx, PP.base);
      const bad = [];
      for (const p of ['/', '/responsible-gaming/']) {
        const page = await ctx.newPage();
        for (const width of [1024, 1180, 1280, 1366]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(PP.base + p, { waitUntil: 'networkidle' });
          await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}' });
          const r = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - innerWidth,
            gear: Math.round(document.querySelector('.masthead [data-open="settings"]').getBoundingClientRect().right - innerWidth),
          }));
          if (r.overflow > 0 || r.gear > 0) bad.push(`${p} ${width}px: ${JSON.stringify(r)}`);
        }
        await page.close();
      }
      expect(!bad.length, 'with WCAG 1.4.12 text spacing the header fits at 1024–1366px and Settings stays on screen', bad.join('; '));
      await ctx.close();
    }

    // Night: the nav marker sits below the descenders (cream on yellow would be 1.2:1).
    {
      const ctx = await context(browser, { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
      await refuseOthers(ctx, PP.base);
      const page = await ctx.newPage();
      await page.goto(PP.base + '/responsible-gaming/', { waitUntil: 'networkidle' });
      const y = await page.evaluate(() => getComputedStyle(document.querySelector('.nav a[aria-current]')).backgroundPositionY);
      expect(y === '100%', 'Night: the current nav item’s marker sits under the text, not across its descenders', y);
      await ctx.close();
    }

    // The age question opens before app.js has loaded, and a "Yes" pressed that early still counts.
    {
      const ctx = await context(browser, { age: false, viewport: { width: 390, height: 844 } });
      await refuseOthers(ctx, PP.base);
      let release;
      const held = new Promise((r) => (release = r));
      await ctx.route(/\/assets\/js\/app\.js/, async (route) => {
        await held;
        await route.continue();
      });
      const page = await ctx.newPage();
      const w = watch(page, PP.base);
      await page.goto(PP.base + '/', { waitUntil: 'commit' });
      const early = await until(page, () => document.getElementById('age-gate')?.open);
      const focus = await page.evaluate(() => document.activeElement?.id);
      if (early) await page.click('[data-age="yes"]');
      const waiting = await page.evaluate(() => ({ open: document.getElementById('age-gate').open, saved: localStorage.getItem('oql.age') }));
      release();
      const done = await until(page, () => !document.getElementById('age-gate').open && JSON.parse(localStorage.getItem('oql.age') || '{}').answer === 'yes');
      expect(early && focus === 'age-title' && waiting.open && !waiting.saved && done,
        'the age question opens before app.js loads, starts on the question, and a "Yes" pressed that early is saved once app.js runs', JSON.stringify({ early, focus, waiting, done }));
      expect(!w.errors.length, 'no errors when the age question is answered early', w.errors.join(' | '));
      await ctx.close();
    }

    // 400% zoom: the age question opens at its start, so the disclaimer isn't hidden under the dialog's head.
    // On a landscape phone, "No" shows its explanation in view.
    {
      const ctx = await context(browser, { age: false, viewport: { width: 320, height: 256 } });
      await refuseOthers(ctx, PP.base);
      const page = await ctx.newPage();
      await page.goto(PP.base + '/', { waitUntil: 'networkidle' });
      await until(page, () => document.getElementById('age-gate')?.open);
      const seen = (sel) => page.evaluate((sel) => {
        const d = document.getElementById('age-gate').getBoundingClientRect();
        const r = document.querySelector(sel).getBoundingClientRect();
        return r.top >= d.top - 1 && r.bottom <= d.bottom + 1;
      }, sel);
      const desc = await seen('#age-desc');
      await page.setViewportSize({ width: 844, height: 390 });
      await page.click('[data-age="no"]');
      const msg = await seen('.age__under p');
      const focus = await page.evaluate(() => document.activeElement === document.querySelector('.age__under p'));
      expect(desc && msg && focus, 'the age question shows its disclaimer at 320×256, and "No" focuses its explanation in view at 844×390', JSON.stringify({ desc, msg, focus }));
      await ctx.close();
    }

    // With JavaScript off: the notice is on the first screen, and nothing that needs scripts looks usable.
    for (const site of modes) {
      const ctx = await context(browser, { javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
      await refuseOthers(ctx, site.base);
      const bad = [];
      const pagesNoJs = ['/', '/games/', '/games/lapidary-wheel/', '/games/brilliant-twenty-one/', '/responsible-gaming/', site === PP ? '/games/gates-of-olympus/' : '/games/seven-systems/'];
      for (const p of pagesNoJs) {
        const page = await ctx.newPage();
        await page.goto(site.base + p, { waitUntil: 'load' });
        const r = await page.evaluate(() => {
          const note = document.querySelector('.noscript')?.getBoundingClientRect();
          // Buttons that work without scripts don't count: popover toggles, and
          // the "Settings" named inside a sentence on /responsible-gaming/.
          const live = [...document.querySelectorAll('main button, .masthead button, .dock button')].filter(
            (b) => b.getClientRects().length && b.type !== 'submit' && !b.hasAttribute('popovertarget') && !b.closest('[popover], dialog') && !b.matches('p .linkish'),
          );
          return { note: note ? Math.round(note.bottom) : null, live: live.map((b) => (b.textContent || b.getAttribute('aria-label')).trim().replace(/\s+/g, ' ').slice(0, 30)) };
        });
        if (r.note === null || r.note > 844) bad.push(`${p}: the notice ends at ${r.note}px`);
        if (r.live.length) bad.push(`${p}: ${r.live.length} buttons that do nothing: ${r.live.slice(0, 5).join(', ')}`);
        await page.close();
      }
      expect(!bad.length, `${site.name}: with JavaScript off, the notice is on the first screen of ${pagesNoJs.length} pages and no dead button shows`, bad.join('; '));
      await ctx.close();
    }

    // Fonts held back 1.2 s (a slow first visit): the metric-matched fallbacks keep layout shift under 0.05.
    {
      const bad = [];
      for (const width of [390, 1440]) {
        const ctx = await context(browser, { viewport: { width, height: 900 } });
        await refuseOthers(ctx, PP.base);
        await ctx.route(/\/assets\/fonts\/.*\.woff2/, async (route) => {
          await new Promise((r) => setTimeout(r, 1200));
          await route.continue();
        });
        for (const p of ['/games/brilliant-twenty-one/', '/', '/responsible-gaming/']) {
          const page = await ctx.newPage();
          await page.addInitScript(() => {
            window.__cls = 0;
            new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
          });
          await page.goto(PP.base + p, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
          const cls = await page.evaluate(() => window.__cls);
          if (!(cls < 0.05)) bad.push(`${p} at ${width}px: CLS ${cls.toFixed(3)}`);
          await page.close();
        }
        await ctx.close();
      }
      expect(!bad.length, 'with the web fonts held back 1.2 s, CLS stays under 0.05 on 3 pages at 390 and 1440px', bad.join('; '));
    }

    // The reality check says demo play isn't counted, only when the demos are on.
    {
      const read = async (site) => (site ? fs.readFile(path.join(site.dir, 'index.html'), 'utf8') : '');
      const [on, off] = [await read(PP), await read(FB)];
      const dlg = (s) => s.slice(s.indexOf('<dialog id="reality-check-dialog"'), s.indexOf('</dialog>', s.indexOf('<dialog id="reality-check-dialog"')));
      expect(/aren’t counted/.test(dlg(on)) && (!FB || !/aren’t counted/.test(dlg(off))), 'the reality check says demo credits aren’t counted only when the Pragmatic Play demos are on');
    }

    // No console warnings when a demo loads (allow and allowfullscreen used to conflict).
    {
      const ctx = await context(browser);
      await refuseOthers(ctx, PP.base);
      await stubPragmatic(ctx);
      const page = await ctx.newPage();
      const warned = [];
      // (The one warning expected here is Playwright's own, about the service worker it blocks.)
      page.on('console', (m) => ['warning', 'error'].includes(m.type()) && !/Service Worker registration blocked/.test(m.text()) && warned.push(m.text()));
      await page.goto(PP.base + '/games/gates-of-olympus/', { waitUntil: 'networkidle' });
      await mounted(page, STAGE);
      await pressOn(page, `${STAGE} .stage__over [data-action="load"]`);
      await stageIs(page, 'ready', 15000);
      expect(!warned.length, 'no console warnings or errors when a demo loads', warned.join(' | '));
      await ctx.close();
    }
  });

// ---------- j. axe-core ----------
// Known exceptions: none. If one is ever needed, add { rule, target, why } here,
// where target is a RegExp tested against the node's CSS selector, and say why.
const AXE_EXCEPTIONS = [];

if (want('axe'))
  await section('axe-core: WCAG 2.2 AA and best practice, both themes, 1440 and 390 px', async () => {
    let AXE;
    try {
      AXE = await fs.readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
    } catch {
      fail('axe-core is not installed: run npm install');
      return;
    }
    const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
    const found = new Map(); // "rule: target" → { impact, help, where: [] }
    let runs = 0;
    const run = async (page, where) => {
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(AXE);
      const violations = await page.evaluate(
        (TAGS) => axe.run(document, { runOnly: { type: 'tag', values: TAGS }, resultTypes: ['violations'], iframes: false })
          .then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(' '), why: (n.failureSummary || '').split('\n').slice(1, 2).join('').trim() })) }))),
        TAGS,
      );
      runs++;
      for (const v of violations) {
        for (const n of v.nodes) {
          if (AXE_EXCEPTIONS.some((x) => x.rule === v.id && x.target.test(n.target))) continue;
          const key = `${v.id}: ${n.target}`;
          if (!found.has(key)) found.set(key, { impact: v.impact, help: v.help, why: n.why, where: [] });
          found.get(key).where.push(where);
        }
      }
    };
    const ready = async (page) => {
      const roots = await page.$$eval('[data-game]', (r) => r.length);
      if (roots) await mounted(page, '[data-game]');
    };

    for (const site of modes) {
      const paths = await sitePaths(site.dir);
      for (const scheme of ['light', 'dark']) {
        for (const width of [1440, 390]) {
          const ctx = await context(browser, { viewport: { width, height: 900 }, colorScheme: scheme });
          await refuseOthers(ctx, site.base);
          await ctx.route((u) => PRAGMATIC_HOST.test(u.hostname), (r) => r.abort('blockedbyclient'));
          await pool(paths, 4, async (p) => {
            const page = await ctx.newPage();
            const where = `${site.name} ${scheme} ${width} ${p}`;
            const one = async () => {
              await page.goto(site.base + p, { waitUntil: 'networkidle' });
              await ready(page);
              await run(page, where);
            };
            await within(one(), 90000, 'axe').catch((e) => fail(`axe on ${where}: ${e.message}`));
            await page.close();
          });
          await ctx.close();
        }
      }
    }

    // States: Settings open, the demo stage ready, the age question, the reset confirmation, and consent.
    for (const scheme of ['light', 'dark']) {
      for (const width of [1440, 390]) {
        const opener = width > 720 ? '.masthead [data-open="settings"]' : '.dock [data-open="settings"]';
        if (PP) {
          const ctx = await context(browser, { viewport: { width, height: 900 }, colorScheme: scheme });
          await refuseOthers(ctx, PP.base);
          await stubPragmatic(ctx);
          const page = await ctx.newPage();
          await page.goto(PP.base + '/', { waitUntil: 'networkidle' });
          await ready(page);
          await page.click(opener);
          await settingsOpen(page);
          await run(page, `${scheme} ${width} / with Settings open`);
          await page.click('#settings [data-action="reset-balance"]');
          await until(page, () => document.getElementById('confirm').open);
          await run(page, `${scheme} ${width} / with the reset confirmation open`);
          await page.goto(PP.base + '/games/gates-of-olympus/', { waitUntil: 'networkidle' });
          await ready(page);
          await page.click(`${STAGE} .stage__over [data-action="load"]`);
          if (await stageIs(page, 'ready', 15000)) await run(page, `${scheme} ${width} /games/gates-of-olympus/ with the demo stage ready`);
          else fail(`axe: the demo stage never became ready (${scheme} ${width})`);
          await ctx.close();

          const first = await context(browser, { viewport: { width, height: 900 }, colorScheme: scheme, age: false });
          await refuseOthers(first, PP.base);
          const fp = await first.newPage();
          await fp.goto(PP.base + '/', { waitUntil: 'networkidle' });
          await until(fp, () => document.getElementById('age-gate')?.open);
          await run(fp, `${scheme} ${width} / with the age question open`);
          await first.close();
        }
        if (GA) {
          const ctx = await context(browser, { viewport: { width, height: 900 }, colorScheme: scheme });
          await refuseOthers(ctx, GA.base);
          const page = await ctx.newPage();
          await page.goto(GA.base + '/', { waitUntil: 'networkidle' });
          await until(page, () => document.querySelector('.consent-banner') && !document.querySelector('.consent-banner').hidden);
          await run(page, `${scheme} ${width} / with the cookie banner`);
          await page.click('.consent-banner [data-open="consent"]');
          await until(page, () => document.getElementById('consent').open);
          await run(page, `${scheme} ${width} / with Cookie settings open`);
          await ctx.close();
        }
      }
    }

    if (!found.size) pass(`no violations in ${runs} axe runs`);
    for (const [key, v] of found) {
      const where = v.where.length > 3 ? `${v.where.slice(0, 3).join('; ')} and ${v.where.length - 3} more` : v.where.join('; ');
      fail(`axe ${v.impact} ${key} (${v.help}${v.why ? `: ${v.why}` : ''}) on ${where}`);
    }
  });

// ---------- report ----------
await browser.close();
for (const b of Object.values(builds)) await b.close?.();
if (KEEP) console.log(`\nBuilds kept in ${await tempDir()}`);
else await cleanTemp();
const { passes } = summary();
console.log(`\n${passes} passed, ${failures.length} failed in ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
console.log(failures.length ? `${failures.length} check(s) failed.` : 'All checks passed.');
process.exit(failures.length ? 1 : 0);
