// Every row of guard-rules.json carries must-block and must-pass examples; this file runs them all
// through the hook that owns the row (bash -> guard-ship.mjs, file -> guard-scope.mjs, signal -> design-signals).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { HOOKS, makeRepo, applyFixture, runHook, fileInput, bashInput, rm } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { detectSignals } = require('../lib/design-signals.cjs');
const table = JSON.parse(fs.readFileSync(path.join(HOOKS, 'guard-rules.json'), 'utf8'));

test('guard-rules.json: unique ids, known events, compilable patterns, block+pass examples on every row', () => {
  const ids = new Set();
  for (const r of table.rules) {
    assert.ok(r.id && !ids.has(r.id), `duplicate or missing id ${r.id}`);
    ids.add(r.id);
    assert.ok(['bash', 'file', 'signal'].includes(r.event), `${r.id}: event`);
    assert.ok(['block', 'warn'].includes(r.action), `${r.id}: action`);
    assert.ok(r.kind === 'builtin' || r.pattern, `${r.id}: pattern or builtin`);
    if (r.pattern) new RegExp(r.pattern, r.flags || '');
    if (r.paths) new RegExp(r.paths);
    assert.ok(r.message, `${r.id}: message`);
    assert.ok(r.examples && r.examples.block && r.examples.block.length >= 1, `${r.id}: needs a must-block example`);
    assert.ok(r.examples.pass && r.examples.pass.length >= 1, `${r.id}: needs a must-pass example`);
  }
});

function runExample(rule, ex) {
  if (rule.event === 'signal') {
    const fired = detectSignals({ rel: ex.rel, content: ex.content, rules: [rule] });
    return fired.length ? 2 : 0;
  }
  const root = makeRepo();
  try {
    const extra = applyFixture(root, ex.fixture);
    const env = ex.env || {};
    if (rule.event === 'bash') return runHook('guard-ship.mjs', bashInput(root, ex, extra), { env, cwd: root });
    if (typeof ex.raw === 'string') return runHook('guard-scope.mjs', { raw: ex.raw }, { env, cwd: root });
    return runHook('guard-scope.mjs', fileInput(root, ex), { env, cwd: root });
  } finally {
    rm(root);
  }
}

for (const rule of table.rules) {
  for (const [kind, want] of [['block', 2], ['pass', 0]]) {
    (rule.examples[kind] || []).forEach((ex, i) => {
      test(`${rule.id}: must-${kind} #${i + 1} ${ex.command || ex.file_path || ex.rel || JSON.stringify(ex.raw)}`, () => {
        const r = runExample(rule, ex);
        const status = typeof r === 'number' ? r : r.status;
        assert.equal(status, want, typeof r === 'number' ? `signal ${rule.id}` : `stderr: ${r.stderr}`);
        if (typeof r !== 'number' && want === 2) assert.match(r.stderr, /BLOCKED|guard-/, 'block reason on stderr');
      });
    });
  }
}
