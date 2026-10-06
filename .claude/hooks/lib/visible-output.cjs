// Vendored from everything-claude-code scripts/hooks/pretooluse-visible-output.js @ ef648e01 (c) 2026 Affaan Mustafa, MIT. Copied verbatim apart from this header.
'use strict';

function normalizeAdditionalContext(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .join('\n');
  }

  return String(value || '').trim();
}

function combineAdditionalContext(current, next) {
  const currentText = normalizeAdditionalContext(current);
  const nextText = normalizeAdditionalContext(next);

  if (!currentText) return nextText;
  if (!nextText) return currentText;

  return `${currentText}\n${nextText}`;
}

function buildPreToolUseAdditionalContext(value) {
  const additionalContext = normalizeAdditionalContext(value);
  if (!additionalContext) return '';

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext,
    },
  });
}

module.exports = {
  buildPreToolUseAdditionalContext,
  combineAdditionalContext,
  normalizeAdditionalContext,
};
