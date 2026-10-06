// Shared helpers for the factory tools (tools/*.mjs). Zero dependencies: Node 20+.
//
// Paths: every tool resolves the repository root as the parent of tools/
// unless FACTORY_ROOT (absolute, or relative to the cwd) says otherwise, so
// the tests can point a tool at a throwaway fixture repository.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOOLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function repoRoot() {
  const env = process.env.FACTORY_ROOT;
  if (env && env !== '.') return path.resolve(env);
  return path.resolve(TOOLS_DIR, '..');
}

/** Minimal argv parser: --flag, --key value, --key=value, positionals. */
export function parseArgs(argv, { booleans = [], strings = [], multi = [] } = {}) {
  const out = { _: [] };
  for (const m of multi) out[m] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { out._.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      let key = a.slice(2);
      let val;
      const eq = key.indexOf('=');
      if (eq >= 0) { val = key.slice(eq + 1); key = key.slice(0, eq); }
      if (booleans.includes(key)) { out[key] = val === undefined ? true : !/^(0|false|no)$/i.test(val); continue; }
      if (strings.includes(key) || multi.includes(key)) {
        if (val === undefined) {
          val = argv[i + 1];
          if (val === undefined || (val.startsWith('--') && val.length > 2)) throw new UsageError(`--${key} needs a value`);
          i++;
        }
        if (multi.includes(key)) out[key].push(val); else out[key] = val;
        continue;
      }
      throw new UsageError(`unknown option --${key}`);
    }
    out._.push(a);
  }
  return out;
}

export class UsageError extends Error {}

/** Run main(); usage errors exit 2 with the message, other errors exit 2 with a stack. */
export async function runMain(main, help) {
  try {
    const code = await main(process.argv.slice(2));
    process.exitCode = code ?? 0;
  } catch (e) {
    if (e instanceof UsageError) {
      process.stderr.write(`error: ${e.message}\n\n${help || ''}`);
      process.exitCode = 2;
    } else {
      process.stderr.write(`error: ${e && e.stack ? e.stack : e}\n`);
      process.exitCode = 2;
    }
  }
}

export const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
export const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
export const readText = (p) => fs.readFileSync(p, 'utf8');
export function readJson(p) {
  const txt = fs.readFileSync(p, 'utf8');
  try { return JSON.parse(txt); } catch (e) { throw new Error(`${p}: invalid JSON (${e.message})`); }
}
export function readJsonIf(p) { return exists(p) ? readJson(p) : null; }
export function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function today() { return new Date().toISOString().slice(0, 10); }

export function slugify(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Recursive file list (relative, posix separators), skipping the given dir names. */
export function walk(dir, { skip = ['node_modules', '.git'] } = {}) {
  const out = [];
  const rec = (d, rel) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (skip.includes(e.name)) continue;
      const p = path.join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) rec(p, r);
      else if (e.isFile() || e.isSymbolicLink()) out.push(r);
    }
  };
  rec(dir, '');
  return out.sort();
}

export function git(args, { cwd = repoRoot(), allowFail = true } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  }
  return r.stdout;
}

/** Pad-and-join table printer. */
export function table(rows, header) {
  const all = header ? [header, ...rows] : rows;
  const widths = [];
  for (const r of all) r.forEach((c, i) => { widths[i] = Math.max(widths[i] || 0, String(c ?? '').length); });
  const line = (r) => r.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ').trimEnd();
  const out = all.map(line);
  if (header) out.splice(1, 0, widths.map((w) => '-'.repeat(w)).join('  '));
  return out.join('\n');
}

/** Get a nested value by dotted path ("a.b[2].c" or "a.b.2.c"). */
export function getPath(obj, p) {
  if (!p) return obj;
  const parts = String(p).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur = obj;
  for (const k of parts) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}

/** True when the module at metaUrl is the entry script (so tools can be imported by tests). */
export function isMain(metaUrl) {
  try { return fs.realpathSync(path.resolve(process.argv[1] || '')) === fs.realpathSync(fileURLToPath(metaUrl)); } catch { return false; }
}

/** The scratch directory for temporary build output. */
export function scratchDir() {
  return process.env.CLAUDE_SCRATCHPAD || process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp';
}
