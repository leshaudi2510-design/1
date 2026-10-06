// Section chrome: the header, the dock, Settings, safer-play tools over time, the age question, no JavaScript.
import fs from 'node:fs/promises';
import path from 'node:path';

// The header, the dock and the dialogs, and the safer play tools over time
// (Playwright's fake clock stands in for the minutes and the midnight).
const LONDON = { timezoneId: 'Europe/London' };

export default [
  {
    id: 'chrome',
    title: 'Site chrome: the header, the dock, Settings, breaks and limits over time, the age question, no JavaScript',
    async run(t) {
      const { browser, modes, fx } = t;
      const { roulette, blackjack, slot } = fx.games;
      const SAFER = fx.safer;
      const { primary: PP, alt: FB } = t.roles;
      const { expect, context, watch, until, mounted, refuseOthers, refuseEmbed, pressOn, settingsOpen, toastText, tabUnderDock, STAGE, stubEmbed, stageInfo, stageIs } = t.harness;

      // A break taken in an open tab ends by itself: the games and the demo open again, and a toast says so.
      for (const p of [fx.demo, roulette.page]) {
        const ctx = await context(browser, LONDON);
        await refuseOthers(ctx, PP.base);
        await stubEmbed(ctx);
        const page = await ctx.newPage();
        const w = watch(page, PP.base);
        await page.clock.install({ time: new Date('2026-09-26T14:00:00+01:00') });
        await page.goto(PP.base + p, { waitUntil: 'networkidle' });
        const G = p === roulette.page ? roulette.sel : STAGE;
        await page.clock.runFor(2000);
        await mounted(page, G);
        await page.click('.masthead [data-open="settings"]');
        await settingsOpen(page);
        await page.click('#settings [data-action="break-5"]');
        await page.keyboard.press('Escape');
        const read = () => page.evaluate((G) => {
          const root = document.querySelector(G);
          return { state: root.dataset.state, locked: root.hasAttribute('data-locked'), pause: localStorage.getItem(__chk.key('pause')) };
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
        await stubEmbed(ctx);
        await ctx.addInitScript(() => {
          if (window.top !== window) return;
          localStorage.setItem(__chk.key('limits'), JSON.stringify({ minutes: 30, pending: null }));
          localStorage.setItem(__chk.key('playtime'), JSON.stringify({ date: '2026-09-26', seconds: 1795 }));
        });
        const page = await ctx.newPage();
        const w = watch(page, PP.base);
        await page.clock.install({ time: new Date('2026-09-26T23:58:00+01:00') });
        await page.goto(PP.base + fx.demo, { waitUntil: 'networkidle' });
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
        // The stubbed frame's load event arrives in real time, not on the fake clock: give it up to 10 s on a busy machine.
        let ready = (await stageInfo(page)).state;
        for (let i = 0; ready === 'loading' && i < 50; i++) {
          await new Promise((r) => setTimeout(r, 200));
          await page.clock.runFor(200);
          ready = (await stageInfo(page)).state;
        }
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
        await page.goto(PP.base + roulette.page, { waitUntil: 'networkidle' });
        await pressOn(page, '.masthead [data-open="settings"]');
        await settingsOpen(page);
        const S = '#settings select[name="limit"]';
        const B = '#settings [data-action="save-limit"]';
        const limitsNow = () => page.evaluate(() => JSON.parse(localStorage.getItem(__chk.key('limits')) || 'null'));
        await page.focus(S);
        for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
        const picked = { value: await page.inputValue(S), stored: await limitsNow(), label: await page.textContent(B), toast: await toastText(page) };
        expect(picked.value === '120' && !picked.stored?.minutes && /2 hours/.test(picked.label) && !picked.toast,
          'Settings: arrowing to "2 hours" saves nothing, and the button says what saving will do', JSON.stringify(picked));
        await pressOn(page, B);
        await until(page, () => JSON.parse(localStorage.getItem(__chk.key('limits')) || '{}').minutes === 120);
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
            localStorage.setItem(__chk.key('playtime'), JSON.stringify({ date: day, seconds: 115 }));
          }
        });
        const page = await ctx.newPage();
        await page.goto(PP.base + SAFER, { waitUntil: 'networkidle' });
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
          `${SAFER}: "Today" keeps counting, and a limit set in Settings shows in the sentence, the pill and the form`, JSON.stringify({ ticks, ...shown }));
        await ctx.close();
      }

      // The header's balance pill at phone widths: a big balance and a long session never push the page sideways.
      {
        const ctx = await context(browser, { viewport: { width: 320, height: 740 } });
        await refuseOthers(ctx, PP.base);
        await ctx.addInitScript(() => {
          if (window.top !== window) return;
          const now = Date.now();
          localStorage.setItem(__chk.key('wallet'), JSON.stringify({ balance: 1234567 }));
          const elapsed = 10 * 3600 + 23 * 60;
          sessionStorage.setItem(__chk.key('session'), JSON.stringify({ start: now - elapsed * 1000, seen: now, staked: 0, returned: 0, reminders: 1, remindedAt: elapsed }));
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
        expect(!bad.length, `the header fits 1,234,567 ${fx.currency.plural} ("1.23M", read out in full) and a 10-hour session from 320 to 460px`, bad.join('; '));
        await ctx.close();
      }

      // Focus is never hidden under the fixed dock on phones (WCAG 2.4.11), including a desktop at 200% zoom.
      for (const [site, viewport, dsf] of [[PP, { width: 390, height: 844 }, 1], [PP, { width: 640, height: 400 }, 2], [FB, { width: 390, height: 844 }, 1]]) {
        if (!site) continue;
        const ctx = await context(browser, { viewport, deviceScaleFactor: dsf });
        await refuseOthers(ctx, site.base);
        await refuseEmbed(ctx);
        const bad = [];
        let stops = 0;
        for (const p of ['/', fx.lobby.page, SAFER, roulette.page]) {
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
        await page.goto(PP.base + roulette.page, { waitUntil: 'networkidle' });
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
        for (const p of ['/', SAFER]) {
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
        await page.goto(PP.base + SAFER, { waitUntil: 'networkidle' });
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
        // Scripts live under /assets/v<version>/js/ in the build.
        await ctx.route(/\/assets\/(?:v\w+\/)?js\/app\.js/, async (route) => {
          await held;
          await route.continue();
        });
        const page = await ctx.newPage();
        const w = watch(page, PP.base);
        await page.goto(PP.base + '/', { waitUntil: 'commit' });
        const early = await until(page, () => document.getElementById('age-gate')?.open);
        const focus = await page.evaluate(() => document.activeElement?.id);
        if (early) await page.click('[data-age="yes"]');
        const waiting = await page.evaluate(() => ({ open: document.getElementById('age-gate').open, saved: localStorage.getItem(__chk.key('age')) }));
        release();
        const done = await until(page, () => !document.getElementById('age-gate').open && JSON.parse(localStorage.getItem(__chk.key('age')) || '{}').answer === 'yes');
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
        const pagesNoJs = ['/', fx.lobby.page, roulette.page, blackjack.page, SAFER, site === PP ? fx.demo : slot.page];
        for (const p of pagesNoJs) {
          const page = await ctx.newPage();
          await page.goto(site.base + p, { waitUntil: 'load' });
          const r = await page.evaluate(() => {
            const note = document.querySelector('.noscript')?.getBoundingClientRect();
            // Buttons that work without scripts don't count: popover toggles, and
            // the "Settings" named inside a sentence on the safer-play page.
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
          for (const p of [blackjack.page, '/', SAFER]) {
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
        await stubEmbed(ctx);
        const page = await ctx.newPage();
        const warned = [];
        // (The one warning expected here is Playwright's own, about the service worker it blocks.)
        page.on('console', (m) => ['warning', 'error'].includes(m.type()) && !/Service Worker registration blocked/.test(m.text()) && warned.push(m.text()));
        await page.goto(PP.base + fx.demo, { waitUntil: 'networkidle' });
        await mounted(page, STAGE);
        await pressOn(page, `${STAGE} .stage__over [data-action="load"]`);
        await stageIs(page, 'ready', 15000);
        expect(!warned.length, 'no console warnings or errors when a demo loads', warned.join(' | '));
        await ctx.close();
      }
    },
  },
];
