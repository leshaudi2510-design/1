// guard-scope.mjs beyond the guard-rules.json examples: input integrity, MultiEdit/NotebookEdit,
// worktree path normalisation, hub safety on claude/* and worktree branches, FACTORY_HOOKS=off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeRepo, runHook, rm } from './helpers.mjs';

const W = (root, file_path, extra = {}) => ({ session_id: 't', cwd: root, tool_name: 'Write', tool_input: { file_path, content: '{}' }, ...extra });

test('fails closed: empty, invalid JSON, truncated (>1 MiB) and path-less input', () => {
  const root = makeRepo();
  try {
    assert.equal(runHook('guard-scope.mjs', { raw: '' }, { cwd: root }).status, 2);
    assert.equal(runHook('guard-scope.mjs', { raw: '{"tool_name":' }, { cwd: root }).status, 2);
    assert.equal(runHook('guard-scope.mjs', { raw: '[]' }, { cwd: root }).status, 2);
    const big = JSON.stringify(W(root, 'sites/legacy/content/a.json', { pad: 'x'.repeat(1100 * 1024) }));
    const r = runHook('guard-scope.mjs', { raw: big }, { cwd: root });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /truncated/);
    assert.equal(runHook('guard-scope.mjs', { session_id: 't', cwd: root, tool_name: 'Write', tool_input: {} }, { cwd: root }).status, 2);
  } finally { rm(root); }
});

test('FACTORY_HOOKS=off does not disable guard-scope', () => {
  const root = makeRepo();
  try {
    const r = runHook('guard-scope.mjs', W(root, 'engine/build.mjs'), { cwd: root, env: { FACTORY_HOOKS: 'off', FACTORY_ROLE: 'spoke', SITE_SLUG: 'legacy' } });
    assert.equal(r.status, 2);
  } finally { rm(root); }
});

test('hub on claude/* and on a Workflow worktree branch may edit any path, including protected ones', () => {
  const root = makeRepo();
  try {
    for (const branch of ['claude/compassionate-mayer-9tqb5p', 'worktree-agent-abc', 'tooling/p1-claude-layer']) {
      for (const f of ['engine/build.mjs', 'engine/tools/check.mjs', 'schemas/stages.json', '.claude/settings.json', 'tools/uniqueness.mjs', 'sites/_fixtures/bad-copy/content/home.json', 'docs/x.md', 'CLAUDE.md']) {
        const r = runHook('guard-scope.mjs', W(root, f), { cwd: root, env: { FACTORY_BRANCH: branch } });
        assert.equal(r.status, 0, `${branch} ${f}: ${r.stderr}`);
      }
    }
    const r = runHook('guard-scope.mjs', W(root, 'engine/build.mjs'), { cwd: root, env: { FACTORY_ROLE: 'hub' } });
    assert.equal(r.status, 0, r.stderr);
  } finally { rm(root); }
});

test('MultiEdit and NotebookEdit: every target path is checked', () => {
  const root = makeRepo();
  try {
    const env = { FACTORY_BRANCH: 'site/legacy' };
    const multi = { session_id: 't', cwd: root, tool_name: 'MultiEdit', tool_input: { file_path: 'sites/legacy/content/home.json', edits: [{ old_string: 'Legacy', new_string: 'Old' }] } };
    assert.equal(runHook('guard-scope.mjs', multi, { cwd: root, env }).status, 0);
    const nb = { session_id: 't', cwd: root, tool_name: 'NotebookEdit', tool_input: { notebook_path: 'engine/x.ipynb', new_source: 'x' } };
    assert.equal(runHook('guard-scope.mjs', nb, { cwd: root, env }).status, 2);
  } finally { rm(root); }
});

test('worktree paths are normalised and judged by the worktree branch (lane worktrees are spokes)', () => {
  const root = makeRepo();
  try {
    const wt = path.join(root, '.claude', 'worktrees', 'lane-copy');
    const gitdir = path.join(root, '.git', 'worktrees', 'lane-copy');
    fs.mkdirSync(wt, { recursive: true });
    fs.mkdirSync(gitdir, { recursive: true });
    fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${gitdir}\n`);
    fs.writeFileSync(path.join(gitdir, 'HEAD'), 'ref: refs/heads/wip/legacy/copy\n');
    const inside = runHook('guard-scope.mjs', W(root, path.join(wt, 'sites/legacy/content/home.json')), { cwd: root });
    assert.equal(inside.status, 0, inside.stderr);
    const engine = runHook('guard-scope.mjs', W(root, path.join(wt, 'engine/build.mjs')), { cwd: root });
    assert.equal(engine.status, 2);
    assert.match(engine.stderr, /scope/);
    // the hub tree itself (branch main via HEAD) is still the hub
    const hub = runHook('guard-scope.mjs', W(root, 'engine/build.mjs'), { cwd: root });
    assert.equal(hub.status, 0, hub.stderr);
  } finally { rm(root); }
});

test('protected list applies on main: existing files blocked, new files allowed, factory.json exempt', () => {
  const root = makeRepo();
  try {
    const env = { FACTORY_BRANCH: 'main' };
    assert.equal(runHook('guard-scope.mjs', W(root, 'engine/tools/check.mjs'), { cwd: root, env }).status, 2);
    assert.equal(runHook('guard-scope.mjs', W(root, 'engine/tools/new-section.mjs'), { cwd: root, env }).status, 0);
    assert.equal(runHook('guard-scope.mjs', W(root, '.claude/factory.json'), { cwd: root, env }).status, 0);
    const edit = { session_id: 't', cwd: root, tool_name: 'Edit', tool_input: { file_path: 'engine/lib/context.mjs', old_string: 'export const OTHER = 1;', new_string: 'export const OTHER = 2;' } };
    assert.equal(runHook('guard-scope.mjs', edit, { cwd: root, env }).status, 0, 'non-disclaimer edit of context.mjs is fine');
  } finally { rm(root); }
});

test('site sessions without a slug may only write the scratchpad', () => {
  const root = makeRepo();
  try {
    const env = { FACTORY_ROLE: 'spoke' };
    assert.equal(runHook('guard-scope.mjs', W(root, 'sites/legacy/content/home.json'), { cwd: root, env }).status, 2);
    assert.equal(runHook('guard-scope.mjs', W(root, '/tmp/factory-noslug.txt'), { cwd: root, env }).status, 0);
  } finally { rm(root); }
});

test('routine without a slug keeps hub file rules (it edits docs on tooling/* branches)', () => {
  const root = makeRepo();
  try {
    const r = runHook('guard-scope.mjs', W(root, 'docs/policy-watch/2026-10.md'), { cwd: root, env: { FACTORY_ROLE: 'routine', FACTORY_BRANCH: 'tooling/policy-2026-10' } });
    assert.equal(r.status, 0, r.stderr);
  } finally { rm(root); }
});
