// Site discovery, building and fingerprints shared by uniqueness.mjs, engine-hashes.mjs,
// status.mjs, board.mjs and order-to-config.mjs.
//
// Layouts understood:
//   factory   sites/<slug>/site.config.json (+ theme/, data/, public/), built by
//             node engine/build.mjs <site-dir> --out DIR --json
//   legacy    a directory holding build.mjs + src/ (today's opalquestlounge/), or a
//             factory-layout site built with the legacy engine (opalquestlounge/build.mjs
//             with SITE_CONFIG/OUT_DIR) while engine/build.mjs does not exist yet
//   static    { "engine": "none" } sites (pixelcrownclub): the directory is the dist

import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot, exists, isDir, readJsonIf, walk, readText, TOOLS_DIR } from './common.mjs';
import { hexToOklab, oklchToOklab, cssColourTokens } from './color.mjs';
import * as T from './text.mjs';

export const DEFAULT_TYPE = 'social-casino';

/** Read what a site directory is. */
export function siteInfo(dir, root = repoRoot()) {
  const abs = path.resolve(dir);
  const slug = path.basename(abs);
  const config = readJsonIf(path.join(abs, 'site.config.json'));
  const legacy = exists(path.join(abs, 'build.mjs')) && isDir(path.join(abs, 'src'));
  const engine = (config && config.engine === 'none') || (!config && !legacy && exists(path.join(abs, 'index.html'))) ? 'none' : 'factory';
  const type = (config && config.type) || DEFAULT_TYPE;
  const rel = path.relative(root, abs);
  return { slug, dir: abs, rel, config, legacy, engine, type, typeDefaulted: !(config && config.type), fixture: rel.split(path.sep).includes('_fixtures') };
}

/** Factory sites on disk: sites/<slug>/ (no "_" or "." prefix), plus legacy dirs passed explicitly. */
export function listSites(root = repoRoot(), sitesDir = path.join(root, 'sites')) {
  if (!isDir(sitesDir)) return [];
  return fs.readdirSync(sitesDir, { withFileTypes: true })
    .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .map((e) => path.join(sitesDir, e.name))
    .filter((d) => isDir(d) && (exists(path.join(d, 'site.config.json')) || exists(path.join(d, 'index.html')) || exists(path.join(d, 'build.mjs'))))
    .map((d) => siteInfo(d, root));
}

/** Build a site into a fresh temporary directory. Returns { dist, method, json, status, stderr, temp }. */
export function buildSite(site, { root = repoRoot(), outDir = null, flags = [] } = {}) {
  if (site.engine === 'none') return { dist: site.dir, method: 'static', json: null, status: 0, temp: false };
  const out = outDir || fs.mkdtempSync(path.join(os.tmpdir(), `factory-${site.slug}-`));
  const engineBuild = path.join(root, 'engine', 'build.mjs');
  let r; let method;
  if (exists(engineBuild) && !site.legacy) {
    method = 'engine';
    r = spawnSync(process.execPath, [engineBuild, site.dir, '--out', out, '--json', ...flags], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } else if (site.legacy) {
    method = 'legacy-site';
    r = spawnSync(process.execPath, [path.join(site.dir, 'build.mjs'), ...flags], { cwd: site.dir, encoding: 'utf8', env: { ...process.env, OUT_DIR: out }, maxBuffer: 64 * 1024 * 1024 });
  } else {
    const legacyEngine = path.join(root, 'opalquestlounge', 'build.mjs');
    if (!exists(legacyEngine)) throw new Error(`cannot build ${site.rel}: neither engine/build.mjs nor the legacy opalquestlounge/build.mjs exists`);
    method = 'legacy-engine';
    r = spawnSync(process.execPath, [legacyEngine, ...flags], { cwd: path.dirname(legacyEngine), encoding: 'utf8', env: { ...process.env, OUT_DIR: out, SITE_CONFIG: path.join(site.dir, 'site.config.json') }, maxBuffer: 64 * 1024 * 1024 });
  }
  let json = null;
  const lines = String(r.stdout || '').trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) { const l = lines[i].trim(); if (l.startsWith('{')) { try { json = JSON.parse(l); break; } catch { /* not json */ } } }
  if (!exists(path.join(out, 'index.html'))) {
    const msg = (r.stderr || r.stdout || '').trim().split('\n').slice(-8).join('\n');
    throw new Error(`build of ${site.rel} (${method}) produced no index.html (exit ${r.status}):\n${msg}`);
  }
  return { dist: out, method, json, status: r.status, stderr: r.stderr, temp: !outDir };
}

export function removeTemp(build) { if (build && build.temp) fs.rmSync(build.dist, { recursive: true, force: true }); }

// ---------- fingerprints ----------

const SEED = () => readJsonIf(path.join(TOOLS_DIR, 'data', 'known-fingerprints.json')) || { entries: [] };

/** Classify a dist HTML path into a page type. */
export function pageTypeOf(rel, html) {
  const p = rel.replace(/\\/g, '/').replace(/index\.html$/, '').replace(/\.html$/, '/').replace(/\/$/, '');
  if (p === '') return 'home';
  const segs = p.split('/');
  if (['terms', 'privacy', 'cookies', '404', 'offline', 'accessibility'].includes(segs[0]) || /^(404|offline)$/.test(p)) return null;
  if (segs[0] === 'games') return segs.length === 1 ? 'lobby' : /data-symbol=/.test(html) ? 'demo' : 'game';
  if (segs[0] === 'responsible-gaming') return 'safer';
  if (segs[0] === 'lp') return null; // landing variants are excluded
  return segs.length === 1 ? segs[0] : `${segs[0]}-item`;
}

/** Concept-level fingerprint (no build): from order.json, concept.json, the seed, the config and the stylesheet. */
export function lightFingerprint(site, root = repoRoot()) {
  const fp = { slug: site.slug, type: site.type, engine: site.engine, brand: site.config && site.config.brand, domain: site.config && site.config.domain, sources: [] };
  const order = readJsonIf(path.join(root, 'orders', site.slug, 'order.json'));
  const concept = readJsonIf(path.join(site.dir, 'concept.json'));
  const seed = SEED().entries.find((e) => e.slug === site.slug);
  if (order) {
    fp.sources.push('order');
    Object.assign(fp, fromOrderLike(order));
  }
  if (concept) {
    fp.sources.push('concept');
    for (const k of ['family', 'era', 'place', 'craft']) if (concept[k] && !fp[k]) fp[k] = concept[k];
    if (!fp.vocabulary && Array.isArray(concept.vocabulary)) fp.vocabulary = concept.vocabulary.map((v) => v.term || v);
    if (!fp.palette && concept.palette && concept.palette.colours) fp.palette = rolePalette(concept.palette.colours);
    if (!fp.fonts && concept.fonts) fp.fonts = { display: famName(concept.fonts.display), body: famName(concept.fonts.body), numeric: famName(concept.fonts.numeric) };
  }
  if (seed) {
    fp.sources.push('seed');
    for (const k of ['family', 'era', 'place', 'craft', 'vocabulary', 'fonts', 'currency', 'homeSummary', 'paletteNames', 'keywords', 'variant']) if (seed[k] !== undefined && fp[k] === undefined) fp[k] = seed[k];
    if (!fp.games && seed.games) fp.games = seed.games;
    if (!fp.brand) fp.brand = seed.brand;
    if (seed.type && site.typeDefaulted) fp.type = seed.type;
  }
  // stylesheet tokens: palette without roles, @font-face families
  const css = siteCss(site);
  if (css) {
    if (!fp.palette) {
      const tokens = cssColourTokens(css);
      if (tokens.size) fp.palette = [...new Set(tokens.values())].map((hex) => ({ role: null, hex, lab: hexToOklab(hex) })).filter((c) => c.lab);
      fp.paletteFrom = 'css';
    }
    const fams = fontFaces(css);
    if (fams.length) fp.cssFonts = fams;
    if (!fp.fonts && fams.length) fp.fonts = { display: fams[0], body: fams[1] || fams[0] };
  }
  if (!fp.paletteFrom && fp.palette) fp.paletteFrom = 'roles';
  return fp;
}

const famName = (f) => (f && typeof f === 'object' ? f.family : f) || undefined;
export function rolePalette(colours) {
  return (colours || []).map((c) => ({ role: c.role || null, name: c.name, hex: c.hex, lab: c.oklch ? oklchToOklab(c.oklch) : hexToOklab(c.hex), h: c.oklch ? c.oklch.h : undefined })).filter((c) => c.lab);
}

/** Fingerprint fields from an order or a direction object. */
export function fromOrderLike(o) {
  const out = {};
  const c = o.concept || {};
  for (const k of ['family', 'era', 'place', 'craft']) if (c[k]) out[k] = c[k];
  if (o.forcing && !out.family) out.family = o.forcing.family;
  if (Array.isArray(c.vocabulary)) out.vocabulary = c.vocabulary.map((v) => v.term || v);
  if (o.palette && o.palette.colours) out.palette = rolePalette(o.palette.colours);
  if (o.typography) out.fonts = { display: famName(o.typography.display), body: famName(o.typography.body), numeric: famName(o.typography.numeric) };
  const games = (o.games && o.games.house) || (o.typeOptions && o.typeOptions.games && o.typeOptions.games.house);
  if (games) out.games = games.map((g) => ({ name: g.name, slug: g.slug, engine: g.engine, specHash: JSON.stringify(g.spec || {}) }));
  const prag = (o.typeOptions && o.typeOptions.games && o.typeOptions.games.pragmatic) || (o.games && Array.isArray(o.games.pragmatic) ? { demos: o.games.pragmatic } : null);
  if (prag && Array.isArray(prag.demos)) out.pragmatic = prag.demos;
  const s = o.structure || (o.forcing && o.forcing.structureTuple) || {};
  out.structureTuple = { heroStyle: s.heroStyle, lobbyLayout: s.lobbyLayout, gamePageLayout: s.gamePageLayout, homeSections: s.homeSections || [], extraPages: s.extraPages || [] };
  if (s.navLabels) out.navLabels = Object.values(s.navLabels);
  if (s.faq) out.faqIds = s.faq;
  const copy = o.copy || {};
  out.heroH1 = copy.heroH1; out.tagline = copy.tagline;
  out.register = (copy.voice && copy.voice.register) || copy.register;
  if (o.typeOptions && o.typeOptions.currency) out.currency = o.typeOptions.currency;
  if (o.currency) out.currency = o.currency;
  if (o.brand) out.brand = o.brand.name || o.brand;
  if (o.type) out.type = o.type;
  if (o.variant) out.variant = o.variant;
  if (o.operator) out.operator = o.operator.name || o.operator.companyName;
  return out;
}

/** The site's own stylesheet text (tokens first). */
export function siteCss(site) {
  const cands = [path.join(site.dir, 'theme', 'tokens.css'), path.join(site.dir, 'src', 'styles', '00-tokens.css')];
  for (const c of cands) if (exists(c)) return readText(c);
  if (site.engine === 'none') {
    const cssFiles = walk(site.dir).filter((f) => f.endsWith('.css'));
    if (cssFiles.length) return cssFiles.map((f) => readText(path.join(site.dir, f))).join('\n');
  }
  return '';
}
export function fontFaces(css) {
  const out = [];
  for (const m of css.matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*["']?([^;"'}]+)["']?/gi)) {
    const f = m[1].trim();
    if (!/fallback$/i.test(f) && !out.includes(f)) out.push(f);
  }
  return out;
}

/** Full fingerprint of a built site: light fingerprint + copy shingles per page type from dist. */
export function distFingerprint(site, dist, root = repoRoot()) {
  const fp = lightFingerprint(site, root);
  const files = walk(dist).filter((f) => f.endsWith('.html'));
  const pages = {};
  const headings = [];
  const faq = [];
  const routes = [];
  const houseNames = [];
  let home = null;
  for (const rel of files) {
    const html = fs.readFileSync(path.join(dist, rel), 'utf8');
    if (/<meta[^>]+http-equiv="refresh"/i.test(html)) continue;
    routes.push(`/${rel.replace(/index\.html$/, '').replace(/\.html$/, '')}`);
    const pt = pageTypeOf(rel, html);
    if (!pt) continue;
    if (pt === 'home') home = html;
    const text = T.visibleText(html);
    if (!pages[pt]) pages[pt] = { files: [], text: '' };
    pages[pt].files.push(rel);
    pages[pt].text += ` ${text}`;
    headings.push(...T.headingsAndButtons(html));
    faq.push(...T.faqEntries(html));
    if (pt === 'game') houseNames.push(T.h1(html));
  }
  const pageShingles = {};
  const site8 = new Set();
  for (const [pt, p] of Object.entries(pages)) {
    pageShingles[pt] = T.shingles(p.text, 8);
    for (const s of pageShingles[pt]) site8.add(s);
  }
  fp.pages = Object.fromEntries(Object.entries(pages).map(([pt, p]) => [pt, { files: p.files, words: T.words(p.text).length }]));
  fp.shingles = pageShingles;
  fp.siteShingles = site8;
  fp.copyMinHash = Object.fromEntries(Object.entries(pageShingles).map(([pt, s]) => [pt, T.minhash(s)]));
  fp.headingShingles = T.shingles(headings.join(' . '), 5);
  fp.faq = faq;
  fp.routes = routes.sort();
  fp.routeSetHash = sha(fp.routes.join('\n'));
  if (home) fp.structure = { homeSections: T.sectionSequence(home), navLabels: T.navLabels(home) };
  if (houseNames.length) fp.houseNames = houseNames.filter(Boolean);
  // fonts actually shipped
  const cssFiles = walk(dist).filter((f) => f.endsWith('.css'));
  const css = cssFiles.map((f) => fs.readFileSync(path.join(dist, f), 'utf8')).join('\n');
  const fams = fontFaces(css);
  if (fams.length) fp.cssFonts = fams;
  return fp;
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
