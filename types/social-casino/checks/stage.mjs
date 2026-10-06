// Section stage (social casino): the Pragmatic Play demo stage, host stubbed.

export default [
  {
    id: 'stage',
    title: 'Pragmatic Play demo stage (host stubbed)',
    after: 'first-screen',
    async run(t) {
      const { browser, fx, trace } = t;
      const { pragmatic: PP } = t.builds;
      const { fail, expect, context, watch, until, mounted, focused, lostFocus, EMBED_HOST, refuseOthers, pressOn, settingsOpen, STAGE, stubEmbed, stageInfo, stageIs } = t.harness;

      for (const p of fx.demoPages) {
        const ctx = await context(browser, { viewport: { width: 1280, height: 900 } });
        await refuseOthers(ctx, PP.base);
        const stub = await stubEmbed(ctx);
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
        expect(EMBED_HOST.test(r.origin ? new URL(r.origin).hostname : ''), `${T}: iframe loads from Pragmatic Play's demo host`, r.origin);
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
            return EMBED_HOST.test(new URL(f.url()).hostname);
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
          const paused = await page.evaluate(() => JSON.parse(localStorage.getItem(__chk.key('pause')) || 'null'));
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
        expect(!w.foreign.filter((u) => !EMBED_HOST.test(new URL(u).hostname)).length, `${T}: no other origin contacted`, w.foreign.join(', '));
        await ctx.close();
      }

      // Age not confirmed: the stage is blocked and even a scripted click asks nothing of Pragmatic Play.
      for (const [answer, title] of [[null, /confirm your age/i], ['no', /locked/i]]) {
        const ctx = await context(browser, { age: false });
        await refuseOthers(ctx, PP.base);
        const stub = await stubEmbed(ctx);
        const page = await ctx.newPage();
        const w = watch(page, PP.base);
        await page.goto(PP.base + fx.demo, { waitUntil: 'networkidle' });
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

      // More stage checks: the caption as the Play button's description, a demo that
      // can't be reached, "Reject all", the expanded stage's Tab order, the reality
      // check over a demo, and the bar's layout and colours.
      {
        const GAME = fx.demo;
        const toEmbed = (u) => EMBED_HOST.test(u.hostname);
        const playFromKeyboard = (page) => pressOn(page, `${STAGE} .stage__over [data-action="load"]`);
        // A stand-in game with something to focus, for the Tab and reality-check checks.
        const GAME_STUB = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Stub demo</title></head><body><button type="button">Spin</button><button type="button">Info</button></body></html>`;
        const stubGame = (ctx) => ctx.route(toEmbed, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: GAME_STUB }));
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
          ['the connection is refused', (ctx) => ctx.route(toEmbed, (r) => r.abort('connectionrefused'))],
          ['a filter blocks the host', (ctx) => ctx.route(toEmbed, (r) => r.abort('blockedbyclient'))],
          ['the host redirects somewhere the CSP does not allow', (ctx) => ctx.route(toEmbed, (r) => r.fulfill({ status: 302, headers: { location: 'https://elsewhere.example/game.html' }, body: '' }))],
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
          expect(failed && f.framesOnPage === 0 && retry.shown && retry.focused && /didn’t load/.test(f.status),
            `failed when ${how}: no iframe, "Try again" shown with focus, and the status says so`, JSON.stringify({ state: f.state, frames: f.framesOnPage, retry, status: f.status }));
          if (!setup) await ctx.setOffline(false);
          await ctx.close();
        }

        // After "Reject all" in Cookie settings, Play asks first and nothing reaches Pragmatic Play until the visitor agrees.
        {
          const ctx = await context(browser);
          await refuseOthers(ctx, PP.base);
          const stub = await stubEmbed(ctx);
          const page = await ctx.newPage();
          const w = watch(page, PP.base);
          await page.goto(PP.base + '/cookies/', { waitUntil: 'networkidle' });
          await page.click('main [data-open="consent"]');
          await until(page, () => document.getElementById('consent').open);
          const said = await page.evaluate(() => document.getElementById('consent').textContent.replace(/\s+/g, ' '));
          expect(/Pragmatic Play demos/.test(said) && /Google Analytics/.test(said) && /each Play button asks first/.test(said),
            'Cookie settings say what the demos may set and what "Reject all" does to them', said.slice(0, 200));
          await page.click('#consent [data-consent="reject"]');
          const stored = await until(page, () => JSON.parse(localStorage.getItem(__chk.key('consent')) || '{}').demos === false);
          const toast = await until(page, () => document.querySelector('#toast .toast__msg')?.textContent === 'Saved.');
          expect(stored && toast, '"Reject all" is kept (demos: false) and confirmed with "Saved."');
          await page.goto(PP.base + fx.demoAfterReject, { waitUntil: 'networkidle' });
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
            sessionStorage.setItem(__chk.key('session'), JSON.stringify({ start: now - (30 * 60 - 20) * 1000, seen: now, staked: 0, returned: 0, reminders: 0, remindedAt: 0 }));
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
          // The close event comes a frame after the dialog closes; rg.js's own close
          // handler was added first, so it has run once this one has.
          await page.evaluate(() => {
            window.__chkRcClosed = false;
            document.getElementById('reality-check-dialog').addEventListener('close', () => (window.__chkRcClosed = true), { once: true });
          });
          if (answer === 'Escape') await page.keyboard.press('Escape');
          else await pressOn(page, `#reality-check-dialog [data-rc="${answer}"]`);
          await until(page, () => window.__chkRcClosed);
          await page.clock.runFor(200); // the focus hooks' timers (the page's clock is paused)
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
            const stub = await stubEmbed(ctx);
            const page = await ctx.newPage();
            for (const p of ['/', fx.demoBar]) {
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
    },
  },
];
