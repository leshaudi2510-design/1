export const meta = {
  name: 'engine-regression',
  description: 'Protect every site when engine/** or types/** changes: rebuild all, classify dist hash changes, full check on a sample, optional static review',
  whenToUse: 'On tooling/* PRs and engine-ci, from /review --engine <pr> and /ship --engine <tag>',
  phases: [
    { title: 'Build all', detail: 'run.mjs all build + engine-hashes --compare' },
    { title: 'Diff', detail: 'classify every hash change as intended or unexplained' },
    { title: 'Check sample', detail: 'full check on one site per type, one at a time' },
    { title: 'Review', detail: 'optional: engine-reviewer + silent-failure-hunter; code-simplifier with --simplify' },
  ],
}

// Objective: an engine change must not silently alter any site (SPEC D10, 7.4; MASTER-PLAN 5.3, D-31).
// Inputs (args): { base: 'main' | <ref>, startedAt: ISO, pr?: number, review?: bool, simplify?: bool, sample?: [slug] }.
// Outputs: { sitesBuilt, hashChanges: [{ slug, intended, reason }], sample: [{ slug, passed, failed }], review?, ok }.
// Eval: ok = every site built, zero unexplained hash changes, every sampled full check green.
// Handoff: intended changes are written with `node tools/engine-hashes.mjs --write` in the same PR, each with a
//   `hash: <slug> intended: <reason>` line in the PR body; unexplained changes fail the PR.
// Concurrency cap is 2 agents; the full check (1.4 GB) runs one site at a time. No Date.now/Math.random/imports/fs.
// Fleet note (claude-swarm src/claude_swarm/quality_gate.py @ 9b1c5561157a, ideas only): the verdict is fail-closed;
// a stage that returns null counts as a failure, never as a pass.

const a = args || {}
const base = a.base || 'main'

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    sitesBuilt: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, type: { type: 'string' }, ok: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } } }, required: ['slug', 'ok'] } },
    hashChanges: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' } }, required: ['slug'] } },
    report: { type: 'string' },
  },
  required: ['sitesBuilt', 'hashChanges'],
}

const DIFF_SCHEMA = {
  type: 'object',
  properties: { changes: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, intended: { type: 'boolean' }, reason: { type: 'string' } }, required: ['slug', 'intended', 'reason'] } } },
  required: ['changes'],
}

const SAMPLE_SCHEMA = {
  type: 'object',
  properties: { sample: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, type: { type: 'string' }, why: { type: 'string' } }, required: ['slug'] } } },
  required: ['sample'],
}

const QA_SCHEMA = {
  type: 'object',
  properties: { slug: { type: 'string' }, passed: { type: 'number' }, failed: { type: 'number' }, partial: { type: 'boolean' }, failures: { type: 'array', items: { type: 'string' } } },
  required: ['slug', 'passed', 'failed'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'warning', 'block'] },
    findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, location: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'location', 'issue'] } },
  },
  required: ['verdict', 'findings'],
}

phase('Build all')
const built = await agent(
  `Rebuild every factory site and compare dist hashes against the base (${base}).\n` +
  `1. If tools/run.mjs exists: \`node tools/run.mjs all build --json\` (Bash timeout 600000). Otherwise (Phase 1) run ` +
  '`node engine/build.mjs <dir> --json --out "$TMPDIR/regress/<slug>"` for every sites/<slug>/ whose site.config.json is not `{ "engine": "none" }`, ' +
  'every sites/_fixtures/<name>/ that has a site.config.json, and every types/<type>/template-site/.\n' +
  '2. `node tools/engine-hashes.mjs --compare engine/dist-hashes.json --out reports/_engine/regression.json`.\n' +
  'Report every site with ok=false and its problems verbatim, and every hash change. Do not edit any file. ' +
  'If a command is missing, say which, and report the sites you could build; never invent a hash.',
  { schema: BUILD_SCHEMA, effort: 'low', label: 'build all' },
)
if (!built) {
  log('Build all returned nothing: failing closed')
  return { sitesBuilt: [], hashChanges: [], sample: [], ok: false, error: 'build stage failed' }
}
const buildFailures = built.sitesBuilt.filter(s => !s.ok)
log(`${built.sitesBuilt.length} sites built, ${buildFailures.length} failed, ${built.hashChanges.length} hash changes`)

phase('Diff')
let classified = []
if (built.hashChanges.length) {
  const diff = await agent(
    `Classify each dist hash change as intended (with the reason) or unexplained.\n` +
    `Hash changes: ${JSON.stringify(built.hashChanges)}\n` +
    `Read \`git diff ${base}...HEAD\` (engine/**, types/**) and the per-file diff of each changed dist (\`node tools/engine-hashes.mjs --explain <slug>\` if available, otherwise diff the two dist trees). ` +
    'A change is intended only when a specific hunk of the PR explains every changed output file; anything else is unexplained. ' +
    `${a.pr ? `PR #${a.pr}: lines of the form "hash: <slug> intended: <reason>" in its body are claims to verify, not proof. ` : ''}Do not edit any file.`,
    { schema: DIFF_SCHEMA, effort: 'high', label: 'classify hashes' },
  )
  classified = diff ? diff.changes : built.hashChanges.map(h => ({ slug: h.slug, intended: false, reason: 'classifier returned nothing' }))
}
const unexplained = classified.filter(c => !c.intended)
if (unexplained.length) log(`unexplained hash changes: ${unexplained.map(c => c.slug).join(', ')}`)

phase('Check sample')
let sample = Array.isArray(a.sample) ? a.sample : null
if (!sample) {
  const pick = await agent(
    'Pick the regression sample: one site per type that has sites (read sites/*/site.config.json `type`; legacy sites with `"engine": "none"` are excluded), ' +
    'preferring the oldest live one, then the newest, then the one with the most house games (registry stages from `git show origin/registry:portfolio/registry.json` when that branch exists, else sites/registry.json). ' +
    'At most three sites. Do not run anything heavy and do not edit files.',
    { schema: SAMPLE_SCHEMA, effort: 'low', label: 'pick sample' },
  )
  sample = pick ? pick.sample.map(s => s.slug) : ['opalquestlounge']
}
log(`sample: ${sample.join(', ')}`)
const results = []
for (const slug of sample) {
  // one full check at a time per machine (1.4 GB each)
  const r = await agent(
    `Full check for ${slug}: \`CHECK_TIMEOUT_MIN=15 node engine/tools/check.mjs --site sites/${slug} --report reports/${slug}/check.json\` ` +
    'with run_in_background and polling (or Bash timeout 600000). Return passed/failed counts from the report; partial:true, a "Stopped after" line or a missing report means failed >= 1.',
    { agentType: 'qa-runner', schema: QA_SCHEMA, label: `check ${slug}` },
  )
  results.push(r || { slug, passed: 0, failed: 1, failures: ['qa-runner returned nothing'] })
}

let review = null
if (a.review || a.simplify) {
  phase('Review')
  const scope = `the changes of ${a.pr ? `PR #${a.pr}` : 'this branch'} against ${base} (\`git diff ${base}...HEAD -- engine types tools\`)`
  const reviewers = [
    () => agent(`Static review of ${scope} for the engine checklist (landmarks, no inline handlers, ESM only, no third-party request before consent, textContent over innerHTML, storage reads in try/catch, no prose or colour literals in engine/**, every lint rule still present, dist-hash changes explained). Findings only, [SEVERITY] / Location / Issue / Fix; zero findings is a valid review.`, { agentType: 'engine-reviewer', schema: REVIEW_SCHEMA, label: 'engine-reviewer' }),
    () => agent(`Hunt silent failures in ${scope}. Findings only.`, { agentType: 'silent-failure-hunter', schema: REVIEW_SCHEMA, label: 'silent-failure-hunter' }),
  ]
  if (a.simplify) {
    reviewers.push(() => agent(
      `Simplify ${scope} without changing behaviour. Work only in your isolated worktree; afterwards run \`node tools/engine-hashes.mjs --compare engine/dist-hashes.json\` and \`node engine/tools/simulate-21.mjs\` there. ` +
      'Any unexplained hash change or simulate-21 difference means you revert that simplification. Report findings as the simplifications you kept (severity "info") with file locations, and verdict "block" if you could not prove equivalence.',
      { agentType: 'code-simplifier', schema: REVIEW_SCHEMA, isolation: 'worktree', label: 'code-simplifier' }))
  }
  const out = await parallel(reviewers)
  review = out.map((r, i) => r || { verdict: 'warning', findings: [{ severity: 'info', location: '-', issue: `reviewer ${i + 1} unavailable (agent missing in this phase or failed)` }] })
}

const sampleOk = results.every(r => r.failed === 0 && !r.partial)
const ok = buildFailures.length === 0 && unexplained.length === 0 && sampleOk
return {
  base,
  startedAt: a.startedAt || null,
  sitesBuilt: built.sitesBuilt.length,
  buildFailures,
  hashChanges: classified,
  sample: results.map(r => ({ slug: r.slug, passed: r.passed, failed: r.failed })),
  review,
  ok,
}
