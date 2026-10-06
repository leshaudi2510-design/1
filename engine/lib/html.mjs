// Tiny templating helpers. `html` joins arrays and drops null/undefined;
// it does not escape, so anything that comes from config goes through `esc`.

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) {
      const v = values[i];
      out += Array.isArray(v) ? v.join('') : v ?? '';
    }
  });
  return out;
}

export const when = (cond, fn) => (cond ? fn() : '');

/** "25 September 2026" */
export function longDate(iso) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

/** "1,000" */
export const num = (n) => new Intl.NumberFormat('en-GB').format(n);

/** "96.02%" */
export const pct = (x, digits = 2) => `${(x * 100).toFixed(digits)}%`;

/** "1 in 3,407" */
export const oneIn = (p) => `1 in ${num(Math.round(1 / p))}`;
