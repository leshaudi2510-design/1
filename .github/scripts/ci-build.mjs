#!/usr/bin/env node
// sites-ci lint step for one build target (a site or a type's template-site). Owner: F.
//
//   node .github/scripts/ci-build.mjs <dir> --out-root DIR [--id ID] [--allow FILE (default .github/ci-allow.json)]
//                                     [--placeholders-ok] [--summary FILE]
//
// 1. plain build of the config as it is      node engine/build.mjs <dir> --json --out ROOT/dist
//    must have zero problems; ROOT/dist is what CI uploads as dist-<id>.
// 2. every pack build variant                pack.checks.builds.<name>.edit(config) written to
//    ROOT/config-<name>.json and built with SITE_CONFIG; each must have zero problems.
//    A variant whose edited config equals the as-is config is reported and not rebuilt; a variant
//    listed in the target's skipVariants (.github/ci-allow.json, with a reason) is reported as skipped.
// 3. strict build                            node engine/build.mjs <dir> --strict --json
//    may fail only with rule ids allowed for this target in .github/ci-allow.json
//    (sites.<slug>.allow[].rule; templates.<type>.expect + allow), plus `placeholder` with
//    --placeholders-ok (PR label). A template must still fail strict with every `expect` rule.
//    Allowed rules that no longer occur are reported as stale (warning, not failure).
//
// Writes ROOT/build-report.json and appends a Markdown table to --summary (default
// $GITHUB_STEP_SUMMARY when set). Exit 0 ok, 1 a gate failed, 2 usage.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function args(argv) {
  const o = { dir: null, outRoot: null, id: null, allow: path.join(REPO, '.github', 'ci-allow.json'), placeholdersOk: false, summary: process.env.GITHUB_STEP_SUMMARY || null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out-root') o.outRoot = argv[++i];
    else if (a === '--id') o.id = argv[++i];
    else if (a === '--allow') o.allow = argv[++i];
    else if (a === '--summary') o.summary = argv[++i];
    else if (a === '--placeholders-ok') o.placeholdersOk = true;
    else if (!a.startsWith('--') && !o.dir) o.dir = a;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!o.dir || !o.outRoot) throw new Error('usage: ci-build.mjs <dir> --out-root DIR [--id ID] [--allow FILE] [--placeholders-ok] [--summary FILE]');
  return o;
}

function build(dir, out, { strict = false, config = null } = {}) {
  const argv = ['engine/build.mjs', dir, '--json', '--out', out];
  if (strict) argv.push('--strict');
  const env = { ...process.env };
  if (config) env.SITE_CONFIG = config;
  else delete env.SITE_CONFIG;
  delete env.OUT_DIR;
  const p = spawnSync(process.execPath, argv, { cwd: REPO, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let json = null;
  try { json = JSON.parse(p.stdout); } catch { /* reported below */ }
  if (!json) {
    process.stderr.write(p.stderr);
    return { ok: false, crashed: true, status: p.status, problems: [{ rule: 'build-crashed', message: (p.stderr || '').trim().split('\n').slice(-3).join(' ') }], warnings: [] };
  }
  return { ...json, status: p.status, stderr: p.stderr };
}

const rulesOf = (list) => [...new Set((list || []).map((p) => p.rule || 'unknown'))].sort();
const messageOf = (p) => p.message || p.msg || '';

async function main() {
  const o = args(process.argv.slice(2));
  const dirAbs = path.resolve(REPO, o.dir);
  const rel = path.relative(REPO, dirAbs);
  const cfg = JSON.parse(fs.readFileSync(path.join(dirAbs, 'site.config.json'), 'utf8'));
  const type = cfg.type || 'social-casino';
  const isTemplate = /(^|\/)template-site$/.test(rel);
  const id = o.id || (isTemplate ? `template-${type}` : path.basename(rel));
  fs.mkdirSync(o.outRoot, { recursive: true });

  const report = { id, dir: rel, kind: isTemplate ? 'template' : 'site', type, ok: true, failures: [], notes: [] };
  const fail = (msg) => { report.ok = false; report.failures.push(msg); };

  // 1. plain build
  const plain = build(rel, path.join(o.outRoot, 'dist'));
  report.plain = { ok: plain.ok === true, problems: plain.problems, warnings: rulesOf(plain.warnings), pages: Array.isArray(plain.pages) ? plain.pages.length : plain.pages, budgets: plain.budgets };
  if (plain.ok !== true || plain.problems.length) fail(`plain build: ${plain.problems.length} problem(s): ${plain.problems.map((p) => `${p.rule}: ${messageOf(p)}`).join(' | ')}`);
  fs.writeFileSync(path.join(o.outRoot, 'build.json'), JSON.stringify(plain.crashed ? plain : { ...plain, stderr: undefined }, null, 2));

  const allowFile = fs.existsSync(o.allow) ? JSON.parse(fs.readFileSync(o.allow, 'utf8')) : { sites: {}, templates: {} };
  const entry = isTemplate ? allowFile.templates?.[type] : allowFile.sites?.[id];
  const skips = new Map((entry?.skipVariants || []).map((v) => [v.name, v]));

  // 2. pack build variants
  report.variants = [];
  let pack = null;
  try { pack = (await import(pathToFileURL(path.join(REPO, 'types', type, 'pack.mjs')).href)).default; }
  catch (err) { fail(`cannot load types/${type}/pack.mjs: ${err.message}`); }
  const builds = pack?.checks?.builds || {};
  for (const [name, spec] of Object.entries(builds)) {
    if (typeof spec?.edit !== 'function') { report.variants.push({ name, skipped: 'no edit()' }); continue; }
    if (skips.has(name)) {
      const s = skips.get(name);
      report.variants.push({ name, skipped: `ci-allow (owner ${s.owner || '?'})` });
      report.notes.push(`variant ${name} skipped by .github/ci-allow.json: ${s.reason}`);
      continue;
    }
    const edited = spec.edit(structuredClone(cfg));
    if (JSON.stringify(edited) === JSON.stringify(cfg)) { report.variants.push({ name, sameAsPlain: true, ok: report.plain.ok }); continue; }
    const file = path.join(o.outRoot, `config-${name}.json`);
    fs.writeFileSync(file, JSON.stringify(edited, null, 2));
    const r = build(rel, path.join(o.outRoot, `dist-${name}`), { config: file });
    report.variants.push({ name, ok: r.ok === true, problems: r.problems, warnings: rulesOf(r.warnings) });
    if (r.ok !== true || r.problems.length) fail(`variant ${name}: ${r.problems.length} problem(s): ${r.problems.map((p) => `${p.rule}: ${messageOf(p)}`).join(' | ')}`);
  }

  // 3. strict build against the allowlist
  const expect = isTemplate ? (entry?.expect || []) : [];
  const allowed = new Set([...expect, ...(entry?.allow || []).map((a) => (typeof a === 'string' ? a : a.rule))]);
  if (o.placeholdersOk && !isTemplate) allowed.add('placeholder');
  const strict = build(rel, path.join(o.outRoot, 'dist-strict'), { strict: true });
  const seen = rulesOf(strict.problems);
  const unexpected = seen.filter((r) => !allowed.has(r));
  const missing = expect.filter((r) => !seen.includes(r));
  const stale = [...allowed].filter((r) => !seen.includes(r) && !expect.includes(r) && !(o.placeholdersOk && r === 'placeholder'));
  report.strict = { ok: strict.ok === true, rules: seen, allowed: [...allowed].sort(), unexpected, missingExpected: missing, stale, placeholdersOk: o.placeholdersOk };
  if (strict.crashed) fail('strict build crashed');
  for (const r of unexpected) fail(`strict: rule ${r} is not allowed for ${id} (${strict.problems.filter((p) => p.rule === r).map(messageOf).slice(0, 3).join(' | ')})`);
  for (const r of missing) fail(`strict: template ${type} no longer fails with ${r}; update .github/ci-allow.json templates.${type}.expect if intended`);
  for (const r of stale) report.notes.push(`stale allowance: ${r} no longer occurs for ${id}; remove it from .github/ci-allow.json`);

  fs.writeFileSync(path.join(o.outRoot, 'build-report.json'), JSON.stringify(report, null, 2));

  const line = (s) => console.log(s);
  line(`${report.ok ? 'ok' : 'FAIL'} ${id} (${report.kind}, ${type})`);
  line(`  plain: ${report.plain.ok ? 'ok' : 'problems'}; warnings: ${report.plain.warnings.join(', ') || 'none'}`);
  for (const v of report.variants) line(`  variant ${v.name}: ${v.skipped ? `skipped (${v.skipped})` : v.sameAsPlain ? 'same config as plain' : v.ok ? 'ok' : 'problems'}`);
  line(`  strict: ${report.strict.ok ? 'clean' : `fails with ${seen.join(', ')}`}; allowed: ${report.strict.allowed.join(', ') || 'none'}`);
  for (const f of report.failures) line(`::error title=${id}::${f}`);
  for (const n of report.notes) line(`::warning title=${id}::${n}`);

  if (o.summary) {
    const md = [
      `### Build ${id} (${report.kind}, ${type}): ${report.ok ? 'ok' : 'FAILED'}`,
      '',
      '| build | result | rules |',
      '|---|---|---|',
      `| plain | ${report.plain.ok ? 'ok' : 'problems'} | warnings: ${report.plain.warnings.join(', ') || 'none'} |`,
      ...report.variants.map((v) => `| ${v.name} | ${v.skipped ? 'skipped' : v.sameAsPlain ? 'same as plain' : v.ok ? 'ok' : 'problems'} | ${v.warnings ? `warnings: ${v.warnings.join(', ') || 'none'}` : ''} |`),
      `| strict | ${report.strict.ok ? 'clean' : unexpected.length || missing.length ? 'unexpected' : 'known pre-launch only'} | ${seen.join(', ') || 'none'} |`,
      '',
      ...report.failures.map((f) => `- error: ${f}`),
      ...report.notes.map((n) => `- note: ${n}`),
      '',
    ].join('\n');
    fs.appendFileSync(o.summary, md + '\n');
  }
  return report.ok ? 0 : 1;
}

main().then((c) => process.exit(c), (err) => { console.error(`ci-build: ${err.message}`); process.exit(2); });
