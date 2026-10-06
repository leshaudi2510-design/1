// order.json -> sites/<slug>/site.config.json (+ concept.json). Shared by order-to-config.mjs and new-site.mjs.
//
// v1 (default, Phase 1; D-48): today's keys + type + storagePrefix, so the engine's v1
// schema and the byte-identical dist are unaffected. v2 (--v2): MASTER-PLAN 4.2 shape with
// typeOptions; used once A ships engine/schema/site.config.schema.json v2 (Phase 2).

import path from 'node:path';
import { repoRoot, readJsonIf, exists } from './common.mjs';
import { listSites, lightFingerprint } from './sites.mjs';

const ENGINE_ID = { 'european-roulette': 'roulette', 'reel-slot': 'reel-slot', blackjack: 'blackjack', 'hi-lo': 'hi-lo', dice: 'dice' };
const PRAGMATIC_DEFAULTS = {
  demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do',
  params: { lang: 'en', cur: 'FUN', jurisdiction: 'UK', websiteUrl: 'https://demogamesfree.pragmaticplay.net' },
  frameHosts: ['https://demogamesfree.pragmaticplay.net'],
};

/**
 * storagePrefix: initials of the slug words, unique among sites on disk. Letters only and
 * 2-5 long, so it satisfies both SPEC 3.2 (^[a-z]{2,5}$) and MASTER-PLAN D-11 (^[a-z0-9]{2,8}$).
 */
export function storagePrefixFor(slug, taken = new Set()) {
  const letters = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');
  const parts = String(slug).split('-').map(letters).filter(Boolean);
  let base = parts.length >= 2 ? parts.map((p) => p[0]).join('') : letters(slug).slice(0, 3);
  if (base.length < 2) base = `${base}${letters(slug).slice(1)}`.slice(0, 3);
  base = base.padEnd(2, 'x').slice(0, 4);
  if (!taken.has(base)) return base;
  for (const c of 'abcdefghijklmnopqrstuvwxyz') if (!taken.has(base + c)) return base + c;
  for (const c of 'abcdefghijklmnopqrstuvwxyz') for (const d of 'abcdefghijklmnopqrstuvwxyz') if (!taken.has(base.slice(0, 3) + c + d)) return base.slice(0, 3) + c + d;
  throw new Error(`no free storagePrefix for ${slug}`);
}

export function takenPrefixes(root = repoRoot(), exceptSlug = null) {
  const out = new Set();
  for (const s of listSites(root)) if (s.slug !== exceptSlug && s.config && s.config.storagePrefix) out.add(s.config.storagePrefix);
  return out;
}

const writtenConsentString = (wc) => (wc && typeof wc === 'object' ? `${wc.reference}${wc.from ? `, ${wc.from}` : ''}${wc.date ? `, ${wc.date}` : ''}` : '');

/** Derive site.config.json from an order. */
export function orderToConfig(order, { version = 1, root = repoRoot(), storagePrefix = null } = {}) {
  const o = order;
  const opt = o.typeOptions || {};
  const op = o.operator || {};
  const themes = (o.palette && o.palette.themes) || {};
  const prefix = storagePrefix || storagePrefixFor(o.orderId, takenPrefixes(root, o.orderId));
  const conceptLine = o.concept ? `${o.concept.title}: ${o.concept.world}` : '';
  const legalUpdated = (o.dates && o.dates.legalUpdated) || {};
  const prag = (opt.games && opt.games.pragmatic) || {};
  if (version === 1) {
    const cfg = {
      brand: o.brand && o.brand.name,
      shortName: o.brand && o.brand.shortName,
      domain: o.domain,
      concept: conceptLine,
    };
    if (opt.currency) {
      const { singular, plural, abbr, startingBalance, topUpAmount, topUpBelow } = opt.currency;
      cfg.currency = { singular, plural, abbr, startingBalance, topUpAmount, topUpBelow };
    }
    cfg.operator = { companyName: op.name, companyNumber: op.registrationNumber, registeredIn: op.registeredIn || op.registry, address: op.address, email: op.email };
    if (opt.purchases) cfg.purchases = !!opt.purchases.enabled;
    cfg.analytics = { ga4: (o.analytics && o.analytics.ga4) || '', adsConversionId: (o.analytics && o.analytics.adsConversionId) || '' };
    cfg.contactEndpoint = o.contactEndpoint || '';
    cfg.lastUpdated = o.dates && o.dates.lastUpdated;
    cfg.legalUpdated = { terms: legalUpdated.terms, privacy: legalUpdated.privacy, cookies: legalUpdated.cookies };
    cfg.themeColor = { light: themes.light && themes.light.themeColor, dark: themes.dark && themes.dark.themeColor };
    if (o.type === 'social-casino') {
      cfg.pragmatic = {
        enabled: !!prag.enabled,
        writtenConsent: writtenConsentString(prag.writtenConsent),
        demoUrl: prag.demoUrl || PRAGMATIC_DEFAULTS.demoUrl,
        params: { ...PRAGMATIC_DEFAULTS.params, ...(prag.params || {}) },
        frameHosts: prag.frameHosts || PRAGMATIC_DEFAULTS.frameHosts,
      };
    }
    cfg.type = o.type;
    cfg.storagePrefix = prefix;
    return cfg;
  }
  // v2 (MASTER-PLAN 4.2)
  const enginePkg = readJsonIf(path.join(root, 'engine', 'package.json'));
  const cfg = {
    schemaVersion: 2, type: o.type, variant: o.variant,
    brand: o.brand && o.brand.name, shortName: o.brand && o.brand.shortName, domain: o.domain,
    engineVersion: enginePkg ? enginePkg.version : '0.0.0',
    deploy: { provider: (o.hosting && o.hosting.provider) || 'cloudflare-pages', project: (o.hosting && o.hosting.cloudflare && o.hosting.cloudflare.projectName) || o.orderId },
    storagePrefix: prefix,
    locales: (o.locales || []).map((l) => ({ code: l.code, path: l.path, default: !!l.default, dir: l.dir || 'ltr', fonts: l.fonts || [], dictionary: l.dictionary || l.code })),
    geo: { adsExclude: [], accessibilityStatement: true, ...(o.geo || {}) },
  };
  if (o.audience) cfg.audience = o.audience;
  if (o.casinoMode) cfg.casinoMode = o.casinoMode;
  cfg.operator = { name: op.name, registrationNumber: op.registrationNumber, registry: op.registry, address: op.address, country: op.country, email: op.email };
  const an = o.analytics || {};
  cfg.analytics = { ga4: an.ga4 || '', adsConversionId: an.adsConversionId || '', conversions: an.conversions || {}, mode: an.mode || 'gtag', consentMode: an.consentMode || 'basic', personalisation: an.personalisation === true, crossDomain: an.crossDomain || [] };
  cfg.thirdParties = [];
  if (o.type === 'social-casino' && prag.enabled) {
    cfg.thirdParties.push({ key: 'pragmatic', hosts: prag.frameHosts || PRAGMATIC_DEFAULTS.frameHosts, purpose: 'Free Pragmatic Play demo games, loaded only after Play', consent: 'embedded', cookies: [], loadedBy: 'click', formAction: false });
  }
  cfg.features = { offline: true, search: o.type === 'online-games' && o.variant === 'portal', reviews: false, map: o.type === 'hotel-casino' };
  cfg.lint = { allow: [] };
  cfg.contactEndpoint = o.contactEndpoint || '';
  cfg.lastUpdated = o.dates && o.dates.lastUpdated;
  cfg.legalUpdated = { terms: legalUpdated.terms, privacy: legalUpdated.privacy, cookies: legalUpdated.cookies };
  cfg.themeColor = { light: themes.light && themes.light.themeColor, dark: themes.dark && themes.dark.themeColor };
  if (o.type === 'social-casino') {
    const games = [];
    (opt.games && opt.games.house || []).forEach((g, i) => games.push({ engine: ENGINE_ID[g.engine] || g.engine, slug: g.slug, name: g.name, order: i + 1 }));
    (prag.demos || []).forEach((d) => games.push({ provider: 'pragmatic', slug: d, featured: d === prag.featured, order: games.length + 1 }));
    cfg.typeOptions = {
      currency: opt.currency, games,
      pragmatic: { enabled: !!prag.enabled, writtenConsent: writtenConsentString(prag.writtenConsent), demoUrl: prag.demoUrl || PRAGMATIC_DEFAULTS.demoUrl, params: { ...PRAGMATIC_DEFAULTS.params, ...(prag.params || {}) } },
      purchases: !!(opt.purchases && opt.purchases.enabled),
      ageVerification: opt.ageVerification ? opt.ageVerification.method : 'self-declaration',
    };
  } else {
    const { scraped, realMoneyLinks, sweepstakes, ...rest } = opt;
    void scraped; void realMoneyLinks; void sweepstakes;
    cfg.typeOptions = rest;
  }
  return cfg;
}

/** concept.json (SPEC 4.3) from an order; siblings of the same type from the sites on disk / seed. */
export function orderToConcept(order, { root = repoRoot() } = {}) {
  const c = order.concept || {};
  const siblings = [];
  for (const s of listSites(root)) {
    if (s.slug === order.orderId) continue;
    const fp = lightFingerprint(s, root);
    if ((fp.type || 'social-casino') !== order.type) continue;
    siblings.push({ slug: s.slug, family: fp.family || null, paletteNames: fp.paletteNames || (fp.palette || []).map((p) => p.name).filter(Boolean), motifKeywords: fp.keywords || [], homeSummary: fp.homeSummary || '' });
  }
  return {
    title: c.title, family: c.family, era: c.era, place: c.place, craft: c.craft, world: c.world, boldMove: c.boldMove,
    vocabulary: c.vocabulary || [],
    artwork: c.artwork || { rule: 'objects-and-places-only', subjects: [], avoid: [] },
    palette: order.palette ? { colours: order.palette.colours, themes: order.palette.themes } : null,
    fonts: order.typography ? { display: order.typography.display && order.typography.display.family, body: order.typography.body && order.typography.body.family, ...(order.typography.numeric ? { numeric: order.typography.numeric.family } : {}) } : null,
    motion: { easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    voice: order.copy && order.copy.voice ? order.copy.voice : null,
    antiReferences: c.antiReferences || [],
    siblings,
  };
}

/** Keep hand-editable fields (games[].skin|rtp, typeOptions.games[].skin|rtp) and keys the order does not produce. */
export function mergePreserving(derived, existing) {
  if (!existing) return derived;
  const out = { ...derived };
  for (const [k, v] of Object.entries(existing)) if (!(k in out)) out[k] = v;
  const keepSkins = (list, old) => (Array.isArray(list) && Array.isArray(old)
    ? list.map((g) => { const o = old.find((x) => x.slug === g.slug); if (!o) return g; const r = { ...g }; for (const f of ['skin', 'rtp']) if (o[f] !== undefined) r[f] = o[f]; return r; })
    : list);
  if (out.games) out.games = keepSkins(out.games, existing.games);
  if (out.typeOptions && out.typeOptions.games && existing.typeOptions) out.typeOptions = { ...out.typeOptions, games: keepSkins(out.typeOptions.games, existing.typeOptions.games) };
  return out;
}

/** Keys of `derived` whose values differ from `existing` (for --check). */
export function diffDerived(derived, existing) {
  const out = [];
  for (const [k, v] of Object.entries(derived)) {
    if (!existing || JSON.stringify(stripSkins(existing[k])) !== JSON.stringify(stripSkins(v))) out.push(k);
  }
  return out;
}
function stripSkins(v) {
  return JSON.parse(JSON.stringify(v ?? null, (k, x) => (k === 'skin' || k === 'rtp' ? undefined : x)));
}

export { exists };
