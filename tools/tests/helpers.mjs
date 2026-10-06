// Test helpers: throwaway fixture repositories and a tool runner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(TOOLS, '..');

/** A temporary repository with schemas/ and orders/_templates/ copied from this one. */
export function makeRepo({ withTemplates = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-test-'));
  fs.cpSync(path.join(REPO, 'schemas'), path.join(dir, 'schemas'), { recursive: true });
  if (withTemplates) fs.cpSync(path.join(REPO, 'orders', '_templates'), path.join(dir, 'orders', '_templates'), { recursive: true });
  return dir;
}

export function write(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  return p;
}

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const example = (name = 'order.example.json') => readJson(path.join(REPO, 'orders', '_templates', name));

/** Run a tool (path relative to tools/) with FACTORY_ROOT set. */
export function run(tool, args = [], { root = REPO, env = {}, input } = {}) {
  const r = spawnSync(process.execPath, [path.join(TOOLS, tool), ...args], { cwd: REPO, encoding: 'utf8', input, env: { ...process.env, FACTORY_ROOT: root, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** A static (engine: none) site with the given pages { 'index.html': html }. */
export function staticSite(root, slug, pages, config = { engine: 'none', type: 'social-casino' }) {
  write(root, `sites/${slug}/site.config.json`, config);
  for (const [rel, html] of Object.entries(pages)) write(root, `sites/${slug}/${rel}`, html);
  return path.join(root, 'sites', slug);
}

export function page({ title = 'Page', h1 = 'Heading', body = '', nav = ['Games', 'About'] }) {
  return `<!doctype html><html lang="en-GB"><head><title>${title}</title></head><body><header><nav>${nav.map((n) => `<a href="#">${n}</a>`).join('')}</nav></header><main><section id="hero"><h1>${h1}</h1><p>${body}</p></section></main><footer><p class="disclaimer">Free to play. No real money.</p></footer></body></html>`;
}

export const lorem = (seed, n = 120) => {
  const words = ['brass', 'ledger', 'transit', 'circle', 'reading', 'dome', 'lantern', 'harbour', 'velvet', 'crown', 'signal', 'paper', 'chart', 'compass', 'tide', 'garden', 'kiln', 'glass', 'mill', 'loom', 'quill', 'ink', 'press', 'type', 'frame'];
  let s = seed; const out = [];
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) % 2147483648; out.push(words[s % words.length]); }
  return out.join(' ');
};
