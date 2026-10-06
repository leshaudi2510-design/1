---
name: concept-synthesis
description: "Generative concept synthesis for a factory order: the 90_SYNTHESIS brandbook shape, 12 archetypes with Aaker scoring, voice spectrum and tone matrix, turned into concept.json world, vocabulary, currency, game names, artwork subjects, avoid list and anti-references. Read by concept-designer."
metadata:
  origin: "ECC (affaan-m/everything-claude-code 2.2.3 @ ef648e01, MIT) - adapted for the site factory"
  source: "skills/brand-discovery/SKILL.md"
---

# Brand Discovery

Use this skill to conduct a structured, adaptive brand identity interview.
The goal is a complete `90_SYNTHESIS.md` — a master brandbook the
organization can use to brief designers, writers, and external
collaborators.

The interview runs across multiple sessions. Capture answers to disk as you
go so that no elicited knowledge is lost when a conversation ends, and so a
later session can resume from where the last one stopped.

## When to Activate

- A brand is being created, repositioned, or needs a written identity reference to brief collaborators.
- Multiple sessions are expected — the conversation will span days or weeks.
- Multiple founders or stakeholders need individual interviews before a reconciliation pass.
- The user wants a structured, repeatable method rather than an ad-hoc chat.
- Existing brand documentation is scattered, implicit, or founder-dependent and needs to be made explicit.

## Anti-Patterns

- **Starting without reading state first.** Every session must open by checking for existing module files and `state.json`. Skipping this loses all continuity from prior sessions.
- **Asking multiple questions at once.** One question at a time is not optional — lists produce checklist answers, not real insight.
- **Moving to Synthesis before saturation.** If the last two probes produced no new information, the module is done. If they did — it isn't.
- **Skipping multi-founder reconciliation.** When multiple stakeholders are involved, individual interviews must complete before reconciliation. Discussing the brand collectively first introduces anchoring bias.
- **Treating this as a one-shot session.** This skill is designed for multiple sessions. Rushing to `90_SYNTHESIS.md` in one conversation produces shallow output.

## (from references/90_SYNTHESIS.md) Module 90 — Master Brandbook (Synthesis)

> **Frameworks:** Kapferer Brand Identity Prism · Aaker brand system (identity /
> personality / associations / equity)
>
> **Goal:** Reconcile all seven preceding modules into a single, actionable
> brandbook. This document is the source of truth the brand uses to brief
> designers, writers, and external collaborators. It resolves tensions between
> modules, commits to specific formulations, and translates them into practical
> guidelines.

---


#### 1. The Why (from Module 10)

> **Core belief:**
>
> **Behavioural How (values in action):**
>
> **What we refuse to be:**

---

#### 2. Positioning (from Module 20)

> **Positioning statement:**
> For **[target client]** who **[situation]**, **[brand name]** is the
> **[category]** that **[unique value]**. Unlike **[alternatives]**, we
> **[key differentiator]**.
>
> **White-space the brand owns:**

---

#### 3. Audience (from Module 30)

> **Ideal Client Profile (one-paragraph portrait):**
>
> **Niche the brand is building toward:**
>
> **Red-flag / disqualifier:**

---

#### 4. Kapferer Brand Identity Prism

| Facet | Content |
|---|---|
| **Physique** (visible, tangible brand attributes) | |
| **Personality** (character if the brand were a person) | |
| **Culture** (values and principles behind the brand) | |
| **Relationship** (how the brand relates to clients) | |
| **Reflection** (how clients see themselves using this brand) | |
| **Self-image** (how clients feel inside when using this brand) | |

---

#### 4b. Aaker Brand System (from Module 40)

> **Primary archetype** (Mark & Pearson):
>
> **Secondary archetype** (if present):
>
> **Aaker brand identity** — four dimensions:
> - *Brand as product:*
> - *Brand as organisation:*
> - *Brand as person (personality):*
> - *Brand as symbol:*
>
> **Brand associations** (3–5 key associations the brand should own):
>
> **Brand equity signals** (what clients would lose if this brand disappeared):

---

#### 5. Voice & Tone summary (from Module 50)

> **Voice statement (one paragraph):**
>
> **The three checks every draft must pass:**
> 1.
> 2.
> 3.

---

#### 6. Narrative assets (from Module 60)

> **Trueline:**
>
> **Brand story arc (one paragraph, usable as an About page starting point):**

---

#### 7. Founder / organisation brand boundary (from Module 70)

> **What the founder brand owns:**
>
> **What the organisation brand owns:**

---

#### 8. Tensions resolved (record any module-to-module conflicts and how they were settled)

| Tension | Module A | Module B | Resolution |
|---|---|---|---|
| | | | |

---

#### 9. Open questions deferred to next session

<!-- Anything that couldn't be resolved with the current data. -->

---

#### 10. Practical next steps

<!-- 3–5 concrete actions the brand can take based on this brandbook. -->

1.
2.
3.


## (from references/40_personality-archetype.md) Module 40 — Personality & Archetype

> **Frameworks:** Mark & Pearson 12 brand archetypes · J. Aaker 5 brand personality
> dimensions (sincerity / excitement / competence / sophistication / ruggedness)
>
> **Goal:** Establish the brand's character — how it would behave if it were a
> person. Personality governs tone, visual register, and what feels "on brand"
> versus "wrong". A sharp archetype makes a hundred small decisions automatic.

---


#### Primary archetype + shadow

| | |
|---|---|
| **Primary archetype** | (name + 1-line why) |
| **Secondary / shadow** | (what the primary archetype risks becoming; what keeps it honest) |

#### J. Aaker personality scores (1–5, 5 = strongly applies)

| Dimension | Score | Evidence |
|---|---|---|
| Sincerity (warm, honest, down-to-earth) | | |
| Excitement (daring, spirited, imaginative) | | |
| Competence (reliable, intelligent, successful) | | |
| Sophistication (upper-class, charming) | | |
| Ruggedness (outdoorsy, tough) | | |

#### Personality in action (3 behavioural guidelines derived from the archetype)

1.
2.
3. ### What the brand must never sound or look like (the anti-personality)

#### Open questions / tensions with Module 50 Voice


## (from references/50_voice-tone.md) Module 50 — Voice & Tone

> **Frameworks:** Brand voice spectrum (formal <-> casual, serious <-> playful,
> distant <-> warm, conventional <-> irreverent) · Content-type tone matrix
>
> **Goal:** Codify the brand's verbal register precisely enough that two different
> writers produce copy that sounds like the same person. Voice is constant;
> tone shifts by context (home page vs. error message vs. proposal cover).

---


#### Voice spectrum (mark the brand's position on each axis)

| Axis | 1 | 2 | 3 | 4 | 5 | Notes |
|---|---|---|---|---|---|---|
| Formal ←→ Casual | | | | | | |
| Serious ←→ Playful | | | | | | |
| Distant ←→ Warm | | | | | | |
| Conventional ←→ Irreverent | | | | | | |
| Minimal ←→ Expressive | | | | | | |

#### Voice statement (one paragraph a writer can internalise)

#### Tone matrix by content type

| Content type | Tone shift | Example phrase |
|---|---|---|
| Homepage headline | | |
| Case study / evidence | | |
| Proposal / commercial | | |
| Error / apology | | |
| Social / informal | | |

#### The three things to check every draft against

1.
2.
3. ### Open questions / tensions with Module 40 Personality

## Factory adaptation (generative mode; no founder interview)

- Inputs: `order.json concept.*` hints and the forcing tuple from `node tools/registry.mjs forcing <orderId> --json` (family, era, place, craft, fonts, structure tuple). No interview, laddering, multi-founder reconciliation or state.json checkpoints.
- Outputs are the `concept.json` fields (`engine/schema/concept.schema.json`): `world` (one sentence without the word casino), `vocabulary` (>= 6 terms with `usedFor`), currency with `origin`, 3-5 house game names with engine and spec variant (social-casino), `artwork.subjects` and `artwork.avoid` (objects and places only), `antiReferences`, `voice` register.
- "What we refuse to be" always includes child appeal, hype and real-money cues.
- Hotel-casino: brand facts are fixed by the client; synthesise visual direction only. Online-games: catalogue positioning plus visual direction.
