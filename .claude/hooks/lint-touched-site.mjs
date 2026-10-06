// Original (site factory). PostToolUse Edit|Write|MultiEdit (SPEC 8, MASTER-PLAN 5.4).
// Uses lib/edit-accumulator.cjs and lib/design-signals.cjs (adapted from everything-claude-code
// scripts/hooks/post-edit-accumulator.js and design-quality-check.js @ ef648e01, MIT).
//
// 1. Records the edited path for the Stop gate (accumulator in the OS temp dir).
// 2. If the path is under <tree>/sites/<slug>/ (not dist*, public/, docs/, *.md, not sites/_*):
//    debounced (2 s per slug, reports/<slug>/.lint.lock) synchronous
//    `node engine/build.mjs <tree>/sites/<slug> --json --out $CLAUDE_SCRATCHPAD/dist-<slug>`,
//    writes reports/<slug>/build.json; problems -> stderr + exit 2 (the model sees them);
//    warnings -> exit 0 with a one-line additionalContext summary.
// 3. Regex design signals from guard-rules.json -> additionalContext (never blocks).
// FACTORY_HOOKS=off disables it. Absent engine/build.mjs (mid-refactor) -> skip quietly.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readInput, hooksOff, context, finish } = require('./lib/out.cjs');
const F = require('./lib/factory.cjs');
const accumulator = require('./lib/edit-accumulator.cjs');
const signals = require('./lib/design-signals.cjs');

const DEBOUNCE_MS = 2000;

function siteOf(rel) {
  const m = /^sites\/([a-z0-9][a-z0-9-]*)\/(.+)$/.exec(rel || '');
  if (!m) return null;
  const inner = m[2];
  if (/^(dist[^/]*|public|docs)\//.test(inner) || /\.md$/i.test(inner)) return null;
  return m[1];
}

function debounced(lockFile) {
  try {
    const st = fs.statSync(lockFile);
    if (Date.now() - st.mtimeMs < DEBOUNCE_MS) return true;
  } catch { /* no lock yet */ }
  try {
    fs.mkdirSync(path.dirname(lockFile), { recursive: true });
    fs.writeFileSync(lockFile, String(process.pid));
  } catch { /* best effort */ }
  return false;
}

function asLines(list) {
  return (list || []).map(p => (typeof p === 'string' ? p : [p.rule, p.file, p.message || p.msg || p.text].filter(Boolean).join(': ') || JSON.stringify(p)));
}

function siblingTerms(siteDir) {
  const concept = F.readJson(path.join(siteDir, 'concept.json'), null);
  const sib = concept && Array.isArray(concept.siblings) ? concept.siblings : [];
  const terms = [];
  for (const s of sib) if (s && Array.isArray(s.vocabulary)) for (const v of s.vocabulary) terms.push(typeof v === 'string' ? v : v && v.term);
  return terms.filter(Boolean).slice(0, 100);
}

function lintSite(treeRoot, slug) {
  const build = path.join(treeRoot, 'engine', 'build.mjs');
  if (!fs.existsSync(build)) return { skipped: 'engine/build.mjs not present' };
  const reports = path.join(treeRoot, 'reports', slug);
  if (debounced(path.join(reports, '.lint.lock'))) return { skipped: 'debounced' };
  const scratch = process.env.CLAUDE_SCRATCHPAD || os.tmpdir();
  const out = path.join(scratch, `dist-${slug}`);
  const r = spawnSync(process.execPath, [build, path.join(treeRoot, 'sites', slug), '--json', '--out', out], {
    cwd: treeRoot, encoding: 'utf8', timeout: 50000, maxBuffer: 32 * 1024 * 1024,
  });
  let result = null;
  try { result = JSON.parse(r.stdout); } catch { /* not JSON */ }
  fs.mkdirSync(reports, { recursive: true });
  const record = result || { ok: false, problems: [], warnings: [], crashed: true, exitCode: r.status, stderr: String(r.stderr || '').slice(-4000) };
  try { fs.writeFileSync(path.join(reports, 'build.json'), JSON.stringify(record, null, 2) + '\n'); } catch { /* best effort */ }
  return { result, record, status: r.status, stderr: r.stderr };
}

async function main() {
  if (hooksOff()) return finish(0);
  const { input } = await readInput();
  if (!input) return finish(0); // PostToolUse cannot undo an edit; nothing to do without input
  accumulator.run(input);

  const root = F.projectRoot(input);
  const notes = [];
  let problems = [];
  let rules = [];
  try { rules = F.loadRules(); } catch { /* signals optional */ }

  for (const p of F.targetPaths(input.tool_input)) {
    const loc = F.locate(p, root);
    if (loc.rel === null) continue;
    const slug = siteOf(loc.rel);
    if (!slug) continue;
    const treeRoot = loc.treeRoot || root;
    const sig = signals.run({ rel: loc.rel, abs: loc.abs, rules, siblingsTerms: siblingTerms(path.join(treeRoot, 'sites', slug)) });
    if (sig.additionalContext) notes.push(sig.additionalContext);
    const lint = lintSite(treeRoot, slug);
    if (lint.skipped) continue;
    if (!lint.result) {
      notes.push(`[factory] engine/build.mjs sites/${slug} --json did not return JSON (exit ${lint.status}); see reports/${slug}/build.json.`);
      continue;
    }
    const probs = asLines(lint.result.problems);
    const warns = asLines(lint.result.warnings);
    if (probs.length) problems = problems.concat(probs.map(x => `sites/${slug}: ${x}`));
    else notes.push(`[factory] build sites/${slug}: 0 problems, ${warns.length} warning(s)${warns.length ? ' (' + warns.slice(0, 3).join('; ').slice(0, 300) + ')' : ''}.`);
  }

  const ctx = context('PostToolUse', notes.join('\n'));
  if (problems.length) {
    return finish(2, { stdout: '', stderr: `[factory] build problems after this edit (fix them in the files they name):\n${problems.slice(0, 40).join('\n')}${notes.length ? '\n' + notes.join('\n') : ''}` });
  }
  return finish(0, { stdout: ctx });
}

main().catch(() => finish(0));
