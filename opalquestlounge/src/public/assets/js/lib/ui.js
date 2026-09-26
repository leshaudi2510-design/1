// Shared UI helpers: announcements, toasts, dialogs, motion preferences,
// and waiting for a prerendered page to be shown.

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The status line inside the open modal dialog, if there is one. While a
 * modal is open, everything outside it (the toast, #announcer) is inert and
 * screen readers never hear it, so messages go here instead. Each
 * .sheet-dialog carries one ([data-dialog-status], role="status") from page
 * load, so it is already a live region when its text changes.
 */
function dialogStatus() {
  const modal = document.activeElement?.closest?.('dialog:modal') || [...document.querySelectorAll('dialog:modal')].pop();
  return modal?.querySelector('[data-dialog-status]') || null;
}

function say(el, message) {
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = message));
}

export function announce(message) {
  const el = dialogStatus() || document.getElementById('announcer');
  if (el) say(el, message);
}

let toastTimer;
/**
 * Show a short message in the toast (a role="status" popover) for `ms`
 * milliseconds. The popover opens first and the text lands a frame later,
 * so screen readers hear it as a change inside a visible live region.
 * While a modal dialog is open the message goes to the dialog's own status
 * line instead: the toast would be inert there, and on phones it would sit
 * over the dialog's controls. (Settings shows the result in its pills.)
 * Never use it to announce outcomes as "wins".
 */
export function toast(message, ms = 5000) {
  const inDialog = dialogStatus();
  if (inDialog) return say(inDialog, message);
  const el = document.getElementById('toast');
  if (!el) return;
  const msg = el.querySelector('.toast__msg') || el;
  msg.textContent = '';
  try {
    if (!el.matches(':popover-open')) el.showPopover();
  } catch {}
  requestAnimationFrame(() => (msg.textContent = message));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    try {
      el.hidePopover();
    } catch {}
  }, ms);
}

export function openDialog(id) {
  const d = document.getElementById(id);
  if (d && !d.open) d.showModal();
  return d;
}

/**
 * Ask before an action, with buttons that name what happens (the native
 * confirm() only offers OK and Cancel). Resolves true for `yes`; Escape
 * or `no` resolves false.
 */
let asking = 0;
export function ask({ title, body = '', yes, no }) {
  const d = document.getElementById('confirm');
  if (!d) return Promise.resolve(false);
  d.querySelector('#confirm-title').textContent = title;
  const p = d.querySelector('#confirm-body');
  p.textContent = body;
  p.hidden = !body;
  d.querySelector('[value="yes"]').textContent = yes;
  d.querySelector('[value="no"]').textContent = no;
  d.returnValue = '';
  d.showModal();
  const id = ++asking;
  return new Promise((resolve) => {
    // The browser fires close a frame after the dialog closes, so an earlier
    // question's close event can arrive while this one is already open.
    const done = () => {
      if (d.open && id === asking) return;
      d.removeEventListener('close', done);
      resolve(id === asking && d.returnValue === 'yes');
    };
    d.addEventListener('close', done);
  });
}

/** Run fn once the page is actually visible to the player (not prerendering). */
export function whenActivated(fn) {
  if (document.prerendering) document.addEventListener('prerenderingchange', () => fn(), { once: true });
  else fn();
}

/**
 * Damped spring from 0 to 1 at time t (seconds), optionally with an
 * initial velocity. The same physics as the CSS linear() easings.
 */
export function spring(t, { stiffness = 170, damping = 15, velocity = 0 } = {}) {
  const w0 = Math.sqrt(stiffness);
  const z = damping / (2 * Math.sqrt(stiffness));
  const x0 = -1;
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const B = (velocity + z * w0 * x0) / wd;
    return 1 + Math.exp(-z * w0 * t) * (x0 * Math.cos(wd * t) + B * Math.sin(wd * t));
  }
  return 1 + Math.exp(-w0 * t) * (x0 + (velocity + w0 * x0) * t);
}
