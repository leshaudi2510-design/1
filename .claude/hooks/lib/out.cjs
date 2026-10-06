// Design reference: everything-claude-code scripts/hooks/run-with-flags.js and scripts/lib/hook-flags.js @ ef648e01 (MIT); no code copied.
// Shared input/output helpers for the factory hooks (ECC-ADOPTION A-77):
// bounded stdin with a truncation flag, a single FACTORY_HOOKS=off gate,
// hookSpecificOutput builders, and an exit helper that flushes before exiting.
// Rule: stdout carries nothing but one decision/hookSpecificOutput JSON (or,
// for SessionStart/UserPromptSubmit, plain context text); stdin is never echoed.
'use strict';

const { readStdinRaw, DEFAULT_MAX_STDIN } = require('./hook-input.cjs');

/** Read the hook payload. Never throws. */
async function readInput(stream = process.stdin) {
  let raw = '';
  let truncated = false;
  try {
    if (stream.isTTY) return { raw: '', truncated: false, input: null, error: 'no stdin' };
    ({ raw, truncated } = await readStdinRaw(stream, { maxStdin: DEFAULT_MAX_STDIN }));
  } catch (err) {
    return { raw: '', truncated: true, input: null, error: String(err && err.message || err) };
  }
  if (truncated) return { raw, truncated: true, input: null, error: 'input truncated' };
  if (!raw.trim()) return { raw, truncated: false, input: null, error: 'empty input' };
  try {
    const input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { raw, truncated: false, input: null, error: 'input is not a JSON object' };
    }
    return { raw, truncated: false, input, error: null };
  } catch (err) {
    return { raw, truncated: false, input: null, error: 'invalid JSON: ' + err.message };
  }
}

/** FACTORY_HOOKS=off disables every hook except guard-scope and guard-ship. */
function hooksOff(env = process.env) {
  return String(env.FACTORY_HOOKS || 'on').toLowerCase() === 'off';
}

function context(eventName, text) {
  const additionalContext = String(text || '').trim();
  if (!additionalContext) return '';
  return JSON.stringify({ hookSpecificOutput: { hookEventName: eventName, additionalContext } });
}

/** Write to a stream and resolve once flushed. */
function write(stream, text) {
  return new Promise(resolve => {
    if (!text) return resolve();
    stream.write(text, () => resolve());
  });
}

/** Flush stdout/stderr, then exit with the given code. */
async function finish(code, { stdout = '', stderr = '' } = {}) {
  await write(process.stdout, stdout);
  await write(process.stderr, stderr && !stderr.endsWith('\n') ? stderr + '\n' : stderr);
  process.exit(code);
}

/** Block (exit 2): the message goes to stderr, which Claude Code shows to the model. */
function block(message) {
  return finish(2, { stderr: message });
}

function allow(stdout = '') {
  return finish(0, { stdout });
}

module.exports = { readInput, hooksOff, context, finish, block, allow, write };
