// Entry point for every page.
import { settings } from './lib/settings.js';
import { wallet } from './lib/wallet.js';
import { fmt } from './lib/format.js';
import { whenActivated, toast, ask } from './lib/ui.js';
import { startRg } from './lib/rg.js';
import { startAgeGate } from './lib/age.js';
import { startConsent } from './lib/consent.js';
import { hasHaptics } from './lib/haptics.js';
import config from './config.js';

// ---------- balance everywhere ----------
function showBalance() {
  const text = fmt(wallet.balance);
  document.querySelectorAll('[data-balance]').forEach((el) => (el.textContent = text));
}
showBalance();
wallet.on(showBalance);

// ---------- settings dialog ----------
function startSettings() {
  const dialog = document.getElementById('settings');
  if (!dialog) return;
  const form = dialog.querySelector('form');
  const sync = () => {
    form.querySelectorAll('input[name="theme"]').forEach((r) => (r.checked = r.value === settings.get('theme')));
    if (form.elements.sound) form.elements.sound.checked = settings.get('sound');
    if (form.elements.haptics) form.elements.haptics.checked = settings.get('haptics');
  };
  if (!hasHaptics) form.querySelector('[data-needs="vibrate"]')?.remove();
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'theme') settings.set('theme', t.value);
    if (t.name === 'sound') settings.set('sound', t.checked);
    if (t.name === 'haptics') settings.set('haptics', t.checked);
  });
  form.querySelector('[data-action="reset-balance"]')?.addEventListener('click', async () => {
    const amount = `${fmt(config.currency.startingBalance)} ${config.currency.plural}`;
    const ok = await ask({
      title: 'Reset your balance?',
      body: `Your balance goes back to ${amount}.`,
      yes: `Reset to ${amount}`,
      no: 'Keep my balance',
    });
    if (!ok) return;
    wallet.reset();
    toast(`Balance reset to ${amount}.`);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-open="settings"]')) return;
    sync();
    document.querySelectorAll(':popover-open').forEach((p) => p.hidePopover());
    dialog.showModal();
  });
  settings.on(sync);
}

// ---------- games ----------
const GAMES = {
  'seven-systems': () => import('./games/seven-systems.js'),
  'lapidary-wheel': () => import('./games/lapidary-wheel.js'),
  'brilliant-twenty-one': () => import('./games/brilliant-21.js'),
  pragmatic: () => import('./games/pragmatic.js'),
};
function startGames() {
  document.querySelectorAll('[data-game]').forEach(async (root) => {
    const load = GAMES[root.dataset.game];
    if (!load) return;
    const mod = await load();
    // Mount after the first frame has been painted, so the page's first
    // style and layout pass isn't forced inside the game's start-up.
    requestAnimationFrame(() => setTimeout(() => mod.mount(root), 0));
  });
}

// ---------- boot ----------
startSettings();
startGames();

whenActivated(() => {
  startRg();
  startConsent();
  startAgeGate();
});

// The opal is decoration. It wakes on the visitor's first move (pointer,
// touch, key or scroll) and until then a still drawing stands in, so the
// WebGL start-up never competes with loading the page.
const WAKE = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'];
let awake = false;
async function wakeOpals() {
  if (awake) return;
  awake = true;
  WAKE.forEach((t) => removeEventListener(t, wakeOpals, { capture: true }));
  document.dispatchEvent(new Event('oql:opal'));
  if (!document.querySelector('canvas[data-opal]')) return;
  const { startOpals } = await import('./lib/opal.js');
  startOpals();
}
whenActivated(() => WAKE.forEach((t) => addEventListener(t, wakeOpals, { capture: true, passive: true })));

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
