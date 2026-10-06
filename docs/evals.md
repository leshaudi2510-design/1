# Evals

What the factory measures to know that a site, a judge or a change to the factory is good, and which measurement is a gate. Sources: ECC-ADOPTION A-24 (from ECC `skills/eval-harness/SKILL.md`), SPEC 15.6 and 20, MASTER-PLAN 9.3 and D-07, ECC-ADOPTION 4.10.

## Vocabulary

- **Regression eval**: something that already works must keep working. Defined before the change; a red result blocks the change.
- **Capability eval**: something the factory claims it can do (tell a reskin from a distinct site, catch implied-winning copy). Defined before the capability is built; measured on fixed fixtures.
- **Grader types**: code (a command with a JSON result), rule/regex (a lint id), model (a judge agent), human (an approval with identity).
- **pass@k**: at least one of k runs passes. Useful when any good answer is enough (a proposal direction).
- **pass^k**: all k runs pass. Required wherever a flaky pass would ship something (launch, judge calibration).

## Gates by grader

| What | Grader | Threshold | Where it runs |
|---|---|---|---|
| Engine move keeps dist byte-identical | code: `tools/engine-hashes.mjs --normalise` diff against `before.sha` | empty diff | Phase 1 acceptance (W1, A's done-when) |
| The 277-check suite still passes on site #1 | code: `engine/tools/check.mjs --oracle-diff engine/tools/oracle/opalquestlounge.json` | 277 passed, 0 failed, not partial, same section ids and titles | Phase 1 acceptance, every engine PR (D-07) |
| Engine change explains every hash change | code: `engine-regression.js`, `engine/dist-hashes.json` | no unexplained `hash:` change (`hash: <slug> intended: <reason>` line) | `tooling/*` PRs |
| Site regression (`ci-ok`) | code + rule: three strict builds, full check, Lighthouse, uniqueness | all green | every site PR |
| Launch | the same `ci-ok` run three times on the launch sha | **pass^3 = 1.0** (`/qa --pass3`) | before `/ship` |
| Uniqueness, mechanical | code: `tools/uniqueness.mjs --post` | thresholds in `schemas/board.schema.json.thresholds.uniqueness[type]` | CI, spoke, ship-gate |
| Uniqueness, judgement | model: three `uniqueness-skeptic` agents | pass if at most one says `sameProduct: true`; a `true` without a cited copy/structure/art pair is rerun once, then counted `false` | spoke pre-check, hub review |
| Compliance, judgement | model: `compliance-judge` | no blocking item; items on unverified policies are advisory | spoke pre-check, hub review |
| Proposal directions | model + code: concept-panel judges plus `uniqueness.mjs --pre` | pass@3 >= 0.9 for model-graded uniqueness, **only for proposal directions, never for launch** | `/order --propose` |
| Human decisions | human: approvals with viewer identity; typed `ship <slug>` | recorded | Board, proposal and Evidence pages, `/ship` |

## Capability evals: the calibration fixtures (SPEC 15.6)

| Fixture | Must | Phase |
|---|---|---|
| `sites/_fixtures/reskin-of-oql/` (opalquestlounge with brand, slug, hues rotated 30 degrees and game names changed) | FAIL `uniqueness.mjs --post` (copy, structure, fonts, headings); at least two skeptics say `sameProduct: true` | 1 (mechanical), 3 (judges) |
| `sites/_fixtures/bad-copy/` (regex-clean copy with implied-winning phrasing, a mascot cover, an inverted dark theme) | `compliance-judge` returns `pass: false` with quotes; `uniqueness.mjs` passes it; the strict build fails on a factory wording rule | 1 (build), 3 (judge) |
| `sites/_fixtures/distinct-pair/{a,b}` (share the three engines and nothing else) | PASS `uniqueness.mjs --post` against each other; at most one skeptic says `sameProduct: true`; every skeptic lists a `visualDifferences` entry | 2-3 |
| `sites/opalquestlounge` | passes both mechanical and judge checks | 1 |
| one fixture per type as each pack ships | per pack | 4 |

`tools/calibrate.mjs` asserts the mechanical outcomes in CI. `calibrate-judges.js` (Phase 3) runs each judge three times and requires **pass^3** on reskin-of-oql, bad-copy and opalquestlounge before the `judges-calibration` commit status is `success`. Bumping a judge prompt without bumping `rubricVersion` fails `engine-lint --rubrics`.

## The fixed eval order

The Meridian example order (`orders/_templates/order.example.json`, SPEC Phase 3) is the factory's fixed benchmark. Before a lesson is promoted or a rule changed, build Meridian twice (with and without the candidate) and compare review rounds, gate results and token cost; record the result as an ADR. Thresholds (uniqueness, Stop gate, concurrency) are calibrated on the first three real pairs and recorded as an ADR (owner question 12).

## Metrics on the Board

First-pass review rate, escape rate (issues found after `ready`), blocking items per round, rounds per site, Stop-gate attempts, token cost per site and per wave (`sessions.cost`). Re-reviews in `portfolio-audit` sample 10-15% of sites (minimum 5).

## Anti-patterns

- A flaky grader inside a release gate (fix the grader or move it out of the gate; never retry until green).
- pass@k used for anything that ships.
- A capability eval defined after the capability was built.
- Cost drift unwatched: a change that passes but doubles tokens per site is a regression.
- Judges graded only on negatives: the positive pair (`distinct-pair`) exists so a panel that calls every factory site a reskin fails calibration.
