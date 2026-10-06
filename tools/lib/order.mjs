// Order loading and validation shared by validate-order.mjs, order-to-config.mjs,
// new-site.mjs, status.mjs and board.mjs.

import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { repoRoot, exists, isDir, readJson, readJsonIf, slugify, today, getPath } from './common.mjs';
import { SchemaSet, validateFile, validate } from './jsonschema.mjs';

export const TYPES = ['social-casino', 'online-games', 'hotel-casino'];
export const COMMON_APPROVALS = ['concept', 'palette', 'typography', 'structure', 'copy', 'operator', 'legal', 'launch'];
export const TYPE_APPROVALS = {
  'social-casino': ['currency', 'games'],
  'online-games': ['catalogue', 'curationPolicy', 'audience'],
  'hotel-casino': ['facts', 'offers', 'media', 'booking'],
};
/** Fields that must be present even at --level draft (SPEC 4.1 amendment 5; D-30). */
const DRAFT_CORE = new Set(['schemaVersion', 'orderId', 'type', 'status', 'client', 'client.name', 'client.language', 'brief', 'brand', 'brand.name']);

/** Resolve an order input: a directory holding order.json, or a JSON file. */
export function resolveOrderInput(input) {
  const abs = path.resolve(input);
  if (isDir(abs)) {
    const f = path.join(abs, 'order.json');
    if (exists(f)) return f;
    throw new Error(`${input}: no order.json in this directory`);
  }
  if (!exists(abs)) throw new Error(`${input}: no such file or directory`);
  return abs;
}

export function loadOrder(input) {
  const file = resolveOrderInput(input);
  return { file, order: readJson(file) };
}

/** Approval items the order's type needs (pack.approvalItems when the pack exports them, else the built-in list). */
export async function approvalItemsFor(type, root = repoRoot()) {
  const pack = await loadPack(type, root);
  if (pack && Array.isArray(pack.approvalItems) && pack.approvalItems.length) return pack.approvalItems;
  return [...COMMON_APPROVALS, ...(TYPE_APPROVALS[type] || [])];
}

const packCache = new Map();
/** Import types/<type>/pack.mjs if it exists (null otherwise; import errors are reported, not thrown). */
export async function loadPack(type, root = repoRoot()) {
  const file = path.join(root, 'types', type || '', 'pack.mjs');
  if (packCache.has(file)) return packCache.get(file);
  let pack = null;
  if (type && exists(file)) {
    try { const mod = await import(new URL(`file://${file}`)); pack = mod.default || mod; } catch (e) { pack = { __error: e.message }; }
  }
  packCache.set(file, pack);
  return pack;
}

/** Question text for a field path, taken from orders/_templates/questions.<type>.<lang>.md blocks. */
export function questionFor(field, { type, lang = 'en', root = repoRoot() } = {}) {
  const map = questionMap(type, lang, root);
  // exact, then the nearest parent path that has a question
  let p = field.replace(/\[\d+\]/g, (m) => m);
  while (p) {
    if (map.has(p)) return map.get(p);
    const stripped = p.replace(/\[\d+\]$/, '');
    if (stripped !== p) { p = stripped; continue; }
    const i = p.lastIndexOf('.');
    p = i > 0 ? p.slice(0, i) : '';
  }
  return lang === 'ru' ? `Пожалуйста, укажите значение поля ${field}.` : `Please provide ${field}.`;
}
const qCache = new Map();
function questionMap(type, lang, root) {
  const key = `${root}|${type}|${lang}`;
  if (qCache.has(key)) return qCache.get(key);
  const map = new Map();
  const file = path.join(root, 'orders', '_templates', `questions.${type}.${lang === 'ru' ? 'ru' : 'en'}.md`);
  if (exists(file)) {
    const txt = fs.readFileSync(file, 'utf8');
    let field = null;
    for (const line of txt.split('\n')) {
      const f = line.match(/^field:\s*(\S+)/);
      if (f) { field = f[1]; continue; }
      const q = line.match(/^question:\s*(.+)$/);
      if (q && field) { if (!map.has(field)) map.set(field, q[1].trim()); field = null; }
    }
  }
  qCache.set(key, map);
  return map;
}

const PLACEHOLDER = /\[[^\]\n]{2,}\]|^\s*(pending|tbd|todo|to be confirmed|placeholder)\b/i;
const SKIP_PLACEHOLDER_KEYS = new Set(['provenance', 'status', 'notes', 'summary', 'note', 'description', 'why']);

/** Every string that still looks like a placeholder: [{ path, value }]. */
export function findPlaceholders(order) {
  const out = [];
  const rec = (v, p, key) => {
    if (SKIP_PLACEHOLDER_KEYS.has(key)) return;
    if (typeof v === 'string') { if (PLACEHOLDER.test(v)) out.push({ path: p, value: v }); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => rec(x, `${p}[${i}]`, key)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) rec(x, p ? `${p}.${k}` : k, k);
  };
  rec(order, '', '');
  return out;
}
export const isPlaceholder = (s) => typeof s !== 'string' || !s.trim() || PLACEHOLDER.test(s);

/** Pragmatic catalogue slugs (types/social-casino/data, engine/data, or the legacy site data). */
export function pragmaticCatalog(root = repoRoot()) {
  const candidates = [
    'types/social-casino/data/pragmatic-catalog.json',
    'engine/data/pragmatic-catalog.json',
    'sites/opalquestlounge/data/pragmatic-games.json',
    'opalquestlounge/src/data/pragmatic-games.json',
  ];
  for (const rel of candidates) {
    const data = readJsonIf(path.join(root, rel));
    if (!data) continue;
    const list = Array.isArray(data) ? data : data.games || data.catalog || data.entries || [];
    return { file: rel, games: new Map(list.filter((g) => g && g.slug).map((g) => [g.slug, g])) };
  }
  return null;
}

/**
 * Validate an order. Returns { level, ok, type, errors: [{ path, message, question, rule }], warnings: [...], missing: [...] }.
 * level: draft | build | launch. Options: { root, offline, file }.
 */
export async function validateOrder(order, { level = 'build', root = repoRoot(), offline = false, file = null } = {}) {
  if (!['draft', 'build', 'launch'].includes(level)) throw new Error(`unknown level ${level}`);
  const type = order && order.type;
  const lang = (order && order.client && order.client.language) || 'en';
  const errors = []; const warnings = []; const missing = [];
  const add = (list, p, message, rule) => list.push({ path: p, message, rule, question: questionFor(p || '(root)', { type, lang, root }) });

  // 1. schema (base) + pack overlay
  const set = new SchemaSet();
  const baseFile = path.join(root, 'schemas', 'order.schema.json');
  let schemaErrors = validateFile(order, baseFile, set);
  const overlayFile = type ? path.join(root, 'types', type, 'schema', 'order-options.schema.json') : null;
  let overlay = null;
  if (overlayFile && exists(overlayFile)) {
    overlay = path.relative(root, overlayFile);
    const entry = set.load(overlayFile);
    const s = entry.schema;
    const wholeOrder = s && s.properties && (s.properties.typeOptions || (s.properties.type && s.properties.orderId));
    if (wholeOrder) schemaErrors = schemaErrors.concat(validate(order, s, { set, entry }));
    else {
      const sub = validate(order.typeOptions ?? {}, s, { set, entry });
      schemaErrors = schemaErrors.concat(sub.map((e) => ({ ...e, path: e.path ? `typeOptions.${e.path}` : 'typeOptions' })));
    }
  }
  const seen = new Set();
  for (const e of schemaErrors) {
    const k = `${e.path}|${e.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (level === 'draft' && (e.keyword === 'required' || e.keyword === 'dependentRequired') && !DRAFT_CORE.has(e.path)) {
      missing.push({ path: e.path, message: e.message, question: questionFor(e.path, { type, lang, root }) });
      continue;
    }
    add(errors, e.path, e.message, `schema.${e.keyword}`);
  }

  // 2. ST 1.4 rejections (every level)
  if (order && typeof order === 'object') rejections(order, (p, m, r) => add(errors, p, m, r));

  // 3. cross-field rules (every level where the fields exist)
  crossField(order, root, (p, m, r) => add(errors, p, m, r), (p, m, r) => add(warnings, p, m, r));

  // 4. launch rules
  if (level === 'launch') await launchRules(order, { root, offline, file }, (p, m, r) => add(errors, p, m, r));

  return { level, ok: errors.length === 0, type: type || null, overlay, errors, warnings, missing };
}

function rejections(o, err) {
  const t = o.type; const opt = o.typeOptions || {};
  if (t === 'social-casino') {
    const demos = o.variant === 'demo-lobby' || getPath(opt, 'games.mode') === 'pragmatic' || getPath(opt, 'games.pragmatic.enabled') === true;
    if (demos) {
      if (getPath(o, 'analytics.adsConversionId')) err('analytics.adsConversionId', 'a demo lobby cannot carry a Google Ads conversion ID (ST 1.1, 1.4): rejected at intake', 'reject.demo-lobby-ads');
      if (getPath(o, 'ppc.accountId')) err('ppc.accountId', 'a demo lobby cannot carry a Google Ads account (ST 1.1, 1.4): rejected at intake', 'reject.demo-lobby-ads');
      const wc = getPath(opt, 'games.pragmatic.writtenConsent');
      if (!wc || typeof wc !== 'object' || !wc.reference) err('typeOptions.games.pragmatic.writtenConsent', 'a demo lobby needs the provider\'s written consent (reference and date) on file before intake (ST 1.1, 1.4)', 'reject.demo-lobby-consent');
    }
    if (opt.sweepstakes === true || getPath(opt, 'currency.redeemable') === true) err('typeOptions.sweepstakes', 'sweepstakes or redeemable coins are not social casino (ST 1.1, 1.4): rejected', 'reject.sweepstakes');
    if (getPath(opt, 'purchases.cashOut') === true || opt.prizes === true) err('typeOptions.purchases', 'cash-out or prizes make the site real-money gambling (ST 1.4): rejected', 'reject.real-money');
  }
  if (opt.realMoneyLinks === true) err('typeOptions.realMoneyLinks', 'links to real-money gambling are out of scope (ST 1.4): rejected', 'reject.real-money');
  if (t === 'hotel-casino' && o.casinoMode === 'B') {
    const gc = getPath(opt, 'modeB.googleConfirmation');
    if (!gc || !gc.reference || !gc.date) err('typeOptions.modeB.googleConfirmation', 'Mode B needs Google\'s written confirmation (reference and date) on file (ST 1.3, 1.4): rejected until it is', 'reject.mode-b-confirmation');
    if ((o.markets || []).includes('GB') || getPath(o, 'geo.market') === 'GB') {
      const op = getPath(opt, 'modeB.gamblingActOpinion');
      if (!op || !op.reference || !op.date) err('typeOptions.modeB.gamblingActOpinion', 'Mode B for a Great Britain target needs the Gambling Act 2005 opinion on file (ST 3.5, 1.4): rejected until it is', 'reject.mode-b-gb-opinion');
    }
  }
  if (t === 'online-games') {
    const scraped = (opt.providers || []).filter((p) => /^(poki|crazygames|crazy-games|scrape|scraped)$/i.test(String(p.key || p.adapter || '')) || /^scrape/i.test(String(p.adapter || '')));
    if (opt.scraped === true || scraped.length) err('typeOptions.providers', 'portals built from Poki or CrazyGames iframes are site-locked and out of scope (ST 1.4): rejected', 'reject.scraped-portal');
  }
}

function crossField(o, root, err, warn) {
  if (!o || typeof o !== 'object') return;
  const opt = o.typeOptions || {};
  if (o.brand && o.brand.name && o.orderId && slugify(o.brand.name) !== o.orderId) warn('orderId', `orderId "${o.orderId}" differs from slug(brand.name) "${slugify(o.brand.name)}" (SPEC 5.1: orderId == slug from the first commit)`, 'order.id-slug');
  const roles = (getPath(o, 'palette.colours') || []).map((c) => c.role);
  const dup = roles.filter((r, i) => roles.indexOf(r) !== i);
  if (dup.length) err('palette.colours', `palette roles must be unique (repeated: ${[...new Set(dup)].join(', ')})`, 'order.palette-roles');
  const locales = o.locales || [];
  if (locales.length) {
    const defs = locales.filter((l) => l.default);
    if (defs.length !== 1) err('locales', `exactly one locale must be the default (found ${defs.length})`, 'order.locale-default');
    else if (defs[0].path !== '/') err('locales', 'the default locale must live at "/"', 'order.locale-default');
    const codes = locales.map((l) => l.code);
    if (new Set(codes).size !== codes.length) err('locales', 'locale codes must be unique', 'order.locale-unique');
  }
  if (o.audience && !(o.audienceAssessment && o.audienceAssessment.signedBy && o.audienceAssessment.signedOn))
    err('audience', 'audience is set only from the signed audience assessment (audienceAssessment.signedBy and signedOn)', 'order.audience-signed');
  if (o.audience && o.audienceAssessment && o.audienceAssessment.result && o.audienceAssessment.result !== o.audience)
    err('audience', `audience "${o.audience}" differs from the signed assessment result "${o.audienceAssessment.result}"`, 'order.audience-signed');
  const repoPath = getPath(o, 'hosting.repo.path');
  if (repoPath && o.orderId && repoPath !== `sites/${o.orderId}`) warn('hosting.repo.path', `expected sites/${o.orderId}`, 'order.repo-path');
  if (o.type === 'social-casino') {
    const house = getPath(opt, 'games.house') || [];
    const slugs = house.map((g) => g.slug);
    const heroGame = getPath(o, 'structure.heroGame');
    if (heroGame && !slugs.includes(heroGame)) err('structure.heroGame', `heroGame "${heroGame}" is not a house game slug (${slugs.join(', ') || 'none'})`, 'sc.hero-game');
    const dupSlug = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    if (dupSlug.length) err('typeOptions.games.house', `house game slugs repeat: ${dupSlug.join(', ')}`, 'sc.game-unique');
    const names = house.map((g) => String(g.name || '').toLowerCase());
    if (names.some((n, i) => n && names.indexOf(n) !== i)) err('typeOptions.games.house', 'house game names repeat', 'sc.game-unique');
    const cur = opt.currency || {};
    if (Number.isFinite(cur.topUpBelow) && Number.isFinite(cur.startingBalance) && !(cur.topUpBelow < cur.startingBalance))
      err('typeOptions.currency.topUpBelow', `topUpBelow (${cur.topUpBelow}) must be lower than startingBalance (${cur.startingBalance})`, 'sc.currency');
    const prag = getPath(opt, 'games.pragmatic') || {};
    const curParam = getPath(prag, 'params.cur');
    if (curParam !== undefined && curParam !== 'FUN') err('typeOptions.games.pragmatic.params.cur', 'cur must be FUN (no GBP-denominated demo on a free-to-play site)', 'sc.cur-fun');
    if (Array.isArray(prag.demos) && prag.demos.length) {
      const cat = pragmaticCatalog(root);
      if (!cat) warn('typeOptions.games.pragmatic.demos', 'no Pragmatic catalogue found (types/social-casino/data/pragmatic-catalog.json); demo slugs not checked', 'sc.demo-catalogue');
      else for (const [i, d] of prag.demos.entries()) {
        const g = cat.games.get(d);
        if (!g) err(`typeOptions.games.pragmatic.demos[${i}]`, `demo "${d}" is not in ${cat.file}`, 'sc.demo-catalogue');
        else if (g.appeal && !['low', 'medium'].includes(g.appeal)) err(`typeOptions.games.pragmatic.demos[${i}]`, `demo "${d}" has appeal "${g.appeal}" (only low or medium are allowed)`, 'sc.demo-appeal');
      }
      if (prag.featured && !prag.demos.includes(prag.featured)) err('typeOptions.games.pragmatic.featured', `featured "${prag.featured}" is not one of the demos`, 'sc.demo-featured');
    }
    const geo = o.geo || {};
    if (geo.market && geo.market !== 'GB') warn('geo.market', 'social-casino is a UK type; other markets are not confirmed (ST 7 Q2)', 'sc.market');
  }
  if (o.type === 'hotel-casino') {
    const venues = opt.venues || [];
    if (o.casinoMode === 'A') {
      const linked = venues.filter((v) => v.casinoLinked);
      if (linked.length) warn('typeOptions.venues', `Mode A: casino-linked venues (${linked.map((v) => v.id).join(', ')}) must never appear on this domain, nor any event held in them`, 'hotel.mode-a-venues');
      if ((o.thirdParties || []).some((tp) => /casino/i.test(tp.purpose || ''))) err('thirdParties', 'Mode A forbids casino third parties', 'hotel.mode-a');
    }
  }
}

async function launchRules(o, { root, offline, file }, err) {
  const type = o.type;
  for (const ph of findPlaceholders(o)) err(ph.path, `still a placeholder at launch: "${ph.value.slice(0, 60)}"`, 'launch.placeholder');
  if (o.ppc && !String(o.ppc.primaryConversion || '').trim()) err('ppc.primaryConversion', 'the primary conversion is an owner placeholder and must be chosen before launch (D-42)', 'launch.placeholder');
  // operator registry check
  const op = o.operator || {};
  const rc = op.registryCheck;
  if (!rc || rc.checked !== true || !rc.on) err('operator.registryCheck', 'the operator must be checked in its registry (checked, by, on, url) before launch', 'launch.operator');
  else if (op.registry === 'Companies House' && (!rc.url || !String(rc.url).includes(String(op.registrationNumber)))) err('operator.registryCheck.url', `the Companies House URL must carry the company number ${op.registrationNumber}`, 'launch.operator');
  // legal
  if (!o.legal || isPlaceholder(o.legal.reviewer) || !o.legal.reviewedOn) err('legal.reviewer', 'a named legal reviewer and a review date are required before launch', 'launch.legal');
  // uniqueness
  if (!o.uniqueness || o.uniqueness.passed !== true) err('uniqueness.passed', 'the uniqueness gate must have passed', 'launch.uniqueness');
  // approvals
  const items = await approvalItemsFor(type, root);
  const byItem = new Map((o.approvals || []).map((a) => [a.item, a]));
  for (const it of items) {
    const a = byItem.get(it);
    if (!a || a.status !== 'approved' || !a.by || !a.on) err(`approvals.${it}`, `approval "${it}" is ${a ? a.status : 'missing'}; every approval item must be approved (with by and on) before launch`, 'launch.approvals');
  }
  // type-specific evidence
  const opt = o.typeOptions || {};
  if (type === 'social-casino') {
    const av = opt.ageVerification || {};
    if (!av.method || !av.decidedBy || !av.decidedOn) err('typeOptions.ageVerification', 'the age-verification decision (method, decidedBy, decidedOn) is required before launch', 'launch.age-verification');
    const prag = getPath(opt, 'games.pragmatic') || {};
    if (prag.enabled) {
      if (!prag.writtenConsent || !prag.writtenConsent.reference) err('typeOptions.games.pragmatic.writtenConsent', 'written consent is required while demos are on', 'launch.pragmatic-consent');
      const siteData = readJsonIf(path.join(root, 'sites', o.orderId || '', 'data', 'pragmatic-games.json'));
      const list = siteData ? (Array.isArray(siteData) ? siteData : siteData.games || []) : [];
      for (const d of prag.demos || []) {
        const g = list.find((x) => x.slug === d);
        if (!g || !g.checked) err('typeOptions.games.pragmatic.demos', `demo "${d}" has no checked date in sites/${o.orderId}/data/pragmatic-games.json`, 'launch.demos-checked');
      }
    }
  }
  const ticks = getPath(o, 'launch.checklist') || {};
  const needTicks = ['policyUrlsVerified'];
  if (type === 'social-casino' || type === 'online-games') needTicks.push('audienceAssessmentSigned');
  if (type === 'hotel-casino') needTicks.push('affiliatePaidSearchChecked');
  if (type === 'online-games') needTicks.push('providerPaidSearchChecked');
  for (const t of needTicks) if (!ticks[t] || ticks[t].done !== true) err(`launch.checklist.${t}`, `launch tick ${t} is not done`, 'launch.tick');
  if ((type === 'social-casino' || type === 'online-games') && !o.audience) err('audience', 'the audience must be set from the signed assessment before launch', 'launch.audience');
  // dates not in the future
  const now = today();
  const dateFields = [];
  const collect = (v, p) => {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) dateFields.push([p, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => collect(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) collect(x, p ? `${p}.${k}` : k);
  };
  collect({ dates: { received: getPath(o, 'dates.received'), lastUpdated: getPath(o, 'dates.lastUpdated'), legalUpdated: getPath(o, 'dates.legalUpdated') }, approvals: o.approvals, launch: o.launch, operator: o.operator, legal: o.legal }, '');
  for (const [p, v] of dateFields) if (v > now) err(p, `date ${v} is in the future (today ${now})`, 'launch.dates-honest');
  // MX
  if (!offline && op.email && /@/.test(op.email)) {
    const domain = op.email.split('@')[1];
    const ok = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 5000);
      dns.promises.resolveMx(domain).then((r) => { clearTimeout(timer); resolve(r.length > 0); }, () => { clearTimeout(timer); resolve(false); });
    });
    if (ok !== true) err('operator.email', `no MX record found for ${domain} (or DNS unavailable; use --offline to skip)`, 'launch.mx');
  }
  void file;
}
