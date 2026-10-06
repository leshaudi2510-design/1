import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pre, post, thresholdsFor } from '../uniqueness.mjs';
import { shingles, jaccard, minhash, minhashJaccard, visibleText } from '../lib/text.mjs';
import { paletteDistance, hexToOklab, rotateHex, hueDiff } from '../lib/color.mjs';
import { REPO, makeRepo, write, run, staticSite, page, lorem } from './helpers.mjs';

test('shingles, Jaccard and MinHash agree', () => {
  const a = shingles(lorem(1, 400)); const b = shingles(lorem(1, 400)); const c = shingles(lorem(7, 400));
  assert.equal(jaccard(a, b), 1);
  assert.ok(jaccard(a, c) < 0.1);
  assert.equal(minhashJaccard(minhash(a), minhash(b)), 1);
  assert.ok(Math.abs(minhashJaccard(minhash(a), minhash(c)) - jaccard(a, c)) < 0.15);
});

test('visible text drops scripts, styles and compliance chrome', () => {
  const t = visibleText('<main><script>var x="secret"</script><p class="age-notice">18+ only</p><p>Hello there</p></main>');
  assert.equal(t.includes('secret'), false);
  assert.equal(t.includes('18+'), false);
  assert.match(t, /Hello there/);
});

test('colour helpers', () => {
  assert.ok(paletteDistance([hexToOklab('#000000')], [hexToOklab('#FFFFFF')]) > 0.9);
  assert.equal(rotateHex('#808080', 30), '#808080');
  assert.notEqual(rotateHex('#FF2E93', 30).toLowerCase(), '#ff2e93');
  assert.equal(hueDiff(350, 10), 20);
});

test('--pre: the Meridian direction passes against the seeded siblings', () => {
  const root = makeRepo();
  write(root, 'sites/opalquestlounge/site.config.json', { brand: 'Opal Quest Lounge', type: 'social-casino' });
  const r = pre(path.join(root, 'orders/_templates/direction.example.json'), { root });
  assert.equal(r.passed, true, JSON.stringify(r.failures));
  assert.deepEqual(r.compared, ['opalquestlounge']);
});

test('--pre: a direction that reuses a sibling font pair, names and family triple fails', () => {
  const root = makeRepo();
  write(root, 'sites/opalquestlounge/site.config.json', { brand: 'Opal Quest Lounge', type: 'social-casino' });
  const d = JSON.parse(fs.readFileSync(path.join(root, 'orders/_templates/direction.example.json'), 'utf8'));
  d.typography.display.family = 'Archivo'; d.typography.body.family = 'Radio Canada';
  d.games.house[0].name = 'Lapidary Wheel';
  d.concept.family = 'print-typography'; d.concept.era = 'contemporary'; d.concept.place = 'print studio';
  const f = write(root, 'dir.json', d);
  const r = pre(f, { root });
  const dims = r.failures.map((x) => x.dimension);
  for (const want of ['fonts:pair', 'names', 'family']) assert.ok(dims.includes(want), `${want} in ${dims}`);
  assert.equal(run('uniqueness.mjs', ['--pre', f, '--fail'], { root }).code, 1);
  assert.equal(run('uniqueness.mjs', ['--pre', f], { root }).code, 0);
});

test('--post on static sites: copies fail, distinct sites pass', () => {
  const root = makeRepo();
  const home = (seed, h1, nav) => page({ title: 'Home', h1, body: lorem(seed, 300), nav });
  staticSite(root, 'alpha-site', { 'index.html': home(1, 'Alpha rooms', ['Reels', 'Ledger']), 'about/index.html': page({ h1: 'About alpha', body: lorem(2, 200) }) }, { engine: 'none', type: 'social-casino', brand: 'Alpha Rooms' });
  staticSite(root, 'beta-site', { 'index.html': home(3, 'Beta hall', ['Tables', 'Crown']), 'the-hall/index.html': page({ h1: 'About beta', body: lorem(4, 200) }) }, { engine: 'none', type: 'social-casino', brand: 'Beta Hall' });
  // a copy of alpha with another brand, kept outside sites/ like a fixture
  const copy = path.join(root, 'sites', '_fixtures', 'alpha-copy');
  fs.cpSync(path.join(root, 'sites', 'alpha-site'), copy, { recursive: true });
  write(root, 'sites/_fixtures/alpha-copy/site.config.json', { engine: 'none', type: 'social-casino', brand: 'Gamma Rooms' });
  const bad = post(copy, { root });
  assert.equal(bad.passed, false);
  assert.ok(bad.failures.some((f) => f.dimension === 'copy:home' && f.sibling === 'alpha-site'));
  assert.ok(bad.failures.some((f) => f.dimension === 'structure:routes'));
  assert.deepEqual(bad.compared.sort(), ['alpha-site', 'beta-site']);
  const good = post(path.join(root, 'sites', 'beta-site'), { root });
  assert.equal(good.passed, true, JSON.stringify(good.failures));
  assert.deepEqual(good.compared, ['alpha-site'], 'fixtures and the site itself are never siblings');
  const cli = run('uniqueness.mjs', ['--post', copy, '--against', 'all', '--fail'], { root });
  assert.equal(cli.code, 1, cli.out + cli.err);
});

test('--post compares across types by copy only', () => {
  const root = makeRepo();
  staticSite(root, 'casino-one', { 'index.html': page({ body: lorem(9, 300) }) }, { engine: 'none', type: 'social-casino' });
  staticSite(root, 'hotel-one', { 'index.html': page({ body: lorem(9, 300) }) }, { engine: 'none', type: 'hotel-casino' });
  const r = post(path.join(root, 'sites', 'hotel-one'), { root });
  assert.deepEqual(r.compared, []);
  assert.ok(r.failures.some((f) => f.dimension === 'factory.cross-site-similarity'));
});

test('thresholds come from board.schema.json when it carries them', () => {
  const root = makeRepo();
  assert.equal(thresholdsFor('social-casino', root).copyPage, 0.25);
  write(root, 'schemas/board.schema.json', { thresholds: { uniqueness: { 'social-casino': { copyPage: 0.3 } } } });
  assert.equal(thresholdsFor('social-casino', root).copyPage, 0.3);
});

const legacy = path.join(REPO, 'opalquestlounge', 'build.mjs');
const engine = path.join(REPO, 'engine', 'build.mjs');
const oqlDir = fs.existsSync(path.join(REPO, 'sites', 'opalquestlounge')) ? path.join(REPO, 'sites', 'opalquestlounge') : path.join(REPO, 'opalquestlounge');
test('the reskin fixture fails against the reference site; the reference site passes', { skip: !(fs.existsSync(legacy) || fs.existsSync(engine)) && 'no engine to build with' }, () => {
  const sites = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-sites-'));
  fs.symlinkSync(oqlDir, path.join(sites, 'opalquestlounge'));
  const bad = run('uniqueness.mjs', ['--post', 'sites/_fixtures/reskin-of-oql', '--against', 'all', '--fail', '--sites', sites]);
  assert.equal(bad.code, 1, bad.out + bad.err);
  assert.match(bad.out, /copy:home vs opalquestlounge/);
  const good = run('uniqueness.mjs', ['--post', path.join(sites, 'opalquestlounge'), '--against', 'all', '--fail', '--sites', sites]);
  assert.equal(good.code, 0, good.out + good.err);
});
