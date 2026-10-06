# Site Factory Board (v1)

`index.html` is the operator Board (SPEC 13, MASTER-PLAN 4.6, 5.6, D-38). Owner: partition G.
It is operator-only: never share it with a client (clients use the per-order proposal and
Evidence pages). The page is a single file with no external scripts, stylesheets or fonts.
It follows the Artifact page contract: no doctype or `<html>/<head>/<body>` of its own (the
Artifact tool wraps it), `<title>` and `<style>` first, light and dark tokens on `:root`.

## What it shows

- **Kanban** by stage: one column per stage of `schemas/stages.json`; `blocked`, `paused` and
  `retired` share the last column, "Stopped". Empty stages collapse to a narrow strip on wide
  screens and are hidden (listed in one line) on phones. A card shows the brand, domain,
  variant, type chip, gate chips (lint, check, axe, Lighthouse, uniqueness), the PR number and
  how long ago the row changed; a red dot marks open incidents.
- **Site drawer**: click a card. Site facts, gates, the Lighthouse table against
  `thresholds.lighthouse`, deploy/CI/health, the order (approvals, PR, proposal and evidence
  links) when an `orders` row exists, the site's CI runs and events.
- **Events strip**: newest first, severity stripe, "Alerts only" filter (red and warn).
- **Capacity counters**: in flight against `config/factory.capacity.maxInFlight`, with the
  client, ready to launch, live, stopped, sessions working/recorded, CI runs in the last 30
  days (and how many were not green), session cost (sum of `sessions.cost.usdEstimate`).
- Type filter chips (`social-casino`, `online-games`, `hotel-casino`) and a theme switch
  (system, light, dark). Both are remembered per viewer in `localStorage`, nothing else is.

## Data: what the page reads

The page obtains the database with `await window.claude.use("db")` and subscribes once to:

| db path | query | used for |
|---|---|---|
| `sites/<slug>` | whole collection | cards, drawer, capacity |
| `orders/<orderId>` | whole collection | cards for orders without a site yet, stage (an order's stage wins over the site's), drawer "Order" |
| `events/<ulid>` | `orderBy("at","desc").limit(200)` | events strip, drawer events |
| `runs/<slug>:<sha>` | `orderBy("at","desc").limit(300)` | CI counter, drawer runs |
| `sessions/<id>` | `limit(200)` | sessions and cost counters |
| `config/factory` | one document | `boardVersion`, `capacity.maxInFlight` |

Document shapes: `schemas/board.schema.json` (`collections.<name>` -> `$defs`). The page never
writes. Every write is Claude's, through the ArtifactData tool (D-38). The other collections in the
schema (`approvals`, `proposals`, `inbox`, `shepherd`, `health`, `lighthouse`, `reviews`,
`portfolio`, `ppc`, `policyhealth`, `certifications`) are declared now so later phases do not
change the contract. Their views (Approvals, Uniqueness heatmap, health timeline, PPC and Policy
panels, intake) arrive in Phases 2-5.

Without a runtime (the file opened locally, a preview, a view where `use("db")` resolves `null`)
the page shows a clearly labelled **demo dataset**: one `sites/opalquestlounge` row in the shape
`tools/board.mjs` builds, plus one example event. With a runtime and an empty database it
shows an onboarding card and no rows: the published page holds no seed rows (D-38).

## Publishing (hub, W34)

Publish `artifacts/board/index.html` with the Artifact tool, private, `icon: "board"` (or
another plain word), and the capabilities kept in `schemas/board.schema.json` at
`artifact.capabilities`:

```json
{ "db": { "rules": [
    { "path": "", "read": "view", "write": "admin" },
    { "path": "orders", "read": "view", "write": "admin" },
    { "path": "proposals", "read": "view", "write": "admin" },
    { "path": "approvals", "read": "view", "write": "interact" },
    { "path": "inbox", "read": "admin", "write": "admin" },
    { "path": "sites", "read": "view", "write": "admin" },
    { "path": "shepherd", "read": "view", "write": "admin" },
    { "path": "runs", "read": "view", "write": "admin" },
    { "path": "health", "read": "view", "write": "admin" },
    { "path": "lighthouse", "read": "view", "write": "admin" },
    { "path": "reviews", "read": "view", "write": "admin" },
    { "path": "sessions", "read": "view", "write": "admin" },
    { "path": "events", "read": "view", "write": "admin" },
    { "path": "portfolio", "read": "view", "write": "admin" },
    { "path": "ppc", "read": "view", "write": "admin" },
    { "path": "policyhealth", "read": "view", "write": "admin" },
    { "path": "certifications", "read": "view", "write": "admin" },
    { "path": "config", "read": "view", "write": "admin" } ] },
  "user": {} }
```

`inbox` is `write: admin` here because a rule's write level may not be below its read level;
client submissions go through the separate intake artifact (SPEC 13.4, Phase 2). The SPEC 13
GitHub `mcp` grant is left out in Phase 1.

Then:

1. `node tools/board.mjs row opalquestlounge --envelope --out reports/opalquestlounge/board-row.json`
   (and `node tools/board.mjs event ...` for events; `runs` rows from CI), then
   `node tools/board.mjs batch <file>` -> `{ writes: [...] }`.
2. ArtifactData `batch` with those writes (collection = the db collection, `doc_id` = the id).
3. ArtifactData `list` on `sites`, `events`, `runs`: at least one row each.
4. Write the URL and id into `.claude/factory.json` (`boardUrl`, `boardId`).

## Checking the page locally

The file has no skeleton, so wrap it once for a browser: put
`<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1">`
before it. Opened like that it renders the demo dataset with no console errors. To exercise the
database path, inject a `window.claude` whose `use("db")` returns an object with
`collection(name).orderBy().limit().onSnapshot(next)` and `doc(path).onSnapshot(next)`.
