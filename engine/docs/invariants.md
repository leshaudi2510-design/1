# Invariants

The factory's non-negotiable properties of a built site, each with a stable id. The ids are the shared vocabulary of the compliance layer:

- `compliance-judge` cites an invariant id (or a policy id) in the `rule` field of every finding;
- `compliance-auditor` maps every invariant that applies to the site's type to the place in the build that satisfies it and the check that proves it; anything unmapped is blocking;
- `tools/docs.mjs` renders one row per applicable id into each site's `COMPLIANCE.md` (`engine/docs/templates/COMPLIANCE.*.md`);
- `tools/probe.mjs` names its live assertions after these ids where one exists.

Sources: SPEC 1.1, MASTER-PLAN 3.2-3.4, 6.1-6.4, D-13, D-25, D-29; SITE-TYPES 2-4; the reference build `opalquestlounge/` (`build.mjs`, `COMPLIANCE.md`). Format after ECC `agents/spec-miner.md` (A-19). Owner of this file: partition H. The pack-level detail (exact strings, selectors, data files) lives in each pack's `types/<type>/docs/invariants.md` (partition A or T); this file is the index and the engine baseline. Never add an invariant that the code does not or will not enforce, and never describe behaviour that has not been read in the code or the plan.

## Conventions

Each invariant is a `### Invariant:` heading with one HTML comment of metadata:

| Key | Meaning |
|---|---|
| `id` | `ENG-*` every type; `SC-*` social-casino; `OG-*` online-games; `HC-*` hotel-casino; `PPC-*` PPC kit and accounts; `POL-*` the policy mechanism. Ids are never reused or renumbered. |
| `applies` | `all`, a type, a variant (`demo-lobby`), a mode (`casinoMode:B`) or an audience (`audience:child-likely`) |
| `enforced` | the lint id(s) or code that make it true at build time (`engine.*`, `sc.*`, `games.*`, `hotel.*`, `ppc.*`, `factory.*` per MASTER-PLAN 3.2) |
| `verified_by` | the check section (`engine/tools/check.mjs#<id>`), probe, ship-gate tick or human step that proves it |
| `basis` | `factory` (the studio's own rule: a hard gate, never demoted) or `policy:<entry>` (rests on a quote in `policy-urls.json`; runs at `warn` until that entry is verified, D-13) |
| `status` | `existing` (enforced today by `opalquestlounge/build.mjs` or `tools/check.mjs`, moves with the engine in Phase 1), `P1`..`P5` (phase in which enforcement lands), `stub` (type pack not yet built) |

Lint ids are given as the master plan names them; Phase 1 keeps today's free-text messages and the ids arrive with `engine/lint/report.mjs` in Phase 2.

## Mandatory page lints per type (D-29)

Pack-owned, applied by the engine, never demoted by `site.config.lint.allow[]`:

| Type | `mandatory.pageLints` | Phase |
|---|---|---|
| social-casino | `sc.disclaimer-verbatim`, `sc.age-ribbon-first`, `sc.trademark-line` | 1 (contract v0) |
| online-games | none in the stub (`type-stub` warning) | full pack 4 |
| hotel-casino | `hotel.rg-block`, `hotel.mode-a-no-casino-terms`, `hotel.mode-a-plus-amenity-only` | 4 (stub has none) |

---

## 1. Engine baseline (every type)

### Invariant: the fixed page set exists on every site
<!-- id: ENG-PAGES-01; applies: all; enforced: engine/pages (about, contact, legal terms/privacy/cookies, accessibility, misc 404/offline) + pack.pages; verified_by: engine/tools/check.mjs#pages, #legal; basis: factory; status: existing (accessibility statement: P2) -->
`/`, `/about/`, `/contact/`, `/terms/`, `/privacy/`, `/cookies/`, `/accessibility/`, 404, and `/offline/` only where the pack enables the service worker (`pack.offline`). The accessibility statement joins the set for every type (D-03).

### Invariant: the Content Security Policy is static, hash-based and generated with the build
<!-- id: ENG-CSP-01; applies: all; enforced: CSP and _headers generation in the engine; lint: no inline style attribute, no <style>, no on* handlers, every inline script hash present in script-src; verified_by: engine/tools/check.mjs#pages, #deploy, tools/probe.mjs (CSP hash vs built _headers); basis: factory; status: existing -->
`frame-src`, `connect-src` and `form-action` list only hosts declared by the pack and `thirdParties[]` (`pack.csp(ctx)`); with nothing declared they stay closed.

### Invariant: nothing third-party loads before interaction and consent
<!-- id: ENG-3P-01; applies: all; enforced: engine.no-third-party-before-consent (existing rule, generalised), engine.no-static-iframe; verified_by: engine/tools/check.mjs#pages, #consent, tools/probe.mjs no-third-party-before-consent; basis: factory; status: existing -->
No cross-origin request on page load; embeds are click-to-load behind a consent category; no `<iframe>` in static HTML unless its host's registry entry is `loadedBy: static`.

### Invariant: every third-party host is registered
<!-- id: ENG-3P-02; applies: all; enforced: engine.third-party-unregistered, engine.iframe-allow-permitted; verified_by: build --strict; basis: factory; status: P2 -->
Each host appears in `site.config.thirdParties[]` with purpose, consent category, cookies and `loadedBy`; the cookies page is generated from that registry.

### Invariant: consent defaults are denied and choices are equal
<!-- id: ENG-CONSENT-01; applies: all; enforced: engine/client/lib/consent.js; verified_by: engine/tools/check.mjs#consent; basis: factory; status: existing -->
Consent Mode v2 basic: all seven signals default `denied`, `ads_data_redaction: true`, `url_passthrough: false`; `gtag.js` is not requested until Accept; "Reject all" and "Accept all" are equally prominent and a "Manage" path exists; the banner is first in tab order and does not obscure focus; withdrawing is as easy as giving; consent is asked again after 12 months; with no analytics configured there is no banner and no Google request at all.

### Invariant: conversions and analytics respect each consent state
<!-- id: ENG-CONSENT-02; applies: all; enforced: engine/client/track.js (two gates: analytics_storage for analytics, ad_storage + ad_user_data for Ads conversions; ad_personalization only when analytics.personalisation is true); verified_by: engine/tools/check.mjs#consent (four states: none, analytics only, ads only, both); basis: factory; status: P2 -->

### Invariant: storage is disclosed key by key
<!-- id: ENG-STORAGE-01; applies: all; enforced: one storage list rendered into Cookies and Privacy, keys prefixed with storagePrefix; verified_by: engine/tools/check.mjs#legal; basis: factory; status: existing -->
Every `localStorage` and cookie key the code writes appears in the policies; keys carry the site's own `storagePrefix` (no two sites share a prefix).

### Invariant: the operator is disclosed honestly and consistently
<!-- id: ENG-OPERATOR-01; applies: all; enforced: engine.placeholder (no [..] placeholders under --strict), engine.operator-consistency (footer == Terms == Organization JSON-LD); verified_by: build --strict, tools/probe.mjs, ship-gate tick operatorDetails; basis: factory; status: existing (placeholder) / P2 (cross-check) -->
Operator name, registration number and registry, address and email on About, Contact, the footer, the Terms and `Organization` JSON-LD; the entity matches the Google Ads verified advertiser.

### Invariant: identical HTML for every visitor
<!-- id: ENG-NOCLOAK-01; applies: all; enforced: static build, no user-agent, geo or referrer branching, no redirects; verified_by: tools/probe.mjs (same HTML per UA, geo and referrer); basis: factory; status: existing -->
The age gate, where present, is a dialog over the same HTML.

### Invariant: technical SEO basics hold on every page
<!-- id: ENG-SEO-01; applies: all; enforced: existing lint (one h1, title <= 60, description <= 155, canonical, lang, valid JSON-LD with resolvable @id, no broken links or anchors, no duplicate ids, OG image 1200x630); verified_by: build --json, engine/tools/check.mjs#jsonld; basis: factory; status: existing -->

### Invariant: no self-serving or fabricated social proof
<!-- id: ENG-PROOF-01; applies: all; enforced: no aggregateRating or review emitted by the engine; hotel.no-self-serving-rating, hotel.review-provenance (hotel-casino); verified_by: engine/tools/check.mjs#jsonld, compliance-judge; basis: factory; status: existing (engine stance) / P4 (hotel lints) -->
No invented ratings, review counts, testimonials or urgency timers.

### Invariant: budgets hold
<!-- id: ENG-BUDGET-01; applies: all; enforced: build budgets (pack.budgets; default first view <= 150 KB gzip, service-worker precache <= 220 KB gzip); verified_by: build --json, engine/tools/lighthouse.mjs (>= 95 every category, LCP < 2.0 s, CLS < 0.05); basis: factory; status: existing (hotel-casino first view <= 100 KB: P4) -->

### Invariant: accessibility to WCAG 2.2 AA as far as engines can check, the rest listed
<!-- id: ENG-A11Y-01; applies: all; enforced: accessible components (native dialog, roving focus, aria-live results, 44 px targets, reduced motion, forced colours); verified_by: engine/tools/check.mjs#axe (0 violations, both themes, 1440 and 390 px; wcag22aa + target-size from P2), #keyboard, #prefs; basis: factory; status: existing -->
`COMPLIANCE.md` lists the WCAG 2.2 criteria no engine checks and never claims "verified" from engines alone (D-25).

### Invariant: dates are honest
<!-- id: ENG-DATES-01; applies: all; enforced: lastUpdated and legalUpdated warnings against git history (existing); verified_by: build --json, ship-gate tick datesHonest; basis: factory; status: existing -->

### Invariant: nothing generic or default ships
<!-- id: ENG-NODEFAULT-01; applies: all; enforced: engine.default-content, engine.generic-cover, engine.placeholder under --strict; verified_by: build --strict (template sites must fail it, MASTER-PLAN 9.3); basis: factory; status: P1 (template) / P2 (ids) -->

### Invariant: no internal paths, secrets or other brands leak into a build
<!-- id: ENG-LEAK-01; applies: all; enforced: engine.internal-path, engine.secret-like, engine.brand-leak (strict problems; contract-change note 11); verified_by: build --strict, release-manager pre-ship scan; basis: factory; status: P2 -->

### Invariant: sites never link to each other
<!-- id: ENG-CROSSLINK-01; applies: all; enforced: engine.cross-link (any href to another registry domain fails); verified_by: build --strict; basis: factory; status: P2 -->
Each site has its own domain, storage prefix, service-worker cache name, mailbox, icons and share cards (SPEC 15.7).

### Invariant: every site is a distinct product within its type
<!-- id: ENG-UNIQUE-01; applies: all; enforced: tools/uniqueness.mjs --pre/--post (thresholds per type), factory.cross-site-similarity across types; verified_by: CI uniqueness job, three uniqueness-skeptic agents (at most one convinced), ship-gate; basis: factory; status: P1 (mechanical) / P3 (panel) -->

### Invariant: text renders in the site's own fonts
<!-- id: ENG-FONTS-01; applies: all; enforced: glyph coverage lint against data/font-coverage.json, engine.font-banned, engine.font-source-missing; verified_by: build --json; basis: factory; status: existing (coverage) / P2 (ids) -->

### Invariant: deploys are versioned and cache-safe
<!-- id: ENG-DEPLOY-01; applies: all; enforced: /assets/v<hash>/ URLs, hashed font names, exactly one max-age per file in _headers, sw.js no-cache, *.pages.dev noindex; verified_by: engine/tools/check.mjs#deploy, #sw, tools/probe.mjs pagesdev-noindex; basis: factory; status: existing -->

### Invariant: multilingual sites declare symmetric alternates
<!-- id: ENG-HREFLANG-01; applies: sites with more than one locale (hotel-casino); enforced: engine.hreflang-symmetry, sitemap xhtml:link; verified_by: build --strict, engine/tools/check.mjs#i18n; basis: policy (Google localized-versions guidance, unverified); status: P4 -->

## 2. social-casino

### Invariant: every page carries the disclaimer verbatim
<!-- id: SC-DISC-01; applies: social-casino; enforced: sc.disclaimer-verbatim (mandatory); verified_by: engine/tools/check.mjs#pages, tools/probe.mjs (every sitemap URL); basis: factory; status: existing -->
The site's own disclaimer string, in the age-notice ribbon above the masthead, the footer, the age gate and the Terms. Opal Quest Lounge's text: "Free-to-play social casino game. No real-money gambling and no prizes of real-world value. For adults 18+."

### Invariant: the age ribbon comes first
<!-- id: SC-AGE-01; applies: social-casino; enforced: sc.age-ribbon-first (mandatory; the .age-notice ribbon precedes the masthead in the DOM); verified_by: engine/tools/check.mjs#chrome, tools/probe.mjs; basis: factory; status: existing -->

### Invariant: 18+ is confirmed before any game
<!-- id: SC-AGE-02; applies: social-casino; enforced: age-boot script opens the age dialog before app.js; play is refused without "Yes"; "No" locks games on the device for 30 days; verified_by: engine/tools/check.mjs#chrome, #dialogs; basis: factory; status: existing -->
This is self-declaration, not age verification. The age-assurance method is an owner decision recorded per order (owner question 11; `COMPLIANCE.md` 0(c) of the reference site).

### Invariant: responsible-gaming tools are always on
<!-- id: SC-RG-01; applies: social-casino; enforced: RG client modules (session clock in the masthead; reality check every 15, 30 or 60 minutes, default 30; daily time limit, lowering applies at once, raising from tomorrow; breaks of 5 minutes, 24 hours, 7 and 30 days that cannot be ended early); the /responsible-gaming/ page; verified_by: engine/tools/check.mjs#chrome; basis: factory; status: existing -->

### Invariant: help is signposted to GamCare and the NHS, never to (Be)GambleAware
<!-- id: SC-HELP-01; applies: social-casino; enforced: sc.helplines (GamCare 0808 8020 133 and the NHS gambling support page in the footer and on the RG page; any link to (be)gambleaware.org fails); helplines from types/social-casino/helplines.json; verified_by: build --json, tools/probe.mjs (helpline block); basis: factory; status: existing -->
The reference site records that GambleAware closed on 31 March 2026; the fleet-wide rule awaits the owner's confirmation (ECC-ADOPTION open question 7).

### Invariant: no real-money or pressure language
<!-- id: SC-WORDS-01; applies: social-casino; enforced: sc.forbidden-terms (the existing FORBIDDEN list: deposit, withdraw, cash out, bonus code, real money wins, win big, jackpot, hurry, don't miss out, and comparisons between the site's games), sc.required-statements, sc.iap-disclosure; verified_by: build --json, compliance-judge (implied winning, pressure); basis: factory (existing list) / policy:google.social-casino (required statements, IAP; warn until verified); status: existing / P2 -->

### Invariant: the currency is virtual and worthless
<!-- id: SC-CURRENCY-01; applies: social-casino; enforced: wallet in localStorage only; no purchase unless purchases is true (then IAP disclosure); no exchange, sale or withdrawal; no redemption wording (cash prize, redeem, sweeps coins; SITE-TYPES 3.5 names this sc.no-redemption-words, the master-plan roster folds wording into sc.forbidden-terms; id to be fixed by partition A); verified_by: build --json, compliance-judge; basis: factory; status: existing (wallet) / P2 (redemption wording) -->

### Invariant: art shows objects and places only
<!-- id: SC-ART-01; applies: social-casino; enforced: own covers per game (no provider logos or art), no characters, mascots, animals, faces or youth culture; demo games carry appeal low or medium; verified_by: build --json (cover present, appeal field), compliance-judge (CAP 16.3.12 lens); basis: factory (art rule) / policy:cap-16 (unverified); status: existing -->

### Invariant: the house games are honest
<!-- id: SC-FAIR-01; applies: social-casino; enforced: outcomes from crypto.getRandomValues with rejection sampling, decided before the animation; nothing adapts to balance or play time; RTP published from the maths modules (engine/docs/game-facts.md); a loss below the stake is never presented as a win; free top-up without timers or pressure; verified_by: the build imports the same maths modules the games run, so the published RTP is the computed one (exact enumeration for the slot, 36/37 for the wheel, tools/simulate-21.mjs for twenty-one); engine/tools/check.mjs#tables for round locks; compliance-judge; basis: factory; status: existing -->

### Invariant: at least three house games in every mode
<!-- id: SC-HOUSE-01; applies: social-casino; enforced: order schema (house minItems 3), validate-order --level build; verified_by: build --strict --no-pragmatic (the certifiable build); basis: factory; status: P1 (schema) -->

### Invariant: a demo lobby is never advertised and never runs without consent
<!-- id: SC-DEMO-01; applies: social-casino demo-lobby; enforced: intake rejection when an Ads account or conversion ID is attached; build --strict fails with demos on and adsConversionId set, with pragmatic.writtenConsent empty, or with any demo lacking a checked date; frame created only on Play; frame-src lists only pragmatic.frameHosts; no direct demo URL in pages; verified_by: build --strict, engine/tools/check.mjs#stage, /pragmatic-verify (human, UK browser); basis: factory; status: existing -->

### Invariant: the trademark line appears iff demos are on
<!-- id: SC-TM-01; applies: social-casino; enforced: sc.trademark-line (mandatory); verified_by: build --json, tools/probe.mjs; basis: factory; status: existing -->

### Invariant: the site runs on its own domain
<!-- id: SC-DOMAIN-01; applies: social-casino; enforced: sc.own-domain (factory: rejects *.pages.dev, *.github.io and domains not registered to the advertiser); verified_by: validate-order --level launch, ship-gate; basis: factory; status: P2 -->

### Invariant: no real-money gambling brand marks
<!-- id: SC-RMG-01; applies: social-casino; enforced: sc.no-rmg-brands; verified_by: build --json, compliance-judge; basis: policy:google.social-casino (warn until verified; decisive for demo-lobby through the intake rejection, which rests on the owner's recorded decision); status: P2 -->

### Invariant: one en-GB locale and the fixed compliance settings
<!-- id: SC-CONFIG-01; applies: social-casino; enforced: site.config schema if/then: exactly one en-GB locale, geo.rg full, geo.minAge 18, analytics.personalisation false; demo-lobby forbids adsConversionId; verified_by: build (schema validation); basis: factory; status: P2 (v2 keys) -->

## 3. online-games (stub in Phase 1; full pack in Phase 4)

### Invariant: every game page carries original editorial
<!-- id: OG-EDIT-01; applies: online-games; enforced: games.editorial-required (summary >= 40 words, howToPlay, controls desktop and touch, < 60% 8-word shingle overlap with the provider feed); verified_by: build --strict; basis: factory; status: stub -->

### Invariant: embeds are sandboxed, attributed and never overlaid
<!-- id: OG-EMBED-01; applies: online-games; enforced: games.sandbox-cross-origin, games.attribution, games.no-overlay-on-stage; verified_by: engine/tools/check.mjs#embed, tools/probe.mjs (no overlay); basis: factory; status: stub -->

### Invariant: ads keep their distance from the game
<!-- id: OG-ADS-01; applies: online-games; enforced: games.ad-distance (>= 150 px from the stage, no ads over the frame, no interstitial between list and game, no auto-refresh); verified_by: engine/tools/check.mjs#ad-distance; basis: factory (derived from unverified publisher policies); status: stub -->

### Invariant: no fake age ratings
<!-- id: OG-PEGI-01; applies: online-games; enforced: games.no-fake-pegi (own age label with an explicit "not a PEGI rating" note); verified_by: build --json; basis: factory; status: stub -->

### Invariant: no gambling mechanics in this type
<!-- id: OG-NOCASINO-01; applies: online-games; enforced: games.no-casino-genre (no slot, poker, bingo or roulette categories or tags; such an order is social-casino); verified_by: build --json, intake; basis: factory; status: stub -->

### Invariant: the audience is set only from a signed assessment
<!-- id: OG-AUDIENCE-01; applies: online-games, social-casino; enforced: audience written only from orders/<id>/audience-assessment.md signed by a named person; validate-order launch item audienceAssessmentSigned; verified_by: ship-gate; basis: factory (the legal test itself is LRN); status: P1 (schema) / P3 (ship-gate) -->

### Invariant: child-likely sites run without profiling
<!-- id: OG-CHILD-01; applies: online-games audience:child-likely; enforced: schema forbids personalisation and requires childDirected; basis mode consent, no advertising features, no remarketing, games-child tag template; games.osa-scope flags chat or UGC in embedded games; verified_by: engine/tools/check.mjs#consent, tools/probe.mjs (child-directed tags); basis: factory (conservative reading); status: stub -->

## 4. hotel-casino (stub in Phase 1; full pack in Phase 4)

### Invariant: a Mode A domain never refers to a casino
<!-- id: HC-MODEA-01; applies: hotel-casino casinoMode:A; enforced: hotel.mode-a-no-casino-terms (mandatory; casinoRef(page) false on every page: visible text, attributes, meta, JSON-LD, paths, media); schema forbids a casino block and casino third parties; casino-linked events fail the build; verified_by: build --strict, engine/tools/check.mjs#casino-mode, site-health sweep; basis: factory; status: stub -->

### Invariant: Mode A+ mentions the casino only as one whitelisted amenity
<!-- id: HC-MODEAPLUS-01; applies: hotel-casino casinoMode:A+; enforced: hotel.mode-a-plus-amenity-only (mandatory; never in hero, OG, title, description, URL or JSON-LD); Section 16 content and art rules and hotel.rg-block site-wide; lawyer-gated at intake; verified_by: build --strict, compliance-judge; basis: factory; status: stub -->

### Invariant: Mode B pages carry the responsible-gambling block
<!-- id: HC-RG-01; applies: hotel-casino casinoMode:B (and A+); enforced: hotel.rg-block (mandatory; helpline per target market, entry age, operator legal name, regulator, licence number, T&Cs, privacy naming the controller, in initial HTML on every casino-referencing page); verified_by: build --strict, tools/probe.mjs; basis: factory; status: stub -->

### Invariant: Mode A and Mode B never share a domain
<!-- id: HC-DOMAIN-01; applies: hotel-casino; enforced: casinoMode is a property of the domain; registry and intake refuse a second mode on the same domain; separate Ads accounts where possible; verified_by: validate-order, registry; basis: factory; status: stub -->

### Invariant: Mode B launches only with written confirmations
<!-- id: HC-MODEB-01; applies: hotel-casino casinoMode:B; enforced: intake rejects Mode B without Google's written confirmation (certifications/* category offline-gambling) and, for a GB target, the Gambling Act opinion; personalisation false; geo.rg info; verified_by: validate-order --level draft and launch, ship-gate; basis: factory; status: stub -->

### Invariant: casino events are derived, never typed
<!-- id: HC-EVENT-01; applies: hotel-casino; enforced: casinoEvent = venues[venue].casinoLinked (author-set values rejected); hotel.casino-event-derived; verified_by: build --strict; basis: factory; status: stub -->

### Invariant: prices are total and offers state their conditions
<!-- id: HC-PRICE-01; applies: hotel-casino; enforced: hotel.price-is-total (mandatory fees included or stated; "from" only with the basis), hotel.offer-significant-conditions (eligibility, validity, minimum stay, exclusions; wagering for casino offers; next to the headline in initial HTML); verified_by: build --strict, compliance-judge; basis: factory (DMCC and CAP Section 8 readings are LRN); status: stub -->

### Invariant: reviews are sourced, ratings are not self-awarded, maps are self-hosted
<!-- id: HC-PROOF-01; applies: hotel-casino; enforced: hotel.review-provenance, hotel.no-self-serving-rating (starRating.author is an awarding body), hotel.map-static-self-hosted (source own, osm or client; file in the build); verified_by: build --strict, engine/tools/check.mjs#map; basis: factory; status: stub -->

### Invariant: cross-domain linking only after consent, and never to online gambling
<!-- id: HC-LINKS-01; applies: hotel-casino; enforced: hotel.gl-on-engine-links (_gl decoration only when consent allows), hotel.no-online-gambling-links (including the brand's own online casino); booking form is a real GET form with form-action from the adapter; verified_by: engine/tools/check.mjs#cta, #consent; basis: factory; status: stub -->

## 5. PPC kit and accounts (partition P, Phase 5)

### Invariant: geo targeting never rests on an unverified list
<!-- id: PPC-GEO-01; applies: all types with a PPC kit; enforced: ppc.geo-allowlist (social-casino allowed countries), ppc.geo-exclusions (hotel-casino prohibited territories) block with "list unverified" while the entry's verified is empty; verified_by: /ppc-kit, ship-gate; basis: policy (blocking, not demoted, by design: D-13 point 2); status: P5 -->

### Invariant: the kit's consent and audience defaults are conservative
<!-- id: PPC-KIT-01; applies: all; enforced: tools/ppc/kit.mjs defaults (Consent Mode v2 basic, all signals denied, ads_data_redaction true, url_passthrough false; personalisation false and no remarketing for social-casino and hotel Mode B; games-child template for child-likely); primary conversion must be set by the owner before validate-order --level launch passes; verified_by: /ppc-kit, validate-order --level launch; basis: factory (precautionary); status: P5 -->

### Invariant: one client, one account, nothing shared
<!-- id: PPC-ACCOUNT-01; applies: all; enforced: account-hygiene.md in every kit (client-owned account under the studio MCC, client payment profile, no shared GTM container, GA4 property, conversion ID, domain, creatives or templates; suspension playbook); factory.cross-site-similarity before each launch; verified_by: ship-gate ticks, guard-ppc.mjs (read-only agents); basis: factory; status: P5 -->

## 6. The policy mechanism

### Invariant: an unverified quote never gates, a factory rule always does
<!-- id: POL-01; applies: all; enforced: engine/lint/report.mjs effective level (declared level only when policyUrls[policy].verified is a date, else warn; factory: true rules never demoted); compliance-judge advisory severity on unverified entries; verified_by: build.json.policies, the bad-copy fixture (must still fail on factory rules); basis: factory; status: P2 -->

### Invariant: nothing launches on an unverified quote its type's strict rules depend on
<!-- id: POL-02; applies: all; enforced: tools/ship-gate.mjs gate policyUrlsVerified (no lint.allow escape); verified only by a named person (tools/policy-recheck.mjs --initial <name>); verified_by: ship-gate; basis: factory; status: P3 (gate) / P4 (recheck tool) -->

## Open items that are owner or lawyer decisions, not invariants

- Age assurance for social-casino: self-declaration today; third-party verification is an owner decision (question 11).
- Whether game names need ®/™ as the provider marks them (reference `COMPLIANCE.md` 0(g); lawyer).
- PECR position on click-to-load embeds: whether the labelled Play click is the consent act (reference `COMPLIANCE.md` 0(f); lawyer).
- The "likely to be accessed by children" determination for each games and social-casino order (signed assessment; lawyer).
