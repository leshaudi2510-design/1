# Type pack: social-casino

UK free-to-play social casino sites: virtual currency, no real money, no prizes, adults 18+. Site #1 is `sites/opalquestlounge`. Status: **full** (contract v0, Phase 1). Plan: `docs/factory/MASTER-PLAN.md` 6.1.

## What the pack does today (Phase 1)

| Member | What | File |
|---|---|---|
| `pages(ctx, common)` | home, the lobby, one page per game (house or Pragmatic Play demo), then the engine's about page, the responsible-gaming page, terms, privacy, cookies, contact, 404 and offline, in sitemap order | `pack.mjs` (page modules still in `engine/pages/`) |
| `styles.partials`, `styles.extraCss` | all twelve engine partials; the per-game cover colours from `engine/lib/art.mjs` | `pack.mjs` |
| `lint.rules` | the type's rules, moved out of the engine's build with their messages: `sc.forbidden-terms`, `sc.pragmatic-off`, `sc.demo-address`, `sc.helplines`, `sc.disclaimer-verbatim`, `sc.age-ribbon-first`, `sc.demo-csp`, `sc.trademark-line`, `sc.pragmatic-stage`, `sc.pragmatic-off-pages`, `sc.demo-csp-headers`, `sc.pragmatic-data`, `sc.pragmatic-checked`, `sc.written-consent`, `sc.ads-with-demos`, `sc.pragmatic-verify-stale`, `sc.lobby-filters` | `lint.mjs` |
| `mandatory.pageLints` | `sc.disclaimer-verbatim`, `sc.age-ribbon-first`, `sc.trademark-line`: no site may switch them off | `lint.mjs` |
| `checks.builds` | `pragmatic` (demos on), `fallback` (demos off), `ga` (demos on, GA4 test ID), with the check sections each feeds | `pack.mjs` |
| `templateSite` | the site `tools/new-site.mjs` copies | `template-site/` |

The chrome (age ribbon, masthead with balance and session clock, dock, the five dialogs), the game code (`engine/games/_legacy/`) and the client modules are still the engine's in Phase 1; Phase 2 moves them into this pack (`pages/`, `ui/`, `client/`, `content/`), Phase 3 replaces the legacy games with `engine/games/{reel-slot,roulette,blackjack}` skins.

## Data

- `policy-urls.json`: the official pages the type's rules rely on. **Every entry is `"verified": null`**: no page has been opened live from this project, so no quote may be a failing gate (MASTER-PLAN D-13). Only `tools/policy-recheck.mjs --initial <name>` writes the verified fields.
- `helplines.json`: GamCare and NHS signposting for GB; GambleAware (closed 31 March 2026) is banned.
- `data/pragmatic-catalog.json`: Pragmatic Play demo facts only (no prose); each site writes its own words in `data/pragmatic-games.json`.
- `data/known-studio-titles.json`: other studios' titles a house game must not be named after (seed list; owned by partition B from Phase 3).
- `schema/order-options.schema.json`: the order's `typeOptions` for this type (variant `own-games` or `demo-lobby`, currency, games, purchases, age verification), read by `tools/validate-order.mjs`.

## Template site

`node engine/build.mjs types/social-casino/template-site --json` gives no problems and the `placeholder` warnings (every operator field is a `[placeholder]`); `--strict` fails on them. Its theme is the reference token set in greys of equal luminance, its images are neutral placeholders and its fonts are the Archivo and Radio Canada subsets. The demos are off and `data/pragmatic-games.json` is empty.
