// Section deploy: a returning visitor gets the new scripts and styles from the first view.
import fs from 'node:fs/promises';
import path from 'node:path';

export default [
  {
    id: 'deploy',
    title: 'Deploys: a returning visitor runs the new scripts and styles from the first view, with or without the service worker',
    async run(t) {
      const { browser, fx, pack } = t;
      const { roulette } = fx.games;
      const { primary: PP } = t.roles;
      const { fail, pass, expect, context, watch, mounted, serve, buildSite, copyProject, swSaved } = t.harness;

      // Build B: a copy of the repository (engine/, types/ and the site) with a
      // new stylesheet rule in the pack's last engine partial and a new export
      // in the engine's client lib/ui.js that app.js imports. A visitor who got
      // the new app.js with the old lib/ui.js would get a module error.
      const src = await copyProject('deploy-src');
      await fs.appendFile(path.join(src.engine, 'styles', pack.styles.partials.at(-1)), '\n:root{--deploy-check:"B"}\n');
      await fs.appendFile(path.join(src.engine, 'client/lib/ui.js'), "\nexport const deployCheck = 'B';\n");
      await fs.appendFile(path.join(src.engine, 'client/app.js'), "\nimport { deployCheck } from './lib/ui.js';\ndocument.documentElement.dataset.deployCheck = deployCheck;\n");
      const B = await buildSite('deploy-b', PP.edit, { from: src });
      expect(B.ok, 'the changed copy of the project builds', B.output.slice(-400));
      expect(B.version && B.version !== PP.version && B.sw !== PP.sw, `a changed script and stylesheet give new asset and service worker versions (v${PP.version} → v${B.version})`);
      // config.js is cached like any script, so a config-only change needs new URLs too.
      const C = await buildSite('deploy-config', (c) => ({ ...PP.edit(c), contactEndpoint: 'https://forms.example.com/contact' }));
      expect(C.ok && C.version !== PP.version && C.sw !== PP.sw, `a config-only change (contactEndpoint) gives new asset and service worker versions (v${PP.version} → v${C.version})`);
      if (!B.ok) return;

      for (const sw of ['allow', 'block']) {
        // Production caching headers (from _headers) and no request routing, which would switch the HTTP cache off.
        const server = await serve(PP.dir, { host: true });
        const ctx = await context(browser, { serviceWorkers: sw });
        const page = await ctx.newPage();
        await page.goto(server.base + '/', { waitUntil: 'load' });
        if (sw === 'allow') expect(await swSaved(page, ['/', roulette.page]), 'before the deploy: the service worker is in control and has saved the site');
        await page.goto(server.base + roulette.page, { waitUntil: 'load' });
        await mounted(page, roulette.sel);

        server.setRoot(B.dir);
        const bad = [];
        const views = [
          ['/', page],
          [roulette.page, await ctx.newPage()],
          [fx.lobby.page, page],
        ];
        for (const [p, tab] of views) {
          const w = watch(tab, server.base);
          await tab.goto(server.base + p, { waitUntil: 'load' });
          const got = await tab.evaluate(() => ({
            css: getComputedStyle(document.documentElement).getPropertyValue('--deploy-check').trim(),
            js: document.documentElement.dataset.deployCheck || '',
          }));
          if (got.css !== '"B"') bad.push(`${p}: the old stylesheet`);
          if (got.js !== 'B') bad.push(`${p}: the old scripts`);
          if (p === roulette.page && !(await mounted(tab, roulette.sel))) bad.push(`${p}: the game didn't start`);
          if (w.errors.length) bad.push(`${p}: ${[...new Set(w.errors)].join(' | ')}`);
        }
        const how = sw === 'allow' ? 'with the service worker' : 'without a service worker (HTTP cache only)';
        if (bad.length) bad.forEach((b) => fail(`after a deploy, ${how}: ${b}`));
        else pass(`after a deploy, ${how}: the new stylesheet and scripts from the first view, in the same tab and a new one, with no errors`);
        await ctx.close();
        await server.close();
      }
    },
  },
];
