// Section keyboard: our games played from the keyboard alone.

export default [
  {
    id: 'keyboard',
    title: 'Keyboard-only play',
    async run(t) {
      const { browser, fx } = t;
      const { roulette, blackjack, slot } = fx.games;
      const { primary: PP, alt: FB } = t.roles;
      const { fail, expect, context, watch, until, mounted, focused, lostFocus, refuseOthers } = t.harness;

      const tick = (page) => page.evaluate(() => window.__chk.results);
      const resultOf = (page, game) => page.textContent(`[data-game="${game}"] [data-result]`);

      if (PP) {
        // Lapidary Wheel: chips placed and lifted on the board with the keyboard, then S spins.
        const ctx = await context(browser);
        await refuseOthers(ctx, PP.base);
        const page = await ctx.newPage();
        const w = watch(page, PP.base);
        await page.goto(PP.base + roulette.page, { waitUntil: 'networkidle' });
        const G = roulette.sel;
        if (!(await mounted(page, G))) fail('wheel: the game never started');
        else {
          await page.focus(`${G} .bet[tabindex="0"]`);
          const keys = ['Enter', 'ArrowRight', 'ArrowDown', 'Enter', 'Enter', 'Backspace'];
          for (const k of keys) await page.keyboard.press(k);
          const total = await page.textContent(`${G} [data-total]`);
          const onBoard = await page.$$eval(`${G} .bet__chip`, (els) => els.filter((e) => e.textContent.trim()).length);
          expect(total === '2' && onBoard === 2, 'wheel: arrows move around the board, Enter places chips, Backspace lifts one', `on the table: ${total} ${fx.currency.plural} on ${onBoard} bets`);
          const before = await tick(page);
          await page.keyboard.press('s');
          const done = await until(page, ([G, n, said]) => {
            const r = document.querySelector(`${G} [data-result]`);
            return window.__chk.results > n && new RegExp(said).test(r.textContent) && document.querySelector(`${G} [data-action="spin"]`).getAttribute('aria-busy') === 'false';
          }, [G, before, roulette.result], 20000);
          const res = await resultOf(page, roulette.slug);
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
        await page.goto(PP.base + blackjack.page, { waitUntil: 'networkidle' });
        const G = blackjack.sel;
        const steady = ([G, n]) => {
          const root = document.querySelector(G);
          if (window.__chk.results <= n) return false;
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
            const res = await resultOf(page, blackjack.slug);
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
            window.__chkSaid = [];
            new MutationObserver(() => window.__chkSaid.push(r.textContent)).observe(r, { childList: true, characterData: true, subtree: true });
          }, G);
          const total = () => page.evaluate((G) => Number((document.querySelector(`${G} [data-player-total]`).textContent.match(/\d+/g) || ['0']).pop()), G);
          const seen = [];
          for (let h = 0; h < 8 && seen.length < 2; h++) {
            const before = await page.evaluate(() => JSON.parse(localStorage.getItem(__chk.key('wallet'))).balance);
            await page.evaluate(() => (window.__chkSaid.length = 0));
            if ((await move('d')) !== 'player') continue; // a Brilliant: no hit to make
            for (let k = 0; k < 12; k++) {
              await page.keyboard.press('h');
              if ((await total()) < 21) continue;
              const standOff = await page.getAttribute(`${G} [data-action="stand"]`, 'aria-disabled');
              await page.keyboard.press('s');
              await until(page, (G) => document.querySelector(`${G} [data-action="deal"]`).getAttribute('aria-disabled') === 'false', G);
              // Let a second, stray settlement (if any) land before counting.
              await until(page, () => window.__chkSaid.filter((t) => /Balance/.test(t)).length > 1, undefined, 1500);
              const said = await page.evaluate(() => window.__chkSaid.slice());
              const after = await page.evaluate(() => JSON.parse(localStorage.getItem(__chk.key('wallet'))).balance);
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
        await page.goto(FB.base + slot.page, { waitUntil: 'networkidle' });
        const G = slot.sel;
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
              return window.__chk.results > n && spin.getAttribute('aria-busy') === 'false' && /Balance/.test(document.querySelector(`${G} [data-result]`).textContent);
            }, [G, n], 20000);
            if (ok) spins++;
          }
          const f = await focused(page);
          expect(spins === 3 && stake === (await page.$$eval(`${G} .stake input`, (r) => r[2].value)) && /data-action=spin/.test(f),
            'slot: 3 picks the third stake, then three spins by keyboard with focus kept on Spin', `${spins} spins, stake ${stake}, focus ${f}, "${(await resultOf(page, slot.slug)).slice(0, 80)}"`);
        }
        const lost = await lostFocus(page);
        expect(!lost.length && !w.errors.length, 'slot: focus never fell to <body>, no errors', [...lost, ...w.errors].join(' | '));
        await ctx.close();
      }
    },
  },
];
