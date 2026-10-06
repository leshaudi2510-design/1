#!/usr/bin/env node
// Lighthouse on a built site, mobile and desktop, against the factory's
// thresholds (MASTER-PLAN D-14: every category >= 95, LCP < 2.0 s, CLS < 0.05).
//
//   node engine/tools/lighthouse.mjs <dist> --out DIR [--site DIR] [--urls /,/games/,...]
//                                    [--form-factors mobile,desktop] [--runs N]
//
//   <dist>          a build folder (engine/build.mjs output)
//   --out DIR       where the reports go: <form-factor>_<page>.report.{json,html}
//                   and summary.json (required)
//   --site DIR      the site folder, for the game page (checks.json games); without
//                   it, the first /games/<slug>/ in the sitemap
//   --urls LIST     the paths to audit (default: /, /games/ and one game page)
//   --runs N        audits per page and form factor; the median by performance
//                   counts (default 1)
//
// summary.json: [{ url, path, formFactor, preset, perf, a11y, bp, seo, lcp, lcpMs,
// cls, tbt, html, json }]: scores 0-100, lcp and tbt in milliseconds (lcp
// and lcpMs are the same number). Exits 1 when a page is below a threshold
// (from schemas/board.schema.json "thresholds.lighthouse" when that file
// exists), 2 on a usage error, 3 when Lighthouse or Chromium can't be found.
//
// Lighthouse comes from the repository's node_modules (lighthouse ^12), else
// from $LH_DIR/node_modules (LH_DIR from the environment or .git/factory-env).
// Chromium is Playwright's (CHROME_PATH overrides). The build is served by
// engine/tools/serve.mjs on a free port, with production cache headers.
import fs from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.dirname(ENGINE);
const USAGE = 'usage: node engine/tools/lighthouse.mjs <dist> --out DIR [--site DIR] [--urls /,/games/] [--form-factors mobile,desktop] [--runs N]';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1];
};
const usage = (msg) => {
  console.error(`${msg ? `error: ${msg}\n` : ''}${USAGE}`);
  process.exit(2);
};
const valued = new Set(['--out', '--site', '--urls', '--form-factors', '--runs']);
const positional = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
if (args.includes('--help')) usage();
const DIST = positional[0] && path.resolve(positional[0]);
const OUT = opt('out') && path.resolve(opt('out'));
if (!DIST || !existsSync(path.join(DIST, 'index.html'))) usage(`${DIST || '<dist>'} holds no build (no index.html)`);
if (!OUT) usage('--out is required');
const FORMS = (opt('form-factors') || 'mobile,desktop').split(',').filter(Boolean);
if (FORMS.some((f) => !['mobile', 'desktop'].includes(f))) usage('--form-factors takes mobile and/or desktop');
const RUNS = Number(opt('runs') || 1);
if (!Number.isInteger(RUNS) || RUNS < 1) usage('--runs takes a positive whole number');

// ---------- thresholds ----------
const DEFAULTS = { perf: 95, a11y: 95, bp: 95, seo: 95, lcpMs: 2000, cls: 0.05 };
function thresholds() {
  const file = path.join(REPO, 'schemas/board.schema.json');
  if (!existsSync(file)) return { ...DEFAULTS, from: 'built-in' };
  try {
    const s = JSON.parse(readFileSync(file, 'utf8'));
    // The value may sit in the schema as a default, a const or a plain object.
    const find = (o) => {
      if (!o || typeof o !== 'object') return null;
      if (o.thresholds?.lighthouse) return o.thresholds.lighthouse;
      for (const v of Object.values(o)) {
        const f = find(v);
        if (f) return f;
      }
      return null;
    };
    let t = find(s);
    t = t?.default || t?.const || t?.properties ? t.default || t.const || null : t;
    if (!t) return { ...DEFAULTS, from: 'built-in' };
    const min = t.min ?? t.categories ?? t.score;
    return {
      perf: t.perf ?? t.performance ?? min ?? DEFAULTS.perf,
      a11y: t.a11y ?? t.accessibility ?? min ?? DEFAULTS.a11y,
      bp: t.bp ?? t['best-practices'] ?? min ?? DEFAULTS.bp,
      seo: t.seo ?? min ?? DEFAULTS.seo,
      lcpMs: t.lcpMs ?? (t.lcp !== undefined ? (t.lcp < 100 ? t.lcp * 1000 : t.lcp) : DEFAULTS.lcpMs),
      cls: t.cls ?? DEFAULTS.cls,
      from: path.relative(REPO, file),
    };
  } catch {
    return { ...DEFAULTS, from: 'built-in' };
  }
}
const LIMITS = thresholds();

// ---------- Lighthouse and Chromium ----------
function lhDir() {
  if (process.env.LH_DIR) return process.env.LH_DIR;
  // .git/factory-env (MASTER-PLAN D-50) defines LH_DIR for every worktree.
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: REPO, encoding: 'utf8' });
  const env = r.status === 0 ? path.join(r.stdout.trim(), 'factory-env') : null;
  if (env && existsSync(env)) return readFileSync(env, 'utf8').match(/^\s*(?:export\s+)?LH_DIR=["']?([^"'\n]+)/m)?.[1] || null;
  return null;
}
async function load(name) {
  const bases = [path.join(REPO, 'package.json'), import.meta.url];
  const lh = lhDir();
  if (lh) bases.push(path.join(lh, 'package.json'));
  for (const base of bases) {
    try {
      const dir = path.dirname(createRequire(base).resolve(`${name}/package.json`));
      const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
      const main = pkg.exports?.['.']?.import || pkg.exports?.['.']?.default || pkg.exports?.['.'] || pkg.main || 'index.js';
      return { mod: await import(pathToFileURL(path.join(dir, typeof main === 'string' ? main : 'index.js'))), dir, version: pkg.version };
    } catch {}
  }
  return null;
}
const LH = await load('lighthouse');
const LAUNCHER = await load('chrome-launcher');
if (!LH || !LAUNCHER) {
  console.error(`error: ${!LH ? 'lighthouse' : 'chrome-launcher'} can't be loaded: install it at the repository root (npm install), or set LH_DIR to a folder whose node_modules has it`);
  process.exit(3);
}
const lighthouse = LH.mod.default;
const desktopConfig = (await import(pathToFileURL(path.join(LH.dir, 'core/config/desktop-config.js')))).default;

async function chromePath() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync('/opt/pw-browsers')) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
  try {
    const { chromium } = await import('playwright');
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch {}
  return null;
}
const CHROME = await chromePath();
if (!CHROME) {
  console.error('error: no Chromium: set CHROME_PATH, or install Playwright\'s browsers (PLAYWRIGHT_BROWSERS_PATH)');
  process.exit(3);
}

// ---------- the pages ----------
function gamePage() {
  const site = opt('site') && path.resolve(opt('site'));
  if (site && existsSync(path.join(site, 'checks.json'))) {
    const g = JSON.parse(readFileSync(path.join(site, 'checks.json'), 'utf8')).games || {};
    const first = g.roulette || g.blackjack || g.slot;
    if (first) return first.page || `/games/${first.slug}/`;
  }
  const xml = existsSync(path.join(DIST, 'sitemap.xml')) ? readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8') : '';
  return [...xml.matchAll(/<loc>https?:\/\/[^/]+(\/games\/[^/<]+\/)<\/loc>/g)].map((m) => m[1])[0] || null;
}
const URLS = opt('urls') ? opt('urls').split(',').filter(Boolean) : ['/', '/games/', gamePage()].filter(Boolean);
for (const u of URLS) if (!existsSync(path.join(DIST, u, 'index.html'))) usage(`${u} is not in the build`);

// ---------- serve ----------
function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ENGINE, 'tools/serve.mjs'), DIST, '--port=0'], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      const line = buf.split('\n')[0];
      if (buf.includes('\n')) resolve({ base: line.trim().replace(/\/$/, '').replace('127.0.0.1', 'localhost'), stop: () => child.kill() });
    });
    child.on('exit', (code) => reject(new Error(`serve.mjs exited (${code})`)));
  });
}

// ---------- run ----------
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const slug = (p) => p.replace(/^\/|\/$/g, '').replace(/[^\w-]+/g, '_') || 'home';
const summary = [];
let failed = 0;
try {
  for (const form of FORMS) {
    for (const p of URLS) {
      const url = server.base + p;
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        const chrome = await LAUNCHER.mod.launch({ chromePath: CHROME, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
        try {
          const r = await lighthouse(url, { port: chrome.port, output: ['json', 'html'], logLevel: 'error' }, form === 'desktop' ? desktopConfig : undefined);
          runs.push(r);
        } finally {
          await chrome.kill();
        }
      }
      runs.sort((a, b) => (a.lhr.categories.performance.score ?? 0) - (b.lhr.categories.performance.score ?? 0));
      const best = runs[Math.floor(runs.length / 2)];
      const { lhr } = best;
      const name = `${form}_${slug(p)}.report`;
      await fs.writeFile(path.join(OUT, `${name}.json`), best.report[0]);
      await fs.writeFile(path.join(OUT, `${name}.html`), best.report[1]);
      const score = (k) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
      const num = (k) => lhr.audits[k]?.numericValue;
      const row = {
        url: lhr.finalDisplayedUrl,
        path: p,
        formFactor: form,
        preset: form,
        perf: score('performance'),
        a11y: score('accessibility'),
        bp: score('best-practices'),
        seo: score('seo'),
        lcp: Math.round(num('largest-contentful-paint') ?? NaN),
        lcpMs: Math.round(num('largest-contentful-paint') ?? NaN),
        cls: Number((num('cumulative-layout-shift') ?? NaN).toFixed(4)),
        tbt: Math.round(num('total-blocking-time') ?? NaN),
        html: `${name}.html`,
        json: `${name}.json`,
        runs: RUNS,
      };
      const below = [
        ...['perf', 'a11y', 'bp', 'seo'].filter((k) => !(row[k] >= LIMITS[k])).map((k) => `${k} ${row[k]} < ${LIMITS[k]}`),
        ...(row.lcpMs < LIMITS.lcpMs ? [] : [`LCP ${row.lcpMs} ms >= ${LIMITS.lcpMs}`]),
        ...(row.cls < LIMITS.cls ? [] : [`CLS ${row.cls} >= ${LIMITS.cls}`]),
      ];
      row.ok = !below.length;
      if (below.length) failed++;
      summary.push(row);
      console.log(`${row.ok ? '✓' : '✗'} ${form.padEnd(7)} ${p.padEnd(32)} perf ${row.perf} a11y ${row.a11y} bp ${row.bp} seo ${row.seo}  LCP ${row.lcpMs} ms  CLS ${row.cls}  TBT ${row.tbt} ms${below.length ? `  (${below.join(', ')})` : ''}`);
    }
  }
} finally {
  server.stop();
}
await fs.writeFile(path.join(OUT, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Lighthouse ${LH.version}, ${CHROME}; thresholds ${LIMITS.from}: categories >= ${LIMITS.perf}/${LIMITS.a11y}/${LIMITS.bp}/${LIMITS.seo}, LCP < ${LIMITS.lcpMs} ms, CLS < ${LIMITS.cls}`);
console.log(`${summary.length - failed} of ${summary.length} audits within the thresholds. Summary: ${path.relative(process.cwd(), path.join(OUT, 'summary.json'))}`);
process.exit(failed ? 1 : 0);
