# Type pack: hotel-casino (stub)

Marketing sites for hotels and resorts that have a casino, advertised as hospitality. Status: **stub** (contract v0, Phase 1); the full pack is Phase 4, partition T. Plan: `docs/factory/MASTER-PLAN.md` 3.4 and 6.3.

What the stub has:

- `pack.mjs`: `status: 'stub'` (every build gets the `type-stub` lint: a warning, an error under `--strict`, so no site of this type can launch), the engine's `basic` chrome, content-only pages from `content-defaults/pages.json` (or the site's own `content/pages.json`) rendered by `engine/pages/article.mjs`, seven generic stylesheet partials, no lint rules, check builds `default` and `ga`. The default pages never mention the casino: Mode A, the default, is a casino-free domain.
- `schema/order-options.schema.json`: the order's `typeOptions` identifiers from SITE-TYPES 6.2, including `casinoMode` (A, A+, B), `locales`, the venue facts, booking hand-off and the Mode B / A+ confirmations.
- `template-site/`: builds with no problems and the `type-stub` and `placeholder` warnings.

Still to come (Phase 4): Mode A / A+ / B rules (`hotel.*` lints, the `casinoRef` sweep), multilingual pages with hreflang, booking, gallery, map facade, offers and events, the geo and helpline tables, check sections `gallery`, `map`, `cta`, `lcp`, `i18n`, `casino-mode`, policy URLs and PPC templates.
