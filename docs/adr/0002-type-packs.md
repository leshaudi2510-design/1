# ADR-0002: Engine plus type packs for three order types

**Date**: 2026-10-06
**Status**: accepted (Phase 1 default; owner confirmation pending, owner question 3)
**Deciders**: chief-architect reconciliation (MASTER-PLAN D-01, D-02, D-03, D-28, D-29); owner to confirm

## Context

The studio receives three kinds of order: UK free-to-play social casino sites, online-games sites, and hotel-with-casino marketing sites. They share a static build, CSP, consent, budgets, accessibility and a Playwright + axe suite, but differ in pages, content models, compliance rules (CAP Section 16 vs the Children's Code vs offline-gambling and DMCC pricing), check sections, PPC setup and locales. The reference engine (`opalquestlounge/`) hard-codes social-casino material (games, Pragmatic, the disclaimer ribbon, GamCare). SPEC.md assumed one type; the ECC adoption plan had dropped a `types/` layer. A hotel site must never carry a social-casino disclaimer, yet no site may switch off its own type's mandatory rules.

## Decision

Split the code into a type-neutral `engine/`, one pack per type under `types/<type>/` (`social-casino`, `online-games`, `hotel-casino`), and per-site data under `sites/<slug>/`. The site's `site.config.json` names its `type`; `engine/build.mjs` loads `types/<type>/pack.mjs`. A pack exports a validated contract (MASTER-PLAN 3.2: pages, routes, content schemas and defaults, chrome, styles, media, lint rules with `mandatory.pageLints`, budgets, CSP and permissions, checks, probes, policy URLs, PPC templates, lanes, approval items, uniqueness dimensions, judge rubric, template site, docs). Mandatory page lints are pack-owned and site-unoverridable; `lint.allow` can never demote a `factory: true` rule. Game plugins stay in `engine/games/<id>/` (social-casino is their only consumer). Phase 1 ships contract v0 (`id`, `pages(ctx)`, `styles.partials`, `mandatory.pageLints`, `checks.builds`, `template-site/`): social-casino extracted from today's engine, online-games and hotel-casino as stubs that build with a `type-stub` warning. Full packs: social-casino in Phase 2, the other two in Phase 4 by partition T.

## Alternatives Considered

### Alternative 1: one engine with type flags (`if (type === 'hotel-casino')`)
- **Pros**: no contract to design; fastest first step.
- **Cons**: type material leaks into every engine file; a change for one type re-tests all three; the rule "no creative or type material in `engine/`" cannot be linted.
- **Why not**: three confirmed order types make the branching permanent, not temporary.

### Alternative 2: drop the type layer, put type differences in `engine/docs/` and per-site config (ECC-ADOPTION's original row)
- **Pros**: fewer directories.
- **Cons**: mandatory lints would either live in the engine (wrong for two of three types) or in site config (overridable by the site).
- **Why not**: it cannot express "pack-owned and site-unoverridable"; reversed by D-01.

### Alternative 3: a separate repository and engine per type
- **Pros**: full isolation.
- **Cons**: three copies of the build, CSP, consent, budgets and check harness; fixes diverge.
- **Why not**: the shared baseline (SITE-TYPES 2.0) is most of the code.

## Consequences

### Positive
- One build for N sites of any type; type differences are data and pack code with one contract (`engine/schema/pack.schema.json`, checked by `engine-lint --packs`).
- Uniqueness, judges, intake questions and PPC kits vary by type without new workflows (`pack.lanes`, `pack.judgeRubric`, `pack.uniqueness`).
- CI selects work by type (`changed-sites.sh` emits `{slug, type}`).

### Negative
- The pack contract is a frozen Phase 1 surface; extending it needs a CONTRACT-CHANGES row.
- Phase 1 must prove the move keeps opalquestlounge's dist byte-identical and the 277 checks green.

### Risks
- Stub packs trip engine lints that still assume games, Pragmatic or the ribbon: only the three mandatory lints move behind the pack in Phase 1; remaining assumptions are logged as `type-stub` carve-outs (MASTER-PLAN risk 7).
- The `ctx.art` refactor changes dist: fallback keeps `engine/lib/art.mjs` static (risk 1).
