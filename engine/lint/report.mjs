// The lint report: every problem and warning carries a rule id.
//
//   const report = createReport({ strict });
//   report.error('h1', 'index.html: 2 <h1> elements');      // always a problem
//   report.warn('apostrophes', '…');                         // always a warning
//   report.strict('placeholder', '…');                       // a problem under --strict, else a warning
//   const r = report.rule('sc.disclaimer-verbatim');         // the same three, bound to one id
//
// Engine rule ids are bare ('placeholder', 'h1', 'type-stub'); type-pack rule
// ids carry the pack's prefix ('sc.forbidden-terms'). Messages are printed
// exactly as given ("error: <message>" / "warning: <message>"), so the human
// output of a build does not change when a check moves between the engine and
// a pack. --json prints { rule, level, message } for each entry; level is
// 'error' (always a problem), 'strict' (a problem only because of --strict)
// or 'warn'.

export const LEVELS = ['error', 'strict', 'warn'];

export function createReport({ strict = false } = {}) {
  const problems = [];
  const warnings = [];
  const add = (rule, level, message) => {
    if (typeof rule !== 'string' || !rule) throw new Error(`lint report: a rule id is required (message: ${message})`);
    if (level === 'error' || (level === 'strict' && strict)) problems.push({ rule, level, message });
    else warnings.push({ rule, level: 'warn', message });
  };
  const bound = (id) => ({
    id,
    strictMode: strict,
    error: (message) => add(id, 'error', message),
    warn: (message) => add(id, 'warn', message),
    strict: (message) => add(id, 'strict', message),
  });
  return {
    strictMode: strict,
    problems,
    warnings,
    error: (rule, message) => add(rule, 'error', message),
    warn: (rule, message) => add(rule, 'warn', message),
    strict: (rule, message) => add(rule, 'strict', message),
    /** The same three calls bound to one rule id, for pack rules. */
    rule: bound,
  };
}

/**
 * Warnings as the build prints them: "missing image" warnings name the page
 * first and are folded into one line per image, as they always were.
 */
export function printableWarnings(warnings) {
  const seen = new Map();
  for (const w of warnings) {
    const message = w.message.replace(/^[^:]+: (missing image)/, '$1');
    if (!seen.has(message)) seen.set(message, { ...w, message });
  }
  return [...seen.values()];
}
