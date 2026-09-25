// Shared UI helpers: announcements, toasts, dialogs, motion preferences,
// and waiting for a prerendered page to be shown.

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function announce(message) {
  const el = document.getElementById('announcer');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = message));
}

let toastTimer;
export function toast(message, ms = 4000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  try {
    if (!el.matches(':popover-open')) el.showPopover();
  } catch {}
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

/**
 * Resolve CSS colour tokens to strings a canvas can use, e.g.
 * cssColours(['--ink', '--paper'], el) → { ink: 'oklch(…)', paper: '…' }.
 * All tokens are read in one style recalculation.
 */
export function cssColours(names, el = document.body) {
  const box = document.createElement('div');
  box.hidden = true;
  const spans = names.map((n) => {
    const s = document.createElement('span');
    s.style.color = `var(${n})`;
    box.append(s);
    return s;
  });
  el.append(box);
  const out = {};
  names.forEach((n, i) => {
    out[n.replace(/^--/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase())] = getComputedStyle(spans[i]).color;
  });
  box.remove();
  return out;
}
