// Adapted from everything-claude-code scripts/hooks/config-protection.js @ ef648e01 (c) 2026 Affaan Mustafa, MIT. Modifications (c) 2026 the site factory studio, MIT.
/**
 * Config Protection ("fix the site, not the check").
 *
 * Blocks modifications to the factory's checks, schemas, fixtures and
 * compliance-owning engine files. Agents frequently weaken a check to make it
 * pass instead of fixing the site; this steers them back to the source.
 *
 * Factory changes against upstream: the ESLint/Prettier/Biome/Ruff/Stylelint
 * list is replaced by the factory's protected list (MASTER-PLAN 5.4, ECC-ADOPTION
 * A-84); paths are matched repo-relative; the stdin entry point is removed
 * (guard-scope.mjs calls run()). Kept: block modification of existing protected
 * files, allow first-time creation, fail closed on truncated input and on any
 * stat error other than ENOENT.
 *
 * Exit codes (as returned by run()):
 *   0 = allow (not protected, or first-time creation)
 *   2 = block (existing protected file modification attempted)
 */

'use strict';

const fs = require('fs');

const MAX_STDIN = 1024 * 1024;

// Repo-relative POSIX globs. `**` = any depth, `*` = one segment.
const PROTECTED_GLOBS = [
  'engine/tools/**',
  'engine/lint/**',
  'engine/client/lib/age.js',
  'engine/client/lib/rg.js',
  'engine/client/lib/consent.js',
  'engine/styles/tokens.contract.json',
  'types/*/lint.mjs',
  'types/*/policy-urls.json',
  'tools/uniqueness.mjs',
  'tools/calibrate.mjs',
  'schemas/**',
  'sites/_fixtures/**',
  '.claude/**',
];

// Never protected even though a glob above matches (SPEC 8: the hub writes these on main).
const PROTECTED_EXCEPTIONS = [
  '.claude/factory.json',
  '.claude/settings.local.json',
];

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += '.*'; i++; }
    else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const PROTECTED_RES = PROTECTED_GLOBS.map(globToRegExp);

function isProtectedPath(rel) {
  if (!rel || PROTECTED_EXCEPTIONS.includes(rel)) return false;
  return PROTECTED_RES.some(re => re.test(rel));
}

/**
 * @param {object} input hook payload (unused beyond the path, kept for the upstream signature)
 * @param {{ rel: string, abs: string, truncated?: boolean, maxStdin?: number,
 *           incoming?: string }} options
 */
function run(input, options = {}) {
  if (options.truncated) {
    return {
      exitCode: 2,
      stderr:
        `BLOCKED: Hook input exceeded ${options.maxStdin || MAX_STDIN} bytes. ` +
        'Refusing to bypass config-protection on a truncated payload. ' +
        'Retry with a smaller edit.'
    };
  }

  const rel = options.rel || '';
  const abs = options.abs || '';

  // The disclaimer constant is engine-owned (SPEC 8): edits that touch it are blocked like a protected file.
  const touchesDisclaimer = rel === 'engine/lib/context.mjs'
    && /\bDISCLAIMER\b/.test(String(input?.tool_input?.old_string || '') + String(options.incoming || ''));

  if (!isProtectedPath(rel) && !touchesDisclaimer) return { exitCode: 0 };

  // Allow first-time creation: there's no existing check to weaken.
  // Fail closed on any stat error other than ENOENT (lstat: a dangling symlink counts as present).
  let exists = true;
  try {
    fs.lstatSync(abs);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      exists = false;
    }
  }

  if (!exists && !touchesDisclaimer) {
    return { exitCode: 0 };
  }

  return {
    exitCode: 2,
    stderr:
      `BLOCKED (protected): ${rel} is a factory check, schema, fixture or compliance file. ` +
      'Fix the site, not the check. Changes to it go through a tooling/* branch and PR ' +
      '(on claude/* and tooling/* hub branches this file is editable).'
  };
}

module.exports = { run, isProtectedPath, PROTECTED_GLOBS, PROTECTED_EXCEPTIONS, globToRegExp };
