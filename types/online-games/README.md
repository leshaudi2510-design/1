# Type pack: online-games (stub)

Free browser-game sites: portal, single-game and kids variants. Status: **stub** (contract v0, Phase 1); the full pack is Phase 4, partition T. Plan: `docs/factory/MASTER-PLAN.md` 6.2.

What the stub has:

- `pack.mjs`: `status: 'stub'` (every build gets the `type-stub` lint: a warning, an error under `--strict`, so no site of this type can launch), the engine's `basic` chrome, content-only pages from `content-defaults/pages.json` (or the site's own `content/pages.json`) rendered by `engine/pages/article.mjs`, seven generic stylesheet partials, no lint rules, check builds `default` and `ga`.
- `schema/order-options.schema.json`: the order's `typeOptions` identifiers from SITE-TYPES 6.2 (variant, providers with the paid-search clause, own games, `audienceSelf`, ads, child-directed flag, social features).
- `template-site/`: builds with no problems and the `type-stub` and `placeholder` warnings.

Still to come (Phase 4): provider adapters, catalogue and taxonomy, the `games.*` lints, check sections `embed`, `catalogue`, `search`, `ad-distance`, `i18n`, the `child` check build, policy URLs and PPC templates.
