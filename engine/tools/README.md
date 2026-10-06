# engine/tools

Tools that build, check and measure a site of any type. Every tool takes the
site folder (`sites/<slug>`, a `types/<type>/template-site`, a fixture) and
runs from the repository root. Owner: partition C (qa-tools).

| Tool | Command | What it does |
|---|---|---|
| `check.mjs` | `node engine/tools/check.mjs --site <site-dir> [--report FILE] [--shots [DIR]] [--only=<ids>] [--workers N] [--tmp DIR] [--keep] [--oracle-diff FILE] [--list]` | End-to-end checks in Playwright's Chromium (section map below) |
| `lighthouse.mjs` | `node engine/tools/lighthouse.mjs <dist> --out DIR [--site DIR] [--urls /,/games/] [--form-factors mobile,desktop] [--runs N]` | Lighthouse 12, mobile and desktop, on `/`, `/games/` and one game page; `summary.json`; exit 1 below the thresholds |
| `make-images.mjs` | `node engine/tools/make-images.mjs --site <site-dir> [--only icons\|cards] [--dry] [--dist DIR]` | Favicons, app icons and 1200 × 630 share cards from the site's artwork; `--dry` says what would change |
| `serve.mjs` | `node engine/tools/serve.mjs <dist> [--port=0] [--host=127.0.0.1]` | Static server with the production cache headers; the URL is the first stdout line |
| `simulate-21.mjs` | `node engine/tools/simulate-21.mjs [<site-dir>] [hands]` | Monte Carlo return to player of the twenty-one maths (C in Phase 1, B from Phase 3) |
| `subset-fonts.py` | `python3 engine/tools/subset-fonts.py <site-dir> [ttf-folder]` | Subsets `engine/fonts/sources/*.ttf` into the site's woff2 files and `data/font-coverage.json` |
| `font-fallbacks.mjs` | `node engine/tools/font-fallbacks.mjs <site-dir> [--measure] [--check]` | Metric-matched fallback faces in the site's `theme/tokens.css` |
| `lib/headers.mjs`, `lib/glyphs.mjs` | imported by `engine/build.mjs` | `_headers` parsing and Cache-Control; glyph coverage |
| `lib/harness.mjs` | imported by the checks | Roots, pass/fail lines by section, throwaway builds, the temp repository copy, static server, browser helpers |

## check.mjs

```
CHECK_TIMEOUT_MIN=15 node engine/tools/check.mjs --site sites/opalquestlounge \
  --report reports/opalquestlounge/check.json --oracle-diff engine/tools/oracle/opalquestlounge.json
node engine/tools/check.mjs --site sites/opalquestlounge --only=pages,offline --workers 2
```

A full run takes about 7 minutes on 4 CPUs: run it in the background and poll
the report, never two at once (with `FACTORY_X` set, a run without `--only`
holds `$FACTORY_X/check.lock`). It builds into a temporary folder (`--tmp`, else
the system one) one build per entry of the type pack's `checks.builds` whose
sections are wanted (social casino: `pragmatic`, `fallback`, `ga`); the deploy
section also builds a changed copy of the repository (`engine/`, `types/` and
the site, `node_modules` linked).

**Sections.** Engine sections live in `check/sections/<id>.mjs`, the type pack's
in `types/<type>/checks/index.mjs` (each with `after: <id>` for its place), and
a site may add `sites/<slug>/checks.mjs` (default export `async (t, api) => {}`,
run last as section `site`). A module exports `[{ id, title, group?, after?, run(t) }]`;
`t` holds `browser`, `builds` (by name, each with `base`, `dir`, `version`, `edit`),
`modes` (the builds the `pages` group covers), `buildsFor(group)`, `fx` (fixtures
from `checks.json`), `cfg`, `pack`, `site`, `shots`, `workers(n)`, `trace`, `axe`
(violations for the report) and `harness` (every helper: `expect`, `context`,
`watch`, `until`, `mounted`, `stageInfo`, ...). Ids are unique across the
engine and every pack; a section runs only when a build feeds its group.

**Section id map** (`--only` takes an id or a group; an unknown one exits 2;
`--list` prints this table from the code):

| Id | `--only` group | From | Title (= the oracle's section) | Checks (opalquestlounge) |
|---|---|---|---|---|
| `builds` | `builds` | engine (runner) | Builds | 3 |
| `pages` | `pages` | engine | Pages at 360, 768 and 1440 px, both modes: no sideways scroll, no errors, nothing from other origins | 10 |
| `first-screen` | `pages` | engine | Home first screen on phones (both modes): the play control above the dock; demo credits by one name | 6 |
| `stage` | `stage` | types/social-casino | Pragmatic Play demo stage (host stubbed) | 113 |
| `keyboard` | `keyboard` | engine | Keyboard-only play | 10 |
| `tables` | `tables` | types/social-casino | Our tables: the betting board, the Twenty-One canvas, Space, stake focus and locks mid-round | 11 |
| `lobby` | `lobby` | types/social-casino | Lobby filters on /games/ | 11 |
| `lobby-links` | `lobby` | types/social-casino | Lobby on /games/: nav and dock links into a group the filter has hidden | 15 |
| `lobby-layout` | `lobby` | types/social-casino | Lobby layout on / and /games/, 320–1440 px in 1 px steps: whole tags, bodies inside tiles, rows that close | 4 |
| `consent` | `consent` | engine | Consent with a test GA4 ID | 16 |
| `dialogs` | `dialogs` | engine | Dialogs | 29 |
| `prefs` | `prefs` | engine | Preferences: reduced motion and the dark theme | 8 |
| `chrome` | `chrome` | engine | Site chrome: the header, the dock, Settings, breaks and limits over time, the age question, no JavaScript | 28 |
| `axe` | `axe` | engine | axe-core: WCAG 2.2 AA and best practice, both themes, 1440 and 390 px | 1 |
| `offline` | `offline` | engine | Offline: the saved copy of the home page, our own games, the safer-play tools and the page a visitor landed on | 6 |
| `deploy` | `deploy` | engine | Deploys: a returning visitor runs the new scripts and styles from the first view, with or without the service worker | 6 |
| | | | **Total** | **277** |

Reserved ids (MASTER-PLAN D-53), not yet written: engine `sw jsonld legal lcp i18n`;
social-casino `policy`; online-games `embed catalogue search ad-distance`;
hotel-casino `gallery map cta casino-mode`.

**checks.json.** `sites/<slug>/checks.json` (schema `checks.schema.json`)
holds what the checks used to hardcode for one site: `storagePrefix` (default
`site.config.json` `storagePrefix` + `.`), `currency` words, `embedHost` and
`embedLabel` (the stubbed third-party host), `stageSelector`, `demoPages`,
single `pages` (demo, safer-play, offline landing and unvisited pages), our
`games` by engine id (`roulette`, `blackjack`, `slot`: slug, result patterns),
the `lobby` page and groups, the share-card fans (`images`) and `extraPages`.
It is validated with Ajv when the repository has it (else only its top-level
keys are checked, and the report says which).

**Report** (`--report FILE`, rewritten after every section):

```
{ site, slug, type, pack, startedAt, durationMs, partial, only,
  checksJson: { file, validator },
  totals: { passed, failed, skipped },          // skipped = sections not run
  durations: { <id>: seconds },
  sections: [{ id, group, title, passed, failed, seconds, done, lines: [{ ok, text }] }],
  skipped: [{ id, title, reason }],
  failures: [{ section, text }],
  axe: [{ rule, impact, help, target, why, mode, theme, width, page, state? }],
  builds: { <name>: assetVersion },
  oracle?: { file, ok, counts, unknownSections, notRun, missing, extra, expectedTotal } }
```

`partial: true` while the run is going and when it stopped early
(`CHECK_TIMEOUT_MIN`, default 30, or SIGTERM/SIGINT); gates read a partial
report as failed. `CI=true` adds `::error` annotations.

**Oracle.** `oracle/opalquestlounge.json` is the pre-move run (277 passed,
0 failed, 408 s; `{ capturedFrom, passed, failed, seconds, checks: [{ section, name }] }`).
`--oracle-diff` compares the sections this run ran: a per-section pass count
that differs fails the run (exit 1); missing and extra check names are
listed, with asset-version hashes (`vb972cd2f14`) ignored. A counts-only oracle
`{ sections: [{ title, passed }], total }` is accepted too.

## lighthouse.mjs

```
node engine/tools/lighthouse.mjs "$X/after" --out reports/opalquestlounge/lighthouse --site sites/opalquestlounge
```

Lighthouse from the repository's `node_modules`, else `$LH_DIR/node_modules`
(`LH_DIR` from the environment or `.git/factory-env`); Chromium from
Playwright (`CHROME_PATH` overrides). Thresholds from
`schemas/board.schema.json` `thresholds.lighthouse` when present, else
categories >= 95, LCP < 2000 ms, CLS < 0.05. `summary.json`:
`[{ url, path, formFactor, preset, perf, a11y, bp, seo, lcp, lcpMs, cls, tbt, html, json, runs, ok }]`.
Exit 1 below a threshold, 3 when Lighthouse or Chromium is missing.
