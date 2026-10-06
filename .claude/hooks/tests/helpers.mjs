// Original (site factory). Test harness for the hook tests: a throwaway factory repo per test and a
// hook runner that feeds stdin JSON and returns { status, stdout, stderr }. Not a test file itself.
// Never depends on $CLAUDE_SCRATCHPAD (empty in Bash); everything lives under os.tmpdir().
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HOOKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(HOOKS, '..', '..');

const STRIP_ENV = ['FACTORY_ROLE', 'SITE_SLUG', 'FACTORY_BRANCH', 'FACTORY_HOOKS', 'CLAUDE_PROJECT_DIR', 'CLAUDE_ENV_FILE', 'CLAUDE_CODE_REMOTE', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'];

export function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const k of STRIP_ENV) delete env[k];
  return { ...env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid', ...extra };
}

export function git(dir, ...args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: cleanEnv() });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function write(root, rel, content) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
}

const FAKE_BUILD = `// fake engine/build.mjs for hook tests
import fs from 'node:fs'; import path from 'node:path';
const site = process.argv[2];
const problems = fs.existsSync(path.join(site, '.fake-problems')) ? fs.readFileSync(path.join(site, '.fake-problems'), 'utf8').trim().split('\\n') : [];
if (fs.existsSync(path.join(site, '.fake-crash'))) { console.error('boom'); process.exit(3); }
process.stdout.write(JSON.stringify({ ok: !problems.length, problems: problems.map(m => ({ rule: 'fake', message: m })), warnings: [{ rule: 'placeholder', message: 'w' }] }));
process.exit(problems.length ? 1 : 0);
`;

const FAKE_CHECK = `// fake engine/tools/check.mjs for hook tests
import fs from 'node:fs'; import path from 'node:path';
const a = process.argv; const site = a[a.indexOf('--site') + 1]; const report = a[a.indexOf('--report') + 1];
if (fs.existsSync(path.join(site, '.fake-check-stop'))) { console.log('pages: 3 passed'); console.log('Stopped after 15 minutes (CHECK_TIMEOUT_MIN)'); process.exit(1); }
if (fs.existsSync(path.join(site, '.fake-check-fail'))) { console.log('✗ pages: home has no h1'); process.exit(1); }
fs.writeFileSync(report, JSON.stringify({ partial: false, totals: { passed: 5, failed: 0 } }));
console.log('pages: 5 passed');
`;

/** A committed factory repo on branch `main`. */
export function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-hooks-'));
  git(root, 'init', '-q', '-b', 'main');
  write(root, '.gitignore', 'reports/\n');
  write(root, 'engine/build.mjs', FAKE_BUILD);
  write(root, 'engine/tools/check.mjs', FAKE_CHECK);
  write(root, 'engine/lib/context.mjs', "export const DISCLAIMER = 'x';\nexport const OTHER = 1;\n");
  write(root, 'schemas/stages.json', { stages: ['intake', 'approved'] });
  write(root, 'sites/demo/site.config.json', '{\n  "brand": "Demo",\n  "type": "social-casino",\n  "games": [\n    { "slug": "a", "skin": {}, "rtp": 96 }\n  ]\n}\n');
  write(root, 'sites/demo/content/home.json', { h1: 'Demo' });
  write(root, 'orders/demo/order.json', { status: 'draft' });
  write(root, 'sites/ready/content/home.json', { h1: 'Ready' });
  write(root, 'orders/ready/order.json', { status: 'approved' });
  write(root, 'sites/legacy/site.config.json', { brand: 'Legacy', type: 'social-casino' });
  write(root, 'sites/legacy/content/home.json', { h1: 'Legacy' });
  write(root, 'sites/_fixtures/bad-copy/content/home.json', { h1: 'x' });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}

export function transcriptLine(role, text, at = new Date()) {
  if (role === 'user') return JSON.stringify({ type: 'user', timestamp: at.toISOString(), message: { role: 'user', content: text } });
  return JSON.stringify({ type: 'assistant', timestamp: at.toISOString(), message: { role: 'assistant', id: 'm' + Math.abs(hash(text)), model: 'claude-opus-5-5', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 1 } } });
}
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

/** Apply a named fixture to a repo; returns extra input fields (e.g. transcript_path). */
export function applyFixture(root, name) {
  const extra = {};
  if (!name || name === 'repo') return extra;
  if (name === 'ship-lock') {
    write(root, 'reports/demo/ship.lock', { slug: 'demo', pr: 7, sha: 'abc', expiresAt: new Date(Date.now() + 20 * 60000).toISOString() });
    const t = path.join(root, 'reports', 'transcript.jsonl');
    fs.writeFileSync(t, [transcriptLine('assistant', 'Type ship demo to confirm'), transcriptLine('user', 'ship demo')].join('\n') + '\n');
    extra.transcript_path = t;
    return extra;
  }
  if (name === 'staged-secret') {
    write(root, 'sites/legacy/content/keys.json', { key: 'AKIA' + 'ABCDEFGHIJKLMNOP' });
  } else if (name === 'staged-placeholder') {
    write(root, 'sites/demo/content/home.json', { h1: 'TODO headline' });
  } else if (name === 'staged-clean') {
    write(root, 'sites/demo/content/home.json', { h1: 'Brass and verdigris' });
  } else {
    throw new Error('unknown fixture ' + name);
  }
  git(root, 'add', '-A');
  return extra;
}

/** Run a hook with a stdin payload (object, or { raw } string) in `cwd` with extra env. */
export function runHook(hook, payload, { env = {}, args = [], cwd = REPO, timeout = 60000 } = {}) {
  const input = payload && typeof payload.raw === 'string' ? payload.raw : JSON.stringify(payload);
  const r = spawnSync(process.execPath, [path.join(HOOKS, hook), ...args], { input, encoding: 'utf8', env: cleanEnv(env), cwd, timeout });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

export function fileInput(root, ex) {
  const tool_input = { file_path: ex.file_path };
  if (ex.content !== undefined) tool_input.content = ex.content;
  if (ex.old_string !== undefined) { tool_input.old_string = ex.old_string; tool_input.new_string = ex.new_string; }
  else if (ex.content === undefined) tool_input.content = '{}';
  return { session_id: 'test', cwd: root, hook_event_name: 'PreToolUse', tool_name: ex.tool || 'Write', tool_input };
}

export function bashInput(root, ex, extra = {}) {
  const tool_input = { command: ex.command };
  if (ex.run_in_background) tool_input.run_in_background = true;
  return { session_id: 'test', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input, ...extra };
}

export function rm(root) {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
}
