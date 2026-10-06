# ADR-0001: Adopt Everything Claude Code by vendoring selected files

**Date**: 2026-10-06
**Status**: accepted (Phase 1 default; owner confirmation pending, owner question 3)
**Deciders**: chief-architect reconciliation (MASTER-PLAN D-21, 7.1); owner to confirm

## Context

The factory needs a discipline layer for its Claude Code sessions: hooks for the memory lifecycle and safety, reviewer and evaluator patterns, path-scoped rules, attribution of anything borrowed. Everything Claude Code (ECC, Affaan Mustafa, MIT, VERSION 2.2.3, commit `ef648e01899ba3e8dc6371642deaaf64b4477775`) has much of that, but about 90% of it is app-development scaffolding (React/TypeScript/Python reviewers, TDD with 80% coverage, multi-harness adapters). claude-swarm (same author, MIT, commit `9b1c5561157a`) is a prototype with known defects in its lock, retry and quality-gate code; its ideas are useful, its code is not. Cloud sessions read only what is committed in the repository (`CLAUDE.md`, `.claude/settings.json`, `.claude/{rules,skills,agents,workflows}`, `.mcp.json`).

## Decision

Vendor a selected set of ECC files into `.claude/` under the factory's own names (ECC-ADOPTION section 1.1 table, "Option C"), driven by one `src -> dest` table that also writes `.claude/VENDORED.json`. Each copied file gets `metadata.origin` frontmatter or a header comment; `THIRD_PARTY_NOTICES.md` carries the full MIT text and the provenance table. claude-swarm contributes ideas and schema shapes only, credited in headers. Upstream drift is reviewed with `tools/vendor-sync.mjs --check` (monthly, in `factory-weekly-audit`) and merged by a human quarterly; anything new entering `.claude/` passes `/security-scan` (`tools/vet-skill.sh`).

## Alternatives Considered

### Alternative 1: install the ECC marketplace plugin (`ecc@ecc`)
- **Pros**: one command; upstream updates arrive automatically.
- **Cons**: unverified in cloud sessions (repo-declared plugins need the workspace-trust dialog; `~/.claude` is per-VM); an estimated ~31k always-on tokens per turn (estimate from file sizes, not measured) and several `node` spawns per tool call; upstream changes land without review.
- **Why not**: the factory's spokes run unattended in cloud containers; an unreviewed, untested runtime layer there is the wrong default. A desktop user may still enable it in a gitignored `settings.local.json`, never combined with the vendored hooks.

### Alternative 2: `install.sh --target claude-project --profile minimal`
- **Pros**: files land in `./.claude`.
- **Cons**: hook commands embed a base64 absolute path of the installing machine (`scripts/lib/install/claude-settings.js:259-260`), which breaks on a fresh clone; about 489 file operations including 21 language rule packs, 68 agents and 94 commands.
- **Why not**: the output does not run on another machine and is mostly irrelevant.

### Alternative 3: write everything ourselves
- **Pros**: no attribution or upstream tracking.
- **Cons**: re-derives tested hook libraries (bounded stdin reader, config protection, schema-key check) and reviewer prompts; loses the upstream fixes.
- **Why not**: the self-contained pieces are worth taking as-is; the rest is already rewritten into our own files with design-reference credits.

## Consequences

### Positive
- About 3-4k always-on tokens instead of ~31k (estimate); everything that reaches a spoke is reviewed and committed.
- Clear provenance per file; licence obligations met by `THIRD_PARTY_NOTICES.md` and per-file markers.
- Factory names everywhere (no ECC-named leftovers such as `gan-*` or `verification-loop`).

### Negative
- Upstream improvements arrive only through a manual quarterly merge.
- Partition E carries the copy-and-adapt work in Phase 1 (Wave 0).

### Risks
- Drift between our adapted copies and upstream hook-contract changes: watch ECC's `docs/hook-bug-workarounds.md` and `schemas/hooks.schema.json`, rerun `.claude/hooks/tests` after every Claude Code bump.
- agentshield false positives on guard scripts: commit a baseline after a human read (MASTER-PLAN risk 5).
