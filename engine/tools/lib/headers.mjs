// The hosting headers file (dist/_headers) as Cloudflare Pages applies it.
// Used by build.mjs to lint the file and by tools/serve.mjs and the checks
// to send the same Cache-Control locally.
//
// Cloudflare applies every rule whose path matches, in file order. A header
// set by two rules is joined with a comma ("max-age=31536000, …, max-age=3600"),
// unless the later rule first removes it with a "! Name" line. A "*" matches
// anything, including slashes.

/** [{ path, set: [[name, value]], unset: [name] }], names in lower case. */
export function parseHeaders(text) {
  const rules = [];
  let rule = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('/')) {
      rule = { path: line, set: [], unset: [] };
      rules.push(rule);
    } else if (rule && line.startsWith('! ')) rule.unset.push(line.slice(2).trim().toLowerCase());
    else if (rule && line.includes(':')) {
      const i = line.indexOf(':');
      rule.set.push([line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()]);
    }
  }
  return rules;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matches = (pattern, pathname) => new RegExp(`^${pattern.split('*').map(escape).join('.*')}$`).test(pathname);

/** The headers a path gets, starting from `defaults` (the host's own, such as its default Cache-Control). */
export function headersFor(rules, pathname, defaults = {}) {
  const out = new Map(Object.entries(defaults).map(([k, v]) => [k.toLowerCase(), v]));
  const setByRule = new Set();
  for (const r of rules) {
    if (!matches(r.path, pathname)) continue;
    for (const k of r.unset) out.delete(k);
    for (const [k, v] of r.set) {
      if (setByRule.has(k) && out.has(k)) out.set(k, `${out.get(k)}, ${v}`);
      else out.set(k, v);
      setByRule.add(k);
    }
  }
  return Object.fromEntries(out);
}

/** Cloudflare Pages' own Cache-Control when no rule sets one. */
export const HOST_DEFAULT_CACHE = 'public, max-age=0, must-revalidate';

/** Cache-Control for a path, as the host would send it. */
export const cacheControlFor = (rules, pathname) => headersFor(rules, pathname, { 'cache-control': HOST_DEFAULT_CACHE })['cache-control'];
