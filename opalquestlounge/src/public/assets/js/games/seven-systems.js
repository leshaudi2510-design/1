// Seven Systems: the slot. The result is drawn from crypto.getRandomValues
// and settled before the reels move; the animation only shows it.
//
// The reels are artwork in the site's print style: white reel strips with
// ink rules, bright crystals in bold ink and the opal mark as the wild.
// They look the same in both themes, so they read no theme colours.
import { STRIPS, STOPS, SYMBOLS, SETS, settle, column } from './seven-systems.math.js';
import { drawCrystal, drawOpal } from '../lib/crystals.js';
import { randomInt } from '../lib/rng.js';
import { wallet } from '../lib/wallet.js';
import { sound } from '../lib/sound.js';
import { buzz } from '../lib/haptics.js';
import { reducedMotion } from '../lib/ui.js';
import { fmt } from '../lib/format.js';
import { shell, shortcuts, fitCanvas } from './common.js';

const RATIO = 444 / 660;
const SPEED = 22; // stops per second while spinning
const OMEGA = 18;
const ZETA = 0.62;

const INK = '#18122B';
const YELLOW = '#FFE11A';
const REEL = '#FFFFFF';
const REEL_SHADE = '#EDE6FF';

const name = (k) => SYMBOLS[k].name;

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

  function geometry() {
    const W = canvas.width;
    const H = canvas.height;
    const pad = W * 0.03;
    const rw = (W - pad * 2) / 3;
    const rh = (H - pad * 2) / 3;
    return { W, H, pad, rw, rh, size: Math.min(rw * 0.7, rh * 0.74) };
  }

  function buildCache() {
    const g = geometry();
    const cw = Math.ceil(g.rw);
    const ch = Math.ceil(g.rh);
    cache = {};
    for (const key of Object.keys(SYMBOLS)) {
      const c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      const x = c.getContext('2d');
      if (key === 'O') drawOpal(x, cw / 2, ch / 2, g.size * 0.98);
      else drawCrystal(x, key, cw / 2, ch / 2, g.size * 0.9);
      cache[key] = c;
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  }

  function draw() {
    if (!cache) buildCache();
    const g = geometry();
    const lw = Math.max(2, g.W / 200);
    const win = [g.pad, g.pad, g.rw * 3, g.rh * 3];
    ctx.clearRect(0, 0, g.W, g.H);

    // The reel window: white strips, the middle one a touch lighter than its neighbours' edges.
    roundRect(...win, g.W * 0.018);
    ctx.fillStyle = REEL;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let r = 0; r < 3; r++) {
      // A lilac band at the top and bottom of each strip suggests the curve of the reel.
      const x = g.pad + r * g.rw;
      const grad = ctx.createLinearGradient(0, g.pad, 0, g.pad + g.rh * 3);
      grad.addColorStop(0, REEL_SHADE);
      grad.addColorStop(0.18, REEL);
      grad.addColorStop(0.82, REEL);
      grad.addColorStop(1, REEL_SHADE);
      ctx.fillStyle = grad;
      ctx.fillRect(x, g.pad, g.rw, g.rh * 3);
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

    // Ink rules between the reels and round the window.
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    for (let r = 1; r < 3; r++) {
      const x = Math.round(g.pad + r * g.rw);
      ctx.beginPath();
      ctx.moveTo(x, g.pad);
      ctx.lineTo(x, g.pad + g.rh * 3);
      ctx.stroke();
    }
    ctx.lineWidth = lw * 1.5;
    roundRect(...win, g.W * 0.018);
    ctx.stroke();

    // Yellow pointers on the middle row, outside the window.
    const my = g.pad + g.rh * 1.5;
    const t = g.pad * 0.8;
    ctx.fillStyle = YELLOW;
    ctx.lineWidth = Math.max(1.5, lw * 0.7);
    ctx.lineJoin = 'round';
    for (const [x, dir] of [[g.pad * 0.12, 1], [g.W - g.pad * 0.12, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x, my - t);
      ctx.lineTo(x + dir * t, my);
      ctx.lineTo(x, my + t);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (wins.length) drawWins(g);
  }

  function drawWins(g) {
    const lw = Math.max(3, g.W / 150);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const w of wins) {
      // Frame each paying cell in yellow, edged in ink.
      w.rows.forEach((row, r) => {
        const inset = lw * 1.4;
        const x = g.pad + g.rw * r + inset;
        const y = g.pad + g.rh * row + inset;
        roundRect(x, y, g.rw - inset * 2, g.rh - inset * 2, g.rw * 0.06);
        ctx.strokeStyle = INK;
        ctx.lineWidth = lw * 1.9;
        ctx.stroke();
        ctx.strokeStyle = YELLOW;
        ctx.lineWidth = lw;
        ctx.stroke();
      });
      // The line itself: ink under yellow.
      ctx.beginPath();
      w.rows.forEach((row, r) => {
        const x = g.pad + g.rw * (r + 0.5);
        const y = g.pad + g.rh * (row + 0.5);
        if (r === 0) ctx.moveTo(g.pad * 0.5, y);
        ctx.lineTo(x, y);
      });
      ctx.lineTo(g.W - g.pad * 0.5, g.pad + g.rh * (w.rows[2] + 0.5));
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw * 1.9;
      ctx.stroke();
      ctx.strokeStyle = YELLOW;
      ctx.lineWidth = lw * 0.8;
      ctx.stroke();
    }
    // Line number tags on top of every line: ink discs with yellow numbers,
    // side by side when two lines start on the same row.
    const fs = Math.round(g.W / 30);
    const perRow = [0, 0, 0];
    ctx.font = `900 ${fs}px Archivo, "Arial Black", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const w of wins) {
      const y0 = g.pad + g.rh * (w.rows[0] + 0.5);
      const x0 = g.pad * 1.7 + perRow[w.rows[0]]++ * fs * 1.9;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x0, y0, fs * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = YELLOW;
      ctx.lineWidth = Math.max(1.5, lw * 0.5);
      ctx.stroke();
      ctx.fillStyle = YELLOW;
      ctx.fillText(String(w.line), x0, y0 + fs * 0.05);
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
