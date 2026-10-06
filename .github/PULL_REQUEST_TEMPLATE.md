<!--
One template for every PR. Fill the block that matches the branch and delete the others.
Site PRs (site/<slug>, wip/<slug>/*) touch only sites/<slug>/** and orders/<slug>/**.
-->

## Site order or fix (`site/<slug>`, `wip/<slug>/*`)

- Slug: `<slug>`
- Type / variant: `social-casino | online-games | hotel-casino` / `<variant>`
- Domain: `<domain>`
- Concept in one line:
- Hosting mode: `studio-cf | client-repo | bundle`
- Evidence Bundle: <link or "not yet">

Gates (CI or `/qa`; tick only what ran green on this head):

- [ ] Lint: `build --strict` as-is config
- [ ] Lint: pack build variants (e.g. Pragmatic off, test GA4)
- [ ] Lint: strict-only problems are all in `.github/strict-allow.json` (or label `placeholders-ok`)
- [ ] Browser check (`engine/tools/check.mjs --site`, label `qa:browser`)
- [ ] axe (inside the browser check)
- [ ] Lighthouse >= 95 all categories, LCP < 2.0 s, CLS < 0.05
- [ ] Uniqueness, mechanical (`tools/uniqueness.mjs --post --against all`, incl. in-flight siblings)
- [ ] Uniqueness skeptic panel (Phase 2)
- [ ] Compliance judge (Phase 2)

## Tooling (`tooling/*`, engine, types, tools, schemas, CI, `.claude`, artifacts, docs)

- Partition / work item:
- Engine regression: `node tools/engine-hashes.mjs --compare engine/dist-hashes.json` result:
- Every changed dist hash is explained, one line each:
  `hash: <slug> intended: <reason>`
- Contract changes recorded in `docs/CONTRACT-CHANGES.md`: yes / not applicable

## Judges (`type:judges`)

- Calibration status (`judges-calibration`): <link>

## Notes for the reviewer
