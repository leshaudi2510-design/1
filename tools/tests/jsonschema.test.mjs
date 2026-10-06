import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validate, validateFile, unknownKeywords, lintSchema } from '../lib/jsonschema.mjs';
import { REPO, makeRepo, write } from './helpers.mjs';

const kw = (data, schema) => validate(data, schema).map((e) => e.keyword);

test('core keywords', () => {
  assert.deepEqual(kw('x', { type: 'integer' }), ['type']);
  assert.deepEqual(kw(3, { type: ['integer', 'null'] }), []);
  assert.deepEqual(kw({}, { required: ['a'] }), ['required']);
  assert.deepEqual(kw('b', { enum: ['a'] }), ['enum']);
  assert.deepEqual(kw('ab', { pattern: '^a$' }), ['pattern']);
  assert.deepEqual(kw(2, { const: 1 }), ['const']);
  assert.deepEqual(kw([1], { minItems: 2 }), ['minItems']);
  assert.deepEqual(kw([1, 'x'], { items: { type: 'integer' } }), ['type']);
  assert.deepEqual(kw({ a: 1, b: 2 }, { properties: { a: {} }, additionalProperties: false }), ['additionalProperties']);
  assert.deepEqual(kw({ b: 'x' }, { additionalProperties: { type: 'integer' } }), ['type']);
  assert.deepEqual(kw([1, 1], { uniqueItems: true }), ['uniqueItems']);
  assert.deepEqual(kw('é', { maxLength: 1 }), []);
  assert.deepEqual(kw(5, { minimum: 6 }), ['minimum']);
  assert.deepEqual(kw([{ k: 1 }], { contains: { properties: { k: { const: 2 } } } }), ['contains']);
  assert.deepEqual(kw(1, { oneOf: [{ type: 'integer' }, { minimum: 0 }] }), ['oneOf']);
  assert.deepEqual(kw(1, { not: { type: 'integer' } }), ['not']);
  assert.deepEqual(kw('2026-13-01', { format: 'date' }), ['format']);
});

test('if/then/else applies only the matching branch', () => {
  const s = { if: { properties: { mode: { const: 'house' } }, required: ['mode'] }, then: { properties: { n: { minimum: 3 } } }, else: { required: ['other'] } };
  assert.deepEqual(kw({ mode: 'house', n: 2 }, s), ['minimum']);
  assert.deepEqual(kw({ mode: 'house', n: 3 }, s), []);
  assert.deepEqual(kw({ mode: 'demo' }, s), ['required']);
});

test('$ref: local pointers, $defs and relative files', () => {
  const root = makeRepo({ withTemplates: false });
  write(root, 'x/a.schema.json', { $id: 'https://e/x/a.schema.json', properties: { s: { $ref: 'b.json#/$defs/s' }, t: { $ref: '#/$defs/t' } }, $defs: { t: { type: 'string' } } });
  write(root, 'x/b.json', { $defs: { s: { enum: ['ok'] } } });
  assert.deepEqual(validateFile({ s: 'ok', t: 'x' }, path.join(root, 'x/a.schema.json')), []);
  assert.deepEqual(validateFile({ s: 'no', t: 1 }, path.join(root, 'x/a.schema.json')).map((e) => e.path).sort(), ['s', 't']);
});

test('error paths use dots and [i]', () => {
  const e = validate({ a: [{ b: 1 }] }, { properties: { a: { items: { properties: { b: { type: 'string' } } } } } });
  assert.equal(e[0].path, 'a[0].b');
});

test('the factory schemas use only supported keywords and compile', () => {
  for (const f of fs.readdirSync(path.join(REPO, 'schemas')).filter((x) => x.endsWith('.json'))) {
    const s = JSON.parse(fs.readFileSync(path.join(REPO, 'schemas', f), 'utf8'));
    if (f === 'stages.json') continue;
    // board.schema.json also carries data members (stage list, thresholds, artifact, collection registry
    // capabilities, version) that tools read; lint only its schema members.
    if (f === 'board.schema.json') for (const k of ['version', 'stages', 'thresholds', 'artifact', 'collections']) delete s[k];
    assert.deepEqual(unknownKeywords(s), [], f);
    assert.deepEqual(lintSchema(s), [], f);
  }
});

test('examples validate against their schemas', () => {
  for (const f of ['order.example.json', 'order.example.online-games.json', 'order.example.hotel-casino.json']) {
    const data = JSON.parse(fs.readFileSync(path.join(REPO, 'orders/_templates', f), 'utf8'));
    assert.deepEqual(validateFile(data, path.join(REPO, 'schemas/order.schema.json')), [], f);
  }
  const d = JSON.parse(fs.readFileSync(path.join(REPO, 'orders/_templates/direction.example.json'), 'utf8'));
  assert.deepEqual(validateFile(d, path.join(REPO, 'schemas/direction.schema.json')), []);
});

test('review schema: blocking items need a quote or selector; sameProduct needs a citation', () => {
  const file = path.join(REPO, 'schemas/review.schema.json');
  const skeptic = { judge: 'uniqueness-skeptic', rubricVersion: '1.0', sameProduct: true, confidence: 0.9, evidence: [{ page: 'home', kind: 'vocabulary', why: 'same words' }], visualDifferences: [], fixes: [] };
  assert.ok(validateFile(skeptic, file).length > 0);
  skeptic.evidence.push({ page: 'home', siblingPage: 'home', kind: 'copy', quote: 'x', why: 'same sentence' });
  assert.deepEqual(validateFile(skeptic, file), []);
  const round = { slug: 'meridian-signal-rooms', round: 1, sha: 'abc', rubricVersions: { 'uniqueness-skeptic': '1.0', 'compliance-judge': '1.0' }, verdict: 'ready', uniqueness: { sameProductVotes: 0, pass: true }, compliance: { pass: true, blocking: 0 }, items: [{ judge: 'compliance-judge', page: 'home', rule: 'cap-16', why: 'x', severity: 'blocking' }], at: '2026-10-06' };
  assert.ok(validateFile(round, file).length > 0, 'a ready verdict with a blocking item (and no quote) must fail');
  round.items = [{ judge: 'compliance-judge', page: 'home', rule: 'seo', why: 'x', severity: 'advisory' }];
  assert.deepEqual(validateFile(round, file), []);
});
