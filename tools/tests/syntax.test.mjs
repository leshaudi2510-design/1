// Every tool parses, prints --help and exits 0 on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TOOLS, run } from './helpers.mjs';

const mjs = [];
const rec = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory() && e.name !== 'node_modules') rec(p); else if (e.name.endsWith('.mjs')) mjs.push(p); } };
rec(TOOLS);

test('node --check passes for every .mjs under tools/', () => {
  assert.ok(mjs.length > 15);
  for (const f of mjs) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${path.relative(TOOLS, f)}: ${r.stderr}`);
  }
});

test('bash -n passes for vet-skill.sh', () => {
  const r = spawnSync('bash', ['-n', path.join(TOOLS, 'vet-skill.sh')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

const CLIS = ['validate-order.mjs', 'order-to-config.mjs', 'new-site.mjs', 'uniqueness.mjs', 'status.mjs', 'board.mjs', 'engine-hashes.mjs', 'partition-scope.mjs', 'engine-lint.mjs', 'fixtures/make-reskin.mjs'];
for (const tool of CLIS) {
  test(`${tool} --help`, () => {
    const r = run(tool, ['--help']);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /Usage/);
  });
}

test('vet-skill.sh --help', () => {
  const r = spawnSync('bash', [path.join(TOOLS, 'vet-skill.sh'), '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage/);
});

test('unknown options are usage errors (exit 2)', () => {
  for (const tool of ['validate-order.mjs', 'uniqueness.mjs', 'status.mjs']) {
    const r = run(tool, ['--no-such-flag']);
    assert.equal(r.code, 2, `${tool}: ${r.out}${r.err}`);
  }
});
