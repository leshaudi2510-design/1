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
//     [data-fallback]              link to the demo on Pragmatic's site, shown if loading fails
//     [data-blocked]               text shown while games are paused
//     [data-blocked-title]         optional heading for that text
// States: idle · loading · ready · failed · blocked
// Controls with aria-disabled="true" stay focusable, and clicks on them do nothing.

import config from '../config.js';
import { rg } from '../lib/rg.js';
import { announce } from '../lib/ui.js';
import { track } from '../lib/consent.js';
import { demoUrl } from '../lib/pragmatic-url.js';

const LOAD_TIMEOUT = 20000;

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
  const fsBtn = root.querySelector('[data-action="fullscreen"]');
  const closeBtn = root.querySelector('[data-action="unload"]');
  const src = demoUrl(config.pragmatic, symbol);
  let frame = null;
  let timer = 0;

  root.querySelectorAll('[data-fallback]').forEach((a) => (a.href = src));

  const isFullscreen = () => Boolean(document.fullscreenElement && root.contains(document.fullscreenElement));
  const isCovering = () => isFullscreen() || root.hasAttribute('data-expanded');
  // Focus moves only when it was inside the stage (the control that had it is
  // about to be hidden), so it is never pulled away from elsewhere on the page.
  const focusInside = () => root.contains(document.activeElement);
  const moveFocus = (el) => el?.focus({ preventScroll: true });

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

  function load() {
    const can = rg.canPlay();
    if (!can.ok) return block(can);
    if (frame) return;
    setState('loading');
    // Play (or Try again) is hidden now, so focus goes to Close demo, which
    // shows from here on and can also cancel a slow load.
    moveFocus(closeBtn);
    say(`Loading the ${name} demo from Pragmatic Play.`);
    frame = document.createElement('iframe');
    frame.src = src;
    frame.title = `${name}, free demo from Pragmatic Play`;
    // allow="fullscreen" replaces the legacy allowfullscreen attribute; setting both makes Chrome log a warning.
    frame.allow = 'fullscreen; autoplay';
    frame.addEventListener(
      'load',
      () => {
        clearTimeout(timer);
        if (root.dataset.state !== 'loading') return;
        setState('ready');
        say(`${name} demo loaded. It plays with demo credits that have no cash value.`);
      },
      { once: true },
    );
    timer = setTimeout(() => {
      if (root.dataset.state !== 'loading') return;
      const inside = focusInside();
      unload();
      setState('failed');
      say(`The ${name} demo didn’t load. You can try again, or open it on Pragmatic Play’s site.`);
      if (inside) moveFocus(root.querySelector('.stage__msg--failed [data-action="load"], [data-fallback]'));
    }, LOAD_TIMEOUT);
    stage.append(frame);
    track('demo_load', { game: symbol });
  }

  function block(can) {
    if (root.dataset.state === 'blocked' && blocked?.textContent === can.message) return;
    const inside = focusInside();
    unload();
    setState('blocked');
    const copy = BLOCKED[can.reason] || BLOCKED.break;
    if (blocked) blocked.textContent = can.message;
    if (blockedTitle) blockedTitle.textContent = copy.title;
    const link = root.querySelector('.stage__msg--blocked a');
    if (link) {
      link.href = copy.link;
      link.textContent = copy.text;
    }
    say(can.message);
    if (inside) moveFocus(link);
  }

  function close(message) {
    const inside = focusInside();
    unload(message);
    setState('idle');
    if (inside) moveFocus(root.querySelector('.stage__over [data-action="load"]'));
  }

  function refresh() {
    const can = rg.canPlay();
    if (!can.ok) return block(can);
    if (root.dataset.state === 'blocked') {
      const inside = focusInside();
      setState('idle');
      say('');
      if (inside) moveFocus(root.querySelector('.stage__over [data-action="load"]'));
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
  const syncFs = () => {
    const on = isCovering();
    fsBtn?.setAttribute('aria-pressed', String(on));
    fsBtn?.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen');
  };
  document.addEventListener('fullscreenchange', syncFs);
  new MutationObserver(syncFs).observe(root, { attributes: true, attributeFilter: ['data-expanded'] });

  // The expanded stage covers the page: Esc leaves it, and Tab stays inside it
  // (dialogs such as the reality check still take focus over it).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !root.hasAttribute('data-expanded')) return;
    if (document.querySelector('dialog[open]')) return;
    root.removeAttribute('data-expanded');
    moveFocus(fsBtn);
  });
  document.addEventListener('focusin', (e) => {
    if (!isCovering() || root.contains(e.target)) return;
    if (e.target.closest?.('dialog, [popover]')) return;
    moveFocus(fsBtn || closeBtn);
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
