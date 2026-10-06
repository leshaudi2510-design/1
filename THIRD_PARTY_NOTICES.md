# Third-party notices

This repository vendors and adapts material from:

- everything-claude-code (ECC) by Affaan Mustafa, https://github.com/affaan-m/everything-claude-code,
  VERSION 2.2.3, vendored from commit ef648e01899ba3e8dc6371642deaaf64b4477775 (2026-10-01), MIT License.
  skills/make-interfaces-feel-better/SKILL.md is a community contribution by linus707 (ECC PR #1659), MIT via the ECC repository.
- claude-swarm by Affaan Mustafa, https://github.com/affaan-m/claude-swarm,
  commit 9b1c5561157a (full sha 9b1c5561157abd2d0d043758b7bfcb0319267d9f, 2026-02-10), MIT License (ideas and schemas only; no code vendored).

No release-tag hash is recorded for ECC: the local checkout used for vendoring is a one-commit shallow clone without tags, so a tag commit could not be verified against GitHub. The pinned commit above is the provenance.

How this file is maintained:

- The licence texts and source list are written by hand (partition H).
- The section "Vendored files" between the `BEGIN VENDORED` and `END VENDORED` markers is generated from `.claude/VENDORED.json` by `node tools/engine-lint.mjs --notices .claude/VENDORED.json THIRD_PARTY_NOTICES.md` (partition D). The same command fails when any `dest` in `VENDORED.json` is missing from this file. Edit `VENDORED.json`, not the generated table.
- Until partition E's Wave 0 copy has run and the table has been regenerated, the table is seeded from the planned `src -> dest` table in `docs/factory/ECC-ADOPTION.md` section 1.1 plus the extra destinations in `docs/factory/MASTER-PLAN.md` section 7.1. A row whose file is not yet in the tree is a planned destination, not a claim that the file exists.

## Licence: everything-claude-code (ECC)

Copied verbatim from `LICENSE` at commit ef648e01899ba3e8dc6371642deaaf64b4477775.

```
MIT License

Copyright (c) 2026 Affaan Mustafa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Licence: claude-swarm

Copied verbatim from `LICENSE` at commit 9b1c5561157abd2d0d043758b7bfcb0319267d9f (identical text to the ECC licence).

```
MIT License

Copyright (c) 2026 Affaan Mustafa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Other sources (recorded now, licence text added when the files are vendored)

These rows come from `docs/factory/MASTER-PLAN.md` section 7.1 and D-21. None of these files is in the tree yet; when one is vendored, its licence text is copied verbatim into this file in the same commit and its rows appear in the generated table.

| Source | What lands where | Phase | Licence (as recorded in the plan; confirm from the upstream LICENSE file when vendoring) |
|---|---|---|---|
| anthropics/skills @ 683bc88e56f3e09ba94f7055977f3d3aa499f202 | `skills/frontend-design/SKILL.md` -> `.claude/craft/frontend-design.md`; `skills/frontend-design/LICENSE.txt` -> `.claude/craft/frontend-design.LICENSE.txt` | 1 (E) | Apache-2.0 (full text in `.claude/craft/frontend-design.LICENSE.txt`; `metadata.origin` added to the frontmatter, a change noted under section 4b) |
| coreyhaines31/marketingskills v2.11.17 | seven ads references + `evals.json` -> `.claude/skills/ppc-kit/references/` | 5 (P) | MIT |
| google-marketing-solutions/ads-policy-monitor | `cloud_functions/ads_policy_monitor/gaql/{ad_policy_data,ad_group_asset,campaign_asset,customer_asset}.sql` -> `ppc/queries/` (Apache-2.0 headers kept in each file) | 5 (P) | Apache-2.0 |

Run as tools, not vendored (no copy in this repository; versions and `dist.integrity` are recorded in `.claude/VENDORED.json`): `ecc-agentshield@1.6.0` (npm, MIT per the plan) and NVIDIA SkillSpector v2.12.0 (uv, git+https; licence per its repository), both invoked by `tools/vet-skill.sh`.

Not vendored by decision (D-21): claude-md-improver, pr-test-analyzer, the hookify runtime.

## Vendored files

Columns follow `docs/factory/ECC-ADOPTION.md` section 8.1. "Upstream commit" is the short form of ef648e01899ba3e8dc6371642deaaf64b4477775 for every ECC row. Per-file markers (ECC-ADOPTION 8.2): `metadata.origin` frontmatter on skills, craft documents and agents; a first-line header comment on hooks and libraries.

<!-- BEGIN VENDORED (generated by tools/engine-lint.mjs --notices from .claude/VENDORED.json; seeded by hand until then) -->
| Vendored path | Upstream path | Upstream commit | Mode |
|---|---|---|---|
| .claude/agents/silent-failure-hunter.md | agents/silent-failure-hunter.md | ef648e01 | verbatim (attribution frontmatter and factory note only) |
| .claude/agents/code-simplifier.md | agents/code-simplifier.md | ef648e01 | verbatim (attribution frontmatter and factory note only) |
| .claude/skills/loop-design-check/SKILL.md | skills/loop-design-check/SKILL.md | ef648e01 | verbatim (attribution frontmatter only) |
| .claude/skills/architecture-decision-records/SKILL.md | skills/architecture-decision-records/SKILL.md | ef648e01 | verbatim (attribution frontmatter only) |
| .claude/skills/growth-log/SKILL.md | skills/growth-log/SKILL.md | ef648e01 | verbatim (attribution frontmatter only) |
| .claude/skills/security-scan/SKILL.md | skills/security-scan/SKILL.md | ef648e01 | verbatim (attribution frontmatter only) |
| .claude/craft/parallel-execution.md | skills/parallel-execution-optimizer/SKILL.md | ef648e01 | verbatim |
| .claude/craft/agent-harness.md | skills/agent-harness-construction/SKILL.md | ef648e01 | verbatim |
| .claude/craft/agentic-engineering.md | skills/agentic-engineering/SKILL.md | ef648e01 | verbatim |
| .claude/craft/interfaces.md | skills/make-interfaces-feel-better/SKILL.md | ef648e01 | verbatim; community contribution by linus707 (PR #1659) |
| .claude/hooks/lib/hook-input.cjs | scripts/hooks/hook-input.js | ef648e01 | verbatim |
| .claude/hooks/lib/transcript-context.cjs | scripts/lib/transcript-context.js | ef648e01 | verbatim |
| .claude/hooks/lib/suggest-compact.cjs | scripts/hooks/suggest-compact.js | ef648e01 | verbatim (only hookEventName becomes UserPromptSubmit) |
| .claude/hooks/lib/utils.cjs | scripts/lib/utils.js | ef648e01 | adapted (subset: getTempDir, writeFile, readStdinJson, log, output) |
| .claude/hooks/lib/config-protection.cjs | scripts/hooks/config-protection.js | ef648e01 | verbatim |
| .claude/hooks/lib/design-signals.cjs | scripts/hooks/design-quality-check.js | ef648e01 | adapted (signal table replaced) |
| .claude/hooks/lib/edit-accumulator.cjs | scripts/hooks/post-edit-accumulator.js | ef648e01 | verbatim |
| .claude/hooks/lib/doc-guard.cjs | scripts/hooks/doc-file-warning.js | ef648e01 | adapted (allowlist replaced, exit 2) |
| .claude/hooks/lib/visible-output.cjs | scripts/hooks/pretooluse-visible-output.js | ef648e01 | verbatim |
| .claude/hooks/tests/check-hooks-schema-keys.cjs | scripts/ci/check-hooks-schema-keys.js | ef648e01 | verbatim |
| .claude/agents/concept-designer.md | agents/gan-planner.md | ef648e01 | adapted |
| .claude/agents/uniqueness-skeptic.md | agents/gan-evaluator.md | ef648e01 | adapted |
| .claude/agents/compliance-judge.md | agents/healthcare-reviewer.md | ef648e01 | adapted (shape only) |
| .claude/agents/engine-reviewer.md | agents/code-reviewer.md | ef648e01 | adapted |
| .claude/agents/qa-runner.md | agents/e2e-runner.md | ef648e01 | adapted |
| .claude/agents/copywriter.md | agents/marketing-agent.md | ef648e01 | adapted |
| .claude/agents/lessons-miner.md | agents/conversation-analyzer.md | ef648e01 | adapted |
| .claude/agents/compliance-auditor.md | agents/a11y-architect.md | ef648e01 | adapted (merged with seo-specialist, performance-optimizer, doc-updater) |
| .claude/agents/release-manager.md | agents/opensource-sanitizer.md | ef648e01 | adapted (pre-check section only) |
| .claude/agents/site-sentinel.md | agents/loop-operator.md | ef648e01 | adapted (escalation triggers only) |
| .claude/craft/design-direction.md | skills/frontend-design-direction/SKILL.md | ef648e01 | adapted |
| .claude/craft/design-system.md | skills/design-system/SKILL.md | ef648e01 | adapted |
| .claude/craft/accessibility.md | skills/accessibility/SKILL.md | ef648e01 | adapted (frontend-a11y folded in) |
| .claude/craft/motion.md | skills/motion-foundations/SKILL.md | ef648e01 | adapted |
| .claude/craft/copy.md | skills/article-writing/SKILL.md | ef648e01 | adapted |
| .claude/craft/seo.md | skills/seo/SKILL.md | ef648e01 | adapted |
| .claude/craft/interaction-audit.md | skills/click-path-audit/SKILL.md | ef648e01 | adapted |
| .claude/craft/council.md | skills/council/SKILL.md | ef648e01 | adapted |
| .claude/skills/qa/SKILL.md | skills/verification-loop/SKILL.md | ef648e01 | adapted (body section "phases") |
| .claude/skills/review/SKILL.md | skills/santa-method/SKILL.md | ef648e01 | adapted (body section "independence rules") |
| .claude/agents/intake-analyst.md | skills/intent-driven-development/SKILL.md | ef648e01 | adapted (AC template, vague-word ban) |
| .claude/craft/voice-profile.md | skills/brand-voice/SKILL.md | ef648e01 | adapted (merged with references/voice-profile-schema.md) |
| .claude/craft/concept-synthesis.md | skills/brand-discovery/SKILL.md | ef648e01 | adapted (merged with references/90_SYNTHESIS, 40_personality-archetype, 50_voice-tone) |
| .claude/workflows/review-panel.js | workflows/orch-review.workflow.js | ef648e01 | adapted (Verdict stage only) |
<!-- END VENDORED -->

## Original files with an ECC or claude-swarm design reference (no code copied)

Listed so that attribution covers substantial portions as well as copies (ECC-ADOPTION 8.1, last paragraph). Each file carries the "Design reference" header line from ECC-ADOPTION 8.2. Rows are taken from ECC-ADOPTION sections 3 and 6 and MASTER-PLAN 7.1.

| Our file | Design reference | Source |
|---|---|---|
| `.claude/hooks/lib/out.cjs` | `scripts/hooks/run-with-flags.js`, `scripts/hooks/pretooluse-visible-output.js`, `scripts/lib/hook-flags.js` | ECC @ ef648e01 (A-77) |
| `.claude/hooks/lib/state-load.mjs` | `scripts/hooks/session-start.js`; instinct injection from `skills/continuous-learning-v2/SKILL.md` | ECC @ ef648e01 (A-79, A-51) |
| `.claude/hooks/guard-rules.json` | rule shape from `skills/hookify-rules/SKILL.md` | ECC @ ef648e01 (A-65) |
| `.claude/hooks/flush-events.mjs` (Stop, PreCompact, cost row, tool counts) | `scripts/hooks/session-end.js`, `scripts/hooks/pre-compact.js`, `scripts/hooks/cost-tracker.js`, `scripts/lib/session-cost-snapshot.js`, `scripts/hooks/skill-run-tracker.js`, `scripts/hooks/session-activity-tracker.js` | ECC @ ef648e01 (A-54, A-70, A-80, A-81) |
| `.claude/hooks/session-start.sh` | ECC SessionStart contract; Anthropic `session-start-hook` skill template in the container | ECC @ ef648e01 (A-101) |
| `.claude/workflows/*.js` header convention | `skills/dynamic-workflow-mode/SKILL.md` | ECC @ ef648e01 (A-73) |
| `.claude/workflows/*.js` lane comments; `schemas/review.schema.json` round-merge shape | decomposer prompt, quality gate, session events, tiering (`src/claude_swarm/*.py`) | claude-swarm @ 9b1c5561157a |

## Adapted text (no file copy)

ECC source text paraphrased into our own files without copying a file. Taken from the "Source" lines of ECC-ADOPTION sections 3 and 4; the full per-item list (A-01 to A-101) stays in that document.

| Our file (section) | ECC source |
|---|---|
| `CLAUDE.md` (Delegation Completion Contract, verbatim paragraph) | `rules/common/agents.md` (I-13) |
| `CLAUDE.md`, every agent body (Prompt Defense Baseline, adapted) | ECC Prompt Defense Baseline (ECC-ADOPTION 4.3) |
| `.claude/rules/sites.md` | `rules/web/design-quality.md` |
| `.claude/rules/engine.md` | `skills/ai-regression-testing/SKILL.md` (A-43), `skills/search-first/SKILL.md` (A-63) |
| lane preamble in creative agents | `agents/gan-generator.md`, `skills/agent-self-evaluation/SKILL.md` (A-02, A-69) |
| `.claude/skills/fix/SKILL.md` (diagnosis table, compliance trigger) | `agents/build-error-resolver.md`, `skills/orch-pipeline/SKILL.md` (A-18, A-72) |
| `.claude/skills/batch/SKILL.md` (check-ins) | `agents/loop-operator.md` (A-16) |
| `.claude/skills/monitor/SKILL.md` (`--audit`) | `skills/automation-audit-ops/SKILL.md` (A-57) |
| `docs/SOP-operator.md` | `agents/harness-optimizer.md` (A-28), `skills/terminal-ops/SKILL.md` (A-60), `skills/skill-stocktake/SKILL.md` (A-66), `skills/living-docs-governance/SKILL.md` (A-67) |
| `docs/SOP-new-order.md` | `skills/orch-pipeline/SKILL.md`, `orch-build-mvp`, `orch-fix-defect` (A-72); `skills/gan-style-harness/SKILL.md` (A-04) |
| `docs/routines.md` (preamble and ending) | `skills/autonomous-agent-harness/SKILL.md` (A-71); monthly steps from `agents/conversation-analyzer.md`, `skills/rules-distill/SKILL.md`, `skills/market-research/SKILL.md` (A-26, A-50, A-61); `skills/canary-watch/SKILL.md` (A-48) |
| `docs/board.md` | `skills/team-agent-orchestration/SKILL.md` (A-74) |
| `docs/evals.md` | `skills/eval-harness/SKILL.md` (A-24) |
| `docs/policy-watch.md` | `skills/deep-research/SKILL.md` (A-62), `the-security-guide.md` sanitisation scans (A-29) |
| `docs/lessons/README.md` | `skills/continuous-learning-v2/SKILL.md` and `agents/observer.md` (A-51) |
| `engine/docs/invariants.md` | `agents/spec-miner.md` invariant block format (A-19) |
| `engine/docs/game-facts.md` | `skills/deep-research/SKILL.md` (A-62) |
