// Section prefs: reduced motion and the dark theme.

export default [
  {
    id: 'prefs',
    title: 'Preferences: reduced motion and the dark theme',
    async run(t) {
      const { browser, modes, fx } = t;
      const { roulette, blackjack, slot } = fx.games;
      const { primary: PP } = t.roles;
      const { expect, context, watch, until, mounted, refuseOthers, settingsOpen, luminance } = t.harness;

      for (const site of modes) {
        // Reduced motion: a wheel spin settles at once (the full animation takes 4.6 s).
        const ctx = await context(browser, { reducedMotion: 'reduce' });
        await refuseOthers(ctx, site.base);
        const page = await ctx.newPage();
        const w = watch(page, site.base);
        await page.goto(site.base + roulette.page, { waitUntil: 'networkidle' });
        const G = roulette.sel;
        await mounted(page, G);
        await page.click(`${G} .bet[data-bet="${roulette.colourBet}"]`);
        await page.click(`${G} [data-action="spin"]`);
        const settled = await until(page, ([G, said]) => new RegExp(said).test(document.querySelector(`${G} [data-result]`).textContent), [G, roulette.settled], 1000);
        expect(settled, `${site.name}: reduced motion: a wheel spin settles at once`, `"${await page.textContent(`${G} [data-result]`)}"`);
        expect(!w.errors.length, `${site.name}: no errors with reduced motion`, w.errors.join(' | '));
        await ctx.close();

        // Night: from the device setting, and from Settings on a light device.
        const pagesToTry = ['/', fx.lobby.page, roulette.page, blackjack.page, site === PP ? fx.demo : slot.page];
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
    },
  },
];
