#!/usr/bin/env node
// The mechanical scaled-content gate (SPEC 15.4, MASTER-PLAN D-33): a site or a
// direction must not be "one product with swapped names" of a sibling of its type.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, runMain, UsageError, repoRoot, exists, isDir, readJson, readJsonIf, writeJson, git, isMain } from './lib/common.mjs';
import { siteInfo, listSites, buildSite, removeTemp, lightFingerprint, distFingerprint, fromOrderLike, DEFAULT_TYPE } from './lib/sites.mjs';
import { paletteDistance, hueDiff } from './lib/color.mjs';
import { jaccard, shingles, minhashJaccard, words } from './lib/text.mjs';
import { validateFile } from './lib/jsonschema.mjs';
import { pragmaticCatalog } from './lib/order.mjs';

const HELP = `Usage:
  node tools/uniqueness.mjs --pre <direction.json|order.json> [--against registry|all] [--fail] [--json] [--out FILE]
  node tools/uniqueness.mjs --post <site-dir> [--dist DIR] [--against registry|all] [--fail] [--json] [--out FILE]

--pre   checks a concept direction (schemas/direction.schema.json) or an order
        against every sibling of the same type before anything is generated:
        soft family rule (family AND two of era/place/craft), vocabulary overlap
        <= 1 term, palette mean nearest-neighbour OKLab distance >= 0.12 (0.16
        same family) and primary/accent hue >= 40 deg, (display, body) pair
        unused, display font reuse only when forcing degraded, body font used at
        most twice, no game name/slug collision (siblings, Pragmatic catalogue,
        known studio titles), structure tuple unused, Pragmatic subset Jaccard
        <= 0.5, hero H1/tagline 5-gram overlap 0, roster rule (warning).
--post  builds the site (engine/build.mjs, or the legacy engine before the
        move; --dist uses a built tree) and every sibling of its type under
        sites/ (not sites/_fixtures, not itself), then compares visible text per
        page type (8-word shingles; Jaccard <= 0.25, 0.20 same family; site <=
        0.15), headings/buttons 5-grams <= 0.2, FAQ sets (>= 2 differ, no shared
        answer), route-set hash, home structure + nav, fonts, game names, brand,
        palette (role palettes only; token palettes are advisory), default
        content/generic covers. Other types: copy only (factory.cross-site-similarity).

Siblings: --against all (default; Phase 1) reads sites/*/ on disk; --against
registry reads origin/registry:portfolio/registry.json signatures (MinHash) and
falls back to all, with a warning, while the registry branch does not exist.
Concept fields of sites without order.json/concept.json come from
tools/data/known-fingerprints.json. Thresholds: schemas/board.schema.json
thresholds.uniqueness[type] when present, else the defaults above.

Options:
  --fail          exit 1 when any failure is found (otherwise exit 0)
  --json          print the report JSON (SPEC 15.4 uniqueness.json shape)
  --out FILE      also write the report to FILE
  --sites DIR     sibling root (default <repo>/sites)
  --keep          keep the temporary builds and print where they are
  --help          this text
Exit codes: 0 passed (or failures without --fail), 1 failed with --fail, 2 tool error.
`;

export const DEFAULTS = {
  copyPage: 0.25, copyPageSameFamily: 0.2, copySite: 0.15, headings: 0.2, faqMinDiff: 2,
  paletteMin: 0.12, paletteMinSameFamily: 0.16, hueMin: 40, pragmaticJaccard: 0.5, vocabularyOverlapMax: 1,
  crossTypeSite: 0.15, bodyFontMaxUses: 2,
};

/** Thresholds from schemas/board.schema.json thresholds.uniqueness[type] (G) merged over the defaults. */
export function thresholdsFor(type, root = repoRoot()) {
  const out = { ...DEFAULTS, source: 'defaults' };
  const board = readJsonIf(path.join(root, 'schemas', 'board.schema.json'));
  if (!board) return out;
  let found = null;
  const rec = (n, parentKey, depth) => {
    if (found || !n || typeof n !== 'object' || depth > 12) return;
    if (parentKey === 'thresholds' && n.uniqueness && typeof n.uniqueness === 'object') { found = n.uniqueness; return; }
    for (const [k, v] of Object.entries(n)) rec(v, k, depth + 1);
  };
  rec(board, '', 0);
  if (!found) return out;
  let t = found.default !== undefined && typeof found.default === 'object' ? found.default : found;
  if (found[type] && typeof found[type] === 'object') t = found[type].default && typeof found[type].default === 'object' ? found[type].default : found[type];
  if (t.properties && typeof t.properties === 'object') t = Object.fromEntries(Object.entries(t.properties).map(([k, v]) => [k, v && (v.default ?? v.const)]));
  const alias = { copy: 'copyPage', pageJaccard: 'copyPage', copyJaccard: 'copyPage', site: 'copySite', siteJaccard: 'copySite', palette: 'paletteMin', paletteDistance: 'paletteMin', hue: 'hueMin' };
  for (const [k, v] of Object.entries(t)) if (typeof v === 'number') { out[alias[k] || k] = v; out.source = 'schemas/board.schema.json'; }
  return out;
}

const norm = (s) => String(s || '').trim().toLowerCase();
const fontPair = (f) => (f ? `${norm(f.display)}|${norm(f.body)}` : null);

function familyRule(a, b) {
  if (!a.family || !b.family || a.family !== b.family) return { shared: false, fail: false };
  const same = ['era', 'place', 'craft'].filter((k) => a[k] && b[k] && norm(a[k]) === norm(b[k])).length;
  return { shared: true, fail: same >= 2, same };
}

function paletteCheck(a, b, th, sameFamily, fail, warn, sib, scores) {
  if (!a.palette || !b.palette || !a.palette.length || !b.palette.length) return;
  const d = paletteDistance(a.palette.map((c) => c.lab), b.palette.map((c) => c.lab));
  scores.palette[sib] = round(d);
  const min = sameFamily ? th.paletteMinSameFamily : th.paletteMin;
  const bothRoles = a.paletteFrom === 'roles' && b.paletteFrom === 'roles';
  if (d < min) (bothRoles ? fail : warn)({ dimension: 'palette', sibling: sib, value: round(d), threshold: min, note: bothRoles ? undefined : 'token palette (no roles): advisory' });
  if (bothRoles) {
    for (const role of ['primary', 'accent']) {
      const x = a.palette.find((c) => c.role === role); const y = b.palette.find((c) => c.role === role);
      if (x && y && x.h !== undefined && y.h !== undefined) {
        const hd = hueDiff(x.h, y.h);
        if (hd < th.hueMin) fail({ dimension: `palette:${role}-hue`, sibling: sib, value: round(hd), threshold: th.hueMin });
      }
    }
  }
}

function gameCollisions(names, slugs, sib, sibGames) {
  const out = [];
  const sn = new Set((sibGames || []).map((g) => norm(g.name || g)));
  const ss = new Set((sibGames || []).map((g) => norm(g.slug)).filter(Boolean));
  for (const n of names) if (n && sn.has(norm(n))) out.push({ name: n, with: sib });
  for (const s of slugs) if (s && ss.has(norm(s))) out.push({ slug: s, with: sib });
  return out;
}

function knownTitles(root) {
  const out = new Set();
  const cat = pragmaticCatalog(root);
  if (cat) for (const g of cat.games.values()) if (g.name) out.add(norm(g.name));
  for (const rel of ['types/social-casino/data/known-studio-titles.json', 'engine/data/known-studio-titles.json']) {
    const d = readJsonIf(path.join(root, rel));
    if (!d) continue;
    const list = Array.isArray(d) ? d : d.titles || d.games || [];
    for (const t of list) out.add(norm(typeof t === 'string' ? t : t.name));
  }
  return out;
}

/** Registry entries (origin/registry) or null when the branch is not there. */
function registryEntries(root) {
  const txt = git(['show', 'origin/registry:portfolio/registry.json'], { cwd: root });
  if (!txt) return null;
  try { return JSON.parse(txt).entries || []; } catch { return null; }
}

function emptyReport(slug, type, mode, against) {
  return { slug, type, mode, at: new Date().toISOString(), against, nearest: [], inFlightCompared: [], familyRule: 'unique',
    scores: { copy: {}, site: {}, legalVariables: 'not-checked', headings: {}, faq: {}, palette: {}, fonts: {}, names: [], structure: {}, roster: {}, crossType: {} },
    failures: [], warnings: [], compared: [], passed: true };
}
const round = (x) => (x == null ? x : Math.round(x * 1000) / 1000);

// ---------------------------------------------------------------- --pre
export function pre(input, { root = repoRoot(), sitesDir, against = 'all' } = {}) {
  const obj = readJson(input);
  const isOrder = obj.schemaVersion !== undefined && obj.orderId !== undefined && !obj.forcing;
  const subj = { ...fromOrderLike(obj), slug: obj.orderId || path.basename(input, '.json') };
  subj.type = obj.type || DEFAULT_TYPE;
  subj.paletteFrom = 'roles';
  const forcing = obj.forcing || {};
  const report = emptyReport(subj.slug, subj.type, 'pre', against);
  const th = thresholdsFor(subj.type, root);
  report.thresholds = th;
  const fail = (f) => report.failures.push(f);
  const warn = (w) => report.warnings.push(w);
  if (!isOrder) {
    const errs = validateFile(obj, path.join(root, 'schemas', 'direction.schema.json'));
    for (const e of errs.slice(0, 10)) warn({ dimension: 'schema', sibling: null, value: `${e.path || '(root)'} ${e.message}`, threshold: null });
  }
  let siblings = siblingsLight(root, sitesDir, against, report).filter((s) => s.slug !== subj.slug && s.engine !== undefined);
  const sameType = siblings.filter((s) => (s.type || DEFAULT_TYPE) === subj.type);
  report.compared = sameType.map((s) => s.slug);
  const titles = knownTitles(root);
  const names = (subj.games || []).map((g) => g.name); const slugs = (subj.games || []).map((g) => g.slug);
  for (const n of names) if (titles.has(norm(n))) fail({ dimension: 'names', sibling: 'known-titles', value: n, threshold: 'no collision' });
  const bodyUses = sameType.filter((s) => s.fonts && norm(s.fonts.body) === norm(subj.fonts && subj.fonts.body)).length;
  if (subj.fonts && bodyUses >= th.bodyFontMaxUses) fail({ dimension: 'fonts:body', sibling: null, value: bodyUses, threshold: th.bodyFontMaxUses });
  const shared = [];
  for (const s of sameType) {
    const fr = familyRule(subj, s);
    if (fr.fail) fail({ dimension: 'family', sibling: s.slug, value: `${subj.family} + ${fr.same} of era/place/craft`, threshold: 'family and < 2 of era/place/craft' });
    else if (fr.shared) shared.push(s.slug);
    const vo = (subj.vocabulary || []).filter((v) => (s.vocabulary || []).some((w) => norm(w) === norm(v)));
    report.scores.structure[s.slug] = { vocabularyOverlap: vo };
    if (vo.length > th.vocabularyOverlapMax) fail({ dimension: 'vocabulary', sibling: s.slug, value: vo.length, threshold: th.vocabularyOverlapMax });
    paletteCheck(subj, s, th, fr.shared, fail, warn, s.slug, report.scores);
    if (subj.fonts && s.fonts) {
      report.scores.fonts[s.slug] = { display: norm(subj.fonts.display) === norm(s.fonts.display), body: norm(subj.fonts.body) === norm(s.fonts.body) };
      if (fontPair(subj.fonts) === fontPair(s.fonts)) fail({ dimension: 'fonts:pair', sibling: s.slug, value: fontPair(subj.fonts), threshold: 'unused pair' });
      else if (norm(subj.fonts.display) === norm(s.fonts.display)) {
        if (/degrad|reuse/i.test(forcing.reason || '')) warn({ dimension: 'fonts:display', sibling: s.slug, value: subj.fonts.display, threshold: 'reuse allowed (forcing degraded)' });
        else fail({ dimension: 'fonts:display', sibling: s.slug, value: subj.fonts.display, threshold: 'unused display font' });
      }
    }
    const coll = gameCollisions(names, slugs, s.slug, s.games);
    report.scores.names.push(...coll);
    for (const c of coll) fail({ dimension: 'names', sibling: s.slug, value: c.name || c.slug, threshold: 'no collision' });
    if (subj.brand && s.brand && norm(subj.brand) === norm(s.brand)) fail({ dimension: 'names:brand', sibling: s.slug, value: subj.brand, threshold: 'no collision' });
    const st = subj.structureTuple; const ss = s.structureTuple;
    if (st && ss && st.heroStyle && st.heroStyle === ss.heroStyle && st.lobbyLayout === ss.lobbyLayout && st.gamePageLayout === ss.gamePageLayout && JSON.stringify(st.homeSections) === JSON.stringify(ss.homeSections))
      fail({ dimension: 'structure', sibling: s.slug, value: 'identical structure tuple', threshold: 'unused tuple' });
    if (subj.pragmatic && s.pragmatic && subj.pragmatic.length && s.pragmatic.length) {
      const j = jaccard(new Set(subj.pragmatic), new Set(s.pragmatic));
      report.scores.roster[s.slug] = round(j);
      if (j > th.pragmaticJaccard) fail({ dimension: 'roster:pragmatic', sibling: s.slug, value: round(j), threshold: th.pragmaticJaccard });
    }
    for (const k of ['heroH1', 'tagline']) {
      if (subj[k] && s[k]) {
        const j = jaccard(shingles(subj[k], 5), shingles(s[k], 5));
        if (j > 0) fail({ dimension: `copy:${k}`, sibling: s.slug, value: round(j), threshold: 0 });
      }
    }
  }
  report.familyRule = shared.length ? `shared:${shared[0]}` : 'unique';
  // roster rule: every third factory site needs an engine beyond the base three (warning until dice/hi-lo exist)
  const base = new Set(['reel-slot', 'european-roulette', 'roulette', 'blackjack']);
  const factoryCount = sameType.filter((s) => s.engine !== 'none').length + 1;
  if (subj.type === 'social-casino' && factoryCount % 3 === 0 && !(subj.games || []).some((g) => !base.has(g.engine))) {
    const enginesExist = exists(path.join(root, 'engine', 'games', 'dice')) && exists(path.join(root, 'engine', 'games', 'hi-lo'));
    (enginesExist ? fail : warn)({ dimension: 'roster-rule', sibling: null, value: `site #${factoryCount} uses only the base engines`, threshold: 'one engine beyond reel-slot, roulette, blackjack' });
  }
  if (forcing.mustAddEngine && !(subj.games || []).some((g) => !base.has(g.engine))) warn({ dimension: 'roster-rule', sibling: null, value: 'forcing.mustAddEngine is set', threshold: 'add an engine' });
  report.nearest = sameType.map((s) => [s.slug, report.scores.palette[s.slug] ?? 1]).sort((x, y) => x[1] - y[1]).slice(0, 2).map((x) => x[0]);
  report.passed = report.failures.length === 0;
  return report;
}

function siblingsLight(root, sitesDir, against, report) {
  if (against === 'registry') {
    const entries = registryEntries(root);
    if (entries) {
      report.against = 'registry';
      return entries.filter((e) => ['reserved', 'approved', 'review', 'live'].includes(e.status)).map((e) => ({
        ...e, fonts: e.fonts, games: e.games, palette: (e.palette || []).map((c) => ({ role: c.role, lab: [c.oklch.l, c.oklch.c * Math.cos(c.oklch.h * Math.PI / 180), c.oklch.c * Math.sin(c.oklch.h * Math.PI / 180)], h: c.oklch.h })), paletteFrom: 'roles',
      }));
    }
    report.warnings.push({ dimension: 'against', sibling: null, value: 'origin/registry not available', threshold: 'falls back to sites/* on disk' });
    report.against = 'all (registry unavailable)';
  }
  return listSites(root, sitesDir).map((s) => lightFingerprint(s, root));
}

// ---------------------------------------------------------------- --post
export function post(siteDir, { root = repoRoot(), sitesDir, dist = null, against = 'all', keep = false, log = () => {} } = {}) {
  const site = siteInfo(siteDir, root);
  if (!exists(path.join(site.dir, 'site.config.json')) && !site.legacy && site.engine !== 'none') throw new Error(`${siteDir}: not a site directory (no site.config.json)`);
  const report = emptyReport(site.slug, site.type, 'post', against);
  const th = thresholdsFor(site.type, root);
  report.thresholds = th;
  const fail = (f) => report.failures.push(f);
  const warn = (w) => report.warnings.push(w);
  const builds = [];
  try {
    let subjectBuild = null;
    if (dist) subjectBuild = { dist: path.resolve(dist), method: 'given', json: null, temp: false };
    else { log(`building ${site.rel || site.slug}`); subjectBuild = buildSite(site, { root }); builds.push(subjectBuild); }
    report.build = { method: subjectBuild.method, status: subjectBuild.status ?? null };
    const subj = distFingerprint(site, subjectBuild.dist, root);
    // by construction: default content or generic covers are an automatic failure
    const bj = subjectBuild.json;
    if (bj) {
      const rules = [...(bj.warnings || []), ...(bj.problems || [])].map((w) => (typeof w === 'string' ? w : w.rule || ''));
      for (const r of ['default-content', 'generic-cover', 'engine.default-content', 'engine.generic-cover']) if (rules.includes(r)) fail({ dimension: 'by-construction', sibling: null, value: r, threshold: 'none' });
    }
    let siblings;
    if (against === 'registry') {
      const entries = registryEntries(root);
      if (entries) {
        report.against = 'registry';
        siblings = entries.filter((e) => e.slug !== site.slug && ['reserved', 'approved', 'review', 'live'].includes(e.status)).map((e) => ({ ...e, registry: true }));
        report.inFlightCompared = siblings.filter((e) => e.status === 'review').map((e) => e.slug);
      } else {
        warn({ dimension: 'against', sibling: null, value: 'origin/registry not available', threshold: 'falls back to sites/* on disk' });
        report.against = 'all (registry unavailable)';
      }
    }
    if (!siblings) {
      siblings = [];
      for (const s of listSites(root, sitesDir)) {
        if (s.dir === site.dir || s.slug === site.slug) continue;
        log(`building sibling ${s.rel || s.slug}`);
        const b = buildSite(s, { root });
        builds.push(b);
        siblings.push({ ...distFingerprint(s, b.dist, root), dist: b.dist });
      }
    }
    const subjNames = [...new Set([...(subj.houseNames || []), ...((subj.games || []).map((g) => g.name))])];
    const subjSlugs = (subj.games || []).map((g) => g.slug);
    const shared = [];
    const worst = [];
    for (const s of siblings) {
      const sameType = (s.type || DEFAULT_TYPE) === subj.type;
      if (!sameType) {
        // across types only the mechanical copy check (factory.cross-site-similarity)
        const j = s.siteShingles ? jaccard(subj.siteShingles, s.siteShingles) : null;
        report.scores.crossType[s.slug] = round(j);
        if (j != null && j > th.crossTypeSite) fail({ dimension: 'factory.cross-site-similarity', sibling: s.slug, value: round(j), threshold: th.crossTypeSite });
        continue;
      }
      report.compared.push(s.slug);
      const fr = familyRule(subj, s);
      if (fr.fail) fail({ dimension: 'family', sibling: s.slug, value: `${subj.family} + ${fr.same} of era/place/craft`, threshold: 'family and < 2 of era/place/craft' });
      if (fr.shared) shared.push(s.slug);
      const pageMax = fr.shared ? th.copyPageSameFamily : th.copyPage;
      let maxJ = 0;
      for (const [pt, set] of Object.entries(subj.shingles)) {
        let j = null;
        if (s.shingles && s.shingles[pt]) j = jaccard(set, s.shingles[pt]);
        else if (s.copyMinHash && s.copyMinHash[pt]) j = minhashJaccard(subj.copyMinHash[pt], s.copyMinHash[pt]);
        if (j == null) continue;
        report.scores.copy[pt] = report.scores.copy[pt] || {};
        report.scores.copy[pt][s.slug] = round(j);
        maxJ = Math.max(maxJ, j);
        if (j > pageMax) fail({ dimension: `copy:${pt}`, sibling: s.slug, value: round(j), threshold: pageMax });
      }
      if (s.siteShingles) {
        const j = jaccard(subj.siteShingles, s.siteShingles);
        report.scores.site[s.slug] = round(j);
        if (j > th.copySite) fail({ dimension: 'copy:site', sibling: s.slug, value: round(j), threshold: th.copySite });
      }
      if (s.headingShingles) {
        const j = jaccard(subj.headingShingles, s.headingShingles);
        report.scores.headings[s.slug] = round(j);
        if (j > th.headings) fail({ dimension: 'headings', sibling: s.slug, value: round(j), threshold: th.headings });
      }
      if (subj.faq && subj.faq.length && s.faq && s.faq.length) {
        const qa = new Set(subj.faq.map((f) => words(f.q).join(' '))); const qb = new Set(s.faq.map((f) => words(f.q).join(' ')));
        const diff = [...qa].filter((q) => !qb.has(q)).length;
        const answersB = new Set(s.faq.map((f) => words(f.a).join(' ')).filter(Boolean));
        const sameAnswers = subj.faq.filter((f) => answersB.has(words(f.a).join(' '))).length;
        report.scores.faq[s.slug] = { differ: diff, identicalAnswers: sameAnswers };
        if (diff < th.faqMinDiff) fail({ dimension: 'faq', sibling: s.slug, value: diff, threshold: th.faqMinDiff });
        if (sameAnswers) fail({ dimension: 'faq:answers', sibling: s.slug, value: sameAnswers, threshold: 0 });
      }
      if (s.routeSetHash && subj.routeSetHash === s.routeSetHash) fail({ dimension: 'structure:routes', sibling: s.slug, value: 'identical route set', threshold: 'differs' });
      if (subj.structure && s.structure) {
        const sameSections = subj.structure.homeSections.length > 0 && JSON.stringify(subj.structure.homeSections) === JSON.stringify(s.structure.homeSections);
        const sameNav = subj.structure.navLabels.length > 0 && JSON.stringify(subj.structure.navLabels.map(norm)) === JSON.stringify(s.structure.navLabels.map(norm));
        report.scores.structure[s.slug] = { homeSections: sameSections, navLabels: sameNav };
        if (sameSections && sameNav) fail({ dimension: 'structure', sibling: s.slug, value: 'same home sections and navigation', threshold: 'differs' });
      }
      const fa = subj.cssFonts || []; const fb = s.cssFonts || [];
      if (fa.length && fb.length) {
        const pa = fa.slice(0, 2).map(norm).sort().join('|'); const pb = fb.slice(0, 2).map(norm).sort().join('|');
        report.scores.fonts[s.slug] = { pair: pa === pb, shared: fa.filter((f) => fb.map(norm).includes(norm(f))) };
        if (pa === pb) fail({ dimension: 'fonts', sibling: s.slug, value: fa.slice(0, 2).join(' + '), threshold: 'unused pair' });
      } else if (subj.fonts && s.fonts && fontPair(subj.fonts) === fontPair(s.fonts)) fail({ dimension: 'fonts', sibling: s.slug, value: fontPair(subj.fonts), threshold: 'unused pair' });
      const sibGames = [...(s.games || []), ...((s.houseNames || []).map((n) => ({ name: n })))];
      const coll = gameCollisions(subjNames, subjSlugs, s.slug, sibGames);
      report.scores.names.push(...coll);
      for (const c of coll) fail({ dimension: 'names', sibling: s.slug, value: c.name || c.slug, threshold: 'no collision' });
      if (subj.brand && s.brand && norm(subj.brand) === norm(s.brand)) fail({ dimension: 'names:brand', sibling: s.slug, value: subj.brand, threshold: 'no collision' });
      paletteCheck(subj, s, th, fr.shared, fail, warn, s.slug, report.scores);
      const opA = subj.operator || (site.config && site.config.operator && (site.config.operator.name || site.config.operator.companyName));
      const opB = s.operator || (s.registry ? s.operator : null);
      if (opA && opB) report.scores.legalVariables = norm(opA) === norm(opB) && !/\[/.test(opA) ? `shared:${s.slug}` : 'distinct';
      worst.push([s.slug, maxJ, report.scores.palette[s.slug] ?? 1]);
    }
    report.familyRule = shared.length ? `shared:${shared[0]}` : 'unique';
    report.nearest = worst.sort((x, y) => y[1] - x[1] || x[2] - y[2]).slice(0, 2).map((x) => x[0]);
    report.passed = report.failures.length === 0;
    if (keep) report.builds = builds.map((b) => b.dist);
    return report;
  } finally {
    if (!keep) for (const b of builds) removeTemp(b);
  }
}

async function main(argv) {
  const a = parseArgs(argv, { booleans: ['fail', 'json', 'keep', 'help'], strings: ['pre', 'post', 'against', 'dist', 'out', 'sites'] });
  if (a.help) { process.stdout.write(HELP); return 0; }
  const root = repoRoot();
  const against = a.against || 'all';
  if (!['all', 'registry'].includes(against)) throw new UsageError('--against must be all or registry');
  if (!!a.pre === !!a.post) throw new UsageError('give exactly one of --pre <file> or --post <site-dir>');
  const sitesDir = a.sites ? path.resolve(a.sites) : path.join(root, 'sites');
  let report;
  try {
    if (a.pre) {
      if (!exists(a.pre)) throw new UsageError(`${a.pre}: no such file`);
      report = pre(a.pre, { root, sitesDir, against });
    } else {
      if (!isDir(a.post)) throw new UsageError(`${a.post}: no such directory`);
      report = post(a.post, { root, sitesDir, dist: a.dist, against, keep: a.keep, log: (m) => { if (!a.json) process.stderr.write(`uniqueness: ${m}\n`); } });
    }
  } catch (e) {
    if (e instanceof UsageError) throw e;
    process.stderr.write(`uniqueness: error: ${e.message}\n`);
    return 2;
  }
  if (a.out) writeJson(path.resolve(a.out), report);
  if (a.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write(`uniqueness ${report.mode} ${report.slug} (${report.type}) against ${report.against}: compared ${report.compared.join(', ') || 'nothing'}; ${report.passed ? 'PASSED' : `FAILED (${report.failures.length})`}\n`);
    for (const f of report.failures) process.stdout.write(`  fail  ${f.dimension}${f.sibling ? ` vs ${f.sibling}` : ''}: ${f.value} (threshold ${f.threshold})\n`);
    for (const w of report.warnings) process.stdout.write(`  warn  ${w.dimension}${w.sibling ? ` vs ${w.sibling}` : ''}: ${w.value}${w.note ? ` [${w.note}]` : ''}\n`);
    if (report.builds) process.stdout.write(`  builds kept: ${report.builds.join(', ')}\n`);
  }
  return a.fail && !report.passed ? 1 : 0;
}

if (isMain(import.meta.url)) runMain(main, HELP);
