// lint-touched-site.mjs, context-line.mjs, log-event.mjs, guard-ppc.mjs and session-start.sh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { HOOKS, makeRepo, runHook, cleanEnv, rm, git } from './helpers.mjs';

const W = (root, file_path, s = 'lint') => ({ session_id: s, cwd: root, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path, content: '{}' } });

// ---------- lint-touched-site ----------
test('lint-touched-site: builds the touched site, writes reports/<slug>/build.json, reports 0 problems as context', () => {
  const root = makeRepo();
  try {
    const r = runHook('lint-touched-site.mjs', W(root, 'sites/legacy/content/home.json'), { cwd: root });
    assert.equal(r.status, 0, r.stderr);
    const b = JSON.parse(fs.readFileSync(path.join(root, 'reports/legacy/build.json'), 'utf8'));
    assert.deepEqual(b.problems, []);
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /0 problems, 1 warning/);
  } finally { rm(root); }
});

test('lint-touched-site: problems go to stderr with exit 2; debounce skips a second build within 2 s', () => {
  const root = makeRepo();
  try {
    fs.writeFileSync(path.join(root, 'sites/legacy/.fake-problems'), 'forbidden wording /jackpot/\n');
    const r = runHook('lint-touched-site.mjs', W(root, 'sites/legacy/content/home.json'), { cwd: root });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /jackpot/);
    const again = runHook('lint-touched-site.mjs', W(root, 'sites/legacy/content/home.json'), { cwd: root });
    assert.equal(again.status, 0, 'debounced');
  } finally { rm(root); }
});

test('lint-touched-site: non-site, docs, dist and fixture paths do not build; FACTORY_HOOKS=off is silent', () => {
  const root = makeRepo();
  try {
    fs.writeFileSync(path.join(root, 'sites/legacy/.fake-problems'), 'x\n');
    for (const f of ['engine/build.mjs', 'sites/legacy/docs/README.md', 'sites/legacy/dist/index.html', 'sites/_fixtures/bad-copy/content/home.json', 'CLAUDE.md']) {
      const r = runHook('lint-touched-site.mjs', W(root, f), { cwd: root });
      assert.equal(r.status, 0, f);
    }
    assert.ok(!fs.existsSync(path.join(root, 'reports/legacy/build.json')));
    assert.equal(runHook('lint-touched-site.mjs', W(root, 'sites/legacy/content/home.json'), { cwd: root, env: { FACTORY_HOOKS: 'off' } }).stdout, '');
  } finally { rm(root); }
});

test('lint-touched-site: design signals reach the model as additionalContext and the path is accumulated', () => {
  const root = makeRepo();
  const s = `sig-${process.pid}`;
  try {
    fs.writeFileSync(path.join(root, 'sites/legacy/content/home.json'), '{"h1":"Play for cash prizes"}');
    const r = runHook('lint-touched-site.mjs', W(root, 'sites/legacy/content/home.json', s), { cwd: root });
    assert.equal(r.status, 0, r.stderr);
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /signal-real-money/);
    assert.match(fs.readFileSync(path.join(os.tmpdir(), `factory-edited-${s}.txt`), 'utf8'), /sites\/legacy\/content\/home\.json/);
  } finally { fs.rmSync(path.join(os.tmpdir(), `factory-edited-${s}.txt`), { force: true }); rm(root); }
});

// ---------- context-line ----------
test('context-line: hub line, site line with stage and gates, silent when off', () => {
  const root = makeRepo();
  try {
    const hub = runHook('context-line.mjs', { prompt: 'x', session_id: 't', cwd: root }, { cwd: root, env: { FACTORY_BRANCH: 'claude/x' } });
    assert.match(hub.stdout, /^factory: hub \| branch claude\/x/);
    fs.mkdirSync(path.join(root, 'reports/legacy'), { recursive: true });
    fs.writeFileSync(path.join(root, 'reports/legacy/session.json'), JSON.stringify({ stage: 'Create', gates: { lint: true, check: false } }));
    const site = runHook('context-line.mjs', { prompt: 'x', session_id: 't', cwd: root }, { cwd: root, env: { FACTORY_BRANCH: 'site/legacy' } });
    assert.match(site.stdout, /^factory: order legacy \| type social-casino \| branch site\/legacy \| last stage Create \| gates lint✓ check✗/);
    assert.equal(runHook('context-line.mjs', { prompt: 'x' }, { cwd: root, env: { FACTORY_HOOKS: 'off' } }).stdout, '');
  } finally { rm(root); }
});

test('context-line: /compact nudge once per context bucket', () => {
  const root = makeRepo();
  const s = `ctx-${process.pid}-${Date.now()}`;
  try {
    const t = path.join(root, 'reports/t.jsonl');
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', usage: { input_tokens: 170000, cache_read_input_tokens: 0, output_tokens: 10 } } }) + '\n');
    const env = { FACTORY_BRANCH: 'site/legacy', COMPACT_CONTEXT_THRESHOLD: '100000' };
    const first = runHook('context-line.mjs', { prompt: 'x', session_id: s, cwd: root, transcript_path: t }, { cwd: root, env });
    assert.match(first.stdout, /\/compact Next: .* for legacy/);
    const second = runHook('context-line.mjs', { prompt: 'x', session_id: s, cwd: root, transcript_path: t }, { cwd: root, env });
    assert.doesNotMatch(second.stdout, /\/compact/);
  } finally { fs.rmSync(path.join(os.tmpdir(), `claude-context-bucket-${s}`), { force: true }); rm(root); }
});

// ---------- log-event ----------
test('log-event: StopFailure appends a warn event (site) and exits 0 on any input', () => {
  const root = makeRepo();
  try {
    assert.equal(runHook('log-event.mjs', { session_id: 't', cwd: root, error_type: 'rate_limit' }, { cwd: root, env: { FACTORY_BRANCH: 'site/legacy' } }).status, 0);
    const ev = JSON.parse(fs.readFileSync(path.join(root, 'reports/legacy/events.jsonl'), 'utf8').trim());
    assert.equal(ev.severity, 'warn');
    assert.equal(ev.text, 'rate_limit');
    assert.equal(runHook('log-event.mjs', { raw: '' }, { cwd: root }).status, 0);
  } finally { rm(root); }
});

// ---------- guard-ppc ----------
test('guard-ppc: mutate denied, reads allowed, GTM publish asks, routine and protected customers denied, post logs', () => {
  const root = makeRepo();
  try {
    const call = (tool_name, tool_input = {}, env = {}, args = []) => runHook('guard-ppc.mjs', { session_id: 't', cwd: root, tool_name, tool_input }, { cwd: root, env, args });
    assert.equal(call('mcp__google-ads__mutate').status, 2);
    assert.equal(call('mcp__google-ads__upload_click_conversions').status, 2);
    assert.equal(call('mcp__google-ads__search', { customer_id: '1234567890', query: 'SELECT campaign.id FROM campaign' }).status, 0);
    assert.equal(call('mcp__ga4__run_report').status, 0);
    const ask = call('mcp__gtm__publish_version');
    assert.equal(ask.status, 0);
    assert.equal(JSON.parse(ask.stdout).hookSpecificOutput.permissionDecision, 'ask');
    assert.equal(call('mcp__ga4__run_report', {}, { FACTORY_ROLE: 'routine' }).status, 2);
    fs.mkdirSync(path.join(root, 'ppc'), { recursive: true });
    fs.writeFileSync(path.join(root, 'ppc/accounts.json'), JSON.stringify({ protected: ['111-222-3333'] }));
    assert.equal(call('mcp__google-ads__search', { customer_id: '1112223333' }).status, 2);
    assert.equal(call('mcp__google-ads__search', { customer_id: '9998887777' }, {}, ['--post']).status, 0);
    const row = JSON.parse(fs.readFileSync(path.join(root, 'ppc/changelog.jsonl'), 'utf8').trim());
    assert.equal(row.account, '9998887777');
    assert.match(row.inputHash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(runHook('guard-ppc.mjs', { raw: '' }, { cwd: root }).status, 2);
  } finally { rm(root); }
});

// ---------- session-start ----------
test('session-start.sh: exits 0, writes role/slug to CLAUDE_ENV_FILE, spoke deny rules, hub writes none', () => {
  const root = makeRepo();
  try {
    fs.mkdirSync(path.join(root, '.claude/hooks/lib'), { recursive: true });
    fs.copyFileSync(path.join(HOOKS, 'lib/state-load.mjs'), path.join(root, '.claude/hooks/lib/state-load.mjs'));
    const envFile = path.join(root, 'reports/env.sh');
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    const run = () => spawnSync('bash', [path.join(HOOKS, 'session-start.sh')], {
      cwd: root, input: '{"source":"startup"}', encoding: 'utf8', timeout: 60000,
      env: cleanEnv({ CLAUDE_PROJECT_DIR: root, CLAUDE_ENV_FILE: envFile }),
    });
    const hub = run();
    assert.equal(hub.status, 0);
    assert.match(hub.stdout, /factory: role hub/);
    assert.match(fs.readFileSync(envFile, 'utf8'), /FACTORY_ROLE=hub/);
    assert.ok(!fs.existsSync(path.join(root, '.claude/settings.local.json')));
    git(root, 'checkout', '-q', '-b', 'site/legacy');
    fs.mkdirSync(path.join(root, 'reports/legacy'), { recursive: true });
    fs.writeFileSync(path.join(root, 'reports/legacy/session.json'), JSON.stringify({ stage: 'Verify', gates: { lint: true } }));
    const spoke = run();
    assert.equal(spoke.status, 0);
    assert.match(spoke.stdout, /factory: role spoke \| site legacy/);
    assert.match(spoke.stdout, /HISTORICAL REFERENCE ONLY/);
    assert.match(fs.readFileSync(envFile, 'utf8'), /SITE_SLUG=legacy/);
    assert.match(fs.readFileSync(path.join(root, '.claude/settings.local.json'), 'utf8'), /registry\.mjs reserve/);
    const off = spawnSync('bash', [path.join(HOOKS, 'session-start.sh')], { cwd: root, input: '', encoding: 'utf8', env: cleanEnv({ CLAUDE_PROJECT_DIR: root, FACTORY_HOOKS: 'off' }) });
    assert.equal(off.status, 0);
    assert.equal(off.stdout, '');
  } finally { rm(root); }
});
