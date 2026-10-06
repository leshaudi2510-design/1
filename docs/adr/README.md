# Architecture Decision Records

Nygard-format ADRs (written with the `architecture-decision-records` skill, ECC I-06). One file per decision, `NNNN-title.md`, never renumbered; a reversed decision gets a new ADR that supersedes the old one. Every change to a shared contract is a row in [`../CONTRACT-CHANGES.md`](../CONTRACT-CHANGES.md) plus an ADR here.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-adopt-ecc-by-vendoring.md) | Adopt Everything Claude Code by vendoring selected files | accepted (Phase 1 default) | 2026-10-06 |
| [0002](0002-type-packs.md) | Engine plus type packs for three order types | accepted (Phase 1 default) | 2026-10-06 |
| [0003](0003-policy-verified-mechanism.md) | Policy quotes gate only once verified | accepted (Phase 1 default) | 2026-10-06 |

Expected next ADRs (named in the plan, not yet written): uniqueness thresholds calibrated on the first three real pairs; Stop-gate timings and token cost per site from the Meridian run; hosting (one studio Cloudflare account); Agent Teams decision (Phase 5).
