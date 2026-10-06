---
name: motion
description: "Motion for factory sites in CSS: principles, duration and spring choices, tokens as custom properties in theme/tokens.css, springs as linear() easing, reduced-motion rules and a vanilla shouldAnimate() gate for canvas games. Read by theme-smith."
metadata:
  origin: "ECC (affaan-m/everything-claude-code 2.2.3 @ ef648e01, MIT) - adapted for the site factory"
  source: "skills/motion-foundations/SKILL.md"
---

# Motion Foundations

The base layer of the motion system. Defines every value, constraint, and
rule that downstream skills (`motion-patterns`, `motion-advanced`) inherit.
Load this skill before any animation work begins.

## When to Activate

- Starting any animated component from scratch
- Setting up tokens, spring presets, or easing values
- Implementing `prefers-reduced-motion` support
- Debugging hydration mismatches from animation initial states
- Evaluating whether an animation should exist at all

## Principles

Motion must do at least one of the following or it must be removed:

- Guide attention
- Communicate state
- Preserve spatial continuity

Responsiveness always outranks smoothness. A 60 fps animation that causes
input delay is worse than no animation.

## Decision Guidance

### Choosing a duration

| Token | Use when |
| --------- | -------------------------------------------- |
| `instant` | Tooltip show/hide, focus ring, badge update |
| `fast` | Button feedback, icon swap, chip toggle |
| `normal` | Modal open, card expand, page element enter |
| `slow` | Hero entrance, full-page transition |
| `crawl` | Deliberate storytelling; use sparingly |

### Choosing a spring

| Preset | Use when |
| --------- | ------------------------------------------ |
| `snappy` | Default UI — buttons, chips, nav items |
| `gentle` | Cards, modals, panels landing softly |
| `bouncy` | Playful moments — empty states, onboarding |
| `instant` | Tooltips, popovers, dropdowns |
| `release` | Drag release — natural physics feel |

### When to disable animation entirely

Disable (make `shouldAnimate()` return `false`) when:

- `prefersReduced` is `true`
- `isLowEnd` is `true` and the animation is non-essential
- The element is off-screen and will never enter the viewport
- The animation is purely decorative with no UX purpose

## Core Concepts

### Token system

```ts
// reference values (upstream lib/motion-tokens.ts); in the factory these become CSS custom properties
export const motionTokens = {
  duration: {
    instant: 0.08,
    fast:    0.18,
    normal:  0.35,
    slow:    0.6,
    crawl:   1.0,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1],
    sharp:  [0.4, 0, 0.2, 1],
    bounce: [0.34, 1.56, 0.64, 1],
    linear: [0, 0, 1, 1],
  },
  distance: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 48,
  },
  scale: {
    subtle: 0.98,
    press:  0.95,
    pop:    1.04,
  },
}

export const springs = {
  snappy:  { type: "spring", stiffness: 300, damping: 30 },
  gentle:  { type: "spring", stiffness: 120, damping: 14 },
  bouncy:  { type: "spring", stiffness: 400, damping: 10 },
  instant: { type: "spring", stiffness: 600, damping: 35 },
  release: { type: "spring", stiffness: 200, damping: 20, restDelta: 0.001 },
}
```

## Factory rules (replace the upstream motion/react rules)

1. **CSS first.** Durations are `--dur-instant|fast|normal|slow|crawl` custom properties in `sites/<slug>/theme/tokens.css`; springs are `linear()` easings stored in `concept.json.motion.easing` and emitted as `--ease-*`. No hard-coded durations or easings in `theme/concept.css`.
2. **Reduced motion overrides everything.** `@media (prefers-reduced-motion: reduce)` disables transforms; opacity-only fades capped at 200 ms are the only fallback.
3. **Never animate layout properties** (`width`, `height`, `top`, `left`, `margin`, `padding`); `transform` and `opacity` only, with an explicit `transition-property`.
4. **Canvas games** (engine-side, tooling/* only): a vanilla `shouldAnimate()` reads `matchMedia('(prefers-reduced-motion: reduce)')`, `navigator.hardwareConcurrency` and `navigator.connection.saveData` once at start-up.
5. View Transitions, `@starting-style` and scroll-driven animations are a checklist of options, never a requirement; every moment must guide attention, communicate state or preserve continuity.
