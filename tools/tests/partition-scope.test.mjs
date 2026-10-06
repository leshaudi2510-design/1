import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPartitions, selfTest, checkScope, ownerOf, globToRegExp, fold } from '../partition-scope.mjs';
import { run, write, makeRepo } from './helpers.mjs';

const P = loadPartitions();

test('globs', () => {
  assert.ok(globToRegExp('engine/**').test('engine/a/b.mjs'));
  assert.ok(globToRegExp('tools/labels.*').test('tools/labels.json'));
  assert.ok(!globToRegExp('tools/labels.*').test('tools/x/labels.json'));
  assert.ok(globToRegExp('types/*/ppc/**').test('types/hotel-casino/ppc/tags.json'));
  assert.ok(globToRegExp('**/node_modules/**').test('a/node_modules/x.js'));
  assert.ok(globToRegExp('x/{a,b}.md').test('x/b.md'));
});

test('self-test passes and covers A-H, T, P', () => {
  assert.deepEqual(selfTest(P), []);
  for (const l of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'T', 'P']) assert.ok(P.partitions[l], l);
});

test('folding: B and T into A, P into E in Phase 1; themselves later', () => {
  assert.equal(fold(P, 'B', 1), 'A');
  assert.equal(fold(P, 'T', 1), 'A');
  assert.equal(fold(P, 'P', 1), 'E');
  assert.equal(fold(P, 'B', 3), 'B');
  assert.equal(fold(P, 'T', 3), 'A');
  assert.equal(fold(P, 'T', 4), 'T');
});

test('D owns its paths and nothing else', () => {
  assert.deepEqual(checkScope(P, 'D', ['tools/uniqueness.mjs', 'schemas/stages.json', 'orders/_templates/x.md', 'sites/_fixtures/bad-copy/site.config.json', 'portfolio/registry.json']), []);
  const errs = checkScope(P, 'D', ['schemas/board.schema.json', 'tools/labels.mjs', 'engine/build.mjs', 'tools/ppc/kit.mjs']);
  assert.equal(errs.length, 4);
});

test('shared paths and exceptions', () => {
  assert.deepEqual(checkScope(P, 'H', ['README.md']), []);
  assert.deepEqual(checkScope(P, 'F', ['README.md']), []);
  assert.equal(checkScope(P, 'D', ['README.md']).length, 1);
  assert.deepEqual(checkScope(P, 'G', ['.claude/factory.json']), []);
  assert.equal(checkScope(P, 'G', ['.claude/settings.json']).length, 1);
  assert.equal(ownerOf(P, 'reports/x/build.json').ignored, true);
  assert.equal(checkScope(P, 'A', ['some/unknown/file.txt'])[0].includes('no partition'), true);
});

test('CLI: --self-test, --paths, --owner, --exists', () => {
  assert.equal(run('partition-scope.mjs', ['--self-test']).code, 0);
  assert.equal(run('partition-scope.mjs', ['D', '--paths', '-'], { input: 'tools/a.mjs\nschemas/x.json\n' }).code, 0);
  assert.equal(run('partition-scope.mjs', ['D', '--paths', '-'], { input: 'engine/build.mjs\n' }).code, 1);
  assert.match(run('partition-scope.mjs', ['--owner', 'engine/tools/check.mjs']).out, /\tC/);
  const root = makeRepo();
  write(root, 'docs/PLAN.md', '# plan\n');
  const r = run('partition-scope.mjs', ['H', '--exists'], { root });
  assert.equal(r.code, 1);
  assert.match(r.out, /missing: THIRD_PARTY_NOTICES.md/);
  assert.doesNotMatch(r.out, /missing: docs\/PLAN.md/);
  assert.equal(run('partition-scope.mjs', ['Z', 'HEAD']).code, 2);
});
