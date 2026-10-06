// Section tables (social casino): our tables' layout, native keys, stake focus and locks mid-round.

export default [
  {
    id: 'tables',
    title: 'Our tables: the betting board, the Twenty-One canvas, Space, stake focus and locks mid-round',
    after: 'keyboard',
    async run(t) {
      const { browser, fx } = t;
      const { roulette, blackjack, slot } = fx.games;
      const { pragmatic: PP, fallback: FB } = t.builds;
      const { expect, context, watch, until, mounted, focused, lostFocus, refuseOthers } = t.harness;

      const WHEEL = roulette.sel;
      const BJ = blackjack.sel;
      const SLOT = slot.sel;
      const playOf = (G) => `${G} [data-action="spin"], ${G} [data-action="deal"]`;
      const tick = (page) => page.evaluate(() => window.__chk.results);
      const busy = (page, G) => until(page, (s) => document.querySelector(s).getAttribute('aria-busy') === 'true', playOf(G), 3000);
      /** The round is over and the play button is on offer (or, with `locked`, the games are locked). */
      const ready = (page, G, { locked = false, timeout = 20000 } = {}) =>
        until(page, ([s, G, locked]) => {
          const b = document.querySelector(s);
          return b.getAttribute('aria-busy') !== 'true' && (locked ? document.querySelector(G).hasAttribute('data-locked') : b.getAttribute('aria-disabled') === 'false');
        }, [playOf(G), G, locked], timeout);
      const open = async (site, p, G, opts) => {
        const ctx = await context(browser, opts);
        await refuseOthers(ctx, site.base);
        const page = await ctx.newPage();
        const w = watch(page, site.base);
        await page.goto(site.base + p, { waitUntil: 'networkidle' });
        // The wheel's Spin waits for a chip on the table; the others are ready to play.
        const ok = (await mounted(page, G)) && (G === WHEEL || (await ready(page, G)));
        return { ctx, page, w, ok };
      };

      // vis-9: one column template for the numbers, dozens and even-money rows.
      if (PP) {
        const bad = [];
        for (const width of [1440, 1024, 768, 390]) {
          const { ctx, page } = await open(PP, roulette.page, WHEEL, { viewport: { width, height: 900 } });
          const r = await page.evaluate((G) =>
            Object.fromEntries(['n3', 'n12', 'n13', 'n36', 'd1', 'd2', 'd3', 'low', 'high'].map((id) => {
              const b = document.querySelector(`${G} [data-bet="${id}"]`).getBoundingClientRect();
              return [id, { l: Math.round(b.left * 10) / 10, r: Math.round(b.right * 10) / 10, t: Math.round(b.top) }];
            })), WHEEL);
          const pairs = width > 720
            ? [['1st 12 left', r.d1.l, '3 left', r.n3.l], ['1st 12 right', r.d1.r, '12 right', r.n12.r], ['2nd 12 left', r.d2.l, '13 left', r.n13.l],
              ['3rd 12 right', r.d3.r, '36 right', r.n36.r], ['1–18 left', r.low.l, '3 left', r.n3.l], ['19–36 right', r.high.r, '36 right', r.n36.r]]
            : [['1st 12 left', r.d1.l, '1–18 left', r.low.l], ['3rd 12 right', r.d3.r, '3 right', r.n3.r], ['3rd 12 right', r.d3.r, '19–36 right', r.high.r]];
          for (const [a, x, b, y] of pairs) if (Math.abs(x - y) > 1) bad.push(`${width}px: ${a} ${x} vs ${b} ${y}`);
          if (width <= 720 && !(r.d1.t === r.d3.t && r.low.t !== r.high.t)) bad.push(`${width}px: the dozens are not one row of three, or the even-money bets not two rows`);
          await ctx.close();
        }
        expect(!bad.length, 'wheel: the dozen and even-money bets line up with the number columns (1440, 1024, 768 px) and sit three across on a phone (390 px)', bad.join(' | '));
      }

      // perf-4: the CSS sets the canvas's shape, so starting the game moves nothing. No touch
      // emulation here: it marks shifts as following input, which hides them.
      if (PP) {
        const bad = [];
        for (const [width, height] of [[390, 844], [600, 900], [1280, 900]]) {
          const ctx = await context(browser, { viewport: { width, height } });
          await refuseOthers(ctx, PP.base);
          await ctx.addInitScript(() => {
            if (window.top !== window) return;
            window.__shift = 0;
            new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__shift += e.value))).observe({ type: 'layout-shift', buffered: true });
          });
          const page = await ctx.newPage();
          await page.goto(PP.base + blackjack.page, { waitUntil: 'networkidle' });
          if (!(await mounted(page, BJ))) bad.push(`${width}px: the game never started`);
          const r = await page.evaluate(async () => {
            await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
            const c = document.querySelector('.twentyone__canvas');
            const b = c.getBoundingClientRect();
            return { shift: window.__shift, box: b.height / b.width, store: c.height / c.width };
          });
          if (r.shift >= 0.005) bad.push(`${width}×${height}: layout shift ${r.shift.toFixed(4)}`);
          if (Math.abs(r.box - r.store) > 0.01) bad.push(`${width}×${height}: drawn at ${r.store.toFixed(3)} in a ${r.box.toFixed(3)} box`);
          await ctx.close();
        }
        expect(!bad.length, 'twenty-one: no layout shift when the game starts (390, 600, 1280 px), and the table is drawn at its box\'s shape', bad.join(' | '));
      }

      // code-5: Space belongs to the focused control, never to a shortcut.
      for (const [p, where] of FB ? [[slot.page, 'slot page'], ['/', 'home hero']] : []) {
        const { ctx, page, w, ok } = await open(FB, p, SLOT);
        const log = [];
        if (!ok) log.push('the slot never became ready');
        else {
          const settledAfter = (n) => until(page, ([G, n]) => window.__chk.results > n && /Balance/.test(document.querySelector(`${G} [data-result]`).textContent)
            && document.querySelector(`${G} [data-action="spin"]`).getAttribute('aria-busy') === 'false', [SLOT, n], 20000);
          let n = await tick(page);
          await page.focus(`${SLOT} [data-action="spin"]`);
          await page.keyboard.press('Space');
          if (!(await settledAfter(n))) log.push('Space on Spin did not spin');
          await page.focus(`${SLOT} .game__buttons [popovertarget]`);
          await page.keyboard.press('Space');
          if (!(await until(page, (G) => document.querySelector(`${G} .paytable-pop`).matches(':popover-open'), SLOT, 3000))) log.push('Space on Paytable did not open it');
          else {
            await page.focus(`${SLOT} .paytable-pop [popovertargetaction="hide"]`);
            await page.keyboard.press('Space');
            if (!(await until(page, (G) => !document.querySelector(`${G} .paytable-pop`).matches(':popover-open'), SLOT, 3000))) log.push('Space on the paytable\'s Close did not close it');
          }
          n = await tick(page);
          await page.focus(`${SLOT} [data-action="spin"]`);
          await page.keyboard.press('s');
          if (!(await settledAfter(n))) log.push('S no longer spins');
        }
        expect(!log.length && !w.errors.length, `slot (${where}): Space activates Spin, Paytable and Close; S still spins`, [...log, ...w.errors].join(' | '));
        await ctx.close();
      }

      // ux-8: stakes are aria-disabled during a round, so a focused stake keeps focus and the keys still work.
      const stakeCases = [[FB, slot.page, SLOT, 's', 'slot page'], [FB, '/', SLOT, 's', 'home hero'], [PP, blackjack.page, BJ, 'd', 'twenty-one']];
      for (const [site, p, G, key, where] of stakeCases.filter(([site]) => site)) {
        const { ctx, page, w, ok } = await open(site, p, G);
        const log = [];
        if (!ok) log.push('the game never became ready');
        else {
          const stake = () => page.evaluate((G) => document.querySelector(`${G} .stake input:checked`).value, G);
          await page.focus(`${G} .stake input:checked`);
          const before = await stake();
          await page.keyboard.press(key);
          if (!(await busy(page, G))) log.push(`${key.toUpperCase()} with focus on a stake did nothing`);
          await page.keyboard.press('ArrowRight');
          const mid = await stake();
          if (mid !== before) log.push(`the stake changed mid-round, ${before} to ${mid}`);
          if (key === 'd') {
            await until(page, (G) => ['stand', 'deal'].some((a) => document.querySelector(`${G} [data-action="${a}"]`).getAttribute('aria-disabled') === 'false'), G);
            if ((await page.getAttribute(`${G} [data-action="stand"]`, 'aria-disabled')) === 'false') await page.keyboard.press('s');
          }
          if (!(await ready(page, G))) log.push('the round never ended');
          await page.keyboard.press(key);
          if (!(await busy(page, G))) log.push(`a second ${key.toUpperCase()} did nothing (focus: ${await focused(page)})`);
          else if (key === 's') await ready(page, G);
        }
        const lost = await lostFocus(page);
        expect(!log.length && !lost.length && !w.errors.length, `${where}: with focus on a stake, ${key.toUpperCase()} plays, focus stays off <body>, the stake holds mid-round and ${key.toUpperCase()} plays again`,
          [...log, ...lost.map((l) => `focus fell to <body> from ${l}`), ...w.errors].join(' | '));
        await ctx.close();
      }

      // code-7: a lock that starts during a round (or just after it) is added to the
      // round's result line; it never replaces it.
      const lockNow = () => {
        const d = new Date();
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        localStorage.setItem(__chk.key('limits'), JSON.stringify({ minutes: 30, pending: null }));
        localStorage.setItem(__chk.key('playtime'), JSON.stringify({ date, seconds: 30 * 60 }));
      };
      const lockCases = [[PP, roulette.page, WHEEL, 'wheel, mid-spin'], [FB, slot.page, SLOT, 'slot, mid-spin'],
        [PP, blackjack.page, BJ, 'twenty-one, mid-hand'], [FB, slot.page, SLOT, 'slot, just after a spin']];
      for (const [site, p, G, where] of lockCases.filter(([site]) => site)) {
        const { ctx, page, w, ok } = await open(site, p, G);
        const log = [];
        if (!ok) log.push('the game never became ready');
        else {
          if (G === WHEEL) {
            await page.focus(`${G} .bet[tabindex="0"]`);
            await page.keyboard.press('Enter');
            await ready(page, G);
          }
          if (G === BJ) {
            await page.focus(`${G} [data-action="deal"]`);
            let inHand = false;
            for (let i = 0; i < 6 && !inHand; i++) {
              await ready(page, G);
              await page.keyboard.press('d');
              await until(page, (G) => ['stand', 'deal'].some((a) => document.querySelector(`${G} [data-action="${a}"]`).getAttribute('aria-disabled') === 'false'), G);
              inHand = (await page.getAttribute(`${G} [data-action="stand"]`, 'aria-disabled')) === 'false';
            }
            await page.evaluate(lockNow);
            await page.keyboard.press('s');
          } else {
            await page.focus(`${G} [data-action="spin"]`);
            await page.keyboard.press('s');
            if (!(await busy(page, G))) log.push('S did not spin');
            if (/after/.test(where)) await ready(page, G);
            await page.evaluate(lockNow);
          }
          await ready(page, G, { locked: true });
          const ended = await until(page, (G) => /daily limit/.test(document.querySelector(`${G} [data-result]`).textContent), G, 3000);
          const said = await page.textContent(`${G} [data-result]`);
          if (!ended || !/Balance [\d,]+\. You’ve reached your daily limit of 30 minutes\./.test(said)) log.push(`the result line reads "${said}"`);
        }
        expect(!log.length && !w.errors.length, `${where}: a daily limit reached then leaves the round's result in place, with the reason after it`, [...log, ...w.errors].join(' | '));
        await ctx.close();
      }
    },
  },
];
