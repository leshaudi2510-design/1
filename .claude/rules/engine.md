---
paths: ["engine/**"]
---

# Engine files

- Hub/tooling branches only, through a PR; the engine serves every site of every type.
- No prose in templates (strings come from content), no colour literals, no site slug, brand or type name in engine code (only the pack-resolver default).
- Every lint rule stays; `factory: true` lints are never demoted. The check sections are the regression suite: a fix that touched `engine/**` adds a named section in `engine/tools/check/sections/` or a site `checks.mjs` extra.
- Keep `engine/dist-hashes.json` explained: run `engine-regression` (rebuild every site, classify hash changes) and add `hash: <slug> intended: <reason>` lines; bump `engine/package.json` on behaviour change.
- Author != reviewer: the session that changed the engine does not judge it (engine-reviewer, silent-failure-hunter). Run `build --strict` and the relevant check section before any AI review.
- The shipped site stays zero-dependency: "adopt" a package only as a root devDependency for `engine/tools/**` or `tools/**`; runtime code is always built here. Report skipped search channels honestly.
- Critical CSS inline; preload the hero and primary font only; exactly one `fetchpriority=high`; precache list only from `engine/build.mjs`; `_headers` CSP generated, no inline handlers, third-party frames only after consent, SRI on external scripts.
- Test at 390 and 1440 px in both themes; ESM only, no bundler, `textContent` over `innerHTML`, storage reads in try/catch, game maths pure and seeded.
