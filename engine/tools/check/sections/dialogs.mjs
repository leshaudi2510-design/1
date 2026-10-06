// Section dialogs: Settings, the reset confirmation and the age question.

export default [
  {
    id: 'dialogs',
    title: 'Dialogs',
    async run(t) {
      const { browser, fx } = t;
      const { roulette, slot } = fx.games;
      const { plural, startText, start } = fx.currency;
      const { primary: PP, alt: FB } = t.roles;
      const { expect, context, watch, until, mounted, focused, within, refuseOthers, pressOn, settingsOpen, STAGE, stageInfo, stageIs } = t.harness;

      for (const [width, opener, where] of [[1280, '.masthead [data-open="settings"]', 'the header'], [390, '.dock [data-open="settings"]', 'the dock']]) {
        const ctx = await context(browser, { viewport: { width, height: 844 } });
        await refuseOthers(ctx, PP.base);
        const page = await ctx.newPage();
        const w = watch(page, PP.base);
        page.on('dialog', (d) => {
          w.errors.push(`native dialog: ${d.message()}`);
          d.dismiss();
        });
        await page.goto(PP.base + roulette.page, { waitUntil: 'networkidle' });
        // A balance that isn't the starting one, so a reset would show.
        await page.evaluate(() => localStorage.setItem(__chk.key('wallet'), JSON.stringify({ balance: 420 })));
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
            stored: JSON.parse(localStorage.getItem(__chk.key('limits')) || '{}').reality,
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
          window.__chkClosed = false;
          document.getElementById('confirm').addEventListener('close', () => (window.__chkClosed = true), { once: true });
        });
        await page.keyboard.press('Escape');
        await until(page, () => !document.getElementById('confirm').open && window.__chkClosed);
        const kept = await page.evaluate(() => ({
          settings: document.getElementById('settings').open,
          stored: JSON.parse(localStorage.getItem(__chk.key('wallet'))).balance,
          shown: document.querySelector('.masthead [data-balance]').textContent,
        }));
        expect(asked.yes === `Reset to ${startText} ${plural}` && asked.no === 'Keep my balance' && asked.focus === 'Keep my balance' && /reset/i.test(asked.title),
          `${width}px: Reset asks first, names the action, and starts on "Keep my balance"`, JSON.stringify(asked));
        expect(kept.settings && kept.stored === 420 && kept.shown === '420', `${width}px: Escape keeps the balance and leaves Settings open`, JSON.stringify(kept));
        await pressOn(page, '#settings [data-action="reset-balance"]');
        await until(page, () => document.getElementById('confirm').open);
        await page.keyboard.press('Shift+Tab');
        const onYes = await focused(page);
        await page.keyboard.press('Enter');
        const reset = await until(page, ([text, n]) => document.querySelector('.masthead [data-balance]').textContent === text && JSON.parse(localStorage.getItem(__chk.key('wallet'))).balance === n, [startText, start]);
        expect(reset, `${width}px: Shift+Tab, Enter on "Reset to ${startText} ${plural}" resets the balance`,
          `focus was on ${onYes}; ${JSON.stringify(await page.evaluate(() => ({ confirm: document.getElementById('confirm').open, value: document.getElementById('confirm').returnValue, shown: document.querySelector('.masthead [data-balance]').textContent, stored: localStorage.getItem(__chk.key('wallet')) })))}`);
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
        await page.evaluate(() => localStorage.setItem(__chk.key('wallet'), JSON.stringify({ balance: 420 })));
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
            frames(() => done({ openAfterStaleClose: open, balance: JSON.parse(localStorage.getItem(__chk.key('wallet'))).balance }));
          });
        })), 10000, 'the page').catch((e) => ({ error: e.message }));
        expect(r.openAfterStaleClose && r.balance === start, 'a confirmation asked again at once gets its own answer (a stale close event does not settle it)', JSON.stringify(r));
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
        window.__chkCancel = false;
        document.getElementById('age-gate').addEventListener('cancel', () => setTimeout(() => (window.__chkCancel = true)), { once: true });
      });
      await page.keyboard.press('Escape');
      const cancelled = await until(page, () => window.__chkCancel);
      expect(cancelled && (await page.evaluate(() => document.getElementById('age-gate').open)), 'Escape does not skip the age question', cancelled ? 'the dialog closed' : 'Escape never reached the dialog');
      // Closed without an answer all the same (Chromium lets a second Escape
      // through, and so does Android's Back): nothing is stored, the games stay
      // locked, and a "Confirm my age" button on the stage asks again.
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.getElementById('age-gate').open && document.getElementById('age-gate').close());
      await mounted(page, STAGE);
      const locked = await page.evaluate((S) => {
        const b = document.querySelector(`${S} [data-open="age-gate"]`);
        return { age: localStorage.getItem(__chk.key('age')), state: document.querySelector(S).dataset.state, ask: Boolean(b?.getClientRects().length) };
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
          if (window.top === window) localStorage.setItem(__chk.key('age'), JSON.stringify({ answer: 'no', at: Date.now() }));
        });
        await refuseOthers(c, PP.base);
        const p = await c.newPage();
        await p.goto(PP.base + fx.demo, { waitUntil: 'networkidle' });
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
      for (const [site, p, G] of [[PP, roulette.page, roulette.sel], ...(FB ? [[FB, '/', slot.sel]] : [])]) {
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
    },
  },
];
