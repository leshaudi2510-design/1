// Shared plumbing for tools/check.mjs: pass and fail lines, throwaway builds,
// a static server, and browser helpers that wait on page state, never on time.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ---------- reporting ----------

export const failures = [];
let passes = 0;
export const pass = (msg) => {
  passes++;
  console.log(`  ✓ ${msg}`);
};
export const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
/** pass or fail on a condition; `detail` is added to the failure line only. */
export const expect = (ok, msg, detail = '') => (ok ? pass(msg) : fail(detail ? `${msg}: ${detail}` : msg));
export const summary = () => ({ passes, failures: failures.length });

/**
 * Run one section of checks. A crash inside it is reported as a failure and
 * the next section still runs.
 */
export async function section(title, fn) {
  console.log(`\n${title}`);
  const t0 = Date.now();
  try {
    await fn();
  } catch (e) {
    fail(`${title}: stopped with an error: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e}`);
  }
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

// ---------- builds ----------

export const baseConfig = async () => JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));

let tmpRoot;
export async function tempDir() {
  tmpRoot ??= await fs.mkdtemp(path.join(os.tmpdir(), 'oql-check-'));
  return tmpRoot;
}
export async function cleanTemp() {
  if (tmpRoot) await fs.rm(tmpRoot, { recursive: true, force: true });
}

/**
 * Build the site with site.config.json changed by `edit` into a temporary
 * folder. Returns { name, dir, cfg, ok, output }.
 */
export async function buildSite(name, edit = (c) => c) {
  const tmp = await tempDir();
  const cfg = edit(await baseConfig());
  const cfgFile = path.join(tmp, `${name}.config.json`);
  const dir = path.join(tmp, name);
  await fs.writeFile(cfgFile, JSON.stringify(cfg, null, 2));
  const r = spawnSync(process.execPath, ['build.mjs'], {
    cwd: ROOT,
    env: { ...process.env, SITE_CONFIG: cfgFile, OUT_DIR: dir },
    encoding: 'utf8',
  });
  const output = `${r.stdout || ''}${r.stderr || ''}`.trim();
  const ok = r.status === 0 && /Lint: no problems found\./.test(output);
  return { name, dir, cfg, ok, output };
}

/** Every path in a build's sitemap, then the 404 page and the offline page. */
export async function sitePaths(dir) {
  const xml = await fs.readFile(path.join(dir, 'sitemap.xml'), 'utf8');
  const paths = [...xml.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
  return [...paths, '/no-such-page/', '/offline/'];
}

// ---------- serving ----------

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain',
};

/** Serve a build folder the way the hosts do: pretty URLs and the custom 404. */
export function serve(dir) {
  const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(dir, path.normalize(p));
    try {
      if (!file.startsWith(dir)) throw new Error('outside');
      const data = await fs.readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      res.end(await fs.readFile(path.join(dir, '404.html')));
    }
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      // "localhost" rather than 127.0.0.1: the site registers its service worker only on https or localhost.
      resolve({ base: `http://localhost:${server.address().port}`, close: () => new Promise((r) => server.close(r)) });
    }),
  );
}

// ---------- browser ----------

export const PRAGMATIC_HOST = /(^|\.)pragmaticplay\.net$/;

/**
 * First-visit answer to the age question, set before any page script runs.
 * Init scripts run in every frame, so this and pageHooks skip the demo's iframe.
 */
export const AGE_YES = () => {
  if (window.top === window) localStorage.setItem('oql.age', JSON.stringify({ answer: 'yes', at: Date.now() }));
};

/**
 * Hooks every page gets (an init script, so they exist before the site's own
 * scripts run). They let the checks wait on what the page does, not on time:
 *   window.__oql.mounted   game roots whose script has started (the first
 *                          change it makes to data-state or aria-disabled)
 *   window.__oql.results   how many times any [data-result] text changed
 *   window.__oql.lost      elements that lost focus to <body>
 */
export function pageHooks() {
  if (window.top !== window) return;
  const oql = (window.__oql = { mounted: new WeakSet(), results: 0, lost: [] });
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
        if (root) oql.mounted.add(root);
      } else if (el.closest('[data-result]')) oql.results++;
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-state', 'aria-disabled'] });
  document.addEventListener(
    'focusout',
    (e) => {
      const from = label(e.target);
      setTimeout(() => {
        if (document.hasFocus() && (!document.activeElement || document.activeElement === document.body)) oql.lost.push(from);
      }, 0);
    },
    true,
  );
}

/**
 * Record what a page does wrong: console errors, uncaught errors and
 * requests to any other origin. `allow404` lets the 404 page's own
 * document status through (and nothing else).
 */
export function watch(page, base, { allow404 = false } = {}) {
  const w = { errors: [], foreign: [], pragmatic: [] };
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
      if (PRAGMATIC_HOST.test(new URL(url).hostname)) w.pragmatic.push(url);
    } catch {}
  });
  return w;
}

/** A browser context with the page hooks, the age answered (unless age: false) and service workers blocked by default. */
export async function context(browser, { age = true, serviceWorkers = 'block', ...opts } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers, ...opts });
  await ctx.addInitScript(pageHooks);
  if (age) await ctx.addInitScript(AGE_YES);
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
  until(page, (s) => [...document.querySelectorAll(s)].every((el) => window.__oql.mounted.has(el)) && document.querySelector(s), selector, timeout);

/** Describe the focused element, or "body" when focus has been lost. */
export const focused = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return 'body';
    return `${a.tagName.toLowerCase()}${a.dataset.action ? `[data-action=${a.dataset.action}]` : ''}${a.id ? `#${a.id}` : ''} "${(a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
  });

/** Elements that lost focus to <body> since the page loaded. */
export const lostFocus = (page) => page.evaluate(() => window.__oql.lost.slice());

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
