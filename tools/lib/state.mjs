// Portfolio state readers shared by status.mjs and board.mjs: the state machine,
// orders (main + in-flight site/* branches), the registry, reports and Board mirrors.

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, readJsonIf, readJson, isDir, exists, git, TOOLS_DIR } from './common.mjs';
import { listSites, siteInfo } from './sites.mjs';

export function loadStages(root = repoRoot()) {
  const f = path.join(root, 'schemas', 'stages.json');
  if (!exists(f)) throw new Error('schemas/stages.json is missing');
  return readJson(f);
}

/** Problems in stages.json itself (derive tables complete, enums consistent, transitions valid). */
export function checkStages(stages) {
  const out = [];
  const S = stages.stages || [];
  if (!Array.isArray(S) || !S.length) return ['stages.json: stages[] is empty'];
  if (new Set(S).size !== S.length) out.push('stages.json: stages[] repeats a stage');
  for (const k of ['orderStatus', 'registryStatus', 'prLabel', 'kanbanColumn']) {
    const t = stages.derive && stages.derive[k];
    if (!t) { out.push(`stages.json: derive.${k} is missing`); continue; }
    for (const s of S) if (!(s in t)) out.push(`stages.json: derive.${k} has no entry for stage "${s}"`);
    for (const s of Object.keys(t)) if (!S.includes(s)) out.push(`stages.json: derive.${k} names unknown stage "${s}"`);
  }
  const defs = stages.$defs || {};
  if (defs.stage && JSON.stringify(defs.stage.enum) !== JSON.stringify(S)) out.push('stages.json: $defs.stage.enum differs from stages[]');
  const vals = (k) => [...new Set(Object.values((stages.derive || {})[k] || {}).filter((v) => v !== null))];
  if (defs.orderStatus) {
    const want = vals('orderStatus').sort(); const have = [...defs.orderStatus.enum].sort();
    if (JSON.stringify(want) !== JSON.stringify(have)) out.push(`stages.json: $defs.orderStatus.enum (${have.join(', ')}) differs from the derive.orderStatus values (${want.join(', ')})`);
  }
  if (defs.registryStatus) for (const v of vals('registryStatus')) if (!defs.registryStatus.enum.includes(v)) out.push(`stages.json: registryStatus "${v}" is not in $defs.registryStatus`);
  if (defs.prLabel) for (const v of vals('prLabel')) if (!defs.prLabel.enum.includes(v)) out.push(`stages.json: prLabel "${v}" is not in $defs.prLabel`);
  if (stages.kanbanColumns) for (const v of vals('kanbanColumn')) if (!stages.kanbanColumns.includes(v)) out.push(`stages.json: kanbanColumn "${v}" is not in kanbanColumns`);
  for (const [i, t] of (stages.transitions || []).entries()) {
    for (const end of ['from', 'to']) {
      const v = t[end];
      if (v === null && end === 'from') continue;
      if (v !== '*' && !S.includes(v)) out.push(`stages.json: transitions[${i}].${end} "${v}" is not a stage`);
    }
  }
  for (const [s, list] of Object.entries(stages.orderStatusLag || {})) {
    if (s.startsWith('$')) continue;
    if (!S.includes(s)) out.push(`stages.json: orderStatusLag names unknown stage "${s}"`);
    for (const v of list) if (!vals('orderStatus').includes(v)) out.push(`stages.json: orderStatusLag.${s} lists unknown order status "${v}"`);
  }
  return out;
}

/** Orders: { slug, file, source: 'main'|'site/<slug>'|'template', order }. */
export function collectOrders(root = repoRoot(), { inFlight = true, templates = false } = {}) {
  const out = [];
  const dir = path.join(root, 'orders');
  if (isDir(dir)) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (e.name === '_templates') {
        if (templates) for (const f of fs.readdirSync(path.join(dir, e.name))) if (/^order\.example.*\.json$/.test(f)) out.push({ slug: f, file: path.join('orders', '_templates', f), source: 'template', order: readJson(path.join(dir, e.name, f)) });
        continue;
      }
      if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
      const f = path.join(dir, e.name, 'order.json');
      if (exists(f)) out.push({ slug: e.name, file: path.relative(root, f), source: 'main', order: readJson(f) });
    }
  }
  if (inFlight) {
    const refs = git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/site/'], { cwd: root }) || '';
    for (const ref of refs.split('\n').map((s) => s.trim()).filter(Boolean)) {
      const slug = ref.replace(/^origin\/site\//, '');
      const txt = git(['show', `${ref}:orders/${slug}/order.json`], { cwd: root });
      if (!txt) continue;
      try {
        const order = JSON.parse(txt);
        const i = out.findIndex((x) => x.slug === slug);
        const row = { slug, file: `${ref}:orders/${slug}/order.json`, source: `site/${slug}`, order };
        if (i >= 0) out[i] = row; else out.push(row); // the site branch is newer than main while in flight
      } catch { /* unreadable order on a branch: reported by --check as missing */ }
    }
  }
  return out;
}

/** Registry: origin/registry entries, else the sites/registry.json snapshot, else the seed. */
export function loadRegistry(root = repoRoot()) {
  const txt = git(['show', 'origin/registry:portfolio/registry.json'], { cwd: root });
  if (txt) { try { return { source: 'origin/registry', entries: JSON.parse(txt).entries || [] }; } catch { /* fall through */ } }
  const snap = readJsonIf(path.join(root, 'sites', 'registry.json'));
  if (snap) return { source: 'sites/registry.json', entries: snap.sites || snap.entries || [] };
  const seed = readJsonIf(path.join(TOOLS_DIR, 'data', 'known-fingerprints.json'));
  return { source: 'seed', entries: (seed && seed.entries) || [] };
}

export const boardRow = (slug, root = repoRoot()) => readJsonIf(path.join(root, 'reports', slug, 'board-row.json'));
export const report = (slug, name, root = repoRoot()) => readJsonIf(path.join(root, 'reports', slug, name));

/** Every slug the portfolio knows about, with what each source says. */
export function portfolio(root = repoRoot()) {
  const stages = loadStages(root);
  const reg = loadRegistry(root);
  const regBy = new Map(reg.entries.map((e) => [e.slug, e]));
  const orders = collectOrders(root);
  const orderBy = new Map(orders.map((o) => [o.slug, o]));
  const sites = listSites(root);
  const siteBy = new Map(sites.map((s) => [s.slug, s]));
  const slugs = [...new Set([...siteBy.keys(), ...orderBy.keys(), ...(reg.source !== 'seed' ? regBy.keys() : [])])].sort();
  const rows = slugs.map((slug) => {
    const site = siteBy.get(slug) || null;
    const ord = orderBy.get(slug) || null;
    const regE = regBy.get(slug) || null;
    const row = boardRow(slug, root);
    const stage = (row && row.stage) || (regE && regE.stage) || null;
    return {
      slug,
      type: (ord && ord.order.type) || (site && site.config && site.config.type) || (regE && regE.type) || null,
      brand: (ord && ord.order.brand && ord.order.brand.name) || (site && site.config && site.config.brand) || (regE && regE.brand) || null,
      engine: (regE && regE.engine) || (site && site.engine) || 'factory',
      stage,
      stageFrom: row && row.stage ? 'board-row' : regE && regE.stage ? reg.source : null,
      orderStatus: ord ? ord.order.status : null,
      orderSource: ord ? ord.source : null,
      registryStatus: regE ? regE.status ?? null : null,
      site, order: ord, registry: regE, boardRow: row,
      build: report(slug, 'build.json', root),
      uniqueness: report(slug, 'uniqueness.json', root),
      check: report(slug, 'check.json', root),
    };
  });
  return { stages, registry: reg, rows };
}

export { siteInfo };
