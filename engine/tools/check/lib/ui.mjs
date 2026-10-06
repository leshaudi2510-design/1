// Page helpers the check sections share: request refusal, keyboard presses,
// the Settings dialog, the toast, colours, the service worker's caches and
// the fixed dock. Everything waits on page state, never on time.
import { until, EMBED_HOST } from '../../lib/harness.mjs';

/** Every other origin is refused (the embed host is left to a stub); watch() records the attempt. */
export const refuseOthers = (ctx, base) =>
  ctx.route((u) => !u.href.startsWith(base) && !EMBED_HOST.test(u.hostname) && /^https?:$/.test(u.protocol), (r) => r.abort('blockedbyclient'));

/** Refuse the embed host too (pages that must not reach it before Play). */
export const refuseEmbed = (ctx) => ctx.route((u) => EMBED_HOST.test(u.hostname), (r) => r.abort('blockedbyclient'));

/** Focus `selector` and press Enter, as a keyboard user does. */
export const pressOn = async (page, selector) => {
  await page.focus(selector);
  await page.keyboard.press('Enter');
};

export const settingsOpen = (page) => until(page, () => document.getElementById('settings')?.open);

/** The toast's text while it shows, or ''. */
export const toastText = (page) => page.evaluate(() => (document.getElementById('toast').matches(':popover-open') ? document.querySelector('#toast .toast__msg').textContent : ''));

/** Relative luminance of a CSS rgb()/rgba() colour (NaN for anything else). */
export function luminance(css) {
  const m = css.match(/rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (!m) return NaN;
  const [r, g, b] = m.slice(1, 4).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Wait until the service worker controls the page and every path in `paths`
 * is saved in one of its caches. Polls the caches, so it waits on state.
 */
export const swSaved = (page, paths, timeout = 20000) =>
  page.evaluate(
    async ([want, ms]) => {
      const t = Date.now();
      await navigator.serviceWorker.ready;
      while (Date.now() - t < ms) {
        if (navigator.serviceWorker.controller) {
          const keys = await caches.keys();
          const inSome = async (p) => {
            for (const k of keys) if (await (await caches.open(k)).match(p)) return true;
            return false;
          };
          if ((await Promise.all(want.map(inSome))).every(Boolean)) return true;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    },
    [paths, timeout],
  );

/** Tab forward through a page; report the stops that end up wholly under the fixed dock (none of them visible). */
export async function tabUnderDock(page, max = 90) {
  const hidden = [];
  let stops = 0;
  await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      const dock = document.querySelector('.dock');
      if (!el || el === document.body) return { end: true };
      if (!dock || dock.contains(el) || getComputedStyle(dock).position !== 'fixed') return { skip: true };
      const top = dock.getBoundingClientRect().top;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || b.top < top - 4) return { ok: true };
      // Wholly under the dock: no sampled point of it shows above the dock.
      for (let x = 0; x < 5; x++) for (let y = 0; y < 3; y++) {
        const px = b.left + ((x + 0.5) / 5) * b.width;
        const py = b.top + ((y + 0.5) / 3) * b.height;
        if (py < top - 4 && el.contains(document.elementFromPoint(px, py))) return { ok: true };
      }
      return { bad: `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}" (top ${Math.round(b.top)}, dock ${Math.round(top)})` };
    });
    if (r.end) break;
    stops++;
    if (r.bad) hidden.push(r.bad);
  }
  return { stops, hidden };
}
