// A Pragmatic Play demo on a stage. Nothing is requested from Pragmatic's
// servers until the visitor presses "Play demo". The frame is removed
// again when a break, a pause or the daily limit starts.
//
// Markup contract (src/lib/ui/stage.mjs):
//   [data-game="pragmatic"][data-symbol][data-name]   root; gets data-state
//     [data-stage]                 the box the iframe goes into
//     [data-action="load"]         starts the demo (Play, and Try again when it fails)
//     [data-action="unload"]       optional, closes the demo (shown while loading and ready)
//     [data-action="fullscreen"]   optional; aria-disabled unless the demo is ready
//     [data-status]                polite live region
//     [data-blocked]               text shown while games are paused
//     [data-blocked-title]         optional heading for that text
//     [data-open="age-gate"]       optional, in the blocked message; shown only
//                                  while the age question is unanswered
// States: idle · loading · ready · failed · blocked
// Controls with aria-disabled="true" stay focusable, and clicks on them do nothing.
// The root also listens for "oql:refocus", which rg.js sends when a dialog
// that interrupted the demo has closed and left focus nowhere visible.

import config from '../config.js';
import { rg } from '../lib/rg.js';
import { announce, ask } from '../lib/ui.js';
import { track, demosRefused } from '../lib/consent.js';
import { demoUrl } from '../lib/pragmatic-url.js';

const LOAD_TIMEOUT = 20000;
// How long a frame that has loaded waits for the reachability check below,
// so a slow check never removes a demo that did load.
const PROBE_WAIT = 3000;

// What the blocked screen says, by the reason rg.canPlay() gives.
const LIMITS = 'About breaks and limits';
const BLOCKED = {
  break: { title: 'You’re on a break', link: '/responsible-gaming/#break', text: LIMITS },
  cooloff: { title: 'Games are paused', link: '/responsible-gaming/#break', text: LIMITS },
  limit: { title: 'Daily limit reached', link: '/responsible-gaming/#limits', text: LIMITS },
  age: { title: 'Games are locked', link: '/responsible-gaming/', text: 'About safer play' },
  unconfirmed: { title: 'Please confirm your age', link: '/responsible-gaming/', text: 'About safer play' },
};

export function mount(root) {
  const { symbol, name } = root.dataset;
  const stage = root.querySelector('[data-stage]');
  const status = root.querySelector('[data-status]');
  const blocked = root.querySelector('[data-blocked]');
  const blockedTitle = root.querySelector('[data-blocked-title]');
  const blockedLink = root.querySelector('.stage__msg--blocked a');
  const confirmAge = root.querySelector('.stage__msg--blocked [data-open="age-gate"]');
  const fsBtn = root.querySelector('[data-action="fullscreen"]');
  const closeBtn = root.querySelector('[data-action="unload"]');
  const src = demoUrl(config.pragmatic, symbol);
  let frame = null;
  let timer = 0;
  let asking = false;

  const isFullscreen = () => Boolean(document.fullscreenElement && root.contains(document.fullscreenElement));
  const isCovering = () => isFullscreen() || root.hasAttribute('data-expanded');
  // Focus moves only when it was inside the stage (the control that had it is
  // about to be hidden), so it is never pulled away from elsewhere on the page.
  const focusInside = () => root.contains(document.activeElement);
  const moveFocus = (el) => el?.focus({ preventScroll: true });
  const play = () => root.querySelector('.stage__over [data-action="load"]');
  const tryAgain = () => root.querySelector('.stage__msg--failed [data-action="load"]');
  const blockedTarget = () => (confirmAge && !confirmAge.hidden ? confirmAge : blockedLink);

  const setState = (s) => {
    root.dataset.state = s;
    root.querySelectorAll('[data-action="load"]').forEach((b) => b.toggleAttribute('hidden', s === 'loading' || s === 'ready'));
    if (fsBtn) fsBtn.setAttribute('aria-disabled', String(s !== 'ready'));
    if (s !== 'ready') leaveFullscreen();
  };
  const say = (text) => {
    if (status) status.textContent = text;
    else announce(text);
  };

  function leaveFullscreen() {
    if (isFullscreen()) document.exitFullscreen().catch(() => {});
    root.removeAttribute('data-expanded');
  }

  function unload(message) {
    clearTimeout(timer);
    leaveFullscreen();
    frame?.remove();
    frame = null;
    if (message) say(message);
  }

  function fail() {
    const inside = focusInside();
    unload();
    setState('failed');
    say(`The ${name} demo didn’t load. You can try again.`);
    if (inside) moveFocus(tryAgain());
  }

  async function load() {
    const can = rg.canPlay();
    if (!can.ok) return block(can);
    if (frame || asking) return;
    // "Reject all" in Cookie settings: ask before each demo, because the demo
    // sets cookies of its own. With no choice made, Play is the consent step,
    // and the caption it points to says what loading the demo does.
    if (demosRefused()) {
      asking = true;
      const yes = await ask({
        title: 'Load this demo?',
        body: 'You chose Reject all. This demo loads from Pragmatic Play, and Pragmatic Play and Google Analytics may set cookies on your device.',
        yes: 'Load demo and allow its cookies',
        no: 'Don’t load it',
      });
      asking = false;
      if (!yes) return;
      const now = rg.canPlay();
      if (!now.ok) return block(now);
      if (frame) return;
    }
    start();
  }

  function start() {
    setState('loading');
    // Play (or Try again) is hidden now, so focus goes to Close demo, which
    // shows from here on and can also cancel a slow load.
    moveFocus(closeBtn);
    say(`Loading the ${name} demo from Pragmatic Play.`);
    if (navigator.onLine === false) return fail(); // offline: don't even ask
    const f = (frame = document.createElement('iframe'));
    f.src = src;
    f.title = `${name}, free demo from Pragmatic Play`;
    // allow="fullscreen" replaces the legacy allowfullscreen attribute; setting both makes Chrome log a warning.
    f.allow = 'fullscreen; autoplay';
    // A frame fires "load" for the browser's own error page too (connection
    // refused, no DNS, a blocker, offline), and the parent page can't tell.
    // So a request for the same address goes alongside the frame: no-cors, no
    // cookies. It follows the same redirects under the same host list
    // (connect-src lists the frame hosts, as frame-src does) and fails only
    // when the network or the CSP refuses it. Any HTTP answer, even an error,
    // counts as reachable; the game's own error page then shows in the frame.
    const reachable = fetch(src, { method: 'HEAD', mode: 'no-cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }).then(
      () => true,
      () => false,
    );
    reachable.then((ok) => {
      if (!ok && frame === f && root.dataset.state === 'loading') fail();
    });
    f.addEventListener(
      'load',
      async () => {
        const ok = await Promise.race([reachable, new Promise((r) => setTimeout(r, PROBE_WAIT, true))]);
        if (frame !== f || root.dataset.state !== 'loading') return;
        clearTimeout(timer);
        if (!ok) return fail();
        setState('ready');
        say(`${name} demo opened. It plays with demo credits that have no cash value.`);
      },
      { once: true },
    );
    timer = setTimeout(() => {
      if (frame === f && root.dataset.state === 'loading') fail();
    }, LOAD_TIMEOUT);
    stage.append(f);
    track('demo_load', { game: symbol });
  }
  // A frame blocked by our own CSP (say, a redirect to a host that isn't
  // listed) or a connection lost while the demo loads.
  document.addEventListener('securitypolicyviolation', (e) => {
    if (frame && root.dataset.state === 'loading' && e.effectiveDirective === 'frame-src') fail();
  });
  addEventListener('offline', () => {
    if (root.dataset.state === 'loading') fail();
  });

  function block(can) {
    if (root.dataset.state === 'blocked' && blocked?.textContent === can.message) return;
    const inside = focusInside();
    unload();
    setState('blocked');
    const copy = BLOCKED[can.reason] || BLOCKED.break;
    if (blocked) blocked.textContent = can.message;
    if (blockedTitle) blockedTitle.textContent = copy.title;
    if (blockedLink) {
      blockedLink.href = copy.link;
      blockedLink.textContent = copy.text;
    }
    // The age question can be closed without an answer (Chromium lets a
    // second Escape through, and so does Android's Back); this asks it again.
    if (confirmAge) confirmAge.hidden = can.reason !== 'unconfirmed';
    say(can.message);
    if (inside) moveFocus(blockedTarget());
  }

  function close(message) {
    const inside = focusInside();
    unload(message);
    setState('idle');
    if (inside) moveFocus(play());
  }

  function refresh() {
    const can = rg.canPlay();
    if (!can.ok) return block(can);
    if (root.dataset.state === 'blocked') {
      const inside = focusInside();
      setState('idle');
      say('');
      if (inside) moveFocus(play());
    }
  }

  // Real fullscreen where the browser allows it on an element; elsewhere
  // (iPhone Safari) the stage expands to fill the window instead.
  function toggleFullscreen() {
    if (isFullscreen()) return void document.exitFullscreen().catch(() => {});
    if (root.hasAttribute('data-expanded')) return void root.removeAttribute('data-expanded');
    if (root.requestFullscreen) root.requestFullscreen().catch(() => root.setAttribute('data-expanded', ''));
    else root.setAttribute('data-expanded', '');
  }
  // A toggle: the name stays "Fullscreen" and aria-pressed carries the state.
  const syncFs = () => fsBtn?.setAttribute('aria-pressed', String(isCovering()));
  document.addEventListener('fullscreenchange', syncFs);
  new MutationObserver(syncFs).observe(root, { attributes: true, attributeFilter: ['data-expanded'] });

  // The expanded stage covers the page, and Tab stays inside it (dialogs such
  // as the reality check still take focus over it). Esc leaves it while focus
  // is on our own controls; keys pressed inside the game go to the game, so
  // from there the way out is the fullscreen button, which Tab always reaches.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !root.hasAttribute('data-expanded')) return;
    if (document.querySelector('dialog[open]')) return;
    root.removeAttribute('data-expanded');
    moveFocus(fsBtn);
  });
  document.addEventListener('focusin', (e) => {
    if (!isCovering() || root.contains(e.target)) return;
    if (e.target.closest?.('dialog, [popover]')) return;
    // Focus has left the covering stage. Landing before it means Shift+Tab,
    // so wrap to the last stop (the game); landing after it means Tab, so wrap
    // to the first (Close demo). The direction comes from where focus landed,
    // not from keydown: a Tab pressed inside the cross-origin game never
    // reaches this document.
    const before = root.compareDocumentPosition(e.target) & Node.DOCUMENT_POSITION_PRECEDING;
    moveFocus(before ? frame || fsBtn : closeBtn || fsBtn);
  });

  // A dialog that opened over the demo (the reality check) has closed, and
  // the browser couldn't give focus back: it can't return it into the game's
  // frame, or to a control the dialog's choice has hidden.
  root.addEventListener('oql:refocus', () => {
    const s = root.dataset.state;
    const to = { ready: frame || closeBtn, loading: closeBtn, blocked: blockedTarget(), failed: tryAgain() }[s] || play();
    moveFocus(to);
    if (s === 'ready' && document.activeElement !== frame) moveFocus(closeBtn);
  });

  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (!a || !root.contains(a)) return;
    if (a.getAttribute('aria-disabled') === 'true') return e.preventDefault();
    if (a.dataset.action === 'load') load();
    else if (a.dataset.action === 'fullscreen') toggleFullscreen();
    else if (a.dataset.action === 'unload') close(`${name} demo closed.`);
  });

  // The game's own Home/Close button posts this message to the parent page
  // in demo mode (Pragmatic's client, PatchHomeButtonDemoMode).
  const origin = new URL(src).origin; // https://demogamesfree.pragmaticplay.net
  addEventListener('message', (e) => {
    if (e.origin !== origin || !frame || e.source !== frame.contentWindow) return;
    let data = e.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (data?.action === 'omni-api.goTo' && data.actionData === 'lobby') close(`${name} demo closed.`);
  });

  rg.onChange(refresh);
  setState('idle');
  refresh();
}
