import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { validateOrder, findPlaceholders } from '../lib/order.mjs';
import { REPO, makeRepo, write, example, run } from './helpers.mjs';

const v = (o, level = 'build', root = REPO) => validateOrder(o, { level, root, offline: true });
const rules = (r) => r.errors.map((e) => e.rule);

test('the Meridian example passes --level build', async () => {
  const r = await v(example());
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test('the Meridian example fails --level launch, placeholders included', async () => {
  const r = await v(example(), 'launch');
  assert.equal(r.ok, false);
  assert.ok(rules(r).includes('launch.placeholder'));
  assert.ok(r.errors.some((e) => e.path === 'ppc.primaryConversion'));
  assert.ok(r.errors.some((e) => e.path === 'legal.reviewer'));
  assert.ok(r.errors.every((e) => typeof e.question === 'string'));
});

test('two house games fail --level build', async () => {
  const o = example(); o.typeOptions.games.house.pop();
  const r = await v(o);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === 'typeOptions.games.house' && /at least 3/.test(e.message)));
});

test('online-games and hotel-casino examples pass draft and build', async () => {
  for (const f of ['order.example.online-games.json', 'order.example.hotel-casino.json']) {
    for (const level of ['draft', 'build']) assert.deepEqual((await v(example(f), level)).errors, [], `${f} ${level}`);
  }
});

test('draft lists missing blocks as questions, not errors; brand.name stays required', async () => {
  const o = example(); delete o.operator; delete o.palette;
  let r = await v(o, 'draft');
  assert.equal(r.ok, true);
  assert.ok(r.missing.some((m) => m.path === 'operator'));
  delete o.brand.name;
  r = await v(o, 'draft');
  assert.ok(r.errors.some((e) => e.path === 'brand.name'));
  const b = await v(example(), 'build');
  assert.equal(b.missing.length, 0);
});

test('cross-field rules: heroGame, palette roles, top-up, locales', async () => {
  const o = example();
  o.structure.heroGame = 'not-a-game';
  o.palette.colours[1].role = 'ink';
  o.typeOptions.currency.topUpBelow = 5000;
  const r = await v(o);
  for (const rule of ['sc.hero-game', 'order.palette-roles', 'sc.currency']) assert.ok(rules(r).includes(rule), rule);
});

test('ST 1.4 rejections run at draft', async () => {
  const demo = example();
  demo.variant = 'demo-lobby';
  demo.analytics.adsConversionId = 'AW-123456789';
  let r = await v(demo, 'draft');
  assert.ok(rules(r).includes('reject.demo-lobby-ads'));
  assert.ok(rules(r).includes('reject.demo-lobby-consent'));

  const hotel = example('order.example.hotel-casino.json');
  hotel.casinoMode = 'B'; hotel.geo.rg = 'info';
  r = await v(hotel, 'draft');
  assert.ok(rules(r).includes('reject.mode-b-confirmation'));
  assert.ok(rules(r).includes('reject.mode-b-gb-opinion'));

  const games = example('order.example.online-games.json');
  games.typeOptions.providers.push({ key: 'poki' });
  r = await v(games, 'draft');
  assert.ok(rules(r).includes('reject.scraped-portal'));

  const sweeps = example(); sweeps.typeOptions.sweepstakes = true;
  r = await v(sweeps, 'draft');
  assert.ok(rules(r).includes('reject.sweepstakes'));
});

test('hotel-casino Mode A forbids a casino block (schema)', async () => {
  const hotel = example('order.example.hotel-casino.json');
  hotel.typeOptions.casino = { entryAge: 21 };
  const r = await v(hotel);
  assert.equal(r.ok, false);
});

test('audience is accepted only from a signed assessment', async () => {
  const o = example(); o.audience = 'general-adult';
  assert.ok(rules(await v(o)).includes('order.audience-signed'));
  o.audienceAssessment = { path: 'orders/x/audience-assessment.md', result: 'general-adult', signedBy: 'A. Owner', signedOn: '2026-10-01' };
  assert.ok(!rules(await v(o)).includes('order.audience-signed'));
});

test('the pack overlay is applied to typeOptions when types/<type>/schema/order-options.schema.json exists', async () => {
  const root = makeRepo();
  write(root, 'types/social-casino/schema/order-options.schema.json', { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['currency', 'mustExist'] });
  const r = await v(example(), 'build', root);
  assert.ok(r.errors.some((e) => e.path === 'typeOptions.mustExist'));
  assert.equal(r.overlay, path.join('types', 'social-casino', 'schema', 'order-options.schema.json'));
});

test('findPlaceholders ignores provenance and statuses', () => {
  const ph = findPlaceholders({ a: '[x y]', status: 'pending', provenance: { q: '[z z]' }, b: 'pending (solicitor)' });
  assert.deepEqual(ph.map((p) => p.path).sort(), ['a', 'b']);
});

test('CLI: --example, exit codes, --json', () => {
  assert.equal(run('validate-order.mjs', ['orders/_templates', '--example', '--level', 'build']).code, 0);
  assert.equal(run('validate-order.mjs', ['orders/_templates', '--example', '--level', 'launch', '--offline']).code, 1);
  assert.equal(run('validate-order.mjs', ['orders/_templates', '--examples', '--level', 'build']).code, 0);
  const j = JSON.parse(run('validate-order.mjs', ['orders/_templates/order.example.json', '--level', 'launch', '--offline', '--json']).out);
  assert.equal(j.ok, false);
  assert.equal(j.level, 'launch');
  assert.equal(run('validate-order.mjs', ['orders/_templates', '--level', 'nope']).code, 2);
});
