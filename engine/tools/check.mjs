#!/usr/bin/env node
// End-to-end checks of one site in a real browser (Playwright's Chromium).
//
//   node engine/tools/check.mjs --site <site-dir> [options]
//
//   --site DIR          the site folder (sites/<slug>, a template site, a fixture);
//                       default: the working directory when it holds site.config.json
//   --report FILE       write the JSON report there (after every section, so a
//                       run that is stopped still leaves one, with partial: true)
//   --shots [DIR]       also save full-page screenshots (default <site>/check-shots)
//   --only=IDS          run some sections only: section ids or groups, comma-separated
//                       (an unknown id exits 2; the list is in engine/tools/README.md)
//   --workers N         pages checked at a time inside a section (default 3 or 4)
//   --tmp DIR           where the throwaway builds go (default: the system temp dir)
//   --keep              keep the throwaway builds and say where they are
//   --oracle-diff FILE  compare the run with a recorded run (engine/tools/oracle/<slug>.json):
//                       per-section pass counts (a difference fails the run) and the
//                       check names (missing and extra names are listed)
//   --list              print the section ids and exit
//
//   CHECK_TIMEOUT_MIN=n stop after n minutes (default 30), writing a partial report
//   CHECK_TRACE=1       print timestamps, for finding slow steps
//
// It builds what it needs into a temporary folder, one build per entry of the
// type pack's checks.builds (social casino: pragmatic, fallback, ga) whose
// sections are wanted, and for the deploy checks a build from a changed copy
// of the repository (engine/, types/ and the site) and one with only its
// config changed.
//
// Sections: the engine's (engine/tools/check/sections/*.mjs), the type pack's
// (types/<type>/checks/index.mjs) and the site's own (sites/<slug>/checks.mjs,
// default export async (t) => {}, run last as section "site"). Site fixtures
// (storage prefix, currency words, stage selector, demo and game pages, lobby
// groups) come from sites/<slug>/checks.json, validated against
// engine/tools/checks.schema.json.
//
// Nothing here reaches the internet. The embed host and Google's tag host are
// answered by stubs; a request to any other origin fails a check. Every wait
// is on page state (a data-state, an aria-disabled, a changed result line),
// never a fixed pause. Exits 0 when every check passed, 1 when one failed
// (or the oracle's counts differ, or the run timed out), 2 on a usage error.
import fs from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, renameSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as harness from './lib/harness.mjs';
import * as ui from './check/lib/ui.mjs';
import { stageHelpers } from './check/lib/stage.mjs';

const { roots, section, fail, expect, failures, summary, sectionResults, onSectionEnd, buildSite, serve, cleanTemp, tempDir } = harness;
const t0 = Date.now();
const startedAt = new Date(t0).toISOString();

// ---------- arguments ----------
const USAGE = 'usage: node engine/tools/check.mjs --site <site-dir> [--report FILE] [--shots [DIR]] [--only=<ids>] [--workers N] [--tmp DIR] [--keep] [--oracle-diff FILE] [--list]';
function usage(msg) {
  if (msg) console.error(`error: ${msg}`);
  console.error(USAGE);
  process.exit(2);
}
function parseArgs(argv) {
  const o = { site: null, report: null, shots: null, only: null, workers: null, tmp: null, keep: false, oracle: null, list: false };
  const takes = { site: 'site', report: 'report', only: 'only', workers: 'workers', tmp: 'tmp', 'oracle-diff': 'oracle' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
    if (!m) usage(`unexpected argument ${a}`);
    const [, name, inline] = m;
    if (name in takes) {
      const v = inline ?? argv[++i];
      if (v === undefined || v === '') usage(`--${name} needs a value`);
      o[takes[name]] = v;
    } else if (name === 'shots') {
      if (inline !== undefined) o.shots = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) o.shots = argv[++i];
      else o.shots = true;
    } else if (name === 'keep') o.keep = true;
    else if (name === 'list') o.list = true;
    else if (name === 'help' || name === 'h') usage(null);
    else usage(`unknown option --${name}`);
  }
  return o;
}
const opts = parseArgs(process.argv.slice(2));
if (!opts.site) {
  if (existsSync('site.config.json')) opts.site = '.';
  else usage('--site is required');
}
const SITE = path.resolve(opts.site);
if (!existsSync(path.join(SITE, 'site.config.json')) && !process.env.SITE_CONFIG) usage(`${SITE} has no site.config.json`);
harness.setRoots({ site: SITE, tmp: opts.tmp });
const WORKERS = opts.workers === null ? null : Number(opts.workers);
if (WORKERS !== null && !(Number.isInteger(WORKERS) && WORKERS > 0)) usage('--workers takes a positive whole number');

// ---------- site, pack, fixtures ----------
const cfg = await harness.baseConfig();
const type = cfg.type || 'social-casino';
const packFile = path.join(roots.REPO, 'types', type, 'pack.mjs');
if (!existsSync(packFile)) usage(`no type pack for "${type}" (${path.relative(process.cwd(), packFile)})`);
const pack = (await import(pathToFileURL(packFile))).default;

const checksFile = path.join(SITE, 'checks.json');
const checks = existsSync(checksFile) ? JSON.parse(readFileSync(checksFile, 'utf8')) : {};
const checksValidation = await validateChecks(checks);
if (checksValidation.errors.length) {
  console.error(`${path.relative(process.cwd(), checksFile)} does not match engine/tools/checks.schema.json:`);
  for (const e of checksValidation.errors) console.error(`  ${e}`);
  process.exit(2);
}

/** Validate checks.json with Ajv when the repository has it (D-05); otherwise say the schema was not applied. */
async function validateChecks(data) {
  const schema = JSON.parse(readFileSync(path.join(roots.ENGINE, 'tools/checks.schema.json'), 'utf8'));
  for (const base of [path.join(roots.REPO, 'package.json'), import.meta.url]) {
    try {
      const mod = createRequire(base)('ajv/dist/2020');
      const Ajv = mod.default || mod;
      const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
      return { validator: 'ajv', errors: validate(data) ? [] : validate.errors.map((e) => `${e.instancePath || '(top level)'} ${e.message}`) };
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }
  }
  // Without Ajv: only the top-level keys are checked against the schema's list.
  const known = new Set(Object.keys(schema.properties));
  return { validator: 'top-level-keys', errors: Object.keys(data).filter((k) => !known.has(k)).map((k) => `(top level) unknown property "${k}"`) };
}

const gameOf = (g) => g && { ...g, page: g.page || `/games/${g.slug}/`, sel: g.selector || `[data-game="${g.slug}"]` };
const currency = { ...(cfg.currency || {}), ...(checks.currency || {}) };
const start = Number(cfg.currency?.startingBalance ?? 1000);
const fx = {
  storagePrefix: checks.storagePrefix ?? (cfg.storagePrefix ? `${cfg.storagePrefix}.` : ''),
  currency: { ...currency, start, startText: start.toLocaleString('en-GB') },
  embedLabel: checks.embedLabel || '',
  stageSelector: checks.stageSelector || '[data-stage-root]',
  demoPages: checks.demoPages || [],
  demo: checks.pages?.demo,
  demoAfterReject: checks.pages?.demoAfterReject ?? checks.pages?.demo,
  demoBar: checks.pages?.demoBar ?? checks.pages?.demo,
  safer: checks.pages?.safer,
  offline: {
    landing: checks.pages?.offlineLanding || '/about/',
    unvisited: checks.pages?.offlineUnvisited || '/contact/',
    unvisitedNoDemos: checks.pages?.offlineUnvisitedNoDemos || '/contact/',
  },
  games: Object.fromEntries(Object.entries(checks.games || {}).map(([k, g]) => [k, gameOf(g)])),
  lobby: { page: checks.lobby?.page || '/games/', groups: checks.lobby?.groups || [] },
  extraPages: checks.extraPages || [],
};
harness.setSiteKeys({ embedHost: checks.embedHost || null, storagePrefix: fx.storagePrefix });

// ---------- sections ----------
const ENGINE_ORDER = ['pages', 'first-screen', 'keyboard', 'consent', 'dialogs', 'prefs', 'chrome', 'axe', 'offline', 'deploy'];
const engineSections = [];
for (const f of (await fs.readdir(path.join(roots.ENGINE, 'tools/check/sections'))).filter((f) => f.endsWith('.mjs')).sort()) {
  const mod = (await import(pathToFileURL(path.join(roots.ENGINE, 'tools/check/sections', f)))).default;
  engineSections.push(...[].concat(mod).map((s) => ({ ...s, from: 'engine' })));
}
engineSections.sort((a, b) => ENGINE_ORDER.indexOf(a.id) - ENGINE_ORDER.indexOf(b.id));
const packIndex = path.join(roots.REPO, 'types', type, 'checks/index.mjs');
const packSections = existsSync(packIndex) ? [].concat((await import(pathToFileURL(packIndex))).default).map((s) => ({ ...s, from: `types/${type}` })) : [];
const siteFile = path.join(SITE, 'checks.mjs');
const siteSections = existsSync(siteFile)
  ? [{ id: 'site', title: `Site checks (${roots.slug})`, from: 'site', run: (await import(pathToFileURL(siteFile))).default }]
  : [];

/** The engine's order with each pack section placed after its `after` id (or at the end). */
function ordered() {
  const list = [{ id: 'builds', title: 'Builds', from: 'engine' }, ...engineSections];
  for (const s of packSections) {
    const at = list.findIndex((x) => x.id === s.after);
    list.splice(at < 0 ? list.length : at + 1, 0, s);
  }
  return [...list, ...siteSections];
}
const ALL = ordered();
const seen = new Map();
for (const s of ALL) {
  if (seen.has(s.id)) usage(`section id "${s.id}" is declared twice (${seen.get(s.id)} and ${s.from}); ids are unique across the engine and the packs`);
  seen.set(s.id, s.from);
}
const groupOf = (s) => s.group || s.id;
const IDS = [...new Set(ALL.flatMap((s) => [s.id, groupOf(s)]))];

if (opts.list) {
  for (const s of ALL) console.log(`${s.id.padEnd(14)}${(s.group && s.group !== s.id ? `(${s.group})` : '').padEnd(10)}${s.from.padEnd(22)}${s.title}`);
  process.exit(0);
}

const ONLY = opts.only?.split(',').map((s) => s.trim()).filter(Boolean) || null;
if (ONLY) {
  const unknown = ONLY.filter((id) => !IDS.includes(id));
  if (unknown.length) {
    console.error(`Unknown section in --only: ${unknown.join(', ')}. Choose from: ${IDS.join(', ')}`);
    process.exit(2);
  }
}
const want = (s) => !ONLY || ONLY.includes(s.id) || ONLY.includes(groupOf(s));

// One full run at a time on a 4-CPU container (MASTER-PLAN D-07): with FACTORY_X
// set, a run without --only holds $FACTORY_X/check.lock; a stale lock (its
// process gone) is taken over.
if (process.env.FACTORY_X && !ONLY) {
  const lock = path.join(process.env.FACTORY_X, 'check.lock');
  mkdirSync(process.env.FACTORY_X, { recursive: true });
  const take = () => writeFileSync(lock, JSON.stringify({ pid: process.pid, site: roots.slug, startedAt }), { flag: 'wx' });
  try {
    take();
  } catch {
    let held = null;
    try {
      held = JSON.parse(readFileSync(lock, 'utf8'));
      process.kill(held.pid, 0);
    } catch {
      held = null;
    }
    if (held) {
      console.error(`Another full check is running (pid ${held.pid}, ${held.site}, since ${held.startedAt}); ${lock} holds it. Use --only, or wait.`);
      process.exit(2);
    }
    writeFileSync(lock, JSON.stringify({ pid: process.pid, site: roots.slug, startedAt }));
  }
  process.on('exit', () => {
    try {
      if (JSON.parse(readFileSync(lock, 'utf8')).pid === process.pid) rmSync(lock, { force: true });
    } catch {}
  });
}

const SHOTS = opts.shots === true ? path.join(SITE, 'check-shots') : opts.shots ? path.resolve(opts.shots) : null;
const KEEP = opts.keep;
// CHECK_TRACE=1 prints timestamps, for finding slow steps.
const trace = /^(1|true|yes)$/i.test(process.env.CHECK_TRACE || '') ? (m) => console.log(`    · ${((Date.now() - t0) / 1000).toFixed(1)} s ${m}`) : () => {};

// ---------- the report ----------
const REPORT = opts.report ? path.resolve(opts.report) : null;
const axeFound = [];
const builtVersions = {};
const skipped = [];
let oracleResult = null;

function report(partial) {
  const sections = sectionResults().map(({ id, group, title, passed, failed, seconds, lines, done }) => ({ id, group, title, passed, failed, seconds, done, lines }));
  const { passes } = summary();
  return {
    site: path.relative(roots.REPO, SITE) || SITE,
    slug: roots.slug,
    type,
    pack: { id: pack.id, version: pack.version },
    startedAt,
    durationMs: Date.now() - t0,
    partial,
    only: ONLY,
    checksJson: existsSync(checksFile) ? { file: path.relative(roots.REPO, checksFile), validator: checksValidation.validator } : null,
    totals: { passed: passes, failed: failures.length, skipped: skipped.length },
    durations: Object.fromEntries(sections.map((s) => [s.id, s.seconds])),
    sections,
    skipped,
    failures: failures.map((f) => ({ section: f.section, text: f.text })),
    axe: axeFound,
    builds: builtVersions,
    ...(oracleResult ? { oracle: oracleResult } : {}),
  };
}
function writeReport(partial) {
  if (!REPORT) return;
  mkdirSync(path.dirname(REPORT), { recursive: true });
  // Written whole, then renamed, so a reader never sees half a file.
  writeFileSync(`${REPORT}.tmp`, `${JSON.stringify(report(partial), null, 2)}\n`);
  renameSync(`${REPORT}.tmp`, REPORT);
}
onSectionEnd(() => writeReport(true));

// A run that stops making progress fails rather than hanging CI or a terminal.
const LIMIT_MIN = Number(process.env.CHECK_TIMEOUT_MIN || 30);
const stop = (why) => {
  console.log(`\n${why} ${failures.length} check(s) had failed by then.`);
  writeReport(true);
  if (REPORT) console.log(`Partial report: ${path.relative(process.cwd(), REPORT)}`);
  process.exit(1);
};
setTimeout(() => stop(`Stopped after ${LIMIT_MIN} minutes (CHECK_TIMEOUT_MIN).`), LIMIT_MIN * 60000).unref();
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => stop(`Stopped by ${sig}.`));

// ---------- builds ----------
const packBuilds = pack.checks?.builds || {};
const runnable = ALL.filter((s) => s.id !== 'builds');
const wanted = runnable.filter(want);
const builds = {};
await section('builds', 'Builds', async () => {
  for (const [name, { edit = (c) => c, sections = [] }] of Object.entries(packBuilds)) {
    if (!wanted.some((s) => sections.includes(groupOf(s)))) continue;
    const b = await buildSite(name, edit);
    b.edit = edit;
    b.sections = sections;
    expect(b.ok, `${name} build ends with "Lint: no problems found."`, b.output.split('\n').filter((l) => /^error/.test(l)).slice(0, 12).join(' | ') || b.output.slice(-600));
    builtVersions[name] = b.version || null;
    try {
      await fs.access(path.join(b.dir, 'index.html'));
      Object.assign(b, await serve(b.dir));
      builds[name] = b;
    } catch {
      fail(`${name} build wrote no pages; its checks are skipped`);
    }
  }
});

const { chromium } = await import('playwright');
const browser = await chromium.launch();
if (SHOTS) await fs.mkdir(SHOTS, { recursive: true });

const stage = stageHelpers(fx.stageSelector);
const t = {
  browser,
  builds,
  /** The builds a visitor gets (those the pages section covers): social casino's pragmatic and fallback. */
  modes: Object.values(builds).filter((b) => b.sections.includes('pages')),
  /** The builds that feed a section group. */
  buildsFor: (group) => Object.values(builds).filter((b) => b.sections.includes(group)),
  /**
   * The builds by role, for engine sections (which never name a pack's builds):
   * primary = the first build the pages group covers (social casino: pragmatic),
   * alt = the second (fallback, the embeds off), analytics = the first build
   * that feeds consent (ga, a test GA4 ID).
   */
  roles: {},
  fx,
  checks,
  cfg,
  pack,
  site: { dir: SITE, slug: roots.slug, type },
  shots: SHOTS,
  trace,
  workers: (n) => WORKERS ?? n,
  axe: axeFound,
  harness: { ...harness, ...ui, ...stage, roots },
};
t.roles = { primary: t.modes[0], alt: t.modes[1], analytics: t.buildsFor('consent')[0] };

for (const s of runnable) {
  if (!want(s)) continue;
  const fed = t.buildsFor(groupOf(s));
  if (s.from !== 'site' && !fed.length) {
    skipped.push({ id: s.id, title: s.title, reason: 'no build feeds this section' });
    console.log(`\n${s.title}\n  (skipped: no build feeds it)`);
    continue;
  }
  await section(s.id, s.title, () => s.run(t, t.harness), { group: groupOf(s) });
}
for (const s of runnable) if (!want(s)) skipped.push({ id: s.id, title: s.title, reason: 'not in --only' });

// ---------- end ----------
await browser.close();
for (const b of Object.values(builds)) await b.close?.();
if (KEEP) console.log(`\nBuilds kept in ${await tempDir()}`);
else await cleanTemp();

let oracleFailed = false;
if (opts.oracle) {
  oracleResult = oracleDiff(path.resolve(opts.oracle));
  oracleFailed = !oracleResult.ok;
}

const { passes } = summary();
console.log(`\n${passes} passed, ${failures.length} failed in ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
console.log(failures.length ? `${failures.length} check(s) failed.` : 'All checks passed.');
writeReport(false);
if (REPORT) console.log(`Report: ${path.relative(process.cwd(), REPORT)}`);
process.exit(failures.length || oracleFailed ? 1 : 0);

/**
 * Compare this run with a recorded one. The oracle is either
 *   { checks: [{ section, name }], passed }           (names by section title), or
 *   { sections: [{ title, passed }], total }           (counts only, MASTER-PLAN D-07).
 * Only the sections this run ran are compared (--only). Asset-version hashes
 * inside names (v0123abcd45) are ignored. A per-section pass count that
 * differs fails the run; differing names are listed.
 */
function oracleDiff(file) {
  const o = JSON.parse(readFileSync(file, 'utf8'));
  const norm = (s) => s.replace(/\bv[0-9a-f]{6,}\b/g, 'v<hash>');
  const ran = sectionResults();
  const ranTitles = new Set(ran.map((s) => s.title));
  const expected = new Map(); // title → { passed, names[] }
  if (Array.isArray(o.checks)) for (const c of o.checks) {
    if (!expected.has(c.section)) expected.set(c.section, { passed: 0, names: [] });
    expected.get(c.section).passed++;
    expected.get(c.section).names.push(norm(c.name));
  }
  else for (const s of o.sections || []) expected.set(s.title, { passed: s.passed, names: null });
  const counts = [];
  const notRun = [];
  for (const [title, e] of expected) {
    const r = ran.find((s) => s.title === title);
    if (!r) {
      notRun.push(title);
      continue;
    }
    // With --only, the builds section builds only what the chosen sections need: compared as a subset.
    if (r.passed !== e.passed && !(ONLY && r.id === 'builds')) counts.push({ title, id: r.id, expected: e.passed, passed: r.passed });
  }
  const unknownSections = ran.filter((s) => !expected.has(s.title)).map((s) => s.title);
  const missing = [];
  const extra = [];
  for (const [title, e] of expected) {
    if (!e.names || !ranTitles.has(title)) continue;
    const got = ran.find((s) => s.title === title).lines.filter((l) => l.ok).map((l) => norm(l.text));
    const left = [...got];
    const subset = ONLY && ran.find((s) => s.title === title).id === 'builds';
    for (const n of e.names) {
      const i = left.indexOf(n);
      if (i >= 0) left.splice(i, 1);
      else if (!subset) missing.push({ section: title, name: n });
    }
    for (const n of left) extra.push({ section: title, name: n });
  }
  const full = !ONLY;
  const totalExpected = Array.isArray(o.checks) ? o.checks.length : o.total;
  const ok = !counts.length && !unknownSections.length && (!full || (!notRun.length && summary().passes === totalExpected));
  console.log(`\nOracle ${path.relative(process.cwd(), file)}: ${ok ? 'same per-section pass counts' : 'differs'}${full ? ` (${summary().passes} of ${totalExpected} passed)` : ` (${ran.length} sections compared)`}.`);
  for (const c of counts) console.log(`  count: "${c.title}": ${c.passed} passed, oracle ${c.expected}`);
  for (const s of unknownSections) console.log(`  section not in the oracle: "${s}"`);
  if (full) for (const s of notRun) console.log(`  oracle section not run: "${s}"`);
  for (const m of missing) console.log(`  missing: [${m.section.slice(0, 40)}] ${m.name}`);
  for (const x of extra) console.log(`  extra:   [${x.section.slice(0, 40)}] ${x.name}`);
  if (!missing.length && !extra.length && Array.isArray(o.checks)) console.log('  every check name matches.');
  return { file: path.relative(roots.REPO, file), ok, counts, unknownSections, notRun: full ? notRun : [], missing, extra, expectedTotal: totalExpected };
}
