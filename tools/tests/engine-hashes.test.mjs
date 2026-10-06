import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { manifest, siteHash, normaliseContent, normalisePath } from '../engine-hashes.mjs';
import { run, write, makeRepo } from './helpers.mjs';

function dist(version, extra = '') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
  fs.mkdirSync(path.join(d, `assets/v${version}/js`), { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), `<meta name="build" content="${version}"><script src="/assets/v${version}/js/app.js"></script>${extra}`);
  fs.writeFileSync(path.join(d, `assets/v${version}/js/app.js`), 'console.log(1)');
  fs.writeFileSync(path.join(d, 'sw.js'), `const CACHE = 'oql-v${version}'`);
  return d;
}

test('manifest lines are sha256sum-style and sorted', () => {
  const m = manifest(dist('abc1234567')).trim().split('\n');
  assert.ok(m.every((l) => /^[0-9a-f]{64}  \S/.test(l)));
  const paths = m.map((l) => l.slice(66));
  assert.deepEqual(paths, [...paths].sort());
});

test('normalisation hides the version hash, nothing else', () => {
  assert.equal(siteHash(dist('abc1234567')), siteHash(dist('fff9876543')));
  assert.notEqual(siteHash(dist('abc1234567')), siteHash(dist('abc1234567', 'changed')));
  assert.notEqual(manifest(dist('abc1234567')), manifest(dist('fff9876543')), 'raw manifests differ');
  assert.equal(normalisePath('assets/vdeadbeef12/js/a.js'), 'assets/v*/js/a.js');
  assert.match(normaliseContent("CACHE = 'oql-v0a1b2c3d4e'"), /oql-v\*/);
});

test('CLI --dir and --compare against a record of static sites', () => {
  const root = makeRepo();
  write(root, 'sites/static-one/site.config.json', { engine: 'none' });
  write(root, 'sites/static-one/index.html', '<p>one</p>');
  const d = path.join(root, 'sites/static-one');
  const out = run('engine-hashes.mjs', ['--dir', d, '--normalise', '--site-hash'], { root }).out.trim().split('\n');
  const hash = out[out.length - 1].split('  ')[0];
  write(root, 'rec.json', { schemaVersion: 1, sites: { 'static-one': { hash } } });
  assert.equal(run('engine-hashes.mjs', ['--compare', path.join(root, 'rec.json')], { root }).code, 0);
  write(root, 'sites/static-one/index.html', '<p>two</p>');
  assert.equal(run('engine-hashes.mjs', ['--compare', path.join(root, 'rec.json')], { root }).code, 1);
  write(root, 'body.txt', 'hash: static-one intended: copy fix\n');
  assert.equal(run('engine-hashes.mjs', ['--compare', path.join(root, 'rec.json'), '--pr-body', path.join(root, 'body.txt')], { root }).code, 0);
  write(root, 'flat.json', { 'static-one': hash });
  assert.equal(run('engine-hashes.mjs', ['--compare', path.join(root, 'flat.json')], { root }).code, 1);
});
