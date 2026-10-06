// Lint rules of the social-casino type (ids 'sc.*'), moved out of
// engine/build.mjs with their messages unchanged apart from file paths.
//
// Each rule: { id, phase, level, factory?, run(input, report) }.
//   phase   where engine/build.mjs runs it (engine/lib/pack.mjs PHASES):
//             file           every text file in the build, before the engine's file rules
//             file-end       every text file, after the engine's file rules
//             page           every page, after the engine's head checks
//             markup-chrome  every page's tags, after the engine's CSP checks
//             markup         every page's tags, after the CSP meta check (input.policy)
//             site           once, after the page loops
//             config         once, after the engine's placeholder check
//   level   the rule's usual level ('error', 'strict' = error only under --strict, 'warn');
//           report.error/strict/warn decide per message.
//   factory true for the mandatory rules (pack.mandatory.pageLints): a site can never switch them off.
//
// input always has { ctx, cfg, site, out } plus the phase's own fields.

import fs from 'node:fs/promises';
import path from 'node:path';
import { plainText, cspOf } from '../../engine/lint/markup.mjs';
import { COVERS } from '../../engine/lib/art.mjs';
import { FILTERS } from '../../engine/lib/ui/tiles.mjs';

const PRAGMATIC_DATA = 'data/pragmatic-games.json';
const TRADEMARK = 'Pragmatic Play and game names are trademarks of their owners; we are not affiliated. Megaways is a trademark of Big Time Gaming. Nobody named here endorses this site.';
// The facts a Pragmatic Play page can mark with data-verify (engine/pages/pragmatic-game.mjs).
const VERIFIABLE = ['grid', 'pays', 'volatility', 'topPayout', 'rtp', 'released', 'bonus'];
const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// The last one: no ranking the games against each other ("the highest of the
// games here"). It draws attention to the biggest payout, and the line-up changes.
export const FORBIDDEN = [/\bdeposit/i, /\bwithdraw/i, /cash[\s-]?out/i, /bonus code/i, /real[\s-]money wins?/i, /win big/i, /jackpot/i, /\bhurry\b/i, /don[’']t miss out/i,
  /\b(highest|biggest|largest|best)\b[^.]{0,40}\b(of the games|on the site|here)\b/i];

/**
 * The demo hosts in a CSP: frame-src is exactly the frame hosts while the
 * demos are on ('none' while they're off), and connect-src lists them too
 * (pragmatic.js checks the demo can be reached) only while they're on.
 */
function demoCspProblems(ctx, policy, where) {
  const out = [];
  const csp = cspOf(policy);
  const hosts = ctx.pragmaticOn ? ctx.cfg.pragmatic.frameHosts || [] : [];
  const frames = csp['frame-src'] || [];
  const wantFrames = hosts.length ? hosts : ["'none'"];
  if (frames.join(' ') !== wantFrames.join(' ')) out.push(`${where}: CSP frame-src is "${frames.join(' ')}", expected "${wantFrames.join(' ')}"`);
  const connect = csp['connect-src'] || [];
  for (const h of hosts) if (!connect.includes(h)) out.push(`${where}: CSP connect-src lacks the demo host ${h}, so the demo's reachability check would fail`);
  for (const h of ctx.cfg.pragmatic?.frameHosts || []) if (!ctx.pragmaticOn && connect.includes(h)) out.push(`${where}: CSP connect-src names the demo host ${h} while the demos are switched off`);
  return out;
}

const gamesOf = (ctx) => (Array.isArray(ctx.pragmaticData.games) ? ctx.pragmaticData.games : []);

export const rules = [
  // ---------- every text file ----------
  {
    id: 'sc.forbidden-terms',
    phase: 'file',
    level: 'error',
    run({ rel, text }, r) {
      for (const re of FORBIDDEN) if (re.test(text)) r.error(`${rel}: forbidden wording ${re} ("${text.match(re)[0].replace(/\s+/g, ' ')}")`);
    },
  },
  {
    // With the demos off, no script or data file points at Pragmatic Play's servers (pages: sc.pragmatic-off-pages).
    id: 'sc.pragmatic-off',
    phase: 'file',
    level: 'error',
    run({ ctx, rel, src, isHtml }, r) {
      if (!ctx.pragmaticOn && !isHtml && /pragmaticplay\.net/.test(src)) r.error(`${rel}: mentions pragmaticplay.net while the demos are switched off`);
    },
  },
  {
    // With them on, the pages still carry no playable demo address: a demo opened
    // outside our page would escape the session clock, reality checks and limits.
    id: 'sc.demo-address',
    phase: 'file',
    level: 'error',
    run({ rel, src, isHtml }, r) {
      if (isHtml && /openGame\.do/.test(src)) r.error(`${rel}: contains a playable Pragmatic Play demo address (openGame.do); only pragmatic.js builds it, after Play`);
    },
  },
  {
    // GambleAware closed on 31 March 2026: signpost GamCare and the NHS instead.
    id: 'sc.helplines',
    phase: 'file-end',
    level: 'error',
    run({ rel, src, isHtml }, r) {
      if (isHtml && /href="https?:\/\/(?:www\.)?(?:be)?gambleaware\.org/i.test(src)) r.error(`${rel}: links to (Be)GambleAware, which closed in March 2026 (use GamCare or the NHS)`);
    },
  },

  // ---------- every page ----------
  {
    id: 'sc.disclaimer-verbatim',
    phase: 'page',
    level: 'error',
    factory: true,
    run({ ctx, html, rel }, r) {
      if (!html.includes(ctx.disclaimer)) r.error(`${rel}: disclaimer missing`);
    },
  },
  {
    // The age notice ribbon opens every page, with the disclaimer verbatim.
    id: 'sc.age-ribbon-first',
    phase: 'markup-chrome',
    level: 'error',
    factory: true,
    run({ ctx, html: s, rel }, r) {
      const ribbon = s.search(/<[a-z]+ class="age-notice"/);
      const head = s.indexOf('<header class="masthead"');
      if (ribbon < 0) r.error(`${rel}: no .age-notice ribbon`);
      else {
        if (head >= 0 && ribbon > head) r.error(`${rel}: the .age-notice ribbon comes after the masthead`);
        const block = s.slice(ribbon, head > ribbon ? head : undefined);
        if (!plainText(block).includes(ctx.disclaimer)) r.error(`${rel}: the .age-notice ribbon doesn't carry the disclaimer verbatim`);
      }
    },
  },
  {
    // frame-src and connect-src name Pragmatic Play's host only while the demos are on.
    id: 'sc.demo-csp',
    phase: 'markup',
    level: 'error',
    run({ ctx, rel, policy }, r) {
      if (policy) for (const m of demoCspProblems(ctx, policy, rel)) r.error(m);
    },
  },
  {
    id: 'sc.trademark-line',
    phase: 'markup',
    level: 'error',
    factory: true,
    run({ ctx, html: s, rel }, r) {
      if (!ctx.pragmaticOn) return;
      const footer = s.slice(s.indexOf('<footer class="colophon"'), s.indexOf('</footer>') + 9);
      if (!plainText(footer).includes(TRADEMARK)) r.error(`${rel}: the footer lacks the trademark line "${TRADEMARK.slice(0, 48)}…"`);
    },
  },
  {
    // Pragmatic Play: each demo page has one stage for its own game, with the markup pragmatic.js needs.
    id: 'sc.pragmatic-stage',
    phase: 'markup',
    level: 'error',
    run({ ctx, page, html: s, rel, tags }, r) {
      const stages = tags.filter((t) => t.attrs['data-game'] === 'pragmatic');
      if (!ctx.pragmaticOn) {
        if (stages.length) r.error(`${rel}: a Pragmatic Play stage while the demos are switched off`);
        return;
      }
      const game = ctx.games.find((g) => g.path === page.path);
      const want = game?.provider === 'pragmatic' ? game : page.path === '/' ? ctx.featured : null;
      if (!want) {
        if (stages.length) r.error(`${rel}: a Pragmatic Play stage on a page that isn't a demo page`);
        return;
      }
      if (stages.length !== 1) {
        r.error(`${rel}: ${stages.length} Pragmatic Play stages, expected one for ${want.name}`);
        return;
      }
      const st = stages[0].attrs;
      const symbol = new Map(gamesOf(ctx).map((g) => [g.slug, g.symbol])).get(want.slug);
      if (st['data-symbol'] !== symbol) r.error(`${rel}: stage data-symbol "${st['data-symbol']}" doesn't match pragmatic-games.json ("${symbol}" for ${want.slug})`);
      if (st['data-name'] !== want.name) r.error(`${rel}: stage data-name "${st['data-name']}" isn't "${want.name}"`);
      if (st['data-state'] !== 'idle') r.error(`${rel}: stage starts in state "${st['data-state']}", not idle`);
      const at = s.search(/<figure [^>]*data-game="pragmatic"/);
      const stageHtml = s.slice(at, s.indexOf('</figure>', at));
      for (const hook of ['data-stage', 'data-action="load"', 'data-action="unload"', 'data-status', 'data-blocked']) {
        if (!stageHtml.includes(hook)) r.error(`${rel}: the stage has no [${hook}] (pragmatic.js needs it)`);
      }
      if (/<iframe\b/.test(stageHtml)) r.error(`${rel}: the stage ships an iframe; it must be created only when Play is pressed`);
    },
  },
  {
    id: 'sc.pragmatic-off-pages',
    phase: 'markup',
    level: 'error',
    run({ ctx, html: s, rel }, r) {
      if (!ctx.pragmaticOn && /pragmaticplay\.net/.test(s)) r.error(`${rel}: mentions pragmaticplay.net while the demos are switched off`);
    },
  },

  // ---------- once per build ----------
  {
    // frame-src and connect-src in the hosting headers match the pages, and the demo host is one of the allowed frame hosts.
    id: 'sc.demo-csp-headers',
    phase: 'site',
    level: 'error',
    async run({ ctx, cfg, out }, r) {
      const headers = await fs.readFile(path.join(out, '_headers'), 'utf8');
      for (const m of demoCspProblems(ctx, headers.match(/Content-Security-Policy: (.*)/)?.[1] || '', '_headers')) r.error(m);
      if (ctx.pragmaticOn) {
        let origin = '';
        try {
          origin = new URL(cfg.pragmatic.demoUrl).origin;
        } catch {}
        if (!(ctx.cfg.pragmatic.frameHosts || []).includes(origin)) r.error(`site.config.json: pragmatic.demoUrl's origin "${origin}" isn't in pragmatic.frameHosts, so the CSP would block the demo`);
      }
    },
  },
  {
    // data/pragmatic-games.json: checked whether or not the demos are on.
    id: 'sc.pragmatic-data',
    phase: 'site',
    level: 'error',
    run({ ctx }, r) {
      const REL = PRAGMATIC_DATA;
      const today = new Date().toISOString().slice(0, 10);
      const list = gamesOf(ctx);
      // A site whose config has the demos off may ship an empty list (the template site does).
      if (!list.length && (ctx.pragmaticOn || !Array.isArray(ctx.pragmaticData.games))) r.error(`${REL}: no "games" list`);
      const str = (v) => typeof v === 'string' && v.trim() !== '';
      const strList = (v) => Array.isArray(v) && v.length > 0 && v.every(str);
      const dupes = (key) => {
        const counts = new Map();
        for (const g of list) counts.set(g[key], (counts.get(g[key]) || 0) + 1);
        for (const [v, n] of counts) if (n > 1) r.error(`${REL}: ${key} "${v}" is used by ${n} games`);
      };
      list.forEach((g, i) => {
        const at = `${REL}: games[${i}]${str(g.slug) ? ` (${g.slug})` : ''}`;
        for (const k of ['slug', 'name', 'symbol', 'grid', 'pays', 'summary']) if (!str(g[k])) r.error(`${at}: "${k}" is required`);
        for (const k of ['tags', 'howItPlays']) if (!strList(g[k])) r.error(`${at}: "${k}" must be a non-empty list of strings`);
        if (str(g.slug) && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug)) r.error(`${at}: slug must be lower-case words joined by hyphens`);
        if (str(g.symbol) && !/^[a-z0-9]+$/i.test(g.symbol)) r.error(`${at}: symbol "${g.symbol}" isn't a Pragmatic gameSymbol`);
        if (!['low', 'medium'].includes(g.appeal)) r.error(`${at}: appeal must be "low" or "medium" (games with strong appeal to under-18s are left out: UK CAP)`);
        if (g.rtp != null && !(typeof g.rtp === 'number' && g.rtp > 80 && g.rtp < 100)) r.error(`${at}: rtp must be a percentage between 80 and 100, or null`);
        if (g.released != null && !(Number.isInteger(g.released) && g.released >= 1990 && g.released <= 2100)) r.error(`${at}: released must be a year, or null`);
        if (g.topPayout != null && !(typeof g.topPayout === 'number' && g.topPayout > 0)) r.error(`${at}: topPayout must be a positive number, or null`);
        for (const k of ['features', 'verify']) if (g[k] != null && !(Array.isArray(g[k]) && g[k].every(str))) r.error(`${at}: "${k}" must be a list of strings`);
        for (const k of Array.isArray(g.verify) ? g.verify : []) {
          if (str(k) && !VERIFIABLE.includes(k)) r.error(`${at}: verify lists "${k}", which the page can't mark (use ${VERIFIABLE.join(', ')})`);
        }
        if (g.checked != null && !(typeof g.checked === 'string' && ISO_DATE.test(g.checked))) r.error(`${at}: "checked" must be a date like "2026-10-01", or left out`);
        else if (g.checked > today) r.error(`${at}: "checked" (${g.checked}) is in the future`);
        if (str(g.slug) && !COVERS[g.slug]) r.error(`${at}: no cover for "${g.slug}" in engine/lib/art.mjs COVERS`);
        if (ctx.houseGames.some((h) => h.slug === g.slug)) r.error(`${at}: slug "${g.slug}" is taken by one of our own games`);
      });
      dupes('slug');
      dupes('symbol');
      dupes('name');
    },
  },
  {
    // Sign-off. "verify" lists the facts the research couldn't confirm, and the
    // page only marks them with an invisible data-verify. So while the demos
    // are on, the launch build (--strict) needs every game's "checked" date:
    // the day someone opened that demo from a UK browser, saw it load and
    // compared the page's figures with the game's own information screen.
    id: 'sc.pragmatic-checked',
    phase: 'site',
    level: 'strict',
    run({ ctx }, r) {
      const REL = PRAGMATIC_DATA;
      const list = gamesOf(ctx);
      const unchecked = list.filter((g) => !g.checked);
      if (!ctx.pragmaticOn || !unchecked.length) return;
      const WAYS_OUT = `open each demo from a UK browser, see it load and compare its facts with the game's information screen (the i button), then set "checked": "YYYY-MM-DD"; or set any figure you can't confirm to null; or build with "pragmatic.enabled": false`;
      if (r.strictMode) {
        for (const g of unchecked) r.strict(`${REL}: ${g.slug} has no "checked" date${g.verify?.length ? ` (unconfirmed: ${g.verify.join(', ')})` : ''}`);
        r.strict(`${REL}: before launch, ${WAYS_OUT}`);
      } else {
        r.warn(`${REL}: ${unchecked.length} of ${list.length} demos have no "checked" date, so the launch build (--strict) fails: ${unchecked.map((g) => g.slug).join(', ')}. Before launch, ${WAYS_OUT}${unchecked.some((g) => g.verify?.length) ? `. Facts the research couldn't confirm ("verify"):\n${unchecked.filter((g) => g.verify?.length).map((g) => `           ${g.name}: ${g.verify.join(', ')}`).join('\n')}` : ''}`);
      }
    },
  },

  // ---------- config (after the engine's placeholder check) ----------
  // The Pragmatic Play demos: open decisions (docs/COMPLIANCE.md, section 0, "Режим Pragmatic").
  {
    // Pragmatic's terms allow its games only with its express written consent.
    id: 'sc.written-consent',
    phase: 'config',
    level: 'strict',
    run({ ctx, cfg }, r) {
      if (ctx.pragmaticOn && !String(cfg.pragmatic.writtenConsent || '').trim()) {
        r.strict('site.config.json: pragmatic.writtenConsent is empty. Record Pragmatic Play\'s written consent (reference and date) before launch, or build with --no-pragmatic');
      }
    },
  },
  {
    // Google's social casino policy bars names associated with real-money gambling brands.
    id: 'sc.ads-with-demos',
    phase: 'config',
    level: 'strict',
    run({ ctx, cfg }, r) {
      if (ctx.pragmaticOn && cfg.analytics?.adsConversionId) {
        r.strict('site.config.json: Google Ads measurement is set while the Pragmatic Play demos are on. Advertise a --no-pragmatic build instead (COMPLIANCE.md, section 0, "Режим Pragmatic")');
      }
    },
  },
  {
    // A demo signed off as "checked" whose "verify" list still names facts: the page still marks them as unconfirmed.
    id: 'sc.pragmatic-verify-stale',
    phase: 'config',
    level: 'warn',
    run({ ctx }, r) {
      if (!ctx.pragmaticOn) return;
      const stale = gamesOf(ctx).filter((g) => g.checked && g.verify?.length);
      if (stale.length) {
        r.warn(`${PRAGMATIC_DATA}: facts still marked "verify" in ${stale.length} checked games. Remove each fact you confirmed in the demo's i screen from "verify", or set it to null:\n${stale.map((g) => `           ${g.name}: ${g.verify.join(', ')}`).join('\n')}`);
      }
    },
  },
  {
    // Lobby filter tags on our own games: real filters only, and none of the slot
    // features (free spins, tumbles, Megaways) that only the Pragmatic Play demos have.
    id: 'sc.lobby-filters',
    phase: 'config',
    level: 'error',
    run({ ctx }, r) {
      const keys = FILTERS.map((f) => f.key).filter((k) => k !== 'all');
      const SLOT_FEATURES = ['freespins', 'tumble', 'megaways'];
      for (const g of ctx.houseGames) {
        for (const t of g.tags) {
          if (!keys.includes(t)) r.error(`engine/lib/context.mjs: ${g.slug} has the tag "${t}", which isn't a lobby filter (${keys.join(', ')})`);
          else if (SLOT_FEATURES.includes(t)) r.error(`engine/lib/context.mjs: ${g.slug} has the tag "${t}", but our own games have no free spins, tumbles or Megaways`);
        }
      }
    },
  },
];

/** The rules no site may switch off (D-29). */
export const MANDATORY = ['sc.disclaimer-verbatim', 'sc.age-ribbon-first', 'sc.trademark-line'];
