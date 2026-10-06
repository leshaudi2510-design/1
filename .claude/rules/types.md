---
paths: ["types/**"]
---

# Type packs

- A pack owns everything type-specific: pages, content schemas and defaults, lints (`sc.*`, `games.*`, `hotel.*`), check sections, `policy-urls.json`, helplines, judge rubric, uniqueness dimensions, intake questions, `template-site/`, PPC templates. The engine never imports type material statically.
- `pack.mjs` must keep the contract validated by `engine/schema/pack.schema.json` (`node tools/engine-lint.mjs --packs`); Phase 1 is contract v0.
- `mandatory.pageLints` are site-unoverridable; a pack never weakens another pack's rules.
- Policy entries carry `verified: null` until a person verifies them with `tools/policy-recheck.mjs --initial <name>`; quote-based rules warn while unverified, factory invariants never demote. Never edit a quote to match a site.
- `template-site/` must build with zero problems (`node engine/build.mjs types/<type>/template-site --json`); stub packs warn `type-stub`.
- Changes run `engine-regression` across every site of the type; `types/<type>/ppc/**` belongs to partition P.
