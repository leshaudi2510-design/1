// Sections lobby, lobby-links, lobby-layout (social casino): the lobby's filters, links into hidden groups, and its layout at every width.

export default [
  {
    id: 'lobby',
    title: 'Lobby filters on /games/',
    after: 'tables',
    async run(t) {
      const { browser, modes, fx } = t;
      const LOBBY = fx.lobby.page;
      const { fail, expect, context, watch, until, refuseOthers } = t.harness;

      for (const site of modes) {
        const ctx = await context(browser);
        await refuseOthers(ctx, site.base);
        const page = await ctx.newPage();
        const w = watch(page, site.base);
        await page.goto(site.base + LOBBY, { waitUntil: 'networkidle' });
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
    },
  },
  {
    id: 'lobby-links',
    group: 'lobby',
    title: 'Lobby on /games/: nav and dock links into a group the filter has hidden',
    after: 'lobby',
    async run(t) {
      const { browser, modes, fx } = t;
      const LOBBY = fx.lobby.page;
      const { fallback: FB } = t.builds;
      // The lobby's two groups: [0] the slots, [1] the tables (ids, and their names in the nav and the dock).
      const [SL, TB] = fx.lobby.groups;
      const navTo = Object.fromEntries(fx.lobby.groups.map((g) => [g.id, g.nav]));
      const dockTo = Object.fromEntries(fx.lobby.groups.map((g) => [g.id, g.dock]));
      const { fail, expect, context, watch, until, refuseOthers, refuseEmbed } = t.harness;

      for (const site of modes) {
        const ctx = await context(browser);
        await refuseOthers(ctx, site.base);
        await refuseEmbed(ctx);
        const page = await ctx.newPage();
        const w = watch(page, site.base);
        await page.goto(site.base + LOBBY, { waitUntil: 'networkidle' });
        if (!(await until(page, () => document.querySelector('[data-filters][data-ready]')))) {
          fail(`${site.name}: the filter bar never started`);
          await ctx.close();
          continue;
        }
        // A chip that empties each group: any slot feature empties the tables, Table games empties the slots.
        const hiding = await page.evaluate((ids) => {
          const out = {};
          for (const id of ids) {
            const tags = [...document.querySelectorAll(`#${id} li[data-tags]`)].map((t) => t.dataset.tags.split(/\s+/));
            out[id] = [...document.querySelectorAll('[data-filters] .chip[data-filter]')].map((c) => c.dataset.filter).find((f) => f !== 'all' && !tags.some((t) => t.includes(f)));
          }
          return out;
        }, [SL.id, TB.id]);
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
        // With the demos on, a slot feature hides #tables and Table games hides
        // #slots. With them off, our one slot has no slot features (build.mjs
        // rejects false ones), so only Table games can hide a group (#slots),
        // and the steps below that hide #tables run on #slots instead.
        const G = hiding[TB.id] ? TB.id : SL.id;
        const O = G === TB.id ? SL.id : TB.id;
        if (!hiding[SL.id] || (!hiding[TB.id] && site !== FB)) {
          fail(`${site.name}: no chip empties a group (${JSON.stringify(hiding)})`);
          await ctx.close();
          continue;
        }
        await press(hiding[G]);
        await page.click(`.nav a[href="${LOBBY}#${G}"]`);
        await landed(G, `"${hiding[G]}" chip, then the nav's ${navTo[G]}`);
        // The same link again, with #G already in the address (no hashchange).
        await page.evaluate(() => scrollTo(0, 0));
        await press(hiding[G]);
        await page.click(`.nav a[href="${LOBBY}#${G}"]`);
        await landed(G, `"${hiding[G]}" chip, then ${navTo[G]} again with #${G} already in the address`);
        // From the keyboard, the other way round (#slots).
        await press(hiding[SL.id]);
        await page.focus(`.nav a[href="${LOBBY}#${SL.id}"]`);
        await page.keyboard.press('Enter');
        await landed(SL.id, `"${hiding[SL.id]}" chip, then Enter on the nav's ${SL.nav}`);
        // Back to #G while a filter hides it. When #G is #slots, first step on to
        // #tables, so there is an entry to go back to.
        if (G === SL.id) {
          await page.click(`.nav a[href="${LOBBY}#${TB.id}"]`);
          await landed(TB.id, `the nav's ${TB.nav}`);
        }
        await press(hiding[G]);
        await page.goBack();
        await landed(G, `"${hiding[G]}" chip, then Back to #${G}`);
        // Back from a game page still brings the filter back, #G in the address or not.
        await press(hiding[G]);
        const tile = await page.$eval(`#${O} li[data-tags]:not([hidden]) .tile__title a`, (a) => a.getAttribute('href'));
        await Promise.all([page.waitForURL((u) => u.pathname === tile), page.click(`#${O} .tile__title a[href="${tile}"]`)]);
        await page.goBack();
        await until(page, () => document.querySelector('[data-filters][data-ready]'));
        const back = await state(G);
        expect(back.pressed === hiding[G] && back.hidden && back.hash === `#${G}`,
          `${site.name}: Back from a game page to ${LOBBY}#${G} keeps the "${hiding[G]}" filter`, JSON.stringify(back));
        expect(!w.errors.length, `${site.name}: no errors`, w.errors.join(' | '));
        await ctx.close();

        // Phones: the dock's link to #G.
        const phone = await context(browser, { viewport: { width: 390, height: 844 } });
        await refuseOthers(phone, site.base);
        const mob = await phone.newPage();
        await mob.goto(site.base + LOBBY, { waitUntil: 'networkidle' });
        await until(mob, () => document.querySelector('[data-filters][data-ready]'));
        await mob.click(`[data-filters] .chip[data-filter="${hiding[G]}"]`);
        await until(mob, (G) => document.getElementById(G).hidden, G);
        await mob.click(`.dock a[href="${LOBBY}#${G}"]`);
        await until(mob, (G) => {
          const t = document.getElementById(G);
          return !t.hidden && t.getBoundingClientRect().top < 240 && t.getBoundingClientRect().top >= 0;
        }, G, 3000);
        const ph = await mob.evaluate((G) => ({ hidden: document.getElementById(G).hidden, top: Math.round(document.getElementById(G).getBoundingClientRect().top) }), G);
        expect(!ph.hidden && ph.top >= 0 && ph.top < 240, `${site.name} 390px: "${hiding[G]}" chip, then the dock's ${dockTo[G]}: #${G} is shown and scrolled to`, JSON.stringify(ph));
        await phone.close();
      }
    },
  },
  {
    id: 'lobby-layout',
    group: 'lobby',
    title: 'Lobby layout on / and /games/, 320–1440 px in 1 px steps: whole tags, bodies inside tiles, rows that close',
    after: 'lobby-links',
    async run(t) {
      const { browser, modes, fx, workers } = t;
      const LOBBY = fx.lobby.page;
      const { fail, pass, context, pool, refuseOthers, refuseEmbed } = t.harness;

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
      const runs = modes.flatMap((site) => ['/', LOBBY].map((p) => ({ site, p })));
      await pool(runs, workers(4), async ({ site, p }) => {
        const ctx = await context(browser, { viewport: { width: 1440, height: 900 } });
        await refuseOthers(ctx, site.base);
        await refuseEmbed(ctx);
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
    },
  },
];
