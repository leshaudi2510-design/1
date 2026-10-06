// Section axe: axe-core, WCAG 2.2 AA and best practice, both themes, 1440 and 390 px,
// on every page of every page build and in the dialog and stage states.
// Each violation also goes to the report's axe[] as
// { rule, impact, help, target, why, mode, theme, width, page, state }.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

// Known exceptions: none. If one is ever needed, add { rule, target, why } here,
// where target is a RegExp tested against the node's CSS selector, and say why.
const AXE_EXCEPTIONS = [];

/** axe-core's browser bundle, from the repository's node_modules (or the one this file resolves). */
async function axeSource(REPO) {
  for (const base of [path.join(REPO, 'package.json'), import.meta.url]) {
    try {
      return await fs.readFile(createRequire(base).resolve('axe-core/axe.min.js'), 'utf8');
    } catch {}
  }
  return null;
}

export default [
  {
    id: 'axe',
    title: 'axe-core: WCAG 2.2 AA and best practice, both themes, 1440 and 390 px',
    async run(t) {
      const { browser, modes, fx, workers, axe } = t;
      const { primary: PP, analytics: GA } = t.roles;
      const { fail, pass, context, until, mounted, pool, within, sitePaths, refuseOthers, refuseEmbed, settingsOpen, STAGE, stubEmbed, stageIs, roots } = t.harness;

      const AXE = await axeSource(roots.REPO);
      if (!AXE) {
        fail('axe-core is not installed: run npm install');
        return;
      }
      const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
      const found = new Map(); // "rule: target" → { impact, help, where: [] }
      let runs = 0;
      // where: { mode?, theme, width, page, state? }; its text is how the failure line names it.
      const whereText = (w) => `${w.mode && !w.state ? `${w.mode} ` : ''}${w.theme} ${w.width} ${w.page}${w.state ? ` with ${w.state}` : ''}`;
      const run = async (page, where) => {
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(AXE);
        const violations = await page.evaluate(
          (TAGS) => axe.run(document, { runOnly: { type: 'tag', values: TAGS }, resultTypes: ['violations'], iframes: false })
            .then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(' '), why: (n.failureSummary || '').split('\n').slice(1, 2).join('').trim() })) }))),
          TAGS,
        );
        runs++;
        for (const v of violations) {
          for (const n of v.nodes) {
            if (AXE_EXCEPTIONS.some((x) => x.rule === v.id && x.target.test(n.target))) continue;
            const key = `${v.id}: ${n.target}`;
            if (!found.has(key)) found.set(key, { impact: v.impact, help: v.help, why: n.why, where: [] });
            found.get(key).where.push(whereText(where));
            axe.push({ rule: v.id, impact: v.impact, help: v.help, target: n.target, why: n.why, ...where });
          }
        }
      };
      const ready = async (page) => {
        const roots = await page.$$eval('[data-game]', (r) => r.length);
        if (roots) await mounted(page, '[data-game]');
      };

      for (const site of modes) {
        const paths = await sitePaths(site.dir);
        for (const scheme of ['light', 'dark']) {
          for (const width of [1440, 390]) {
            const ctx = await context(browser, { viewport: { width, height: 900 }, colorScheme: scheme });
            await refuseOthers(ctx, site.base);
            await refuseEmbed(ctx);
            await pool(paths, workers(4), async (p) => {
              const page = await ctx.newPage();
              const where = { mode: site.name, theme: scheme, width, page: p };
              const one = async () => {
                await page.goto(site.base + p, { waitUntil: 'networkidle' });
                await ready(page);
                await run(page, where);
              };
              await within(one(), 90000, 'axe').catch((e) => fail(`axe on ${whereText(where)}: ${e.message}`));
              await page.close();
            });
            await ctx.close();
          }
        }
      }

      // States: Settings open, the demo stage ready, the age question, the reset confirmation, and consent.
      for (const scheme of ['light', 'dark']) {
        for (const width of [1440, 390]) {
          const opener = width > 720 ? '.masthead [data-open="settings"]' : '.dock [data-open="settings"]';
          if (PP) {
            const at = (page, state) => ({ mode: PP.name, theme: scheme, width, page, state });
            const ctx = await context(browser, { viewport: { width, height: 900 }, colorScheme: scheme });
            await refuseOthers(ctx, PP.base);
            await stubEmbed(ctx);
            const page = await ctx.newPage();
            await page.goto(PP.base + '/', { waitUntil: 'networkidle' });
            await ready(page);
            await page.click(opener);
            await settingsOpen(page);
            await run(page, at('/', 'Settings open'));
            await page.click('#settings [data-action="reset-balance"]');
            await until(page, () => document.getElementById('confirm').open);
            await run(page, at('/', 'the reset confirmation open'));
            await page.goto(PP.base + fx.demo, { waitUntil: 'networkidle' });
            await ready(page);
            await page.click(`${STAGE} .stage__over [data-action="load"]`);
            if (await stageIs(page, 'ready', 15000)) await run(page, at(fx.demo, 'the demo stage ready'));
            else fail(`axe: the demo stage never became ready (${scheme} ${width})`);
            await ctx.close();

            const first = await context(browser, { viewport: { width, height: 900 }, colorScheme: scheme, age: false });
            await refuseOthers(first, PP.base);
            const fp = await first.newPage();
            await fp.goto(PP.base + '/', { waitUntil: 'networkidle' });
            await until(fp, () => document.getElementById('age-gate')?.open);
            await run(fp, at('/', 'the age question open'));
            await first.close();
          }
          if (GA) {
            const at = (page, state) => ({ mode: GA.name, theme: scheme, width, page, state });
            const ctx = await context(browser, { viewport: { width, height: 900 }, colorScheme: scheme });
            await refuseOthers(ctx, GA.base);
            const page = await ctx.newPage();
            await page.goto(GA.base + '/', { waitUntil: 'networkidle' });
            await until(page, () => document.querySelector('.consent-banner') && !document.querySelector('.consent-banner').hidden);
            await run(page, at('/', 'the cookie banner'));
            await page.click('.consent-banner [data-open="consent"]');
            await until(page, () => document.getElementById('consent').open);
            await run(page, at('/', 'Cookie settings open'));
            await ctx.close();
          }
        }
      }

      if (!found.size) pass(`no violations in ${runs} axe runs`);
      for (const [key, v] of found) {
        const where = v.where.length > 3 ? `${v.where.slice(0, 3).join('; ')} and ${v.where.length - 3} more` : v.where.join('; ');
        fail(`axe ${v.impact} ${key} (${v.help}${v.why ? `: ${v.why}` : ''}) on ${where}`);
      }
    },
  },
];
