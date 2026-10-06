---
name: design-system
description: "Tokens and visual audit for a factory site theme: sites/<slug>/theme/tokens.css in OKLCH with both themes, every property of engine/styles/tokens.contract.json, a 10-dimension audit and AI-slop detection. Read by theme-smith; audit mode used by compliance-auditor on judge-pack screenshots."
metadata:
  origin: "ECC (affaan-m/everything-claude-code 2.2.3 @ ef648e01, MIT) - adapted for the site factory"
  source: "skills/design-system/SKILL.md"
---

# Design System — Generate & Audit Visual Systems

## When to Use

- Starting a new project that needs a design system
- Auditing an existing codebase for visual consistency
- Before a redesign — understand what you have
- When the UI looks "off" but you can't pinpoint why
- Reviewing PRs that touch styling

## How It Works

### Mode 1: Generate Design System

Analyzes your codebase and generates a cohesive design system:

```
1. Read `engine/styles/tokens.contract.json` and the site's `theme/tokens.css` (if any)
2. Extract: colors, typography, spacing, border-radius, shadows, breakpoints
3. Research 3 competitor sites for inspiration (via browser MCP)
4. Propose a design token set (JSON + CSS custom properties)
5. Generate DESIGN.md with rationale for each decision
6. Create an interactive HTML preview page (self-contained, no deps)
```

Output: `DESIGN.md` + `design-tokens.json` + `design-preview.html`

### Mode 2: Visual Audit

Scores your UI across 10 dimensions (0-10 each):

```
1. Color consistency — are you using your palette or random hex values?
2. Typography hierarchy — clear h1 > h2 > h3 > body > caption?
3. Spacing rhythm — consistent scale (4px/8px/16px) or arbitrary?
4. Component consistency — do similar elements look similar?
5. Responsive behavior — fluid or broken at breakpoints?
6. Dark mode — complete or half-done?
7. Animation — purposeful or gratuitous?
8. Accessibility — contrast ratios, focus states, touch targets
9. Information density — cluttered or clean?
10. Polish — hover states, transitions, loading states, empty states
```

Each dimension gets a score, specific examples, and a fix with exact file:line.

### Mode 3: AI Slop Detection

Identifies generic AI-generated design patterns:

```
- Gratuitous gradients on everything
- Purple-to-blue defaults
- "Glass morphism" cards with no purpose
- Rounded corners on things that shouldn't be rounded
- Excessive animations on scroll
- Generic hero with centered text over stock gradient
- Sans-serif font stack with no personality
```

## Factory adaptation

- Mode 1 output is `sites/<slug>/theme/tokens.css` (OKLCH, `:root` light + dark, every property in `engine/styles/tokens.contract.json`; lint `engine.token-contract`), never a separate `design-tokens.json` or DESIGN.md; the rationale lives in `concept.json`.
- No competitor-site research through a browser: the concept pack is the only input.
- "Fleet diversity" is not judged here: `tools/uniqueness.mjs` measures palette, font and structure distance against the registry (within the order's type).
- Colour literals belong only in `theme/` (lint `engine.colour-literal`).
- Audit mode (Mode 2/3) reads the judge-pack PNGs at 390 and 1440 px in both themes; findings cite file:line in `theme/`.
