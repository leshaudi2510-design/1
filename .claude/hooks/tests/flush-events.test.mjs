// flush-events.mjs: Stop gate (attempt cap, stop_hook_active, `Stopped after`), checkpoint commit
// (never push), PreCompact, cost row, hub behaviour, FACTORY_HOOKS=off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo, runHook, git, transcriptLine, rm } from './helpers.mjs';

let n = 0;
const sid = () => `flush-${process.pid}-${Date.now()}-${n++}`;
const accum = s => path.join(os.tmpdir(), `factory-edited-${s}.txt`);
const events = (root, slug) => fs.readFileSync(path.join(root, 'reports', slug, 'events.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));

function edited(root, s, rels) {
  fs.writeFileSync(accum(s), rels.map(r => path.join(root, r)).join('\n') + '\n');
}

function cleanup(s) {
  for (const f of [accum(s), path.join(os.tmpdir(), `factory-stop-attempts-${s}`), path.join(os.tmpdir(), `factory-transcript-${s}.json`)]) fs.rmSync(f, { force: true });
}

const SPOKE = { FACTORY_BRANCH: 'site/legacy' };

test('green gate: checkpoint commit of sites/<slug> only, never a push, events + cost row written', () => {
  const root = makeRepo();
  const s = sid();
  try {
    fs.writeFileSync(path.join(root, 'sites/legacy/content/home.json'), '{"h1":"New"}\n');
    fs.writeFileSync(path.join(root, 'stray.txt'), 'not committed by the hook');
    edited(root, s, ['sites/legacy/content/home.json']);
    const t = path.join(root, 'reports', 't.jsonl');
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, [transcriptLine('user', 'go'), transcriptLine('assistant', 'done')].join('\n') + '\n');
    const r = runHook('flush-events.mjs', { session_id: s, cwd: root, hook_event_name: 'Stop', transcript_path: t }, { cwd: root, env: SPOKE });
    assert.equal(r.status, 0, r.stderr);
    assert.match(git(root, 'log', '-1', '--format=%s'), /^site\(legacy\): checkpoint /);
    assert.deepEqual(git(root, 'show', '--name-only', '--format=', 'HEAD').split('\n'), ['sites/legacy/content/home.json']);
    assert.match(git(root, 'status', '--porcelain'), /stray\.txt/);
    assert.equal(git(root, 'remote'), '', 'no remote configured, nothing pushed');
    const ev = events(root, 'legacy');
    const cost = ev.find(e => e.kind === 'cost');
    assert.ok(cost && cost.inputTokens === 10 && cost.cacheRead === 100 && cost.modelFamily === 'opus');
    assert.ok(!fs.existsSync(accum(s)), 'accumulator cleared after a green gate');
  } finally { cleanup(s); rm(root); }
});

test('failing gate: exit 2 on the first attempt, then blocked: needs operator (attempt cap 2)', () => {
  const root = makeRepo();
  const s = sid();
  try {
    fs.writeFileSync(path.join(root, 'sites/legacy/.fake-problems'), 'operator.address is still a placeholder\n');
    edited(root, s, ['sites/legacy/site.config.json']);
    const first = runHook('flush-events.mjs', { session_id: s, cwd: root, hook_event_name: 'Stop' }, { cwd: root, env: SPOKE });
    assert.equal(first.status, 2);
    assert.match(first.stderr, /placeholder/);
    const second = runHook('flush-events.mjs', { session_id: s, cwd: root, hook_event_name: 'Stop' }, { cwd: root, env: SPOKE });
    assert.equal(second.status, 0);
    assert.match(JSON.parse(second.stdout).systemMessage, /blocked: needs operator/);
    assert.ok(events(root, 'legacy').some(e => e.severity === 'warn' && e.text === 'blocked: needs operator'));
  } finally { cleanup(s); rm(root); }
});

test('stop_hook_active: failures never loop the session', () => {
  const root = makeRepo();
  const s = sid();
  try {
    fs.writeFileSync(path.join(root, 'sites/legacy/.fake-problems'), 'x\n');
    edited(root, s, ['sites/legacy/content/home.json']);
    const r = runHook('flush-events.mjs', { session_id: s, cwd: root, hook_event_name: 'Stop', stop_hook_active: true }, { cwd: root, env: SPOKE });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /blocked: needs operator/);
  } finally { cleanup(s); rm(root); }
});

test('a `Stopped after` line from check --only=pages is a failure, never green', () => {
  const root = makeRepo();
  const s = sid();
  try {
    fs.writeFileSync(path.join(root, 'sites/legacy/.fake-check-stop'), '');
    edited(root, s, ['sites/legacy/content/home.json']);
    const r = runHook('flush-events.mjs', { session_id: s, cwd: root, hook_event_name: 'Stop' }, { cwd: root, env: SPOKE });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Stopped after/);
  } finally { cleanup(s); rm(root); }
});

test('no site edits: no gate, exit 0', () => {
  const root = makeRepo();
  const s = sid();
  try {
    fs.writeFileSync(path.join(root, 'sites/legacy/.fake-problems'), 'x\n');
    const r = runHook('flush-events.mjs', { session_id: s, cwd: root, hook_event_name: 'Stop' }, { cwd: root, env: SPOKE });
    assert.equal(r.status, 0, r.stderr);
  } finally { cleanup(s); rm(root); }
});

test('hub: never gates and never commits, even with site edits', () => {
  const root = makeRepo();
  const s = sid();
  try {
    fs.writeFileSync(path.join(root, 'sites/legacy/.fake-problems'), 'x\n');
    fs.writeFileSync(path.join(root, 'sites/legacy/content/home.json'), '{"h1":"Hub edit"}\n');
    edited(root, s, ['sites/legacy/content/home.json']);
    const head = git(root, 'rev-parse', 'HEAD');
    const r = runHook('flush-events.mjs', { session_id: s, cwd: root, hook_event_name: 'Stop' }, { cwd: root, env: { FACTORY_BRANCH: 'claude/x' } });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(git(root, 'rev-parse', 'HEAD'), head);
    assert.ok(fs.existsSync(path.join(root, 'reports/_hub/events.jsonl')), 'reports/ is gitignored in the fixture, so _hub events land there');
  } finally { cleanup(s); rm(root); }
});

test('PreCompact: info event, exit 0, no gate', () => {
  const root = makeRepo();
  const s = sid();
  try {
    fs.writeFileSync(path.join(root, 'sites/legacy/.fake-problems'), 'x\n');
    edited(root, s, ['sites/legacy/content/home.json']);
    const r = runHook('flush-events.mjs', { session_id: s, cwd: root, hook_event_name: 'PreCompact', trigger: 'auto' }, { cwd: root, env: SPOKE, args: ['--precompact'] });
    assert.equal(r.status, 0);
    assert.ok(events(root, 'legacy').some(e => /^compaction at /.test(e.text)));
    assert.ok(JSON.parse(fs.readFileSync(path.join(root, 'reports/legacy/session.json'), 'utf8')).summary);
  } finally { cleanup(s); rm(root); }
});

test('FACTORY_HOOKS=off and empty input exit 0 without side effects', () => {
  const root = makeRepo();
  try {
    assert.equal(runHook('flush-events.mjs', { session_id: 'x', cwd: root }, { cwd: root, env: { ...SPOKE, FACTORY_HOOKS: 'off' } }).status, 0);
    assert.equal(runHook('flush-events.mjs', { raw: '' }, { cwd: root, env: SPOKE }).status, 0);
    assert.ok(!fs.existsSync(path.join(root, 'reports/legacy/events.jsonl')));
  } finally { rm(root); }
});
