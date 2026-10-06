# Site factory

This repository is a studio's site factory: one shared static engine, one pack per order type, and one folder per client site, built in bulk with Claude Code (cloud sessions, workflows, routines and a Board artifact). Operators start with the Russian operating guide, [`docs/SOP-operator.md`](docs/SOP-operator.md); everyone else starts with [`docs/factory/MASTER-PLAN.md`](docs/factory/MASTER-PLAN.md), the authoritative plan.

Status: **Phase 1** (factory skeleton) is in progress; see [`docs/PLAN.md`](docs/PLAN.md). Nothing is deployed by the factory yet.

## Order types

| Type | What the site is | Pack | State |
|---|---|---|---|
| `social-casino` | UK free-to-play social casino: house games on a virtual currency, no real money, no prizes, 18+ only | `types/social-casino/` | site #1 is Opal Quest Lounge; full pack in Phase 2 |
| `online-games` | browser-game portal, single-game page or kids' games site | `types/online-games/` | stub (builds with a `type-stub` warning); full pack in Phase 4 |
| `hotel-casino` | marketing site for a hotel or resort that has a casino; Mode A (casino-free domain) by default | `types/hotel-casino/` | stub; full pack in Phase 4 |

Out of scope by rule: real-money gambling, sweepstakes, an advertised demo lobby, hotel Mode B without written confirmations, scraped game portals (SITE-TYPES 1.4).

## Layout

```
engine/      shared builder, client code, styles, game plugins, check suite (engine/tools), docs (engine/docs)
types/       one pack per order type: pages, content schemas, lint rules, checks, policy data, template site
sites/       one folder per site (sites/<slug>/); sites/registry.json is a generated snapshot
orders/      one folder per order: brief, order.json, questions, proposal, reviews, evidence
tools/       factory tools: order validation, scaffolding, uniqueness, status, Board rows, partition scope
schemas/     order, stages, direction, registry, review, evidence and Board schemas
artifacts/   the Board and the client-facing proposal and Evidence page templates
CLAUDE.md    the agents' constitution (<= 200 lines)
.claude/     Claude Code project layer: settings and hooks, skills, agents, workflows, rules, craft documents
docs/        plans, SOPs, ADRs, contract changes, routines, policy watch, lessons
reports/     gitignored build, check, Lighthouse and session reports per site
```

The full tree with owners and phases is MASTER-PLAN section 2.

## Commands (Claude Code)

| Command | Purpose | Phase |
|---|---|---|
| `/order` | a new order from a brief: `order.json`, questions for the client, proposal, approval | 1 |
| `/build` | build one site from its approved order | 1 (thin), 2 (full) |
| `/qa` | every gate for one site: strict builds, browser checks, Lighthouse, uniqueness | 1 |
| `/status` | portfolio or site status; Board sync; launch-gate checklist | 1 |
| `/batch`, `/review`, `/fix`, `/handoff`, `/pragmatic-verify`, `/ship` | waves of cloud sessions, review panel, fixes, hand-over, demo check, the only door to production | 3 |
| `/monitor`, `/policy-recheck` | routines; policy quote recheck | 4 |
| `/ppc-kit`, `/ppc-audit` | Google Ads kit per order; read-only account audit | 5 |

Direct tool commands (Phase 1):

```bash
node engine/build.mjs sites/<slug> [--strict] [--json]
CHECK_TIMEOUT_MIN=15 node engine/tools/check.mjs --site sites/<slug> --report reports/<slug>/check.json
node engine/tools/lighthouse.mjs sites/<slug>/dist --out reports/<slug>/lighthouse
node tools/validate-order.mjs orders/<id> --level draft|build|launch
node tools/new-site.mjs <slug> --type <type>
node tools/uniqueness.mjs --post sites/<slug> --against all --fail
node tools/status.mjs --table --offline-ok
```

## Documents

| Read this | For |
|---|---|
| [`docs/factory/MASTER-PLAN.md`](docs/factory/MASTER-PLAN.md) | the authoritative plan (decisions, tree, contracts, roster, phases, owner questions, risks) |
| [`docs/factory/`](docs/factory/) | the detail references: SPEC, SITE-TYPES, ECC-ADOPTION, TOOLKIT-SCOUT |
| [`docs/SOP-operator.md`](docs/SOP-operator.md), [`docs/SOP-new-order.md`](docs/SOP-new-order.md) | operating the factory (Russian) |
| [`docs/OWNER-QUESTIONS.ru.md`](docs/OWNER-QUESTIONS.ru.md) | the owner's 15 open questions and the defaults in use (Russian) |
| [`engine/docs/invariants.md`](engine/docs/invariants.md) | every non-negotiable property of a built site, with ids |
| [`docs/CONTRACT-CHANGES.md`](docs/CONTRACT-CHANGES.md), [`docs/adr/`](docs/adr/) | how and why shared contracts change |
| [`docs/board.md`](docs/board.md), [`docs/routines.md`](docs/routines.md) | the Board and the scheduled routines |
| [`docs/policy-watch.md`](docs/policy-watch.md) | how policy quotes get verified (all unverified today) |
| [`docs/evals.md`](docs/evals.md), [`docs/lessons/`](docs/lessons/) | what is measured; what the factory learned |

## Policy quotes are unverified

No official policy page (Google Ads, ASA/CAP, ICO, Gambling Commission, legislation.gov.uk) has been opened from the factory's environment. Every quote is marked unverified; rules built on one run as warnings until a named person verifies it, and no site launches while a quote its type's strict rules depend on is unverified. The studio's own rules (verbatim disclaimer, age ribbon, own domain, nothing third-party before consent) are hard gates from day one.

## Legacy sites

- **Opal Quest Lounge** (`sites/opalquestlounge/`, until partition A's Phase 1 move: `opalquestlounge/`): site #1, built by the engine; its own README and COMPLIANCE are in its `docs/`.
- **Pixel Crown Club** (`sites/pixelcrownclub/`, until the move: the repository root): the original hand-built site, `engine: none`; CI skips it.

## Licences

The factory vendors and adapts material from Everything Claude Code and claude-swarm by Affaan Mustafa (MIT). Licence texts and the per-file provenance table: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
