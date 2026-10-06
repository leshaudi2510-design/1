// Section offline: the service worker's saved copy.

export default [
  {
    id: 'offline',
    title: 'Offline: the saved copy of the home page, our own games, the safer-play tools and the page a visitor landed on',
    async run(t) {
      const { browser, modes, fx } = t;
      const ourGames = new Set(Object.values(fx.games).map((g) => g.page));
      const { primary: PP } = t.roles;
      const { fail, pass, expect, context, watch, mounted, sitePaths, serve, swSaved, STAGE } = t.harness;

      for (const site of modes) {
        // Its own server, to take down: Playwright's offline mode doesn't reach
        // the service worker's requests. No request routing either: a routed
        // context bypasses the service worker.
        const server = await serve(site.dir);
        const ctx = await context(browser, { serviceWorkers: 'allow' });
        const first = await ctx.newPage();
        // The first page loads before the worker controls anything; the worker saves it when it starts.
        const landing = fx.offline.landing;
        await first.goto(server.base + landing, { waitUntil: 'load' });
        const house = (await sitePaths(site.dir)).filter((p) => ourGames.has(p));
        const promised = ['/', fx.safer, ...house, '/offline/'];
        expect(await swSaved(first, [landing, ...promised]), `${site.name}: the service worker saves ${promised.join(', ')} and the landing page ${landing}`);
        await first.close();
        await ctx.setOffline(true);
        server.setDown(true);
        const bad = [];
        for (const p of [...promised, landing]) {
          const page = await ctx.newPage();
          const w = watch(page, server.base);
          try {
            await page.goto(server.base + p, { waitUntil: 'load', timeout: 15000 });
            const shown = await page.evaluate(() => document.documentElement.dataset.page);
            if (shown === 'offline' && p !== '/offline/') bad.push(`${p}: the offline page instead of the saved copy`);
            const ours = `[data-game]:not(${STAGE})`;
            if ((await page.$$(ours)).length && !(await mounted(page, ours))) bad.push(`${p}: the game didn't start`);
          } catch (e) {
            bad.push(`${p}: ${e.message.split('\n')[0]}`);
          }
          if (w.errors.length) bad.push(`${p}: ${[...new Set(w.errors)].join(' | ')}`);
          await page.close();
        }
        if (bad.length) bad.forEach((b) => fail(`${site.name} offline: ${b}`));
        else pass(`${site.name}: offline, ${promised.length + 1} pages load from the saved copy and our games start, with no errors`);
        // A page the visitor never opened isn't saved: the offline page says so.
        const unvisited = site === PP ? fx.offline.unvisited : fx.offline.unvisitedNoDemos;
        const page = await ctx.newPage();
        await page.goto(server.base + unvisited, { waitUntil: 'load' }).catch(() => {});
        expect((await page.evaluate(() => document.documentElement.dataset.page).catch(() => '')) === 'offline', `${site.name}: offline, an unvisited page (${unvisited}) shows the offline page`);
        await ctx.close();
        await server.close();
      }
    },
  },
];
