// Seven Systems: the slot. The result is drawn from crypto.getRandomValues
// and settled before the reels move; the animation only shows it.
import { STRIPS, STOPS, LINES, SYMBOLS, SETS, settle, column } from './seven-systems.math.js';
import { drawCrystal, drawCabochon } from '../lib/crystals.js';
import { opalImage } from '../lib/opal.js';
import { randomInt } from '../lib/rng.js';
import { wallet } from '../lib/wallet.js';
import { settings } from '../lib/settings.js';
import { sound } from '../lib/sound.js';
import { buzz } from '../lib/haptics.js';
import { reducedMotion, cssColours } from '../lib/ui.js';
import { fmt } from '../lib/format.js';
import { shell, shortcuts, fitCanvas } from './common.js';

const RATIO = 444 / 660;
const SPEED = 22; // stops per second while spinning
const OMEGA = 18;
const ZETA = 0.62;

const name = (k) => SYMBOLS[k].name;

// A still, cheap opal for the first paint: milky or black body with a few patches of colour.
function quickOpal(w, h, dark) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.beginPath();
  x.ellipse(w / 2, h / 2, (w / 2) * 0.94, (h / 2) * 0.94, 0, 0, Math.PI * 2);
  x.fillStyle = dark ? '#10131b' : '#dfe2e4';
  x.fill();
  x.save();
  x.clip();
  const hues = ['#2b88e6', '#22b573', '#d7b531', '#14a6b8', '#e06a2a', '#3cc46a'];
  for (let i = 0; i < 14; i++) {
    x.globalAlpha = dark ? 0.85 : 0.55;
    x.fillStyle = hues[i % hues.length];
    x.beginPath();
    x.arc(w * (0.15 + ((i * 37) % 70) / 100), h * (0.15 + ((i * 53) % 70) / 100), Math.min(w, h) * 0.12, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();
  return c;
}

function describeWin(w) {
  if (w.kind === 'set') return `${SETS[w.set].name}, mixed`;
  if (w.symbol === 'O') return 'three Opals';
  const wild = w.symbols.includes('O') ? ' with Opal' : '';
  return `three ${name(w.symbol)}${wild}`;
}

function describeGrid(stops) {
  const cols = stops.map((s, r) => column(r, s));
  const rows = ['Top', 'Middle', 'Bottom'];
  return rows.map((label, i) => `${label} row: ${cols.map((c) => name(c[i])).join(', ')}.`).join(' ');
}

export function mount(root) {
  const canvas = root.querySelector('.slot__canvas');
  const ctx = canvas.getContext('2d');
  const ui = shell(root, {});
  const radios = [...root.querySelectorAll('.stake input')];

  let pos = [0, 0, 0].map(() => randomInt(STOPS));
  const blur = [0, 0, 0];
  let wins = [];
  let cache = null;
  let theme = null;
  let opalReady = false;

  function readTheme() {
    return { ...cssColours(['--ink', '--rule', '--paper', '--accent', '--green'], root), dark: settings.isDark() };
  }

  function geometry() {
    const W = canvas.width;
    const H = canvas.height;
    const pad = W * 0.025;
    const rw = (W - pad * 2) / 3;
    const rh = (H - pad * 2) / 3;
    return { W, H, pad, rw, rh, size: Math.min(rw * 0.78, rh * 0.8) };
  }

  function buildCache() {
    theme = readTheme();
    const g = geometry();
    const cw = Math.ceil(g.rw);
    const ch = Math.ceil(g.rh);
    cache = {};
    // The WebGL opal is made when the browser is idle; until then a quick 2D stand-in keeps start-up light.
    const ow = Math.round(g.size * 1.02);
    const oh = Math.round(g.size * 0.78);
    const opal = opalReady ? opalImage(ow, oh, { dark: theme.dark }) : quickOpal(ow, oh, theme.dark);
    if (!opalReady) {
      document.addEventListener(
        'oql:opal',
        () => {
          opalReady = true;
          cache = null;
          if (!ui.busy) requestAnimationFrame(draw);
        },
        { once: true },
      );
    }
    for (const key of Object.keys(SYMBOLS)) {
      const c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      const x = c.getContext('2d');
      if (key === 'O') drawCabochon(x, opal, cw / 2, ch / 2, g.size, theme);
      else drawCrystal(x, key, cw / 2, ch / 2, g.size * 0.92, theme);
      cache[key] = c;
    }
  }

  function draw() {
    if (!cache) buildCache();
    const g = geometry();
    ctx.clearRect(0, 0, g.W, g.H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.pad, g.pad, g.rw * 3, g.rh * 3);
    ctx.clip();
    for (let r = 0; r < 3; r++) {
      const x = g.pad + r * g.rw;
      const midY = g.pad + g.rh * 1.5;
      const p = pos[r];
      const base = Math.floor(p);
      for (let k = -2; k <= 2; k++) {
        const i = base + k;
        const sym = STRIPS[r][((i % STOPS) + STOPS) % STOPS];
        const y = midY + (i - p) * g.rh - g.rh / 2;
        if (blur[r] > 0.05) {
          // Motion blur: the symbol smeared along the reel.
          const b = blur[r];
          ctx.globalAlpha = 0.34 * b;
          ctx.drawImage(cache[sym], x, y - g.rh * 0.22 * b);
          ctx.drawImage(cache[sym], x, y + g.rh * 0.22 * b);
          ctx.globalAlpha = 1 - 0.45 * b;
          ctx.drawImage(cache[sym], x, y);
          ctx.globalAlpha = 1;
        } else ctx.drawImage(cache[sym], x, y);
      }
    }
    ctx.restore();

    // Reel dividers and the window's rules.
    ctx.strokeStyle = theme.rule;
    ctx.lineWidth = Math.max(1, g.W / 600);
    for (let r = 1; r < 3; r++) {
      const x = Math.round(g.pad + r * g.rw) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, g.pad);
      ctx.lineTo(x, g.pad + g.rh * 3);
      ctx.stroke();
    }
    // Tick marks at the middle row, like a specimen tray's centre line.
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = Math.max(1.5, g.W / 400);
    const my = g.pad + g.rh * 1.5;
    for (const x of [g.pad * 0.3, g.W - g.pad * 0.3]) {
      ctx.beginPath();
      ctx.moveTo(x, my - g.rh * 0.12);
      ctx.lineTo(x, my + g.rh * 0.12);
      ctx.stroke();
    }

    if (wins.length) drawWins(g);
  }

  function drawWins(g) {
    const lw = Math.max(2, g.W / 220);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const w of wins) {
      ctx.strokeStyle = theme.ink;
      ctx.lineWidth = lw;
      ctx.beginPath();
      w.rows.forEach((row, r) => {
        const x = g.pad + g.rw * (r + 0.5);
        const y = g.pad + g.rh * (row + 0.5);
        if (r === 0) ctx.moveTo(g.pad * 0.5, y);
        ctx.lineTo(x, y);
      });
      const last = w.rows[2];
      ctx.lineTo(g.W - g.pad * 0.5, g.pad + g.rh * (last + 0.5));
      ctx.stroke();
      // Frame each paying cell with the double rule of a specimen label.
      w.rows.forEach((row, r) => {
        const x = g.pad + g.rw * r;
        const y = g.pad + g.rh * row;
        const inset = lw * 1.5;
        ctx.lineWidth = lw * 0.6;
        ctx.strokeRect(x + inset, y + inset, g.rw - inset * 2, g.rh - inset * 2);
        ctx.strokeRect(x + inset * 2.4, y + inset * 2.4, g.rw - inset * 4.8, g.rh - inset * 4.8);
      });
      // Line number tag
      const y0 = g.pad + g.rh * (w.rows[0] + 0.5);
      const tag = String(w.line);
      const fs = Math.round(g.W / 34);
      ctx.font = `600 ${fs}px "Martian Mono", ui-monospace, monospace`;
      ctx.fillStyle = theme.ink;
      ctx.beginPath();
      ctx.arc(g.pad * 1.6, y0, fs * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.paper;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, g.pad * 1.6, y0 + fs * 0.05);
    }
    ctx.restore();
  }

  function resize() {
    if (fitCanvas(canvas, RATIO)) {
      cache = null;
      draw();
    }
  }
  new ResizeObserver(resize).observe(canvas);
  settings.on(({ key }) => {
    if (key === 'theme') {
      cache = null;
      draw();
    }
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    cache = null;
    requestAnimationFrame(draw);
  });
  document.fonts?.ready.then(() => draw());

  // ---------- a spin ----------
  // Each reel runs up to speed, spins, then settles on a damped spring.
  // While a reel is a blur we swap in a whole number of stops, so it lands
  // exactly on its result at its planned time without changing speed.
  function animate(stops) {
    return new Promise((resolve) => {
      const p0 = pos.map((p) => ((p % STOPS) + STOPS) % STOPS);
      const stopAt = [0.7, 0.98, 1.26];
      const settleFor = 0.6;
      const SWAP_AT = 0.22;
      const plan = p0.map((start, r) => {
        const tc = stopAt[r];
        const cruiseEnd = start - SPEED * (tc - 0.06);
        const Dmin = (SPEED / OMEGA) * 0.55;
        const whole = Math.floor(cruiseEnd - Dmin);
        const D = cruiseEnd - whole; // between Dmin and Dmin + 1
        let T = stops[r];
        while (T > whole) T -= STOPS;
        return { start, tc, T, D, jump: whole - T, stopped: false };
      });
      const wd = OMEGA * Math.sqrt(1 - ZETA * ZETA);
      const t0 = performance.now();
      let lastTick = 0;
      function frame(now) {
        const t = (now - t0) / 1000;
        let done = true;
        plan.forEach((pl, r) => {
          if (t < pl.tc) {
            const run = t < 0.12 ? (SPEED * t * t) / 0.24 : SPEED * (t - 0.06);
            pos[r] = pl.start - run - (t >= SWAP_AT ? pl.jump : 0);
            blur[r] = Math.min(1, t / 0.12);
            done = false;
          } else {
            const tau = t - pl.tc;
            const x0 = pl.D;
            const v0 = -SPEED;
            const x = Math.exp(-ZETA * OMEGA * tau) * (x0 * Math.cos(wd * tau) + ((v0 + ZETA * OMEGA * x0) / wd) * Math.sin(wd * tau));
            pos[r] = pl.T + x;
            blur[r] = Math.max(0, 1 - tau / 0.12);
            if (!pl.stopped && x <= 0) {
              pl.stopped = true;
              sound.stop();
              buzz(12);
            }
            if (tau < settleFor) done = false;
            else {
              pos[r] = pl.T;
              blur[r] = 0;
            }
          }
        });
        if (now - lastTick > 55 && t < plan[2].tc) {
          lastTick = now;
          sound.tick();
        }
        draw();
        if (done) {
          pos = stops.slice();
          blur.fill(0);
          draw();
          resolve();
        } else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  async function spin() {
    if (ui.busy) return;
    const stake = ui.stake();
    if (!ui.allowed(stake)) return;
    wallet.stake(stake);
    const stops = [0, 1, 2].map(() => randomInt(STOPS));
    const outcome = settle(stops, stake);
    wallet.credit(outcome.returned, { defer: true });

    ui.busy = true;
    wins = [];
    ui.say('Spinning…');
    canvas.setAttribute('aria-label', 'The reels are spinning.');
    if (reducedMotion()) {
      pos = stops.slice();
      draw();
    } else {
      await animate(stops);
    }
    wins = outcome.wins;
    draw();
    root.querySelectorAll('.paytable tr.is-hit').forEach((tr) => tr.classList.remove('is-hit'));
    for (const w of wins) root.querySelector(`.paytable tr[data-sym="${w.kind === 'set' ? `set:${w.set}` : w.symbol}"]`)?.classList.add('is-hit');

    wallet.reveal();
    canvas.setAttribute('aria-label', describeGrid(stops));
    const detail = wins.length
      ? wins.map((w) => `Line ${w.line}: ${describeWin(w)}, ${fmt(w.amount)}.`).join(' ')
      : 'No line paid.';
    ui.settled({ staked: stake, returned: outcome.returned, detail });
    ui.celebrate(stake, outcome.returned);
    ui.busy = false;
  }

  ui.play.addEventListener('click', spin);
  shortcuts(root, { s: spin, ' ': () => document.activeElement === root && spin() }, radios);

  resize();
  draw();
}
