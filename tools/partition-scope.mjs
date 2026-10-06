#!/usr/bin/env node
// Partition ownership checks (MASTER-PLAN 9.2, D-35; ECC 9 CI partition-scope).

import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, runMain, UsageError, repoRoot, exists, readJson, git, isMain, TOOLS_DIR } from './lib/common.mjs';

const HELP = `Usage:
  node tools/partition-scope.mjs <letter> <base> [--worktree] [--paths FILE]
  node tools/partition-scope.mjs <letter> --exists
  node tools/partition-scope.mjs --self-test
  node tools/partition-scope.mjs --all-paths-covered
  node tools/partition-scope.mjs --owner <path>...

Reads tools/partitions.json (A-H, T, P; phase-aware: partitions that are not yet
active fold into their parent, B and T into A and P into E in Phase 1).

<letter> <base>      every path changed between <base> and HEAD
                     (git diff --name-status --no-renames <base>...HEAD, so a
                     move counts its old and new paths) must belong to <letter>
                     (or be a shared path or a sanctioned exception of it), and
                     every path must belong to some partition. --worktree adds
                     uncommitted and untracked changes; --paths FILE ("-" for
                     stdin) checks a newline-separated list instead of git.
<letter> --exists    every Phase 1 deliverable listed for <letter> exists.
--self-test          globs compile, the built-in sample of representative paths
                     resolves to the expected owners, no path has two owners
                     outside "shared", every partition's own "expects" resolve to it.
--all-paths-covered  every tracked file (git ls-files) has exactly one owner
                     (ignored and shared paths excepted).
--owner              print the owner of each path.
--phase N            evaluate as phase N (default: the file's phase).
Exit codes: 0 ok, 1 violation, 2 usage error.
`;

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') { const j = glob.indexOf('}', i); re += `(?:${glob.slice(i + 1, j).split(',').map((s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')).join('|')})`; i = j; }
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function loadPartitions(file = path.join(TOOLS_DIR, 'partitions.json')) {
  const p = readJson(file);
  const compiled = {};
  for (const [letter, def] of Object.entries(p.partitions)) {
    compiled[letter] = { ...def, letter, ownsRe: (def.owns || []).map(globToRegExp), exceptRe: (def.except || []).map(globToRegExp) };
  }
  return { ...p, compiled, ignoredRe: (p.ignored || []).map(globToRegExp) };
}

/** Raw (unfolded) partitions whose globs claim the path. */
export function rawOwners(P, file) {
  return Object.values(P.compiled).filter((d) => d.ownsRe.some((r) => r.test(file)) && !d.exceptRe.some((r) => r.test(file))).map((d) => d.letter);
}
export function fold(P, letter, phase = P.phase) {
  let l = letter; let guard = 0;
  while (P.compiled[l] && (P.compiled[l].activeFrom || 1) > phase && P.compiled[l].foldedInto && guard++ < 5) l = P.compiled[l].foldedInto;
  return l;
}
/** { owners: [effective letters], shared: [letters]|null, ignored } */
export function ownerOf(P, file, phase = P.phase) {
  if (P.ignoredRe.some((r) => r.test(file))) return { owners: [], shared: null, ignored: true };
  const sh = (P.shared || []).find((s) => s.path === file);
  const owners = [...new Set(rawOwners(P, file).map((l) => fold(P, l, phase)))];
  return { owners, shared: sh ? sh.partitions.map((l) => fold(P, l, phase)) : null, ignored: false };
}

export function checkScope(P, letter, files, phase = P.phase) {
  const errors = [];
  for (const f of files) {
    const o = ownerOf(P, f, phase);
    if (o.ignored) continue;
    if (o.shared) { if (!o.shared.includes(letter)) errors.push(`${f}: shared by ${o.shared.join(', ')}, not ${letter}`); continue; }
    const exc = (P.exceptions || []).find((e) => e.path === f && fold(P, e.partition, phase) === letter);
    if (exc) continue;
    if (!o.owners.length) { errors.push(`${f}: no partition owns this path`); continue; }
    if (o.owners.length > 1) { errors.push(`${f}: owned by several partitions (${o.owners.join(', ')})`); continue; }
    if (o.owners[0] !== letter) errors.push(`${f}: belongs to partition ${o.owners[0]} (${P.compiled[o.owners[0]] ? P.compiled[o.owners[0]].name : '?'}), not ${letter}`);
  }
  return errors;
}

// Representative paths -> expected owner in Phase 1 (MASTER-PLAN 2 tree).
export const SAMPLE = {
  'engine/build.mjs': 'A', 'engine/lib/layout.mjs': 'A', 'engine/lint/report.mjs': 'A', 'engine/schema/pack.schema.json': 'A',
  'engine/games/_legacy/slots.js': 'A', 'engine/games/roulette/index.mjs': 'A', 'engine/tools/simulate-21.mjs': 'A',
  'engine/tools/check.mjs': 'C', 'engine/tools/oracle/opalquestlounge.json': 'C', 'engine/docs/invariants.md': 'H',
  'types/social-casino/pack.mjs': 'A', 'types/social-casino/checks/stage.mjs': 'C', 'types/social-casino/data/known-studio-titles.json': 'A',
  'types/social-casino/data/pragmatic-catalog.json': 'A', 'types/social-casino/ppc/events.json': 'E', 'types/online-games/pack.mjs': 'A',
  'types/hotel-casino/template-site/site.config.json': 'A', 'sites/opalquestlounge/site.config.json': 'A', 'sites/opalquestlounge/checks.json': 'C',
  'sites/opalquestlounge/docs/README.md': 'H', 'sites/pixelcrownclub/index.html': 'F', 'sites/registry.json': 'F',
  'sites/_fixtures/reskin-of-oql/site.config.json': 'D', 'tools/uniqueness.mjs': 'D', 'tools/partitions.json': 'D', 'tools/labels.mjs': 'F',
  'tools/labels.json': 'F', 'tools/ci-lint.mjs': 'F', 'tools/ppc/kit.mjs': 'E', 'schemas/order.schema.json': 'D', 'schemas/board.schema.json': 'G',
  'orders/_templates/order.example.json': 'D', 'portfolio/registry.json': 'D', 'CLAUDE.md': 'E', '.claude/settings.json': 'E',
  '.claude/hooks/guard-ppc.mjs': 'E', '.claude/agents/catalogue-curator.md': 'A', '.claude/skills/ppc-kit/SKILL.md': 'E',
  '.github/workflows/sites-ci.yml': 'F', '.github/workflows/opalquestlounge-ci.yml': 'A', 'package.json': 'F', '.gitignore': 'F',
  'artifacts/board/index.html': 'G', 'artifacts/ppc-dashboard/index.html': 'E', 'docs/PLAN.md': 'H', 'docs/factory/SPEC.md': 'H',
  'briefs/social-casino-uk.md': 'H', 'THIRD_PARTY_NOTICES.md': 'H', '.mcp.json': 'E', 'ppc/policy.json': 'E',
  'opalquestlounge/build.mjs': 'A', 'prompts/social-casino-uk.md': 'A', 'index.html': 'A', 'assets/css/site.css': 'A',
};
// Later phases: who owns what once B, T and P are active.
export const SAMPLE_LATER = {
  5: { 'engine/games/roulette/index.mjs': 'B', 'types/online-games/pack.mjs': 'T', 'types/hotel-casino/geo/GB.json': 'T', 'types/online-games/ppc/tags.json': 'P', 'tools/ppc/kit.mjs': 'P', '.claude/hooks/guard-ppc.mjs': 'P', '.claude/agents/catalogue-curator.md': 'T', 'engine/tools/simulate-21.mjs': 'B' },
};

export function selfTest(P) {
  const errors = [];
  for (const [l, d] of Object.entries(P.partitions)) {
    for (const g of [...(d.owns || []), ...(d.except || [])]) { try { globToRegExp(g); } catch (e) { errors.push(`${l}: glob ${g} does not compile (${e.message})`); } }
    if (d.foldedInto && !P.partitions[d.foldedInto]) errors.push(`${l}: foldedInto ${d.foldedInto} is not a partition`);
  }
  for (const want of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'T', 'P']) if (!P.partitions[want]) errors.push(`partition ${want} is missing`);
  const check = (sample, phase) => {
    for (const [f, want] of Object.entries(sample)) {
      const o = ownerOf(P, f, phase);
      const got = o.shared ? `shared(${o.shared.join(',')})` : o.owners.join(',') || 'none';
      if (o.owners.length !== 1 || o.owners[0] !== want) errors.push(`phase ${phase}: ${f} -> ${got}, expected ${want}`);
    }
  };
  check(SAMPLE, P.phase);
  for (const [phase, sample] of Object.entries(SAMPLE_LATER)) check(sample, Number(phase));
  for (const [l, d] of Object.entries(P.partitions)) for (const f of d.expects || []) {
    const o = ownerOf(P, f, P.phase);
    const exc = (P.exceptions || []).some((e) => e.path === f && fold(P, e.partition) === l);
    if (!exc && !(o.owners.length === 1 && o.owners[0] === l) && !(o.shared && o.shared.includes(l))) errors.push(`${l} expects ${f}, which resolves to ${o.owners.join(',') || 'nobody'}`);
  }
  for (const s of P.shared || []) for (const l of s.partitions) if (!P.partitions[l]) errors.push(`shared ${s.path}: unknown partition ${l}`);
  return errors;
}

function diffPaths(base, worktree, root) {
  const out = git(['diff', '--name-status', '--no-renames', `${base}...HEAD`], { cwd: root });
  if (out === null) throw new UsageError(`git diff ${base}...HEAD failed (is ${base} a valid ref?)`);
  const files = out.split('\n').filter(Boolean).map((l) => l.split('\t').pop());
  if (worktree) {
    const st = git(['status', '--porcelain', '--untracked-files=all'], { cwd: root }) || '';
    for (const l of st.split('\n').filter(Boolean)) files.push(l.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''));
  }
  return [...new Set(files)];
}

async function main(argv) {
  const a = parseArgs(argv, { booleans: ['self-test', 'all-paths-covered', 'exists', 'worktree', 'help', 'owner', 'json'], strings: ['paths', 'phase', 'file'] });
  if (a.help) { process.stdout.write(HELP); return 0; }
  const root = repoRoot();
  const P = loadPartitions(a.file ? path.resolve(a.file) : undefined);
  const phase = a.phase ? Number(a.phase) : P.phase;
  if (a['self-test']) {
    const errs = selfTest(P);
    for (const e of errs) process.stdout.write(`error: ${e}\n`);
    process.stdout.write(`partition-scope --self-test: ${errs.length ? `${errs.length} problem(s)` : `ok (${Object.keys(SAMPLE).length} sample paths, ${Object.keys(P.partitions).length} partitions)`}\n`);
    if (!a['all-paths-covered']) return errs.length ? 1 : 0;
    if (errs.length) return 1;
  }
  if (a['all-paths-covered']) {
    const files = (git(['ls-files'], { cwd: root }) || '').split('\n').filter(Boolean);
    const errs = [];
    for (const f of files) {
      const o = ownerOf(P, f, phase);
      if (o.ignored || o.shared) continue;
      if (!o.owners.length) errs.push(`${f}: no partition owns this path`);
      else if (o.owners.length > 1) errs.push(`${f}: owned by ${o.owners.join(', ')}`);
    }
    for (const e of errs) process.stdout.write(`error: ${e}\n`);
    process.stdout.write(`partition-scope --all-paths-covered: ${files.length} tracked file(s), ${errs.length ? `${errs.length} problem(s)` : 'every path has one owner'}\n`);
    return errs.length ? 1 : 0;
  }
  if (a.owner) {
    for (const f of a._) { const o = ownerOf(P, f, phase); process.stdout.write(`${f}\t${o.ignored ? 'ignored' : o.shared ? `shared:${o.shared.join(',')}` : o.owners.join(',') || 'none'}\n`); }
    return 0;
  }
  const letter = a._[0];
  if (!letter || !P.partitions[letter]) throw new UsageError(`first argument must be a partition letter (${Object.keys(P.partitions).join(', ')})`);
  if (a.exists) {
    const missing = (P.partitions[letter].expects || []).filter((f) => !exists(path.join(root, f)));
    for (const f of missing) process.stdout.write(`missing: ${f}\n`);
    process.stdout.write(`partition-scope ${letter} --exists: ${missing.length ? `${missing.length} of ${(P.partitions[letter].expects || []).length} missing` : `all ${(P.partitions[letter].expects || []).length} present`}\n`);
    return missing.length ? 1 : 0;
  }
  let files;
  if (a.paths) files = (a.paths === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(a.paths, 'utf8')).split('\n').map((s) => s.trim()).filter(Boolean);
  else {
    const base = a._[1];
    if (!base) throw new UsageError('give a base ref (e.g. origin/tooling/factory-layout) or --paths FILE');
    files = diffPaths(base, a.worktree, root);
  }
  const errs = checkScope(P, letter, files, phase);
  for (const e of errs) process.stdout.write(`error: ${e}\n`);
  process.stdout.write(`partition-scope ${letter}: ${files.length} path(s), ${errs.length ? `${errs.length} out of scope` : 'all in scope'}\n`);
  return errs.length ? 1 : 0;
}

if (isMain(import.meta.url)) runMain(main, HELP);
