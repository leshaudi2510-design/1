import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseYamlSubset, parseFrontMatter } from '../lib/frontmatter.mjs';
import { makeRepo, write, example, run, readJson } from './helpers.mjs';

test('board row for a site (seeded stage) and for an order; validate; batch', () => {
  const root = makeRepo();
  write(root, 'sites/opalquestlounge/site.config.json', { brand: 'Opal Quest Lounge', domain: 'opalquestlounge.com', type: 'social-casino', storagePrefix: 'oql' });
  const out = path.join(root, 'reports/opalquestlounge/board-row.json');
  let r = run('board.mjs', ['row', 'opalquestlounge', '--out', out], { root });
  assert.equal(r.code, 0, r.err);
  const site = readJson(out);
  assert.equal(site.stage, 'live');
  assert.equal(site.status, 'live');
  assert.equal(run('board.mjs', ['validate', out], { root }).code, 0);

  write(root, 'orders/meridian-signal-rooms/order.json', example());
  r = run('board.mjs', ['row', 'orders', 'meridian-signal-rooms', '--envelope'], { root });
  assert.equal(r.code, 0, r.err);
  const env = JSON.parse(r.out);
  assert.equal(env.collection, 'orders');
  assert.equal(env.data.stage, 'approved');
  assert.equal(env.data.approvals.games, 'approved');
  assert.equal(env.data.approvals.copy, 'pending');

  const bad = { ...site, stage: 'shipped' };
  write(root, 'bad.json', bad);
  assert.equal(run('board.mjs', ['validate', path.join(root, 'bad.json')], { root }).code, 1);
  write(root, 'batch.jsonl', `${JSON.stringify(env)}\n${JSON.stringify({ collection: 'sites', id: 'opalquestlounge', data: site })}\n`);
  const b = run('board.mjs', ['batch', path.join(root, 'batch.jsonl')], { root });
  assert.equal(b.code, 0, b.err);
  assert.equal(JSON.parse(b.out).writes.length, 2);
  const ev = run('board.mjs', ['event', '--kind', 'policy', '--severity', 'warn', '--text', 'quote unverified'], { root });
  assert.equal(ev.code, 0);
  assert.equal(run('board.mjs', ['event', '--kind', 'nope', '--text', 'x'], { root }).code, 1);
});

test('board validate uses G\'s board.schema.json when present', () => {
  const root = makeRepo();
  write(root, 'schemas/board.schema.json', { $defs: { sites: { type: 'object', required: ['slug', 'mustHave'] } } });
  write(root, 'doc.json', { slug: 'abc-site', brand: 'X', type: 'social-casino', stage: 'live', updatedAt: '2026-10-06T00:00:00Z' });
  const r = run('board.mjs', ['validate', path.join(root, 'doc.json')], { root });
  assert.equal(r.code, 1);
  assert.match(r.out, /board.schema.json/);
});

test('front matter subset parser', () => {
  const d = parseYamlSubset('name: a\ntools: Read, Grep\nlist: [x, "y z"]\nblock:\n  - one\n  - two\nmap:\n  origin: "ECC"\ntext: |\n  line 1\n  line 2\nflag: true\nn: 30\n');
  assert.deepEqual(d.list, ['x', 'y z']);
  assert.deepEqual(d.block, ['one', 'two']);
  assert.equal(d.map.origin, 'ECC');
  assert.equal(d.text, 'line 1\nline 2\n');
  assert.equal(d.flag, true);
  assert.equal(d.n, 30);
  assert.ok(parseFrontMatter('no front matter').error);
});

test('engine-lint skips missing inputs and catches agent, skill, rubric and context errors', () => {
  const root = makeRepo();
  let r = run('engine-lint.mjs', ['--agents', '--skills', '--rubrics', '--context', '--packs', '--strings'], { root });
  assert.equal(r.code, 0);
  assert.match(r.out, /skip +--agents/);
  write(root, '.claude/agents/judge.md', '---\nname: judge\ndescription: Judges the product as a quality rater would.\ntools: Read, Grep\nbackground: true\n---\nrubricVersion: 1.0\n');
  write(root, '.claude/agents/rubrics.json', { judge: { rubricVersion: '1.0', hash: 'deadbeef' } });
  write(root, '.claude/skills/order/SKILL.md', '---\nname: order\ndescription: Take an order.\narguments: [--id]\nallowed-tools: Read, Write(orders/**)\n---\nBody\n');
  write(root, 'CLAUDE.md', 'x\n'.repeat(201));
  r = run('engine-lint.mjs', ['--agents', '--skills', '--rubrics', '--context'], { root });
  assert.equal(r.code, 1);
  for (const re of [/background/, /positional/, /grants nothing/, /hash deadbeef/, /CLAUDE.md has 201 lines/]) assert.match(r.out, re);
  const agent = fs.readFileSync(path.join(root, '.claude/agents/judge.md'));
  write(root, '.claude/agents/judge.md', agent.toString().replace('background: true\n', ''));
  write(root, '.claude/agents/rubrics.json', { judge: { rubricVersion: '1.0', hash: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, '.claude/agents/judge.md'))).digest('hex') } });
  write(root, 'CLAUDE.md', 'short\n');
  r = run('engine-lint.mjs', ['--agents', '--rubrics', '--context'], { root });
  assert.equal(r.code, 0, r.out);
});

test('engine-lint --packs checks pack contract v0', () => {
  const root = makeRepo();
  write(root, 'types/social-casino/pack.mjs', "export default { id: 'social-casino', pages: () => [], styles: { partials: [] }, mandatory: { pageLints: [] }, checks: { builds: {} } };\n");
  write(root, 'types/social-casino/template-site/site.config.json', { type: 'social-casino' });
  write(root, 'types/online-games/pack.mjs', "export default { id: 'games', pages: [] };\n");
  const r = run('engine-lint.mjs', ['--packs'], { root });
  assert.equal(r.code, 1);
  assert.match(r.out, /types\/online-games\/pack.mjs: id "games"/);
  assert.doesNotMatch(r.out, /types\/social-casino\/pack.mjs:/);
});

test('engine-lint --notices', () => {
  const root = makeRepo();
  write(root, 'V.json', { ecc: { repo: 'affaan-m/everything-claude-code', commit: 'ef648e01' }, files: [{ dest: '.claude/agents/a.md', src: 'agents/a.md', mode: 'adapted' }] });
  write(root, 'N.md', 'affaan-m/everything-claude-code\n.claude/agents/a.md\n');
  let r = run('engine-lint.mjs', ['--notices', path.join(root, 'V.json'), path.join(root, 'N.md')], { root });
  assert.equal(r.code, 1);
  assert.match(r.out, /Affaan Mustafa/);
  write(root, 'N.md', 'affaan-m/everything-claude-code\n.claude/agents/a.md\nCopyright (c) 2026 Affaan Mustafa\n');
  r = run('engine-lint.mjs', ['--notices', path.join(root, 'V.json'), path.join(root, 'N.md')], { root });
  assert.equal(r.code, 0, r.out);
});

test('engine-lint --schemas accepts the factory schemas', () => {
  const r = run('engine-lint.mjs', ['--schemas']);
  assert.equal(r.code, 0, r.out);
});
