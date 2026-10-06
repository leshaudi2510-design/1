# Site Factory Board

The Board is the factory's one screen and one shared database: `artifacts/board/index.html`, published once as a private Claude artifact with the `db` capability, pinned, and recorded in `.claude/factory.json` (`boardUrl`, `boardId`). Owner of the page and of `schemas/board.schema.json`: partition G. Sources: SPEC 13, MASTER-PLAN 4.6 and 5.6, ECC-ADOPTION A-74.

**The Board is operator-only.** It holds every order's client names, contacts, domains, incidents and token spend, so it is never shared with a client. Clients approve on per-order pages (the proposal page for concept through copy; the Evidence page for launch), each private to one order; those pages write the same `approvals/*` documents the Board reads.

## What exists when

| Phase | Board scope |
|---|---|
| 1 | `schemas/board.schema.json` complete (every collection below, including ECC and PPC fields) so later phases add no contract change; `artifacts/board/index.html` v1: Kanban by `schemas/stages.json`, site drawer, events strip, capacity counters, light/dark tokens; rows written: `sites`, `events`, `runs` via `node tools/board.mjs` (D-38) |
| 2 | Order Intake Form (`artifacts/intake/index.html`) writing `inbox/*` |
| 3 | proposal and Evidence templates; `approvals`, `reviews`, `shepherd` in use |
| 4-5 | routines write `health`, `lighthouse`, `portfolio/*`; PPC panel and policy panel fed by `ppc/*`, `policyhealth/*`, `certifications/*`, `portfolio/policy` |

## Who writes what

- Claude writes through `ArtifactData` (from skills, workflows and routines) or `node tools/board.mjs`; every document is validated against `schemas/board.schema.json` first (`tools/board.mjs validate`).
- Viewers write only `approvals/*` (proposal page, Evidence page, or the Board's relay mode, always with the viewer identity and `via: 'board'|'proposal'|'evidence'`) and their own `inbox/*` rows.
- Routines write directly when `.claude/factory.json.routineBoardWrites == direct`; otherwise they commit JSON to branch `board-data` and the page reads it through its GitHub `mcp` capability (SPEC 12).
- Document ids are idempotent (`health/<slug>:<YYYY-MM-DDTHH>`, `runs/<slug>:<sha>`, `shepherd/<slug>:<sha>`), so a rerun overwrites rather than duplicates.

## Collections

The authoritative shapes are in `schemas/board.schema.json`; this is the reading guide.

| Doc id | What it holds | Written by |
|---|---|---|
| `orders/<orderId>` | brand, domain, client, `stage` (the canonical state), type, variant, casinoMode, audience, markets, session id, PR, proposal and Evidence URLs, approvals keyed by `pack.approvalItems[]`, question counts, build progress, `ppc{}`; same shape as `reports/<slug>/board-row.json` | `/order`, Stop hook mirror, `/status --sync`, routines |
| `orders/<orderId>.proposal` | the three directions with palette, fonts, games, structure, scores, blocking items | `/order --propose` |
| `approvals/<orderId>:<item>` | status, chosen direction, `by {id, name}`, `at`, note, `via` | viewers only |
| `inbox/<id>` | an intake-form submission (type, variant and per-type blocks) | the submitter; `orders-inbox` marks it `taken` |
| `sites/<slug>` | stage, type, variant, locales, deployed version, CI result, latest reports (lint, check sections incl. pack ids, axe, Lighthouse, uniqueness), health summary, Lighthouse baseline and drift, nearest sibling, `reports.policy{unverified, promoted}` | `/status --sync`, routines |
| `runs/<slug>:<sha>` | one CI run: result, run URL, report URL, Lighthouse | `ci-reporter` |
| `shepherd/<slug>:<sha>` | idempotency row for a launch watch | `pr-shepherd` |
| `health/<slug>:<hour>` (rolled up per day after 7 days) | probe results per site | `site-health` |
| `lighthouse/<slug>:<date>` | nightly scores and drift | `lighthouse-nightly` |
| `reviews/<slug>:<round>` | verdict, rubric versions (incl. the type rubric), uniqueness votes, compliance result, items with severity `blocking|advisory` and proof (`quote|selector`, `policyId`), integration issues, missing items | `review-panel.js` |
| `sessions/<id>` | cloud session status, last check, URL, `cost{ inputTokens, outputTokens, cacheRead, cacheWrite, modelFamily, usdEstimate }`, `toolCounts` | `/batch`, Stop hook mirror |
| `events/<ulid>` | `kind` (session, ci, review, health, lighthouse, uniqueness, ship, deploy, incident, intake, ppc, policy), `severity` (info, warn, red, green), text, ref | everyone, via `events.jsonl` and `/status --sync` |
| `portfolio/registry`, `portfolio/matrix` | registry snapshot; pairwise uniqueness matrix (pairs carry `sameType`) | `/status --sync`, `portfolio-audit` |
| `portfolio/policy` | per type: total policy entries, verified, unverified list, last recheck, by whom | `factory-monthly`, `policy-watch` |
| `ppc/<slug>`, `policyhealth/<accountId>:<date>`, `certifications/<accountId>:<country>:<category>` | Ads account, kit version, certification status and expiry, daily policy health | partition P (Phase 5) |
| `config/factory` | routine ids, coordinator session, write modes, last CI poll, thresholds (`stopGate`, `policyHealth`, `uniqueness[type]`, `lighthouse`, health), types, environments, `limits[]`, stages copied from `schemas/stages.json` | `/monitor`, `/status --open --publish` |

`schemas/board.schema.json.stages` must equal `schemas/stages.json.stages` (partition G's done-when check).

## Views

- **Kanban**: one column per stage (blocked, paused and retired share the last). Card: brand, domain, type chip, policy badge, PR chip, session chip, last stage, gate chips (lint, check, axe, lighthouse, uniqueness, compliance), red dot for open incidents, amber for `verifyFailed`.
- **Site drawer**: health timeline, probe badges, Lighthouse sparklines, deployed version vs main, open PRs, nearest sibling and score (in-flight included), reviews, Evidence link.
- **Approvals**: the same `approvals/*` docs the client pages write, with a relay mode for answers given elsewhere; at most 4 pending decisions highlighted, oldest `launchTarget` first.
- **Uniqueness**: within-type heatmap from `portfolio/matrix`, worst pairs, and the cross-type copy-similarity list (`factory.cross-site-similarity`).
- **Capacity**: sessions by stage, CI queue, next wave, CI minutes this month against the budget, cost per site and wave.
- **Alerts strip**: `red` and `warn` events, newest first.
- **PPC panel** and **Policy panel** (Phase 4-5).

An empty database renders an onboarding card.

## Cards and columns (control-pane discipline, ECC A-74)

Each order card is a work item with an owner, a state, a branch, an acceptance list and a merge gate:

| Card field (team-agent-orchestration) | Our field |
|---|---|
| id, title | `orderId`, brand |
| owner | `sessionId` (spoke) or the hub |
| state | `stage` |
| branch, worktree | `site/<slug>`; hub worktrees under `.claude/worktrees/` |
| acceptance[] | the gates of the next transition (SPEC 16, 17) |
| merge_gate | `sites-ok` + review verdict + `ship.lock` |
| handoff | `reports/<slug>/session.json.summary`, `orders/<slug>/DELIVERY.md` |

A column's exit criterion is the gate of the transition out of it (SPEC 16); a card never moves because someone dragged it.

Control-pane test (ECC: "Do not add more automation until the operator can answer: who owns this, what changed, what gate failed, and what can safely merge?"): the Board must answer those four questions for every card without opening a terminal. Merge readiness is shown by gate, never by impression.

Failure modes to watch (verbatim from ECC `skills/team-agent-orchestration/SKILL.md`):

- **Agent soup**: many agents running, no owner or merge gate.
- **Invisible work**: useful output exists only in a chat transcript.
- **Board theater**: a Kanban board exists but cards have no acceptance criteria.
- **Overlapping writes**: parallel agents edit the same files without worktrees.
- **No product artifact**: the process produces docs but no runnable or publishable surface.

Our guards against them: every card has a session or hub owner and a merge gate; every stage commits its files and `session.json`; acceptance comes from `stages.json` transitions; lanes own disjoint paths in worktrees; every order ends in a PR with a built site.

## Privacy and retention

- `inbox` rows are readable only at admin level and are deleted 90 days after they are taken (`factory-monthly`).
- Health rows older than 7 days are rolled up to one per day; rows older than 90 days are pruned.
- No credentials or tokens are ever stored on the Board; the intake form says so.
