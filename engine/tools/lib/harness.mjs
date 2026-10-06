// Shared plumbing for engine/tools/check.mjs: pass and fail lines recorded by
// section, throwaway builds of a site (and of a changed copy of the repo), a
// static server, and browser helpers that wait on page state, never on time.
//
// Roots. REPO is the repository that holds engine/ and types/; SITE is the
// site folder being checked (sites/<slug>, a template site, a fixture). Both
// are set once by check.mjs through setRoots() before anything else runs.
import fs from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseHeaders, cacheControlFor } from './headers.mjs';

export const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** { REPO, ENGINE, SITE, slug, tmpParent } — set by setRoots(). */
export const roots = { REPO: path.dirname(ENGINE), ENGINE, SITE: null, slug: null, tmpParent: os.tmpdir() };

export function setRoots({ site, tmp } = {}) {
  roots.SITE = path.resolve(site);
  roots.slug = path.basename(roots.SITE);
  if (tmp) roots.tmpParent = path.resolve(tmp);
}

// ---------- reporting ----------
// Every pass and fail line belongs to the section that is running.

const state = { sections: [], current: null, failures: [], passes: 0, onSection: null };
const CI = process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true';

const record = (ok, msg) => {
  const s = state.current;
  if (!s) return;
  if (ok) s.passed++;
  else s.failed++;
  s.lines.push({ ok, text: msg });
};
export const failures = state.failures;
export const pass = (msg) => {
  state.passes++;
  record(true, msg);
  console.log(`  ✓ ${msg}`);
};
export const fail = (msg) => {
  state.failures.push({ section: state.current?.id ?? null, text: msg });
  record(false, msg);
  console.log(`  ✗ ${msg}`);
  if (CI) console.log(`::error title=check ${state.current?.id ?? ''}::${String(msg).replace(/\r?\n/g, ' ')}`);
};
/** pass or fail on a condition; `detail` is added to the failure line only. */
export const expect = (ok, msg, detail = '') => (ok ? pass(msg) : fail(detail ? `${msg}: ${detail}` : msg));
export const summary = () => ({ passes: state.passes, failures: state.failures.length });
/** The sections run so far (and the one running, if any), as the report lists them. */
export const sectionResults = () => state.sections;
/** Called with the section after each one ends (check.mjs writes the report there). */
export const onSectionEnd = (fn) => (state.onSection = fn);

/**
 * Run one section of checks. A crash inside it is reported as a failure and
 * the next section still runs.
 */
export async function section(id, title, fn, { group = id } = {}) {
  console.log(`\n${title}`);
  const s = { id, group, title, passed: 0, failed: 0, seconds: 0, lines: [], done: false };
  state.sections.push(s);
  state.current = s;
  const t0 = Date.now();
  try {
    await fn();
  } catch (e) {
    fail(`${title}: stopped with an error: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e}`);
  }
  s.seconds = Number(((Date.now() - t0) / 1000).toFixed(1));
  s.done = true;
  state.current = null;
  console.log(`  (${s.seconds.toFixed(1)} s)`);
  await state.onSection?.(s);
}

// ---------- builds ----------

/** The site's config as the build reads it (SITE_CONFIG, relative to the site folder, may stand in). */
export const baseConfig = async () =>
  JSON.parse(await fs.readFile(path.resolve(roots.SITE, process.env.SITE_CONFIG || 'site.config.json'), 'utf8'));

let tmpRoot;
export async function tempDir() {
  if (!tmpRoot) {
    await fs.mkdir(roots.tmpParent, { recursive: true });
    tmpRoot = await fs.mkdtemp(path.join(roots.tmpParent, `check-${roots.slug || 'site'}-`));
  }
  return tmpRoot;
}
export async function cleanTemp() {
  if (tmpRoot) await fs.rm(tmpRoot, { recursive: true, force: true });
}
/** The same, for an exit path that cannot wait. */
export function cleanTempSync() {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
}

/**
 * Build the site with its config changed by `edit` into a temporary folder,
 * with engine/build.mjs from the repository or from a changed copy of it
 * (`from`, as copyProject() returns it).
 * Returns { name, dir, cfg, ok, output, version, sw }: version and sw are
 * the asset and service worker versions the build printed.
 */
export async function buildSite(name, edit = (c) => c, { from = { repo: roots.REPO, site: roots.SITE } } = {}) {
  const tmp = await tempDir();
  const cfg = edit(await baseConfig());
  const cfgFile = path.join(tmp, `${name}.config.json`);
  const dir = path.join(tmp, name);
  await fs.writeFile(cfgFile, JSON.stringify(cfg, null, 2));
  const r = spawnSync(process.execPath, [path.join(from.repo, 'engine/build.mjs'), from.site, '--out', dir], {
    cwd: from.site,
    // TMPDIR: the build writes only inside the site, reports/, dist* or the temp
    // directories, and --tmp may name a folder outside the system one.
    env: { ...process.env, SITE_CONFIG: cfgFile, OUT_DIR: '', TMPDIR: roots.tmpParent },
    encoding: 'utf8',
  });
  const output = `${r.stdout || ''}${r.stderr || ''}`.trim();
  const ok = r.status === 0 && /Lint: no problems found\./.test(output);
  const [, version, sw] = output.match(/\(assets v(\w+), sw (\w+)\)/) || [];
  return { name, dir, cfg, ok, output, version, sw };
}

/**
 * A copy of the repository's engine/, types/ and the site folder (without
 * node_modules, builds or screenshots) to change and build, for checks that
 * need a second version of the site. The site keeps its path relative to the
 * repository; node_modules is linked, not copied.
 * Returns { repo, site, engine }.
 */
export async function copyProject(name) {
  const dest = path.join(await tempDir(), name);
  const skip = /(^|\/)(node_modules|dist[^/]*|check-shots|\.git)(\/|$)/;
  const rel = path.relative(roots.REPO, roots.SITE);
  const parts = ['engine', 'types', ...(rel.startsWith('..') || path.isAbsolute(rel) ? [] : [rel])];
  for (const part of parts) {
    const from = path.join(roots.REPO, part);
    if (!existsSync(from)) continue;
    await fs.cp(from, path.join(dest, part), { recursive: true, filter: (src) => !skip.test(path.relative(roots.REPO, src).split(path.sep).join('/')) });
  }
  // A site outside the repository goes under sites/ in the copy.
  const site = parts.includes(rel) ? path.join(dest, rel) : path.join(dest, 'sites', path.basename(roots.SITE));
  if (!parts.includes(rel)) await fs.cp(roots.SITE, site, { recursive: true, filter: (src) => !skip.test(path.relative(roots.SITE, src).split(path.sep).join('/')) });
  if (existsSync(path.join(roots.REPO, 'node_modules'))) await fs.symlink(path.join(roots.REPO, 'node_modules'), path.join(dest, 'node_modules'), 'dir').catch(() => {});
  return { repo: dest, site, engine: path.join(dest, 'engine') };
}

/** Every path in a build's sitemap, then the 404 page and the offline page. */
export async function sitePaths(dir) {
  const xml = await fs.readFile(path.join(dir, 'sitemap.xml'), 'utf8');
  const paths = [...xml.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
  return [...paths, '/no-such-page/', '/offline/'];
}

// ---------- serving ----------

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain',
};

/**
 * Serve a build folder the way the hosts do: pretty URLs and the custom 404.
 * Every response is no-cache, unless `host` is set: then each file gets the
 * Cache-Control Cloudflare Pages would send, from the build's _headers, so
 * the browser's HTTP cache behaves as it does in production. setRoot()
 * serves another build from the same address, which is how a check
 * simulates a deploy. setDown(true) drops every connection, as an
 * unreachable server would: Playwright's offline mode doesn't reach a
 * service worker's own requests.
 */
export function serve(dir, { host = false } = {}) {
  let root = dir;
  let down = false;
  const server = http.createServer(async (req, res) => {
    if (down) {
      req.socket.destroy();
      return;
    }
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const p = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const file = path.join(root, path.normalize(p));
    const cache = async (status) => {
      if (!host) return 'no-cache';
      if (status === 404) return 'no-store';
      return cacheControlFor(parseHeaders(await fs.readFile(path.join(root, '_headers'), 'utf8').catch(() => '')), pathname);
    };
    try {
      if (!file.startsWith(root)) throw new Error('outside');
      const data = await fs.readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': await cache(200) });
      res.end(data);
    } catch {
      res.writeHead(404, { 'content-type': MIME['.html'], 'cache-control': await cache(404) });
      res.end(await fs.readFile(path.join(root, '404.html')));
    }
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      // "localhost" rather than 127.0.0.1: the site registers its service worker only on https or localhost.
      resolve({
        base: `http://localhost:${server.address().port}`,
        close: () => new Promise((r) => server.close(r)),
        setRoot: (d) => (root = d),
        setDown: (on) => (down = on),
      });
    }),
  );
}

// ---------- browser ----------

/**
 * The third-party embed host the type's stage loads (social casino: Pragmatic
 * Play's demo host), from the site's checks.json "embedHost". Set by
 * check.mjs; a RegExp tested against a URL's hostname. Null when the site
 * embeds nothing, so nothing matches.
 */
export let EMBED_HOST = /(?!)/;
/** The prefix of every localStorage and sessionStorage key the site writes ("oql." for "oql.wallet"). */
export let STORAGE_PREFIX = '';
export function setSiteKeys({ embedHost, storagePrefix }) {
  if (embedHost) EMBED_HOST = embedHost instanceof RegExp ? embedHost : new RegExp(embedHost);
  if (storagePrefix !== undefined) STORAGE_PREFIX = storagePrefix;
}
/** A storage key, as the site names it. */
export const key = (name) => `${STORAGE_PREFIX}${name}`;

/**
 * First-visit answer to the age question, set before any page script runs.
 * Init scripts run in every frame, so this and pageHooks skip embedded frames.
 */
export const AGE_YES = (k) => {
  if (window.top === window) localStorage.setItem(k, JSON.stringify({ answer: 'yes', at: Date.now() }));
};

/**
 * Hooks every page gets (an init script, so they exist before the site's own
 * scripts run). They let the checks wait on what the page does, not on time:
 *   window.__chk.mounted   game roots whose script has started (the first
 *                          change it makes to data-state or aria-disabled)
 *   window.__chk.results   how many times any [data-result] text changed
 *   window.__chk.lost      elements that lost focus to <body>
 *   window.__chk.key(n)    the site's storage key for n ("oql." + n)
 */
export function pageHooks(prefix) {
  if (window.top !== window) return;
  const chk = (window.__chk = { mounted: new WeakSet(), results: 0, lost: [], key: (n) => `${prefix}${n}` });
  const label = (el) =>
    el && el.nodeType === 1
      ? `${el.tagName.toLowerCase()}${el.dataset?.action ? `[data-action=${el.dataset.action}]` : ''}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}`
      : String(el);
  new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (!el) continue;
      if (r.type === 'attributes') {
        const root = el.closest('[data-game]');
        if (root) chk.mounted.add(root);
      } else if (el.closest('[data-result]')) chk.results++;
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-state', 'aria-disabled'] });
  document.addEventListener(
    'focusout',
    (e) => {
      const from = label(e.target);
      setTimeout(() => {
        if (document.hasFocus() && (!document.activeElement || document.activeElement === document.body)) chk.lost.push(from);
      }, 0);
    },
    true,
  );
}

/**
 * Record what a page does wrong: console errors, uncaught errors and
 * requests to any other origin. `allow404` lets the 404 page's own
 * document status through (and nothing else). `embed` collects the
 * requests to the embed host.
 */
export function watch(page, base, { allow404 = false } = {}) {
  const w = { errors: [], foreign: [], embed: [] };
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const loc = m.location()?.url || '';
    if (allow404 && /status of 404/.test(m.text()) && loc.split('?')[0] === page.url().split('?')[0]) return;
    w.errors.push(`${m.text()}${loc ? ` (${loc.replace(base, '')})` : ''}`);
  });
  page.on('pageerror', (e) => w.errors.push(`uncaught: ${e.message}`));
  page.on('request', (r) => {
    const url = r.url();
    if (url.startsWith(base) || /^(data|blob|about):/.test(url)) return;
    w.foreign.push(url);
    try {
      if (EMBED_HOST.test(new URL(url).hostname)) w.embed.push(url);
    } catch {}
  });
  return w;
}

/** A browser context with the page hooks, the age answered (unless age: false) and service workers blocked by default. */
export async function context(browser, { age = true, serviceWorkers = 'block', ...opts } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers, ...opts });
  await ctx.addInitScript(pageHooks, STORAGE_PREFIX);
  if (age) await ctx.addInitScript(AGE_YES, key('age'));
  return ctx;
}

/**
 * Wait for fn(arg) to be truthy in the page. Returns true, or false after
 * the timeout, so a check can report what it saw instead of crashing.
 */
export async function until(page, fn, arg, timeout = 10000) {
  try {
    // Polled on a timer, not on animation frames, so a page that stops painting can't stall a check.
    await page.waitForFunction(fn, arg, { timeout, polling: 50 });
    return true;
  } catch (e) {
    if (/Timeout/i.test(e.message)) return false;
    throw e;
  }
}

/** Wait until the game script under `selector` has mounted. */
export const mounted = (page, selector, timeout = 10000) =>
  until(page, (s) => [...document.querySelectorAll(s)].every((el) => window.__chk.mounted.has(el)) && document.querySelector(s), selector, timeout);

/** Describe the focused element, or "body" when focus has been lost. */
export const focused = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return 'body';
    return `${a.tagName.toLowerCase()}${a.dataset.action ? `[data-action=${a.dataset.action}]` : ''}${a.id ? `#${a.id}` : ''} "${(a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
  });

/** Elements that lost focus to <body> since the page loaded. */
export const lostFocus = (page) => page.evaluate(() => window.__chk.lost.slice());

/** Reject if `promise` hasn't settled within `ms`, so a stuck page fails a check instead of hanging the run. */
export const within = (promise, ms, what) => {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`${what} took over ${ms / 1000} s`)), ms))),
  ]);
};

/** Scroll to the end and back so lazily laid-out sections (content-visibility) are measured. */
export const scrollThrough = (page) =>
  page.evaluate(async () => {
    // A frame, or at most 100 ms if the page isn't producing frames.
    const frame = () => new Promise((r) => {
      requestAnimationFrame(() => r());
      setTimeout(r, 100);
    });
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
      scrollTo(0, y);
      await frame();
    }
    scrollTo(0, 0);
    await frame();
  });

/** Run fn over items, `n` at a time. */
export async function pool(items, n, fn) {
  const queue = items.map((item, i) => [item, i]);
  const workers = Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) {
      const [item, i] = queue.shift();
      await fn(item, i);
    }
  });
  await Promise.all(workers);
}
