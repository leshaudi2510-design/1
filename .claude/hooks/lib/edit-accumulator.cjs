// Adapted from everything-claude-code scripts/hooks/post-edit-accumulator.js @ ef648e01 (c) 2026 Affaan Mustafa, MIT. Modifications (c) 2026 the site factory studio, MIT.
/**
 * PostToolUse: accumulate edited file paths for batch processing at Stop.
 *
 * Records each edited path to a session-scoped temp file (one path per line).
 * flush-events.mjs reads this list at Stop time and runs the site gate once
 * across all edited files, eliminating per-edit latency.
 *
 * Factory changes: the session id comes from the hook payload's `session_id`
 * (CLAUDE_SESSION_ID is not in the cloud container's env); every path is
 * recorded (not only JS/TS); the file is `factory-edited-<session_id>.txt`.
 * appendFileSync is used so concurrent hook processes write atomically
 * without overwriting each other. Deduplication is deferred to the Stop hook.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function getAccumFile(sessionId) {
  const raw = sessionId ||
    crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 12);
  // Strip path separators and traversal sequences so the value is safe to embed in a filename.
  const safe = String(raw).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(os.tmpdir(), `factory-edited-${safe}.txt`);
}

function appendPath(sessionId, filePath) {
  if (filePath) {
    fs.appendFileSync(getAccumFile(sessionId), String(filePath) + '\n', 'utf8');
  }
}

/**
 * @param {object} input parsed hook payload
 */
function run(input) {
  try {
    const sid = input && input.session_id;
    appendPath(sid, input.tool_input?.file_path || input.tool_input?.notebook_path);
    const edits = input.tool_input?.edits;
    if (Array.isArray(edits)) {
      for (const edit of edits) appendPath(sid, edit?.file_path);
    }
  } catch {
    // Accumulation is best-effort; the Stop gate re-derives what it can.
  }
}

/** Unique paths recorded for a session. */
function read(sessionId) {
  try {
    const lines = fs.readFileSync(getAccumFile(sessionId), 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
    return [...new Set(lines)];
  } catch {
    return [];
  }
}

function clear(sessionId) {
  try { fs.rmSync(getAccumFile(sessionId), { force: true }); } catch { /* ignore */ }
}

module.exports = { run, read, clear, getAccumFile };
