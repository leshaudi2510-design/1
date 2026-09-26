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
const SECTIONS = ['pages', 'stage', 'keyboard', 'lobby', 'consent', 'dialogs', 'prefs', 'axe'];
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
  ['fallback', withPragmatic(false), ['pages', 'keyboard', 'lobby', 'dialogs', 'prefs', 'axe']],
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
      stageH: Math.round(root.getBoundingClientRect().height),
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
      expect(/opened/.test(r.status), `${T}: the status region says the demo opened`, `"${r.status}"`);
      expect(idle.stageH === l.stageH && l.stageH === r.stageH, `${T}: the stage keeps its height from idle through loading to ready`, `${idle.stageH} → ${l.stageH} → ${r.stageH}px`);

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

    await stageExtras();
  });

/**
 * More stage checks: the caption as the Play button's description, a demo that
 * can't be reached, "Reject all", the expanded stage's Tab order, the reality
 * check over a demo, and the bar's layout and colours.
 */
async function stageExtras() {
  const GAME = '/games/gates-of-olympus/';
  const toPragmatic = (u) => PRAGMATIC_HOST.test(u.hostname);
  const playFromKeyboard = (page) => pressOn(page, `${STAGE} .stage__over [data-action="load"]`);
  // A stand-in game with something to focus, for the Tab and reality-check checks.
  const GAME_STUB = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Stub demo</title></head><body><button type="button">Spin</button><button type="button">Info</button></body></html>`;
  const stubGame = (ctx) => ctx.route(toPragmatic, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: GAME_STUB }));
  // Where focus is, relative to the stage: an action name, "frame", "body" or "outside".
  const focusAt = (page) =>
    page.evaluate((S) => {
      const a = document.activeElement;
      const root = document.querySelector(S);
      if (!a || a === document.body) return 'body';
      if (a.tagName === 'IFRAME' && root.contains(a)) return 'frame';
      if (root.contains(a)) return a.dataset.action || a.dataset.open || a.textContent.trim().slice(0, 40);
      return `outside: ${a.tagName.toLowerCase()} "${(a.textContent || '').trim().slice(0, 30)}"`;
    }, STAGE);

  // The caption beside Play says what loading a demo does, and describes the button.
  {
    const ctx = await context(browser);
    await refuseOthers(ctx, PP.base);
    const page = await ctx.newPage();
    for (const p of ['/', GAME]) {
      await page.goto(PP.base + p, { waitUntil: 'networkidle' });
      const cap = await page.evaluate((S) => {
        const root = document.querySelector(S);
        const play = root.querySelector('.stage__over [data-action="load"]');
        const id = play.getAttribute('aria-describedby');
        const el = id && document.getElementById(id);
        return {
          text: (el?.textContent || '').replace(/\s+/g, ' ').trim(),
          link: el?.querySelector('a')?.getAttribute('href') || '',
          isCaption: el?.tagName === 'FIGCAPTION' && root.contains(el),
          figure: root.getAttribute('aria-describedby') === id,
          named: document.getElementById(root.getAttribute('aria-labelledby'))?.textContent === root.dataset.name,
          fallback: root.querySelectorAll('[data-fallback], a[href*="pragmaticplay"]').length,
        };
      }, STAGE);
      expect(cap.isCaption && cap.figure && cap.named && /Pragmatic Play/.test(cap.text) && /Google Analytics/.test(cap.text) && /cookies/.test(cap.text) && cap.link === '/cookies/#third-party',
        `${p}: the stage is named by the game and described by its caption, which describes Play too: the demo and Google Analytics inside it may set cookies (linked to /cookies/#third-party)`, JSON.stringify(cap));
      expect(!cap.fallback, `${p}: the stage links nowhere on Pragmatic Play's site (a demo there would escape the limits and breaks)`, `${cap.fallback} link(s)`);
    }
    await ctx.close();
  }

  // A demo that can't be reached ends in "failed", not "loaded" over a browser error page.
  for (const [how, setup] of [
    ['the connection is refused', (ctx) => ctx.route(toPragmatic, (r) => r.abort('connectionrefused'))],
    ['a filter blocks the host', (ctx) => ctx.route(toPragmatic, (r) => r.abort('blockedbyclient'))],
    ['the host redirects somewhere the CSP does not allow', (ctx) => ctx.route(toPragmatic, (r) => r.fulfill({ status: 302, headers: { location: 'https://elsewhere.example/game.html' }, body: '' }))],
    ['the browser is offline', null],
  ]) {
    const ctx = await context(browser);
    await refuseOthers(ctx, PP.base);
    if (setup) await setup(ctx);
    const page = await ctx.newPage();
    await page.goto(PP.base + GAME, { waitUntil: 'networkidle' });
    await mounted(page, STAGE);
    if (!setup) await ctx.setOffline(true); // no stub: a stub would still answer
    await playFromKeyboard(page);
    const failed = await stageIs(page, 'failed', 10000);
    const f = await stageInfo(page);
    const retry = await page.evaluate((S) => {
      const b = document.querySelector(`${S} .stage__msg--failed [data-action="load"]`);
      return { shown: Boolean(b?.getClientRects().length), focused: document.activeElement === b };
    }, STAGE);
    expect(failed && f.framesOnPage === 0 && retry.shown && retry.focused && /didn't load/.test(f.status),
      `failed when ${how}: no iframe, "Try again" shown with focus, and the status says so`, JSON.stringify({ state: f.state, frames: f.framesOnPage, retry, status: f.status }));
    if (!setup) await ctx.setOffline(false);
    await ctx.close();
  }

  // After "Reject all" in Cookie settings, Play asks first and nothing reaches Pragmatic Play until the visitor agrees.
  {
    const ctx = await context(browser);
    await refuseOthers(ctx, PP.base);
    const stub = await stubPragmatic(ctx);
    const page = await ctx.newPage();
    const w = watch(page, PP.base);
    await page.goto(PP.base + '/cookies/', { waitUntil: 'networkidle' });
    await page.click('main [data-open="consent"]');
    await until(page, () => document.getElementById('consent').open);
    const said = await page.evaluate(() => document.getElementById('consent').textContent.replace(/\s+/g, ' '));
    expect(/Pragmatic Play demos/.test(said) && /Google Analytics/.test(said) && /each Play button asks first/.test(said),
      'Cookie settings say what the demos may set and what "Reject all" does to them', said.slice(0, 200));
    await page.click('#consent [data-consent="reject"]');
    const stored = await until(page, () => JSON.parse(localStorage.getItem('oql.consent') || '{}').demos === false);
    const toast = await until(page, () => document.querySelector('#toast .toast__msg')?.textContent === 'Saved.');
    expect(stored && toast, '"Reject all" is kept (demos: false) and confirmed with "Saved."');
    await page.goto(PP.base + '/games/wolf-gold/', { waitUntil: 'networkidle' });
    await mounted(page, STAGE);
    const readConfirm = () => page.evaluate(() => {
      const d = document.getElementById('confirm');
      return { open: d.open, title: d.querySelector('#confirm-title').textContent, yes: d.querySelector('[value="yes"]').textContent, no: d.querySelector('[value="no"]').textContent, focus: document.activeElement?.textContent };
    });
    await playFromKeyboard(page);
    await until(page, () => document.getElementById('confirm').open);
    const q = await readConfirm();
    expect(q.open && /Load this demo/.test(q.title) && q.yes === 'Load demo and allow its cookies' && q.no === 'Don’t load it' && q.focus === q.no && !stub.hits.length,
      'after "Reject all", Play asks first (focus on "Don’t load it") and nothing has been asked of Pragmatic Play', JSON.stringify({ ...q, hits: stub.hits.length }));
    await page.keyboard.press('Enter');
    await until(page, () => !document.getElementById('confirm').open);
    const no = await stageInfo(page);
    expect(no.state === 'idle' && no.focusPlay && !stub.hits.length, '"Don’t load it" leaves the stage idle, with focus back on Play and no request made', JSON.stringify({ state: no.state, focus: await focused(page), hits: stub.hits.length }));
    await playFromKeyboard(page);
    await until(page, () => document.getElementById('confirm').open);
    await page.click('#confirm [value="yes"]');
    const ready = await stageIs(page, 'ready', 15000);
    expect(ready && stub.hits.length > 0 && (await stageInfo(page)).focusClose, '"Load demo and allow its cookies" loads it, with focus on Close demo', JSON.stringify({ state: (await stageInfo(page)).state, hits: stub.hits.length }));
    expect(!w.errors.length, 'no console or page errors around "Reject all" and the demo', w.errors.join(' | '));
    await ctx.close();
  }

  // The expanded stage (no element fullscreen, as on an iPhone): Tab and Shift+Tab
  // go round Close demo, fullscreen and the game; the button keeps its name.
  {
    const ctx = await context(browser, { viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => {
      if (window.top === window) delete Element.prototype.requestFullscreen;
    });
    await refuseOthers(ctx, PP.base);
    await stubGame(ctx);
    const page = await ctx.newPage();
    const w = watch(page, PP.base);
    await page.goto(PP.base + GAME, { waitUntil: 'networkidle' });
    await mounted(page, STAGE);
    await playFromKeyboard(page);
    await stageIs(page, 'ready', 15000);
    const FS = `${STAGE} [data-action="fullscreen"]`;
    await pressOn(page, FS);
    const expanded = await until(page, (S) => document.querySelector(S).hasAttribute('data-expanded'), STAGE);
    const btn = () => page.evaluate((FS) => ({ label: document.querySelector(FS).getAttribute('aria-label'), pressed: document.querySelector(FS).getAttribute('aria-pressed') }), FS);
    const on = await btn();
    expect(expanded && on.label === 'Fullscreen' && on.pressed === 'true', 'expanded stage: the fullscreen button keeps the name "Fullscreen" and is pressed', JSON.stringify(on));
    const walk = async (key, n) => {
      const seen = [];
      for (let i = 0; i < n; i++) {
        await page.keyboard.press(key);
        seen.push(await focusAt(page));
      }
      return seen;
    };
    await page.focus(FS);
    const forward = await walk('Tab', 6);
    await page.focus(`${STAGE} [data-action="unload"]`);
    const back = await walk('Shift+Tab', 1);
    const inside = forward.every((s) => ['unload', 'fullscreen', 'frame'].includes(s));
    expect(inside && forward.slice(0, 4).includes('unload') && forward.includes('frame'),
      'expanded stage: Tab from fullscreen goes through the game and back round to Close demo, never leaving the stage', forward.join(' → '));
    expect(back[0] === 'frame', 'expanded stage: Shift+Tab from Close demo wraps to the game', back.join(' → '));
    await page.focus(FS);
    await page.keyboard.press('Escape');
    const off = await btn();
    const left = await page.evaluate((S) => !document.querySelector(S).hasAttribute('data-expanded'), STAGE);
    expect(left && off.pressed === 'false' && off.label === 'Fullscreen' && (await focusAt(page)) === 'fullscreen', 'expanded stage: Escape on our controls leaves it, with focus on the fullscreen button', JSON.stringify({ left, ...off, focus: await focusAt(page) }));
    expect(!w.errors.length, 'no console or page errors in the expanded stage', w.errors.join(' | '));
    await ctx.close();
  }

  // The reality check over a demo: whichever way it's answered, focus ends on
  // something visible (the game, or the break message), never on <body>.
  // The page's clock is Playwright's, so the check comes exactly when asked for.
  for (const [answer, fromGame, want] of [
    ['break', false, 'About breaks and limits'],
    ['break', true, 'About breaks and limits'],
    ['continue', true, 'frame'],
    ['Escape', true, 'frame'],
  ]) {
    const ctx = await context(browser);
    await refuseOthers(ctx, PP.base);
    await stubGame(ctx);
    // A session 20 seconds short of the 30-minute reality check.
    await ctx.addInitScript(() => {
      if (window.top !== window) return;
      const now = Date.now();
      sessionStorage.setItem('oql.session', JSON.stringify({ start: now - (30 * 60 - 20) * 1000, seen: now, staked: 0, returned: 0, reminders: 0, remindedAt: 0 }));
    });
    const page = await ctx.newPage();
    await page.clock.install();
    await page.goto(PP.base + GAME, { waitUntil: 'networkidle' });
    await page.clock.runFor(1000); // lets the game mount (it waits for a frame)
    await mounted(page, STAGE);
    await playFromKeyboard(page);
    await stageIs(page, 'ready', 15000);
    if (fromGame) {
      const game = page.frames().find((f) => f !== page.mainFrame());
      await game?.focus('button');
    }
    const before = await focusAt(page);
    await page.clock.runFor(30000);
    const shown = await until(page, () => document.getElementById('reality-check-dialog').open);
    if (answer === 'Escape') await page.keyboard.press('Escape');
    else await pressOn(page, `#reality-check-dialog [data-rc="${answer}"]`);
    await until(page, () => !document.getElementById('reality-check-dialog').open);
    await page.clock.runFor(200); // the dialog's close event, and the focus hooks' timers
    const after = await focusAt(page);
    const state = (await stageInfo(page)).state;
    const lost = await lostFocus(page);
    const where = `${answer === 'Escape' ? 'Escape' : `"${answer}"`} with focus ${fromGame ? 'in the game' : 'on Close demo'}`;
    expect(shown && before === (fromGame ? 'frame' : 'unload') && after === want && state === (answer === 'break' ? 'blocked' : 'ready') && !lost.length,
      `reality check over a demo, ${where}: focus ends on ${want === 'frame' ? 'the game' : `"${want}"`}`, JSON.stringify({ shown, before, after, state, lost }));
    await ctx.close();
  }

  // The bar keeps its rows from idle to ready at phone and desktop widths, and
  // "Close demo" looks the same on home as on a game page, by night too.
  {
    const look = {};
    for (const [width, scheme] of [[390, 'light'], [1024, 'dark']]) {
      const ctx = await context(browser, { viewport: { width, height: 900 }, colorScheme: scheme });
      await refuseOthers(ctx, PP.base);
      const stub = await stubPragmatic(ctx);
      const page = await ctx.newPage();
      for (const p of ['/', '/games/zeus-vs-hades-gods-of-war/']) {
        await page.goto(PP.base + p, { waitUntil: 'networkidle' });
        await mounted(page, STAGE);
        const h0 = (await stageInfo(page)).stageH;
        const release = stub.holdNext();
        await playFromKeyboard(page);
        await stageIs(page, 'loading');
        const h1 = (await stageInfo(page)).stageH;
        release();
        await stageIs(page, 'ready', 15000);
        const h2 = (await stageInfo(page)).stageH;
        expect(h0 === h1 && h1 === h2, `${p} at ${width}px: the stage doesn't jump when Play is pressed`, `${h0} → ${h1} → ${h2}px`);
        if (scheme === 'dark') {
          look[p] = await page.evaluate((S) => {
            const s = getComputedStyle(document.querySelector(`${S} [data-action="unload"]`));
            return `${s.borderTopColor} ${s.boxShadow}`;
          }, STAGE);
        }
      }
      await ctx.close();
    }
    const [home, game] = Object.values(look);
    expect(home && home === game, 'Night: "Close demo" on the home stage has the same border and shadow as on a game page', JSON.stringify(look));
  }
}

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
    // Closed without an answer all the same (Chromium lets a second Escape
    // through, and so does Android's Back): nothing is stored, the games stay
    // locked, and a "Confirm my age" button on the stage asks again.
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.getElementById('age-gate').open && document.getElementById('age-gate').close());
    await mounted(page, STAGE);
    const locked = await page.evaluate((S) => {
      const b = document.querySelector(`${S} [data-open="age-gate"]`);
      return { age: localStorage.getItem('oql.age'), state: document.querySelector(S).dataset.state, ask: Boolean(b?.getClientRects().length) };
    }, STAGE);
    expect(locked.age === null && locked.state === 'blocked' && locked.ask, 'closed without an answer: nothing is stored, the stage stays locked and offers "Confirm my age"', JSON.stringify(locked));
    await pressOn(page, `${STAGE} [data-open="age-gate"]`);
    const again = await until(page, () => document.getElementById('age-gate').open && document.getElementById('age-gate').contains(document.activeElement));
    expect(again, '"Confirm my age" asks the question again, with focus inside it');
    await page.click('[data-age="yes"]');
    await until(page, () => !document.getElementById('age-gate').open);
    const opened = await stageIs(page, 'idle');
    expect(opened && (await stageInfo(page)).focusPlay, 'answering "Yes" then opens the stage, with focus on Play', await focused(page));
    await page.reload({ waitUntil: 'networkidle' });
    // The stage mounts after app.js has run startAgeGate(), so by then the question would be open.
    await mounted(page, STAGE);
    expect(!(await page.evaluate(() => document.getElementById('age-gate').open)), 'once answered, the age question is not asked again');
    expect(!w.errors.length, 'no console or page errors around the age question', w.errors.join(' | '));
    await ctx.close();

    // A "no" keeps its 30-day lock: no "Confirm my age", and the question can't be reopened.
    {
      const c = await context(browser, { age: false });
      await c.addInitScript(() => {
        if (window.top === window) localStorage.setItem('oql.age', JSON.stringify({ answer: 'no', at: Date.now() }));
      });
      await refuseOthers(c, PP.base);
      const p = await c.newPage();
      await p.goto(PP.base + '/games/gates-of-olympus/', { waitUntil: 'networkidle' });
      await mounted(p, STAGE);
      await stageIs(p, 'blocked');
      const r = await p.evaluate((S) => {
        const b = document.querySelector(`${S} [data-open="age-gate"]`);
        const shown = Boolean(b?.getClientRects().length);
        b?.click();
        return { shown, reopened: document.getElementById('age-gate').open };
      }, STAGE);
      expect(!r.shown && !r.reopened, 'after "No", no "Confirm my age" is shown, and even a scripted click on it doesn\'t reopen the question', JSON.stringify(r));
      await c.close();
    }

    // Our own tables, in both modes: closed unanswered, a table offers "Confirm my age" too.
    for (const [site, p, G] of [[PP, '/games/lapidary-wheel/', '[data-game="lapidary-wheel"]'], ...(FB ? [[FB, '/', '[data-game="seven-systems"]']] : [])]) {
      const c = await context(browser, { age: false });
      await refuseOthers(c, site.base);
      const pg = await c.newPage();
      const pw = watch(pg, site.base);
      await pg.goto(site.base + p, { waitUntil: 'networkidle' });
      await until(pg, () => document.getElementById('age-gate')?.open);
      await mounted(pg, G);
      await pg.evaluate(() => document.getElementById('age-gate').close()); // as a second Escape or Android's Back does
      const offered = await until(pg, (G) => document.querySelector(`${G} [data-age-ask]`)?.hidden === false, G);
      await pressOn(pg, `${G} [data-open="age-gate"]`);
      const asked = await until(pg, () => document.getElementById('age-gate').open);
      await pg.click('[data-age="yes"]');
      const gone = await until(pg, (G) => document.querySelector(`${G} [data-age-ask]`).hidden && !document.getElementById('age-gate').open, G);
      const f = await focused(pg);
      expect(offered && asked && gone && f !== 'body' && !pw.errors.length,
        `${site.name} ${p}: closed unanswered, the table offers "Confirm my age", which asks again; once answered it goes, and focus stays in the game`, JSON.stringify({ offered, asked, gone, focus: f, errors: pw.errors }));
      await c.close();
    }
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

// ---------- i. axe-core ----------
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
