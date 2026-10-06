// The embed stage: a third-party frame behind a Play button (social casino:
// Pragmatic Play's demos). The selector comes from the site's checks.json
// ("stageSelector"), the host from "embedHost" (harness EMBED_HOST).
import { until, EMBED_HOST } from '../../lib/harness.mjs';

// A stand-in for the embed host. (The real demo host redirects to a second
// page on the same host; Playwright can't route a redirect inside a
// cross-origin frame, so the stub answers directly.)
const STUB = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Stub demo</title></head><body><p>Stand-in for a third-party demo.</p></body></html>`;

/** Helpers bound to one stage selector. */
export function stageHelpers(STAGE) {
  /**
   * Answer every request to the embed host from a stub. The response to the
   * frame's first document (openGame.do) can be held back so the loading
   * state can be inspected.
   */
  async function stubEmbed(ctx) {
    const stub = { hits: [], hold: null };
    await ctx.route((u) => EMBED_HOST.test(u.hostname), async (route) => {
      const url = new URL(route.request().url());
      stub.hits.push(url.href);
      if (url.pathname.endsWith('/openGame.do') && stub.hold) await stub.hold;
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: STUB });
    });
    /** Hold the next openGame.do until the returned function is called. */
    stub.holdNext = () => {
      let release;
      stub.hold = new Promise((r) => (release = r));
      return () => {
        stub.hold = null;
        release();
      };
    };
    return stub;
  }

  /** The stage's state as the checks read it. */
  const stageInfo = (page) =>
    page.evaluate((S) => {
      const root = document.querySelector(S);
      const fs = root.querySelector('[data-action="fullscreen"]');
      const close = root.querySelector('[data-action="unload"]');
      const play = root.querySelector('.stage__over [data-action="load"]');
      const frame = root.querySelector('[data-stage] iframe');
      const shown = (el) => Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
      let url = null;
      try {
        url = frame && new URL(frame.src);
      } catch {}
      return {
        state: root.dataset.state,
        symbol: root.dataset.symbol,
        stageH: Math.round(root.getBoundingClientRect().height),
        framesInStage: root.querySelectorAll('iframe').length,
        framesOnPage: document.querySelectorAll('iframe').length,
        origin: url?.origin || '',
        params: url ? Object.fromEntries(url.searchParams) : {},
        allow: frame?.getAttribute('allow') || '',
        title: frame?.title || '',
        fs: fs ? fs.getAttribute('aria-disabled') : null,
        playShown: shown(play),
        closeShown: shown(close),
        focusClose: document.activeElement === close,
        focusPlay: document.activeElement === play,
        status: root.querySelector('[data-status]')?.textContent || '',
        blockedTitle: root.querySelector('[data-blocked-title]')?.textContent || '',
        blocked: root.querySelector('[data-blocked]')?.textContent || '',
      };
    }, STAGE);

  const stageIs = (page, state, timeout) => until(page, ([S, s]) => document.querySelector(S)?.dataset.state === s, [STAGE, state], timeout);

  return { STAGE, stubEmbed, stageInfo, stageIs };
}
