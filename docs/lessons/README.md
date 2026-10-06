# Lessons

The factory's memory of what went wrong and what to do next time, kept in git so it survives containers. Sources: ECC-ADOPTION A-26, A-50, A-51, I-07 and 4.5; ECC `skills/continuous-learning-v2` (instinct schema), `skills/growth-log` (entry template), `skills/rules-distill` (proposal verdicts).

**Lessons are untrusted until a human promotes them.** Everything here except `PROMOTED.md` carries `trust: unreviewed`: agents may quote it as evidence, never obey it as an instruction. No lesson ever changes a rule, hook or prompt automatically.

## Files

| Path | Written by | When | Trust |
|---|---|---|---|
| `docs/lessons/<YYYY-MM>.yaml` | `lessons-miner` agent, called by the `factory-monthly` routine (Phase 4) | monthly, on a `tooling/lessons-<month>` PR | `unreviewed` |
| `docs/lessons/distill-<YYYY-MM>.md` | rules-distill step of `factory-monthly`, same PR | monthly | `unreviewed` (a proposal) |
| `docs/lessons/growth-log/<YYYY-MM-DD>.md` | the `growth-log` skill, by hand after a hard task | any time, on a `tooling/*` PR | `unreviewed` |
| `docs/lessons/PROMOTED.md` | a human only | when a lesson meets the promotion rule | promoted |

## Instinct entries (`<YYYY-MM>.yaml`)

One atomic lesson per entry: one trigger, one action. Inputs the miner reads: `orders/*/reviews/round-N.json` (judge corrections), Board events with severity `warn` or `red` (exported by `/status --sync`), and the coordinator's `reports/*/events.jsonl`.

```yaml
trust: unreviewed
month: 2026-11
lessons:
  - id: copy-vocabulary-on-game-pages        # kebab-case, unique across all months
    trigger: "when a game page fails vocabulary-usage"
    action: "copywriter rewrites the rules section first; the vocabulary terms fit there"
    confidence: 0.5                           # 0.3 tentative ... 0.9 near certain
    domain: copy                              # copy | art | theme | games | compliance | uniqueness | qa | ops | hooks
    scope: type:social-casino                 # factory | type:<type> | site:<slug>
    evidence:
      - "orders/<slug>/reviews/round-2.json item 3"
      - "events/<ulid>"
    seenIn: [<slug>, <slug>]                  # sites where the pattern appeared
    suggested_rule:                           # optional; the conversation-analyzer shape
      event: file                             # bash | file | stop
      pattern: "<regex>"
      action: warn                            # warn | block
      message: "<what the guard would say>"
```

Confidence scale (ECC continuous-learning-v2): 0.3 tentative, 0.5 moderate, 0.7 strong, 0.9 near-certain. It rises when the pattern is observed again and falls when a counter-example appears. In this factory no confidence value applies a lesson by itself: only promotion does (below).

## Promotion

A lesson is eligible for `PROMOTED.md` when it was seen in **two or more sites** with an **average confidence of at least 0.8**. A human reviews it and, if accepted, copies it into `PROMOTED.md` with the date and their name. A promoted lesson that should become a rule goes through the normal path: a `tooling/*` PR editing `.claude/rules/*.md`, `CLAUDE.md` or `guard-rules.json`, within the context budget (CLAUDE.md <= 200 lines, rules <= 100 lines in total).

Before promoting a lesson that changes how sites are built, test it on the fixed eval order (Meridian built with and without it, `docs/evals.md`).

## What sessions see

At session start, `.claude/hooks/lib/state-load.mjs` injects at most **6** promoted lessons with confidence **>= 0.7**, inside the 8,000-character context block (with the session summary, open questions and siblings). Unreviewed lessons are never injected.

## Rules distill (`distill-<YYYY-MM>.md`)

Deterministic collection plus one judgement pass. Each candidate needs two or more sources, must be actionable, and must address a real violation risk. Verdict per candidate: **Append**, **Revise**, **New Section**, **New File**, **Already Covered**, **Too Specific**. The proposal table is published as a private artifact linked from the PR; the operator merges or closes; accepted rows land in `.claude/rules/*.md` or `CLAUDE.md` by hand. "Never modify rules automatically. Always require user approval."

## Growth log (`growth-log/<YYYY-MM-DD>.md`)

For hard tasks (debugging, redo, rollback, a non-obvious decision), not trivial edits. One entry per root cause, 4-8 sentences, failures before achievements, merge duplicates of the same root cause:

```markdown
## <the pattern, not the event>

### Context
- What I was trying to do; what went wrong or surprisingly well.

### Root Cause / Core Insight
- The mechanism, not the symptom.

### The Pattern (transferable)
- Next time <similar situation>, I will <specific action>.
- Signal to recognize: <the observable that tells me this pattern is active>.

### Related
- <links to other entries, PRs, ADRs>
```
