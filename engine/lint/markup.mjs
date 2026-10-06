// Markup helpers shared by the engine's lint and the type packs' lint rules.
// Moved out of build.mjs unchanged.

/** The text a page shows: scripts, styles, <code>, tags and entities removed. */
export const visibleText = (s) =>
  s
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<code>[\s\S]*?<\/code>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');

export const decode = (s) =>
  s.replace(/&(amp|quot|#39|lt|gt|nbsp);/g, (_, e) => ({ amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>', nbsp: ' ' })[e]);

export const plainText = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
const ATTR = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/** Every start tag outside scripts and comments, as { name, attrs }. */
export function tagsOf(s) {
  const markup = s.replace(/<!--[\s\S]*?-->/g, '').replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/g, '$1</script>');
  return [...markup.matchAll(TAG)].map((m) => {
    const attrs = {};
    for (const a of m[2].matchAll(ATTR)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    return { name: m[1].toLowerCase(), attrs };
  });
}

/** A Content-Security-Policy string as { directive: [sources] }. */
export const cspOf = (policy) =>
  Object.fromEntries(policy.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));
