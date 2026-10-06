<!--
Template for sites/<slug>/docs/COMPLIANCE.md (English). Filled by tools/docs.mjs (Phase 3) from site.config.json, the order,
the pack, engine/docs/invariants.md, types/<type>/docs/invariants.md and reports/<slug>/*.json; written by compliance-auditor
in build-site.js Document. Modelled on opalquestlounge/COMPLIANCE.md. Grammar as in README.en.md (contract-change request 30).
Context keys: brand, domain, slug, type, typeLabel, variant, casinoMode, market, generatedAt, commit, engineVersion,
  policies.verified, policies.unverified, uniqueness.passed, uniqueness.siteScore, uniqueness.threshold, audit.unmapped
Tables:
  ownerDecisions  open decisions and blockers: # | question | what is known | what to do | status
  invariants      one row per invariant id that applies to this type/variant/mode:
                  id | requirement | where it is satisfied (file, function, selector; never a line number) | proving check | status
  policyStatus    one row per policy-urls.json entry used by this type: id | url | verified (date or "unverified") | rules affected
  storage         every storage key and cookie: key | purpose | category | lifetime | set by
  thirdParties    site.config thirdParties[]: host | purpose | consent category | loaded by | cookies
  a11yAutomated   axe and keyboard results from check.json
  budgets         first view and precache from build.json
  lighthouse      reports/<slug>/lighthouse/summary.json
Lists: unmapped (invariants with no proof; must be empty for G7), wcagManual (WCAG 2.2 criteria no engine checks)
Includes: typeCompliance (pack: the type's policy section, e.g. social-casino certification and responsible gaming),
  certificationForm (pack: what to enter in the advertiser's certification form; may be empty for types without one),
  sharedFramework (engine: the accepted shared-framework risk, SPEC 15.7)
Status words: "done" (enforced by the build or the checks), "owner" (needs a fact, a decision, a lawyer or a Google tool),
  "blocker" (not done and blocks launch). No emoji.
Rules: never state that a policy quote is verified unless its policyStatus row has a date; never claim WCAG conformance from
  engines alone; never name another studio site.
-->
# Compliance checklist: {{brand}}

For each requirement this file says where it is met and which check proves it. Paths are relative to the repository root; references point to functions, ids and selectors, not line numbers, so the file does not go stale with every edit. Generated on {{generatedAt}} from commit `{{commit}}` (engine {{engineVersion}}); regenerate rather than edit.

Status words: **done** (enforced by the build or the browser checks), **owner** (needs a fact, a decision, a lawyer or a Google tool), **blocker** (not done; blocks launch).

This is not legal advice. Site type: {{typeLabel}} ({{type}}, variant {{variant}}).

## Policy quotes: verification state

Rules that rest on a quote from Google, ASA/CAP, ICO, the Gambling Commission or legislation.gov.uk act as hard gates only once a named person has checked the quote against the live page. Verified: {{policies.verified}}; unverified: {{policies.unverified}}. An unverified quote's rules run as warnings, and the site cannot launch while any quote its type's strict rules depend on is unverified.

{{table:policyStatus}}

## 0. Open decisions and blockers

Nothing in this section counts as done until you record the decision.

{{table:ownerDecisions}}

## 1. Invariants

Every studio invariant that applies to this site, where it is met and what proves it. Ids are defined in `engine/docs/invariants.md` and `types/{{type}}/docs/invariants.md`; review findings cite the same ids.

{{table:invariants}}

Invariants without a proof (must be empty before launch):

{{list:unmapped}}

## 2. Type-specific requirements

{{include:typeCompliance}}

## 3. UK GDPR and PECR

Nothing non-essential is stored and no third party is contacted before consent; "Reject all" and "Accept all" are equally prominent; consent can be withdrawn as easily as given and is asked again after 12 months.

Storage this site uses (the same list is printed in Cookies and Privacy):

{{table:storage}}

Third parties:

{{table:thirdParties}}

## 4. Accessibility (WCAG 2.2 AA)

Automated results (axe-core and keyboard journeys):

{{table:a11yAutomated}}

Automated engines cover only part of WCAG 2.2. These criteria are checked by hand and are not claimed as verified by the engines:

{{list:wcagManual}}

## 5. Performance and Core Web Vitals

{{table:budgets}}

{{table:lighthouse}}

Field data (INP, real-user Core Web Vitals) exists only after launch.

## 6. Uniqueness and shared framework

This site passed the factory's uniqueness gate: {{uniqueness.passed}} (highest site-level copy similarity {{uniqueness.siteScore}} against a threshold of {{uniqueness.threshold}}, compared with other sites of the same type, including ones still in production).

{{include:sharedFramework}}

## 7. Advertising certification

{{include:certificationForm}}
