---
name: voice-profile
description: "Voice profile for a factory site, kept in concept.json.voice: rhythm, compression, claim style, preferred and banned moves, CTA rules, per page type. Read by copywriter; produced by concept-designer."
metadata:
  origin: "ECC (affaan-m/everything-claude-code 2.2.3 @ ef648e01, MIT) - adapted for the site factory"
  source: "skills/brand-voice/SKILL.md"
---

# Brand Voice

Build a durable voice profile from real source material, then use that profile everywhere instead of re-deriving style from scratch or defaulting to generic AI copy.

## When to Activate

- the user wants content or outreach in a specific voice
- writing for X, LinkedIn, email, launch posts, threads, or product updates
- adapting a known author's tone across channels
- the existing content lane needs a reusable style system instead of one-off mimicry

## Source Priority

Use the strongest real source set available, in this order:

1. recent original X posts and threads
2. articles, essays, memos, launch notes, or newsletters
3. real outbound emails or DMs that worked
4. product docs, changelogs, README framing, and site copy

Do not use generic platform exemplars as source material.

## What to Extract

- rhythm and sentence length
- compression vs explanation
- capitalization norms
- parenthetical use
- question frequency and purpose
- how sharply claims are made
- how often numbers, mechanisms, or receipts show up
- how transitions work
- what the author never does

## Output Contract

Produce a reusable `VOICE PROFILE` block that downstream skills can consume directly. Use the schema in [references/voice-profile-schema.md](references/voice-profile-schema.md).

Keep the profile structured and short enough to reuse in session context. The point is not literary criticism. The point is operational reuse.

## Hard Bans

Delete and rewrite any of these:

- fake curiosity hooks
- "not X, just Y"
- "no fluff"
- forced lowercase
- LinkedIn thought-leader cadence
- bait questions
- "Excited to share"
- generic founder-journey filler
- corny parentheticals

## Persistence Rules

- Reuse the latest confirmed `VOICE PROFILE` across related tasks in the same session.
- If the user asks for a durable artifact, save the profile in the requested workspace location or memory surface.
- Do not create repo-tracked files that store personal voice fingerprints unless the user explicitly asks for that.

## Downstream Use

Use this skill before or inside:

- `content-engine`
- `crosspost`
- `lead-intelligence`
- article or launch writing
- cold or warm outbound across X, LinkedIn, and email

If another skill already has a partial voice capture section, this skill is the canonical source of truth.

## Voice profile schema (merged from references/voice-profile-schema.md)

Use this exact structure when building a reusable voice profile:

```text
VOICE PROFILE
=============
Author:
Goal:
Confidence:

Source Set
- source 1
- source 2
- source 3

Rhythm
- short note on sentence length, pacing, and fragmentation

Compression
- how dense or explanatory the writing is

Capitalization
- conventional, mixed, or situational

Parentheticals
- how they are used and how they are not used

Question Use
- rare, frequent, rhetorical, direct, or mostly absent

Claim Style
- how claims are framed, supported, and sharpened

Preferred Moves
- concrete moves the author does use

Banned Moves
- specific patterns the author does not use

CTA Rules
- how, when, or whether to close with asks

Page Notes
- hero:
- game rules:
- legal overrides:
- error strings:
- contact:
- responsible gaming:
```

Guidelines:

- Keep the profile concrete and source-backed.
- Use short bullets, not essay paragraphs.
- Every banned move should be observable in the source set or explicitly requested by the user.
- If the source set conflicts, call out the split instead of averaging it into mush.

## Factory adaptation

- Source: `order.json copy.voice` and the brief, never X posts or the studio's own channels; the profile is stored in `concept.json.voice` (optional keys `rhythm`, `claimStyle`, `bannedMoves[]`, `ctaRules`; change note to partition A), not in a VOICE.md.
- Fixed for every site: British English, second person, active voice. Banned moves always include the FORBIDDEN lint list (deposits, withdrawals, cash-out, bonus codes, real-money wins, jackpots, urgency, best-odds claims) and the usual AI-isms.
- CTA rule: a button says what happens and for how much (`order.json copy.buttons`).
