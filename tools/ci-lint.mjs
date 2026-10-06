#!/usr/bin/env node
// Static lint of the GitHub Actions workflows (MASTER-PLAN W28, D-49, D-14; SPEC 11). Owner: F.
//
//   node tools/ci-lint.mjs [.github/workflows | file.yml ...] [--json]
//   node tools/ci-lint.mjs --self-test
//
// Rules (error unless noted):
//   yaml            every workflow parses (YAML 1.2, the `yaml` devDependency) and has `on` and `jobs`
//   run-path        every repository path a `run:` block names (a token starting with engine/, tools/,
//                   types/, sites/, schemas/, artifacts/, .github/ or .claude/, without variables or
//                   globs) exists in the checkout, or the same run block guards it with
//                   `[ -f path ]` / `-d` / `-e` / `-s`, or the step's `if:` uses hashFiles('path')
//   matrix-guard    a job whose matrix comes from fromJSON(needs.<job>.outputs.<name>) has an `if:`
//                   containing `needs.<job>.outputs.<name> != '[]'` (an empty matrix vector is a
//                   workflow error, SPEC 11.1)
//   push-branches   a `push` trigger never runs on site/** or wip/** branches: it needs a `branches`
//                   filter without site/wip/catch-all patterns, or `branches-ignore` naming both
//                   (pull_request already covers those branches; SPEC 11.1)
//   lighthouse      sites-ci.yml has a step that runs engine/tools/lighthouse.mjs (D-14)
//   aggregator      a job named *-ok runs `if: always()` and needs every other job of the workflow
//                   except continue-on-error ones (skipped counts as success there, SPEC 10.1)
//   checkout-pin    (warning) actions referenced without a version (`uses: owner/action` without @)
//
// Exit 0 no errors, 1 errors, 2 usage or missing yaml module.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = /^(engine|tools|types|sites|schemas|artifacts|\.github|\.claude)\/[A-Za-z0-9_.\-/]+$/;

let YAML;
async function loadYaml() {
  if (YAML) return YAML;
  try { YAML = await import('yaml'); } catch { console.error('ci-lint: the yaml package is missing; run npm ci at the repository root'); process.exit(2); }
  return YAML;
}

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Repository paths named in a shell block (tokens split on whitespace, quotes and shell punctuation). */
export function pathsIn(run) {
  const out = new Set();
  for (const tok of String(run).split(/[\s'"`;|&()<>=,]+/)) {
    const t = tok.replace(/\/+$/, '');
    if (t && ROOTS.test(t) && !t.includes('..')) out.add(t);
  }
  return [...out];
}

function guarded(p, run, stepIf) {
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`-[fdes]\\s+["']?${esc}["']?(\\s|\\]|$)`).test(run)) return true;
  if (stepIf && new RegExp(`hashFiles\\(\\s*['"]${esc}['"]`).test(String(stepIf))) return true;
  return false;
}

function pushProblems(on) {
  if (!on || typeof on !== 'object' || !('push' in on)) return [];
  const push = on.push || {};
  const branches = asList(push.branches);
  const ignore = asList(push['branches-ignore']);
  const bad = (b) => /^(site|wip)\//.test(b) || b === '**' || b === '*' || /^(site|wip)\*/.test(b);
  if (branches.length) {
    const hits = branches.filter(bad);
    return hits.length ? [`push.branches includes ${hits.join(', ')}: pull_request already runs site/** and wip/** work`] : [];
  }
  if (ignore.length) {
    const covers = (prefix) => ignore.some((b) => b === `${prefix}/**` || b === `${prefix}/*` || b === `${prefix}**`);
    return covers('site') && covers('wip') ? [] : ['push.branches-ignore must list site/** and wip/**'];
  }
  if (push.tags && !push.branches) return [];
  return ['push has no branches filter, so it also runs on site/** and wip/** branches (add branches: or branches-ignore:)'];
}

export function lintWorkflow(text, file, { exists = (p) => fs.existsSync(path.join(REPO, p)) } = {}) {
  const errors = [];
  const warnings = [];
  const name = path.basename(file);
  let doc;
  try {
    doc = YAML.parse(text);
  } catch (err) {
    return { file, errors: [{ rule: 'yaml', message: err.message.split('\n')[0] }], warnings };
  }
  if (!doc || typeof doc !== 'object' || !doc.on || !doc.jobs) {
    return { file, errors: [{ rule: 'yaml', message: 'missing `on` or `jobs`' }], warnings };
  }
  for (const m of pushProblems(doc.on)) errors.push({ rule: 'push-branches', message: m });

  let lighthouse = false;
  const jobs = doc.jobs;
  for (const [jobId, job] of Object.entries(jobs)) {
    if (!job || typeof job !== 'object') continue;
    // matrix guard
    const matrix = job.strategy && job.strategy.matrix;
    if (matrix && typeof matrix === 'object') {
      for (const v of Object.values(matrix)) {
        const m = typeof v === 'string' && v.match(/fromJSON\(\s*(needs\.[\w-]+\.outputs\.[\w-]+)\s*\)/);
        if (!m) continue;
        const cond = String(job.if || '');
        if (!cond.includes(`${m[1]} != '[]'`)) errors.push({ rule: 'matrix-guard', message: `job ${jobId}: matrix from ${m[1]} needs if: ${m[1]} != '[]'` });
      }
    }
    // steps
    for (const [i, step] of asList(job.steps).entries()) {
      if (!step || typeof step !== 'object') continue;
      const label = `job ${jobId} step ${step.name || step.id || i + 1}`;
      if (typeof step.uses === 'string' && !step.uses.startsWith('./') && !step.uses.startsWith('docker://') && !step.uses.includes('@')) {
        warnings.push({ rule: 'checkout-pin', message: `${label}: ${step.uses} has no @version` });
      }
      if (typeof step.run !== 'string') continue;
      if (step.run.includes('engine/tools/lighthouse.mjs')) lighthouse = true;
      for (const p of pathsIn(step.run)) {
        if (exists(p) || guarded(p, step.run, step.if)) continue;
        errors.push({ rule: 'run-path', message: `${label}: ${p} does not exist and is not guarded ([ -f ${p} ] or hashFiles)` });
      }
    }
  }
  if (name === 'sites-ci.yml' && !lighthouse) errors.push({ rule: 'lighthouse', message: 'no step runs engine/tools/lighthouse.mjs (D-14)' });

  // aggregator
  for (const [jobId, job] of Object.entries(jobs)) {
    if (!/-ok$/.test(jobId) || !job) continue;
    if (!String(job.if || '').includes('always()')) errors.push({ rule: 'aggregator', message: `job ${jobId} needs if: always()` });
    const needs = new Set(asList(job.needs));
    for (const [other, o] of Object.entries(jobs)) {
      if (other === jobId || (o && o['continue-on-error'] === true)) continue;
      if (!needs.has(other)) errors.push({ rule: 'aggregator', message: `job ${jobId} does not need ${other}` });
    }
  }
  return { file, errors, warnings };
}

function targets(args) {
  const list = args.length ? args : ['.github/workflows'];
  const files = [];
  for (const a of list) {
    const abs = path.resolve(a);
    if (!fs.existsSync(abs)) { console.error(`ci-lint: ${a}: no such file or directory`); process.exit(2); }
    if (fs.statSync(abs).isDirectory()) {
      for (const f of fs.readdirSync(abs).sort()) if (/\.ya?ml$/.test(f)) files.push(path.join(abs, f));
    } else files.push(abs);
  }
  return files;
}

function selfTest() {
  const exists = (p) => ['engine/build.mjs', 'engine/tools/lighthouse.mjs', 'sites/x'].includes(p);
  const base = (jobs, on = 'on:\n  pull_request:\n  push:\n    branches: [main]\n') => `name: t\n${on}jobs:\n${jobs}`;
  const cases = [
    ['clean', base('  a:\n    runs-on: x\n    steps:\n      - run: node engine/build.mjs sites/x\n'), []],
    ['missing path', base('  a:\n    runs-on: x\n    steps:\n      - run: node tools/nope.mjs\n'), ['run-path']],
    ['guarded path', base('  a:\n    runs-on: x\n    steps:\n      - run: |\n          if [ -f tools/nope.mjs ]; then node tools/nope.mjs; fi\n'), []],
    ['hashFiles guard', base("  a:\n    runs-on: x\n    steps:\n      - if: hashFiles('tools/nope.mjs') != ''\n        run: node tools/nope.mjs\n"), []],
    ['variable path ignored', base('  a:\n    runs-on: x\n    steps:\n      - run: node engine/build.mjs "sites/$SLUG"\n'), []],
    ['matrix unguarded', base("  c:\n    runs-on: x\n    steps: []\n  a:\n    needs: c\n    strategy:\n      matrix:\n        s: ${{ fromJSON(needs.c.outputs.sites) }}\n    runs-on: x\n    steps: []\n"), ['matrix-guard']],
    ['matrix guarded', base("  c:\n    runs-on: x\n    steps: []\n  a:\n    needs: c\n    if: needs.c.outputs.sites != '[]'\n    strategy:\n      matrix:\n        s: ${{ fromJSON(needs.c.outputs.sites) }}\n    runs-on: x\n    steps: []\n"), []],
    ['push site/**', base('  a:\n    runs-on: x\n    steps: []\n', "on:\n  push:\n    branches: [main, 'site/**']\n"), ['push-branches']],
    ['push unfiltered', base('  a:\n    runs-on: x\n    steps: []\n', 'on:\n  push:\n    paths: [engine/**]\n'), ['push-branches']],
    ['push branches-ignore', base('  a:\n    runs-on: x\n    steps: []\n', "on:\n  push:\n    branches-ignore: ['site/**', 'wip/**']\n"), []],
    ['aggregator missing need', base('  a:\n    runs-on: x\n    steps: []\n  b:\n    runs-on: x\n    steps: []\n  x-ok:\n    if: always()\n    needs: [a]\n    runs-on: x\n    steps: []\n'), ['aggregator']],
    ['aggregator ok', base('  a:\n    runs-on: x\n    steps: []\n  l:\n    continue-on-error: true\n    runs-on: x\n    steps: []\n  x-ok:\n    if: always()\n    needs: [a]\n    runs-on: x\n    steps: []\n'), []],
    ['bad yaml', 'on: [\n', ['yaml']],
  ];
  let bad = 0;
  for (const [title, text, want] of cases) {
    const r = lintWorkflow(text, 'x.yml', { exists });
    const got = [...new Set(r.errors.map((e) => e.rule))].sort();
    const ok = JSON.stringify(got) === JSON.stringify([...want].sort());
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${title}${ok ? '' : `: got ${got.join(',') || 'none'}, want ${want.join(',') || 'none'}`}`);
  }
  const noLh = lintWorkflow(base('  a:\n    runs-on: x\n    steps: []\n'), 'sites-ci.yml', { exists });
  const lhOk = noLh.errors.some((e) => e.rule === 'lighthouse');
  console.log(`${lhOk ? 'ok  ' : 'FAIL'} sites-ci without lighthouse`);
  if (!lhOk) bad++;
  console.log(bad ? `ci-lint self-test: ${bad} failed` : 'ci-lint self-test: ok');
  return bad ? 1 : 0;
}

async function main(argv) {
  await loadYaml();
  if (argv.includes('--self-test')) return selfTest();
  const json = argv.includes('--json');
  const files = targets(argv.filter((a) => !a.startsWith('--')));
  const results = files.map((f) => lintWorkflow(fs.readFileSync(f, 'utf8'), f));
  if (json) {
    console.log(JSON.stringify({ ok: results.every((r) => !r.errors.length), results: results.map((r) => ({ ...r, file: path.relative(REPO, r.file) })) }, null, 2));
  } else {
    for (const r of results) {
      const rel = path.relative(REPO, r.file);
      for (const e of r.errors) console.log(`error ${rel}: [${e.rule}] ${e.message}`);
      for (const w of r.warnings) console.log(`warning ${rel}: [${w.rule}] ${w.message}`);
      if (!r.errors.length) console.log(`ok ${rel}${r.warnings.length ? ` (${r.warnings.length} warning(s))` : ''}`);
    }
  }
  return results.some((r) => r.errors.length) ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (err) => { console.error(`ci-lint: ${err.stack || err.message}`); process.exit(2); });
}
