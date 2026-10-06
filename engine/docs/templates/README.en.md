<!--
Template for sites/<slug>/docs/README.md (English). Filled by tools/docs.mjs (Phase 3); modelled on opalquestlounge/README.md.
Grammar (contract-change request 30): {{path}} scalar from the docs context; {{table:<name>}} generated Markdown table;
{{list:<name>}} generated bullet list; {{include:<name>}} fragment resolved by the docs context (pack docs dir first,
then engine/docs/templates/fragments/, a directory added with tools/docs.mjs in Phase 3). Any placeholder left unfilled fails `tools/docs.mjs --validate`.
Context keys used here:
  brand, domain, slug, type, typeLabel, variant, market, locales, generatedAt, commit, engineVersion, buildVersion,
  concept.title, concept.summary, operator.name, hosting, deploy.provider, deploy.project
Tables: concept, configTodo, results
Lists: lintRules, caching, ownerTodo
Includes: intro (pack: what this type of site is and is not), modes (pack: variant or mode switches; may be empty),
  hosting (engine: the deploy steps for `hosting`), afterDeploy (pack: post-deploy checks incl. certification pointer)
Rules: no sibling brand, palette or summary from concept.json.siblings/antiReferences ever appears here (stripped on export, SPEC 5.9).
-->
# {{brand}}

{{typeLabel}} for **{{domain}}** (market: {{market}}; languages: {{locales}}). Built by the studio's site factory from engine {{engineVersion}}; this file was generated on {{generatedAt}} from commit `{{commit}}`. Do not edit it by hand: change the site and regenerate.

{{include:intro}}

{{include:modes}}

## Concept: {{concept.title}}

{{concept.summary}}

{{table:concept}}

## Files

```
sites/{{slug}}/
├── site.config.json      brand, domain, operator, analytics, dates, type options
├── concept.json          the concept: world, vocabulary, palette, fonts, voice
├── content/              page texts (JSON per page; per locale where the site has several)
├── theme/                tokens.css, concept.css, fonts.json
├── art/                  covers and drawings (objects and places only where the type requires it)
├── media/                photo originals and manifest (types that use photos)
├── data/                 site data (font coverage; provider catalogue subsets)
├── public/               favicon, icons, share images
├── docs/                 README.md, COMPLIANCE.md (this file and its companion, generated)
└── checks.json           site-specific selectors for the browser checks
```

The shared engine lives in `engine/`, the rules of this site type in `types/{{type}}/`. A site never edits either.

## Before launch: what only you can supply

{{table:configTodo}}

{{list:ownerTodo}}

While any operator field still holds a placeholder, the build prints warnings and `--strict` turns them into errors. Legal texts (Terms, Privacy, Cookies) are written for this configuration but are not legal advice: a lawyer reviews them before launch.

## Commands

Run from the repository root (Node 22; the browser tools need the root `npm ci`).

```bash
node engine/build.mjs sites/{{slug}}                    # build dist/ and lint
node engine/build.mjs sites/{{slug}} --strict           # the launch build: zero problems
node engine/build.mjs sites/{{slug}} --json             # one JSON line: pages, budgets, warnings, problems
CHECK_TIMEOUT_MIN=15 node engine/tools/check.mjs --site sites/{{slug}} --report reports/{{slug}}/check.json
node engine/tools/check.mjs --site sites/{{slug}} --only=pages,offline --workers 2 --report reports/{{slug}}/partial.json
node engine/tools/lighthouse.mjs sites/{{slug}}/dist --out reports/{{slug}}/lighthouse
node engine/tools/make-images.mjs --site sites/{{slug}}  # icons and share images, then build again
node engine/tools/serve.mjs sites/{{slug}}/dist --port=0
```

## What the build checks

The build ends with no problems or fails. For this site type it checks:

{{list:lintRules}}

Rules that rest on a policy quote not yet verified against the live page run as warnings; the studio's own rules always fail the build. The full list with ids and proofs is in `COMPLIANCE.md`.

## Caching and updates

{{list:caching}}

## Deploy

{{include:hosting}}

### After deploy

{{include:afterDeploy}}

## Checks on record

Figures below come from the build, the browser checks and Lighthouse for commit `{{commit}}` ({{generatedAt}}). Do not copy them by hand: rerun the commands and regenerate this file.

{{table:results}}

Real INP and field Core Web Vitals appear only in PageSpeed Insights and Search Console after launch.
