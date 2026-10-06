import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { orderToConfig, storagePrefixFor, mergePreserving, diffDerived } from '../lib/config.mjs';
import { makeReskin } from '../fixtures/make-reskin.mjs';
import { REPO, makeRepo, write, example, run, readJson } from './helpers.mjs';

test('storagePrefix: initials, letters only, unique', () => {
  assert.equal(storagePrefixFor('meridian-signal-rooms'), 'msr');
  assert.equal(storagePrefixFor('opalquestlounge'), 'opa');
  assert.equal(storagePrefixFor('meridian-signal-rooms', new Set(['msr'])), 'msra');
  assert.match(storagePrefixFor('a-1'), /^[a-z]{2,5}$/);
});

test('v1 config carries today\'s keys plus type and storagePrefix', () => {
  const c = orderToConfig(example(), { root: makeRepo() });
  for (const k of ['brand', 'shortName', 'domain', 'concept', 'currency', 'operator', 'purchases', 'analytics', 'contactEndpoint', 'lastUpdated', 'legalUpdated', 'themeColor', 'pragmatic', 'type', 'storagePrefix']) assert.ok(k in c, k);
  assert.equal(c.operator.companyNumber, '15823417');
  assert.equal(c.pragmatic.params.cur, 'FUN');
  assert.equal(c.storagePrefix, 'msr');
});

test('v2 config follows MASTER-PLAN 4.2', () => {
  const c = orderToConfig(example('order.example.hotel-casino.json'), { version: 2, root: makeRepo() });
  assert.equal(c.schemaVersion, 2);
  assert.equal(c.casinoMode, 'A');
  assert.equal(c.locales.length, 2);
  assert.ok(c.typeOptions.booking);
  const sc = orderToConfig(example(), { version: 2, root: makeRepo() });
  assert.deepEqual(sc.typeOptions.games.map((g) => g.engine), ['reel-slot', 'roulette', 'blackjack']);
});

test('mergePreserving keeps skins and unknown keys; diffDerived ignores skins', () => {
  const derived = { brand: 'X', games: [{ slug: 'a', name: 'A' }] };
  const existing = { brand: 'X', extra: 1, games: [{ slug: 'a', name: 'A', skin: { s: 1 }, rtp: 0.97 }] };
  const m = mergePreserving(derived, existing);
  assert.equal(m.extra, 1);
  assert.deepEqual(m.games[0].skin, { s: 1 });
  assert.deepEqual(diffDerived(derived, existing), []);
  assert.deepEqual(diffDerived({ brand: 'Y' }, existing), ['brand']);
});

test('order-to-config CLI: --print, write, --check', () => {
  const root = makeRepo();
  const p = run('order-to-config.mjs', ['orders/_templates/order.example.json', '--print'], { root });
  assert.equal(p.code, 0);
  assert.equal(JSON.parse(p.out).brand, 'Meridian Signal Rooms');
  const o = write(root, 'orders/meridian-signal-rooms/order.json', example());
  assert.equal(run('order-to-config.mjs', [o, '--check'], { root }).code, 1);
  assert.equal(run('order-to-config.mjs', [o], { root }).code, 0);
  assert.ok(fs.existsSync(path.join(root, 'sites/meridian-signal-rooms/concept.json')));
  assert.equal(run('order-to-config.mjs', [o, '--check'], { root }).code, 0);
  const cfg = readJson(path.join(root, 'sites/meridian-signal-rooms/site.config.json'));
  cfg.brand = 'Hand edit';
  write(root, 'sites/meridian-signal-rooms/site.config.json', cfg);
  assert.equal(run('order-to-config.mjs', [o, '--check'], { root }).code, 1);
});

test('new-site copies the type template and personalises it', () => {
  const root = makeRepo();
  write(root, 'types/social-casino/template-site/site.config.json', { brand: '[Brand]', shortName: '[Short]', domain: 'example.com', type: 'social-casino', storagePrefix: 'xx', currency: {}, operator: {}, deploy: { provider: 'cloudflare-pages', project: 'template' } });
  write(root, 'types/social-casino/template-site/checks.json', { storagePrefix: 'xx' });
  write(root, 'types/social-casino/template-site/theme/tokens.css', ':root{--ink:#000}');
  let r = run('new-site.mjs', ['throwaway-social-casino', '--type', 'social-casino'], { root });
  assert.equal(r.code, 0, r.err);
  const cfg = readJson(path.join(root, 'sites/throwaway-social-casino/site.config.json'));
  assert.equal(cfg.storagePrefix, 'tsc');
  assert.equal(cfg.deploy.project, 'throwaway-social-casino');
  assert.equal(readJson(path.join(root, 'sites/throwaway-social-casino/checks.json')).storagePrefix, 'tsc');
  assert.ok(fs.existsSync(path.join(root, 'sites/throwaway-social-casino/theme/tokens.css')));
  assert.equal(run('new-site.mjs', ['throwaway-social-casino', '--type', 'social-casino'], { root }).code, 2, 'refuses an existing site');
  r = run('new-site.mjs', ['meridian-signal-rooms', '--order', 'orders/_templates/order.example.json'], { root });
  assert.equal(r.code, 0, r.err);
  const m = readJson(path.join(root, 'sites/meridian-signal-rooms/site.config.json'));
  assert.equal(m.brand, 'Meridian Signal Rooms');
  assert.ok(!('pragmatic' in m), 'keys missing from the template are skipped');
  assert.match(r.out, /skipped pragmatic/);
  assert.equal(run('new-site.mjs', ['x-hotel', '--type', 'hotel-casino'], { root }).code, 2, 'no template for the type');
  assert.equal(run('new-site.mjs', ['Bad Slug', '--type', 'social-casino'], { root }).code, 2);
});

test('make-reskin maps the legacy layout and swaps only names, prefix and hues', () => {
  const root = makeRepo();
  write(root, 'src-site/site.config.json', { brand: 'Opal Quest Lounge', shortName: 'Opal Lounge', domain: 'opalquestlounge.com', themeColor: { light: '#FF2E93', dark: '#18122B' } });
  write(root, 'src-site/src/styles/00-tokens.css', '/* OPAL QUEST LOUNGE */ :root{--m:#FF2E93;--w:#FFFFFF}');
  write(root, 'src-site/src/data/pragmatic-games.json', { games: [] });
  write(root, 'src-site/src/public/favicon.svg', '<svg/>');
  const to = path.join(root, 'sites/_fixtures/reskin');
  const r = makeReskin({ from: path.join(root, 'src-site'), to, root });
  assert.equal(r.layout, 'legacy (mapped per SPEC 3.1)');
  const cfg = readJson(path.join(to, 'site.config.json'));
  assert.equal(cfg.brand, 'Topaz Quest Lounge');
  assert.equal(cfg.storagePrefix, 'rsk');
  assert.equal(cfg.type, 'social-casino');
  const css = fs.readFileSync(path.join(to, 'theme/tokens.css'), 'utf8');
  assert.match(css, /TOPAZ QUEST LOUNGE/);
  assert.doesNotMatch(css, /#FF2E93/i);
  assert.match(css, /#FFFFFF/i, 'neutrals are not rotated');
  assert.ok(fs.existsSync(path.join(to, 'fixture.json')));
  assert.throws(() => makeReskin({ from: path.join(root, 'src-site'), to, root }), /exists/);
});

test('the committed fixtures are in the factory layout', () => {
  for (const f of ['reskin-of-oql', 'bad-copy']) {
    const dir = path.join(REPO, 'sites/_fixtures', f);
    for (const rel of ['site.config.json', 'theme/tokens.css', 'data/pragmatic-games.json', 'public/favicon.svg', 'fixture.json']) assert.ok(fs.existsSync(path.join(dir, rel)), `${f}/${rel}`);
    const cfg = readJson(path.join(dir, 'site.config.json'));
    assert.equal(cfg.type, 'social-casino');
    assert.match(cfg.storagePrefix, /^[a-z]{2,5}$/);
  }
  const bad = fs.readFileSync(path.join(REPO, 'sites/_fixtures/bad-copy/data/pragmatic-games.json'), 'utf8');
  for (const w of [/\bdeposit/i, /cash[\s-]?out/i, /real[\s-]money wins?/i]) assert.match(bad, w);
});
