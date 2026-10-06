// Builds the address of a Pragmatic Play demo from site.config.json's
// "pragmatic" block (assets/js/config.js). Only games/pragmatic.js uses it,
// after Play is pressed: no page carries a demo's address (build.mjs checks).

/**
 * @param {{ demoUrl: string, params: Record<string, string> }} settings
 * @param {string} symbol Pragmatic's gameSymbol, e.g. "vs20olympgate"
 */
export function demoUrl(settings, symbol) {
  const u = new URL(settings.demoUrl);
  u.searchParams.set('gameSymbol', symbol);
  for (const [k, v] of Object.entries(settings.params || {})) if (v !== '') u.searchParams.set(k, v);
  return u.href;
}
