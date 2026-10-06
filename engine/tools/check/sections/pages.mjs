// Section pages (+ first-screen): every page at three widths in every page build, and the home first screen on phones.
import fs from 'node:fs/promises';
import path from 'node:path';

export default [
  {
    id: 'pages',
    title: 'Pages at 360, 768 and 1440 px, both modes: no sideways scroll, no errors, nothing from other origins',
    async run(t) {
      const { browser, modes, fx, trace, workers, shots: SHOTS } = t;
      const { fail, pass, expect, context, watch, scrollThrough, pool, within, sitePaths, refuseOthers, refuseEmbed } = t.harness;

      for (const site of modes) {
        const paths = [...(await sitePaths(site.dir)), ...fx.extraPages];
        let loads = 0;
        const foreign = new Set();
        const embedHits = new Set();
        for (const width of [360, 768, 1440]) {
          // Service workers stay on here: registering one is part of every page load.
          const ctx = await context(browser, { viewport: { width, height: 900 }, serviceWorkers: 'allow' });
          await refuseOthers(ctx, site.base);
          await refuseEmbed(ctx);
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
            w.embed.forEach((u) => embedHits.add(`${u} (from ${p})`));
            if (SHOTS) {
              await fs.mkdir(path.join(SHOTS, site.name), { recursive: true });
              await page.screenshot({ path: path.join(SHOTS, site.name, `${width}${p.replace(/\//g, '_')}.png`), fullPage: true, animations: 'disabled' });
            }
            loads++;
          };
          await pool(paths, workers(3), async (p) => {
            const page = await ctx.newPage();
            await within(checkPage(page, p), 90000, 'the page').catch((e) => bad.push(`${site.name} ${width}px ${p}: ${e.message}`));
            await page.close();
          });
          await ctx.close();
          if (bad.length) bad.forEach(fail);
          else pass(`${site.name}: ${paths.length} pages at ${width}px: one h1, no sideways scroll, no console or page errors`);
        }
        expect(!foreign.size, `${site.name}: no request to another origin on any page before interaction (${loads} page loads)`, [...foreign].slice(0, 8).join(', '));
        if (fx.embedLabel) expect(!embedHits.size, `${site.name}: nothing requested from ${fx.embedLabel} before Play is pressed`, [...embedHits].slice(0, 8).join(', '));
      }
    },
  },
  {
    id: 'first-screen',
    group: 'pages',
    title: 'Home first screen on phones (both modes): the play control above the dock; demo credits by one name',
    async run(t) {
      const { browser, modes } = t;
      const { expect, context, refuseOthers, refuseEmbed } = t.harness;

      for (const site of modes) {
        // Spec 13: ribbon, H1 and the stage with its play button above the dock
        // at the spec's phone sizes (0: 390×844 and 360×780), demos on or off.
        for (const [width, height] of [[360, 780], [390, 844]]) {
          const ctx = await context(browser, { viewport: { width, height } });
          await refuseOthers(ctx, site.base);
          await refuseEmbed(ctx);
          const page = await ctx.newPage();
          await page.goto(site.base + '/', { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const r = await page.evaluate(() => {
            const play = document.querySelector('.hero .stage .btn--play, .hero [data-action="spin"]');
            const dock = document.querySelector('.dock');
            return {
              play: play ? `${play.className} "${play.textContent.trim().replace(/\s+/g, ' ')}"` : null,
              bottom: play && Math.round(play.getBoundingClientRect().bottom),
              dock: dock && Math.round(dock.getBoundingClientRect().top),
              scrollY: Math.round(scrollY),
            };
          });
          expect(r.play && r.dock && r.scrollY === 0 && r.bottom <= r.dock - 4,
            `${site.name} ${width}×${height}: the hero's play control ends above the dock (${r.bottom} ≤ ${r.dock} − 4)`, JSON.stringify(r));
          await ctx.close();
        }
        // The demos' play money is "demo credits" everywhere (spec 12), never a second name.
        const hits = [];
        const files = (await fs.readdir(site.dir, { recursive: true })).filter((f) => /\.(html|js)$/.test(f));
        for (const f of files) if (/practice credit/i.test(await fs.readFile(path.join(site.dir, f), 'utf8'))) hits.push(f);
        expect(!hits.length, `${site.name}: no page or script calls demo credits "practice credits" (${files.length} files)`, hits.join(', '));
      }
    },
  },
];
