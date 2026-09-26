// A Pragmatic Play demo on a stage. Nothing is requested from Pragmatic's
// servers until the visitor presses "Play demo". The frame is removed
// again when a break, a pause or the daily limit starts.
//
// Markup contract (see src/lib/games-ui.mjs):
//   [data-game="pragmatic"][data-symbol][data-name]   root; gets data-state
//     [data-stage]                 the box the iframe goes into
//     [data-action="load"]         starts the demo (there may be several)
//     [data-action="fullscreen"]   optional
//     [data-action="unload"]       optional, closes the demo
//     [data-status]                polite live region
//     [data-fallback]              link to the demo on Pragmatic's site, shown if loading fails
//     [data-blocked]               text shown while games are paused
// States: idle · loading · ready · failed · blocked

import config from '../config.js';
import { rg } from '../lib/rg.js';
import { announce } from '../lib/ui.js';
import { track } from '../lib/consent.js';
import { demoUrl } from '../lib/pragmatic-url.js';

const LOAD_TIMEOUT = 20000;

export function mount(root) {
  const { symbol, name } = root.dataset;
  const stage = root.querySelector('[data-stage]');
  const status = root.querySelector('[data-status]');
  const blocked = root.querySelector('[data-blocked]');
  const fsBtn = root.querySelector('[data-action="fullscreen"]');
  const src = demoUrl(config.pragmatic, symbol);
  let frame = null;
  let timer = 0;

  root.querySelectorAll('[data-fallback]').forEach((a) => (a.href = src));

  const setState = (s) => {
    root.dataset.state = s;
    root.querySelectorAll('[data-action="load"]').forEach((b) => b.toggleAttribute('hidden', s === 'loading' || s === 'ready'));
  };
  const say = (text) => {
    if (status) status.textContent = text;
    else announce(text);
  };

  function unload(message) {
    clearTimeout(timer);
    if (document.fullscreenElement && root.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {});
    root.removeAttribute('data-expanded');
    frame?.remove();
    frame = null;
    if (message) say(message);
  }

  function load() {
    const can = rg.canPlay();
    if (!can.ok) return block(can.message);
    if (frame) return;
    setState('loading');
    say(`Loading the ${name} demo from Pragmatic Play.`);
    frame = document.createElement('iframe');
    frame.src = src;
    frame.title = `${name}, free demo from Pragmatic Play`;
    frame.allow = 'fullscreen; autoplay';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
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
      unload();
      setState('failed');
      say(`The ${name} demo didn't load. You can open it on Pragmatic Play's site instead.`);
    }, LOAD_TIMEOUT);
    stage.append(frame);
    track('demo_load', { game: symbol });
  }

  function block(message) {
    unload();
    setState('blocked');
    if (blocked) blocked.textContent = message;
    say(message);
  }

  function refresh() {
    const can = rg.canPlay();
    if (!can.ok) return block(can.message);
    if (root.dataset.state === 'blocked') {
      setState('idle');
      say('');
    }
  }

  // Real fullscreen where the browser allows it on an element; elsewhere
  // (iPhone Safari) the stage expands to fill the window instead.
  function toggleFullscreen() {
    if (document.fullscreenElement) return void document.exitFullscreen().catch(() => {});
    if (root.hasAttribute('data-expanded')) return void root.removeAttribute('data-expanded');
    if (stage.requestFullscreen) stage.requestFullscreen().catch(() => root.setAttribute('data-expanded', ''));
    else root.setAttribute('data-expanded', '');
  }
  const syncFs = () => {
    const on = Boolean(document.fullscreenElement && root.contains(document.fullscreenElement)) || root.hasAttribute('data-expanded');
    fsBtn?.setAttribute('aria-pressed', String(on));
  };
  document.addEventListener('fullscreenchange', syncFs);
  new MutationObserver(syncFs).observe(root, { attributes: true, attributeFilter: ['data-expanded'] });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.hasAttribute('data-expanded')) root.removeAttribute('data-expanded');
  });

  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (!a || !root.contains(a)) return;
    if (a.dataset.action === 'load') load();
    else if (a.dataset.action === 'fullscreen') toggleFullscreen();
    else if (a.dataset.action === 'unload') {
      unload(`${name} demo closed.`);
      setState('idle');
    }
  });

  rg.onChange(refresh);
  setState('idle');
  refresh();
}
