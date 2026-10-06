// Adapted from everything-claude-code scripts/hooks/design-quality-check.js @ ef648e01 (c) 2026 Affaan Mustafa, MIT. Modifications (c) 2026 the site factory studio, MIT.
/**
 * Design-drift signals (called by lint-touched-site.mjs after the build pass).
 *
 * Regex only, a few milliseconds, never blocks. Factory changes: the Tailwind
 * signal table is replaced by the `event: "signal"` rows of
 * .claude/hooks/guard-rules.json (brief section 5 cliches, real-money and
 * urgency phrases, mascot/character art, banned fonts, third-party script
 * hosts); signals are returned for `additionalContext` instead of stderr,
 * because exit-0 stderr is invisible to the model; sibling vocabulary from
 * concept.json.siblings is added when present.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CHECKLIST = [
  'one bold move, specific to this concept',
  'two themes designed separately',
  'objects and places only in artwork (no characters, mascots, faces)',
  'no real-money, prize or urgency cues',
];

function readContent(filePath) {
  try {
    return fs.readFileSync(path.resolve(filePath), 'utf8');
  } catch {
    return '';
  }
}

function applies(rule, rel) {
  if (!rule.paths) return true;
  return new RegExp(rule.paths).test(rel);
}

/**
 * @param {{ rel: string, content: string, rules: object[], siblingsTerms?: string[] }} args
 * @returns {string[]} labels of the signals that fired
 */
function detectSignals({ rel, content, rules, siblingsTerms = [] }) {
  const found = [];
  for (const rule of rules) {
    if (rule.event !== 'signal' || !rule.pattern || !applies(rule, rel)) continue;
    let re;
    try { re = new RegExp(rule.pattern, rule.flags || ''); } catch { continue; }
    const m = re.exec(content);
    if (m) found.push(`${rule.id}: ${rule.message} ("${m[0].slice(0, 60)}")`);
  }
  for (const term of siblingsTerms) {
    if (term && term.length > 3 && content.toLowerCase().includes(term.toLowerCase())) {
      found.push(`signal-sibling-term: a sibling site's vocabulary term appears ("${term}")`);
    }
  }
  return found;
}

function buildWarning(rel, findings) {
  if (!findings.length) return '';
  return [
    `[factory] design signals in ${rel}:`,
    ...findings.map(f => `  - ${f}`),
    '[factory] Re-check against the concept:',
    ...CHECKLIST.map(item => `  - ${item}`),
  ].join('\n');
}

function run({ rel, abs, rules, siblingsTerms }) {
  const content = readContent(abs);
  const findings = detectSignals({ rel, content, rules, siblingsTerms });
  return { exitCode: 0, additionalContext: buildWarning(rel, findings), findings };
}

module.exports = { run, detectSignals, buildWarning };
