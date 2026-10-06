---
name: design-direction
description: "Design direction for a factory site: tone, one bold move, OKLCH palette with world names, two themes designed separately, a characterful font pair, and the brief's anti-pattern list. Read by concept-designer and theme-smith."
metadata:
  origin: "ECC (affaan-m/everything-claude-code 2.2.3 @ ef648e01, MIT) - adapted for the site factory"
  source: "skills/frontend-design-direction/SKILL.md"
---

# Frontend Design Direction

Use this skill when the work is not just making UI function, but making it feel
purposeful, polished, and appropriate to the product domain.

Source: salvaged from stale community PR #1659 by `linus707`.

## When to Use

- The user asks to build a web page, app, dashboard, artifact, component, or UI.
- The user asks to make an interface more polished, distinctive, beautiful, or
  less generic.
- The implementation needs visual hierarchy, typography, color, motion, layout,
  and interaction choices.
- The current UI works but reads as flat, generic, templated, or mismatched to
  the audience.

## Design Direction

Before coding, choose a specific direction:

1. Purpose: what job does the interface do?
2. Audience: who repeats this workflow, and what do they need to scan first?
3. Tone: utilitarian, editorial, playful, industrial, refined, technical,
   maximal, minimal, dense, calm, or another explicit direction.
4. Memorable detail: one design idea that makes the result feel intentional.
5. Constraints: framework, accessibility, performance, responsiveness, and
   existing design system.

Match the direction to the domain. A SaaS operations tool should usually be
dense, quiet, and scannable. A portfolio, launch page, game, or editorial piece
can be more expressive. Do not force a landing-page composition onto a tool that
needs repeated daily use.

## Implementation Guidance

- Build the actual usable experience as the first screen unless the user
  explicitly asks for marketing copy.
- Use existing project components, tokens, icon libraries, and routing patterns
  before introducing a new visual system.
- Use real or generated visual assets when the interface depends on images,
  products, places, people, gameplay, charts, or inspectable media.
- Prefer contextual typography and spacing over generic oversized hero text.
- Keep palettes multi-dimensional: avoid a UI dominated by one hue family.
- Use CSS variables or existing design tokens so the direction remains
  coherent across states.
- Design responsive constraints explicitly: grids, aspect ratios, min/max
  sizes, stable toolbars, and fixed-format controls should not shift when labels
  or hover states appear.
- Use motion sparingly but deliberately. Prefer high-signal transitions that
  clarify state over decorative animation.
- Verify text fit on mobile and desktop. Long labels must wrap or resize
  cleanly rather than overflowing.

## Anti-Patterns

- Do not default to common generated patterns: purple gradients, decorative
  blobs, oversized cards, vague hero copy, or stock-like atmospheric media.
- Do not add UI cards inside other cards.
- Do not use a single decorative style everywhere when the domain calls for
  restraint.
- Do not hide the primary product, tool, object, or workflow behind generic
  marketing sections.
- Do not add a new dependency for a design flourish unless it clearly pays for
  itself.
- Do not describe the UI's features inside the UI when the controls can speak
  for themselves.

## Review Checklist

- The first viewport immediately communicates the product, workflow, or object.
- The visual hierarchy supports scanning and repeated use.
- Typography fits the container and does not overlap adjacent content.
- Color choices have contrast and do not collapse into a one-note palette.
- Icons are used for familiar tool actions where available.
- Responsive layout has stable dimensions for boards, grids, toolbars,
  controls, tiles, and counters.
- Assets render and carry the subject matter instead of acting as filler.
- Motion improves orientation and does not mask sluggishness.
- The result matches the repo's existing frontend conventions unless there is a
  clear reason to depart.

## Factory adaptation

Every direction (concept-designer) and every theme (theme-smith) must emit:

- tone in one sentence, and **one bold move** (`concept.json.boldMove`) that no sibling in the registry already uses;
- a 5-6 colour **OKLCH** palette with world names (`order.json palette`), light and dark designed separately, never one inverted from the other;
- a characterful font pair plus a numeric face from `engine/fonts/approved-pairings.json` (Inter, Poppins, Montserrat and Space Grotesk fail lint `font-banned`);
- a live, playable hero (`heroStyle`): the first screen is the usable product, not a poster.

Anti-patterns added from the brief (section 5) and CAP 16.3.12: neon purple, gold-on-black 3D coins, aurora blobs, AI renders, glass everywhere, bento grids, rounded-2xl on everything, emoji icons, 100vh static hero, hover-scale grids, fake social proof, pulsing CTAs, urgency timers, confetti; no characters, mascots, faces, sweets, child aesthetics or youth slang (artwork is objects and places only).

The direction must differ from every registry entry of the same type on concept family, bold move, hue family and font pair; `node tools/uniqueness.mjs --pre <direction.json>` is the proof, not a claim in prose.
