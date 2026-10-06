# Plan (pointer)

**The authoritative plan is [`docs/factory/MASTER-PLAN.md`](factory/MASTER-PLAN.md).** This file only says where things stand. Where any other document disagrees with the master plan, the master plan wins; a change to the plan is a row in [`CONTRACT-CHANGES.md`](CONTRACT-CHANGES.md) plus an ADR in [`adr/`](adr/), never a new design document (MASTER-PLAN risk 16).

Detail references (cited by the master plan by section number, not edited after 2026-10-06):

| Document | Use it for |
|---|---|
| [`factory/SPEC.md`](factory/SPEC.md) v1.1 | operations: commands, git/CI, routines, Board, Evidence, partitions, verification |
| [`factory/SITE-TYPES.md`](factory/SITE-TYPES.md) rev 2 | type packs, `site.config.json` v2, compliance matrix, PPC pack per type, hotel Mode A/A+/B |
| [`factory/ECC-ADOPTION.md`](factory/ECC-ADOPTION.md) | vendored discipline, hooks, attribution, the 19 contract-change notes |
| [`factory/TOOLKIT-SCOUT.md`](factory/TOOLKIT-SCOUT.md) | scan gate, PPC toolchain, consent and a11y assertions |

## Phase status (2026-10-06)

| Phase | Scope (MASTER-PLAN 9.1, 9.4) | Status |
|---|---|---|
| 0 Owner actions | SPEC 18 Phase 0: default branch `main`, private repo, rulesets and merge queue, labels, Cloudflare token and Access, environment allowlist and setup script, coordinator session, owner-UI routines (`pr-shepherd`, optional `ci-failed`, `ci-reporter-api`), uptime monitor | Not started. Does not block Phase 1 (D-36); CODEOWNERS, labels and CI assume the defaults in [`OWNER-QUESTIONS.ru.md`](OWNER-QUESTIONS.ru.md). |
| 1 Factory skeleton | opalquestlounge built by `engine/build.mjs` with byte-identical dist; three type packs that build (social-casino v0, online-games and hotel-casino stubs); first tools, schemas, Claude layer, CI files, Board v1, first docs (W1-W34) | **In progress** on branch `claude/compassionate-mayer-9tqb5p`: seven partitions (A+B, C, D, E, F, G, H) in parallel worktrees; merge order A -> C, D -> E -> F, G, H; then the hub runs the 9.3 verification block. No deploys, routines or spokes. |
| 2 Full social-casino pack | lint ids and policy demotion, full pack contract, asset re-tree, content resolver, `consent` check section, registry branch, `run.mjs`, lane agents, `build-site.js` | Not started |
| 3 Factory brain and launch path | game plugins, judge pack, evidence, docs generator, ship gate, deploy/release workflows, review/fix/batch/handoff/ship skills; Meridian example order built, reviewed, dry-shipped | Not started (needs Phase 0) |
| 4 Scale-out, monitoring, two more packs | coordinator, `/monitor --create=all`, policy-recheck, online-games and hotel-casino packs by partition T | Not started |
| 5 First 30-order batch, PPC | waves of 10, threshold calibration, partition P (`/ppc-kit`, `/ppc-audit`, `.mcp.json`) | Not started (P waits for owner questions 10 and 15) |

Phase 1 work items owned by documentation (partition H): W31 (`THIRD_PARTY_NOTICES.md`, this file, `CONTRACT-CHANGES.md`), W32 (SOPs, Board, routines, policy watch, evals, ADRs 0001-0003, lessons), W33 (`engine/docs/`, root README body). The `briefs/` content and `sites/opalquestlounge/docs/` belong to H as well but land after partition A's move commit (W3).

Update this table when a phase starts or its acceptance block passes; record the acceptance commit and `reports/_phase1/acceptance.json` (Phase 1) or the SPEC 20 / ST 5.6 acceptance lines (later phases) in the Status cell.
