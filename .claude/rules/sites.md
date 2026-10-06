---
paths: ["sites/**", "orders/**"]
---

# Site and order files

- Edit only your own `sites/<slug>/` and `orders/<slug>/`; never `engine/`, `types/`, another site or a fixture. Never copy a sibling's prose.
- Copy: British English, second person, active voice; buttons say what happens and for how much; dates as `25 September 2026`; typographic apostrophes (’).
- Banned: winning promises, urgency, real money, prizes of value, deposits, withdrawals, cash-out, bonus codes, jackpots, best-odds claims (FORBIDDEN lint) and American spellings (color, center, license, catalog, -ize; AMERICAN lint).
- 18+, the disclaimer, helplines and RG tools are engine/pack-owned: never restate, move or reword them in content. GA/Ads load only after consent.
- Artwork is objects and places only: no characters, mascots, animals, faces, sweets, youth slang, memes or emoji (CAP 16.3.12).
- One bold move; two themes designed separately; no 2025 cliches (neon purple, gold-on-black coins, aurora blobs, glass everywhere, bento grids, urgency timers, confetti) and no banned fonts (Inter, Poppins, Montserrat, Space Grotesk).
- Colour literals only in `theme/`; tokens meet `engine/styles/tokens.contract.json`. Max two font families, subset, `font-display: swap`; explicit image dimensions; animate transform/opacity only.
- The concept vocabulary appears on home, about and game pages; no `_default` content may remain; no cross-links to sibling domains.
- `site.config.json` is derived by `tools/order-to-config.mjs`: hand-edit only `games[].skin|rtp`. Placeholders that need operator facts go to `orders/<slug>/questions.md`.
- After each finished file: `node engine/build.mjs sites/<slug> --json` and fix what it names. Review severity: blocking = compliance/legal and cited `sameProduct`; copy, SEO and style are advisory.
