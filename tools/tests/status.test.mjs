import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { checkStages, loadStages } from '../lib/state.mjs';
import { REPO, makeRepo, write, example, run, readJson } from './helpers.mjs';

test('stages.json is self-consistent and every stage has every derivation', () => {
  const s = loadStages(REPO);
  assert.deepEqual(checkStages(s), []);
  for (const k of ['orderStatus', 'registryStatus', 'prLabel', 'kanbanColumn']) for (const st of s.stages) assert.ok(st in s.derive[k], `${k}.${st}`);
  assert.equal(s.stages.length, 15);
});

test('checkStages catches a missing derivation and a bad transition', () => {
  const s = loadStages(REPO);
  delete s.derive.prLabel.fix;
  s.transitions.push({ from: 'review', to: 'nowhere', by: 'x', gate: 'y' });
  const errs = checkStages(s);
  assert.ok(errs.some((e) => /prLabel has no entry for stage "fix"/.test(e)));
  assert.ok(errs.some((e) => /"nowhere" is not a stage/.test(e)));
});

test('status --check passes on this repository', () => {
  const r = run('status.mjs', ['--check']);
  assert.equal(r.code, 0, r.out + r.err);
});

test('status --check fails on an order whose status disagrees with the Board stage', () => {
  const root = makeRepo();
  const o = example(); o.status = 'building';
  write(root, 'orders/meridian-signal-rooms/order.json', o);
  write(root, 'reports/meridian-signal-rooms/board-row.json', { orderId: 'meridian-signal-rooms', stage: 'review' });
  let r = run('status.mjs', ['--check'], { root });
  assert.equal(r.code, 1);
  assert.match(r.out, /disagrees with the Board stage "review"/);
  o.status = 'review';
  write(root, 'orders/meridian-signal-rooms/order.json', o);
  r = run('status.mjs', ['--check'], { root });
  assert.equal(r.code, 0, r.out);
  // post-launch lag is accepted
  o.status = 'launch-ready';
  write(root, 'orders/meridian-signal-rooms/order.json', o);
  write(root, 'reports/meridian-signal-rooms/board-row.json', { orderId: 'meridian-signal-rooms', stage: 'live' });
  assert.equal(run('status.mjs', ['--check'], { root }).code, 0);
});

test('status --check compares board.schema.json stages when the file exists', () => {
  const root = makeRepo();
  const stages = readJson(path.join(root, 'schemas/stages.json')).stages;
  write(root, 'schemas/board.schema.json', { stages });
  assert.equal(run('status.mjs', ['--check'], { root }).code, 0);
  write(root, 'schemas/board.schema.json', { stages: stages.slice(1) });
  assert.equal(run('status.mjs', ['--check'], { root }).code, 1);
});

test('status --table, --json and --gate', () => {
  const root = makeRepo();
  write(root, 'orders/meridian-signal-rooms/order.json', example());
  const t = run('status.mjs', ['--table', '--offline-ok'], { root });
  assert.equal(t.code, 0);
  assert.match(t.out, /meridian-signal-rooms/);
  const j = JSON.parse(run('status.mjs', ['--json'], { root }).out);
  assert.equal(j.rows[0].orderStatus, 'approved');
  const g = run('status.mjs', ['--gate', 'meridian-signal-rooms'], { root });
  assert.match(g.out, /strictBuild/);
  assert.match(g.out, /missing/);
  assert.match(g.out, /done +orderValidated/);
});
