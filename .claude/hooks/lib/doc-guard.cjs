// Adapted from everything-claude-code scripts/hooks/doc-file-warning.js @ ef648e01 (c) 2026 Affaan Mustafa, MIT. Modifications (c) 2026 the site factory studio, MIT.
/**
 * Doc guard (called by guard-scope.mjs, PreToolUse Write/Edit).
 *
 * Factory change against upstream: the denylist of ad-hoc names becomes an
 * ALLOWLIST per deliverable tree, and the warning becomes a block (exit 2).
 * The web harness's Stop hook commits everything untracked, so no agent note
 * may land in a site or order folder (ECC-ADOPTION A-85). Only NEW files are
 * checked; existing documents can be edited. Fixture and template folders
 * (`sites/_*`, `orders/_*`) are not deliverables and are not checked.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// One constant shared with the tests so the two cannot drift.
const ALLOWED_DOCS = {
  sites: ['docs/README.md', 'docs/COMPLIANCE.md'],
  orders: ['brief.md', 'questions.md', 'proposal.md', 'DELIVERY.md', 'audience-assessment.md', 'ppc-kit/**'],
};

function allowedIn(kind, inner) {
  return ALLOWED_DOCS[kind].some(p => p.endsWith('/**') ? inner.startsWith(p.slice(0, -2)) : inner === p);
}

/**
 * @param {object} _input hook payload
 * @param {{ rel: string, abs: string }} options repo-relative POSIX path and absolute path
 */
function run(_input, options = {}) {
  const rel = String(options.rel || '');
  if (!/\.(md|txt)$/i.test(rel)) return { exitCode: 0 };
  const m = /^(sites|orders)\/([^/]+)\/(.+)$/.exec(rel);
  if (!m || m[2].startsWith('_')) return { exitCode: 0 };
  if (allowedIn(m[1], m[3])) return { exitCode: 0 };
  try {
    if (options.abs && fs.existsSync(options.abs)) return { exitCode: 0 };
  } catch { /* treat as new */ }
  return {
    exitCode: 2,
    stderr:
      `BLOCKED (doc-guard): new ${path.extname(rel)} file ${rel} in a deliverable folder. ` +
      `Allowed documents: sites/<slug>/{${ALLOWED_DOCS.sites.join(', ')}}, ` +
      `orders/<slug>/{${ALLOWED_DOCS.orders.join(', ')}}. ` +
      'Put working notes in reports/<slug>/ (gitignored) or the scratchpad.'
  };
}

module.exports = { run, ALLOWED_DOCS };
