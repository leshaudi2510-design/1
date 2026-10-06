# ADR-0003: Policy quotes gate only once verified

**Date**: 2026-10-06
**Status**: accepted (Phase 1 default; owner confirmation pending, owner questions 2 and 3)
**Deciders**: chief-architect reconciliation (MASTER-PLAN D-13, D-16); owner to confirm

## Context

Many factory rules encode a sentence from an official page: Google Ads policy answers, the CAP Code, ASA guidance, ICO guidance, the Gambling Act. No such page has been opened from the factory's environment: the egress proxy refuses those hosts, so every quote comes from a search-engine extract (SITE-TYPES preamble, re-tested 2026-10-06). A build gate built on an unread sentence can block a correct site or pass a wrong one, and a client could be told a site "complies" with text nobody has read. At the same time, the studio's own invariants (verbatim disclaimer, age ribbon first, own domain, nothing third-party before consent) do not depend on any quote and must stay hard gates.

## Decision

Every quote lives in the pack's `types/<type>/policy-urls.json` with `verified: null | <date>`, `pageUpdated`, `checkedBy`, `usedBy: [ruleIds]`. Five mechanisms (D-13):

1. `engine/lint/report.mjs` gains `policy`: a rule's effective level is its declared level only when its policy entry is verified, otherwise `warn`; rules flagged `factory: true` carry no policy and are never demoted; `build.json.policies{verified, unverified, demoted[]}` reports the state.
2. Check sections that encode quotes report warn rows while unverified; `ppc.geo-allowlist` and `ppc.geo-exclusions` block with "list unverified".
3. compliance-judge receives `policy-status.json`, cites a `policyId` or an invariant id per finding, and marks findings on unverified entries `severity: advisory` (never blocking); the `bad-copy` fixture must still fail on factory rules.
4. `ship-gate` gate `policyUrlsVerified`: every `usedBy` entry of an `error` or `strict` rule of the site's type must be verified before launch; no `lint.allow` escape.
5. `tools/policy-recheck.mjs --live | --from-captures docs/policy-watch/refs/` fetches and diffs; it writes `verified`, `pageUpdated` and `checkedBy` only with `--initial <name>`; `site-health` goes amber on drift. The toolkit's `rules/uk-social-casino.yaml` is not a separate file: its entries live in `policy-urls.json` and its checks are `sc.*` lint rules and the check section `policy` (D-16).

## Alternatives Considered

### Alternative 1: enforce every quoted rule as an error now
- **Pros**: maximum caution.
- **Cons**: gates on sentences nobody has read; a wrong extract blocks correct sites, a missing one passes wrong sites; no way to tell which.
- **Why not**: false confidence in both directions.

### Alternative 2: drop quote-based rules until the pages can be read
- **Pros**: nothing unverified in the build.
- **Cons**: loses the warnings that steer copy and art now; the rules would be written later under time pressure.
- **Why not**: warnings are cheap and useful; only gating needs verification.

### Alternative 3: a manual compliance checklist per site, no tooling
- **Pros**: simple.
- **Cons**: does not scale to 30 sites; drifts per operator; no record of which quote a decision rested on.
- **Why not**: the factory's point is that rules are data with provenance.

## Consequences

### Positive
- Honest state: every report, judge finding and Board panel says which quotes are unverified.
- Factory invariants keep gating from day one; nothing quote-based can launch until a named person has verified it.
- Verification is one PR per change with the capture or live diff as evidence.

### Negative
- No site whose type's strict rules depend on an unverified quote can pass `/ship` until owner question 2 is resolved (live access or desktop captures) and someone verifies.
- hotel-casino Mode B cannot launch while `geo-exclusions.json` is unverified.

### Risks
- Quotes drift after verification: monthly `policy-watch` routine plus quarterly desktop captures while the hosts are blocked.
- Fetched pages are untrusted input: the routine ignores instructions in loaded content and runs the sanitisation scans in `docs/policy-watch.md` before committing.
