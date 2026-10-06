// Lapidary Wheel: single-zero roulette. The pocket is chosen with
// crypto.getRandomValues the moment you spin; the ball is then drawn on a
// path that ends in that pocket.
//
// The wheel is artwork in the site's print style: ink outlines, garnet,
// jet and malachite pockets, a gold rim and a cut gem at the hub. It looks
// the same in both themes, so it reads no theme colours.
import { WHEEL, BETS, CHIPS, TABLE_LIMIT, colourOf, settle } from './lapidary-wheel.math.js';
import { randomInt } from '../lib/rng.js';
import { wallet } from '../lib/wallet.js';
import { sound } from '../lib/sound.js';
import { buzz } from '../lib/haptics.js';
import { reducedMotion } from '../lib/ui.js';
import { fmt, carats } from '../lib/format.js';
import { shell, shortcuts, fitCanvas, setOff, isOff } from './common.js';

const N = WHEEL.length;
const STEP = (Math.PI * 2) / N;
const COLOUR_NAME = { garnet: 'Garnet', jet: 'Jet', malachite: 'Malachite' };
const spoken = (n) => `${n} ${COLOUR_NAME[colourOf(n)]}`;

// Print colours (spec 3.1 and 7.20). Identical by day and by night.
const INK = '#18122B';
const POCKET = { garnet: '#C8102E', jet: '#18122B', malachite: '#13C08B' };
const NUMBER = { garnet: '#FFFFFF', jet: '#FFFFFF', malachite: '#18122B' };
const GOLD = '#FFC21A';
const YELLOW = '#FFE11A';
const GEM = '#3DD6FF';
const GEM_LIGHT = '#C9F4FF';
const CREAM = '#FFF5E1';

export function mount(root) {
  const canvas = root.querySelector('.wheel__canvas');
  const ctx = canvas.getContext('2d');
  const board = root.querySelector('[data-board]');
  const buttons = [...board.querySelectorAll('.bet')];
  const totalEl = root.querySelector('[data-total]');
  const historyEl = root.querySelector('[data-history]');
  const undoBtn = root.querySelector('[data-action="undo"]');
  const clearBtn = root.querySelector('[data-action="clear"]');
  const rebetBtn = root.querySelector('[data-action="rebet"]');
  const chipRadios = [...root.querySelectorAll('.chips input')];

  let bets = {};
  let placed = [];
  let lastBets = null;
  const total = () => Object.values(bets).reduce((a, b) => a + b, 0);
  const ui = shell(root, { needed: total });

  // ---------- wheel state ----------
  let wheelAngle = -Math.PI / 2 - STEP / 2;
  let ball = null; // { angle, radius } in wheel-independent screen terms
  let landed = null; // pocket index

  const ring = (c, r0, r1, a0 = 0, a1 = Math.PI * 2) => {
    ctx.beginPath();
    ctx.arc(c, c, r1, a0, a1);
    ctx.arc(c, c, r0, a1, a0, true);
    ctx.closePath();
  };
  const disc = (c, r) => {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
  };

  function draw() {
    const S = canvas.width;
    const c = S / 2;
    const R = (f) => f * S;
    const line = (f) => Math.max(1, S * f);
    ctx.clearRect(0, 0, S, S);

    // Ink outline, gold rim and ball track, with a groove where the ball runs.
    disc(c, R(0.497));
    ctx.fillStyle = INK;
    ctx.fill();
    disc(c, R(0.482));
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = line(0.004);
    disc(c, R(0.458));
    ctx.stroke();
    ctx.globalAlpha = 1;
    disc(c, R(0.412));
    ctx.fillStyle = INK;
    ctx.fill();

    // Number ring and pockets, turning with the wheel.
    const fs = Math.round(S * 0.037);
    ctx.font = `800 ${fs}px Archivo, "Arial Narrow", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < N; i++) {
      const n = WHEEL[i];
      const a0 = wheelAngle + i * STEP;
      const a1 = a0 + STEP;
      const col = colourOf(n);
      ctx.fillStyle = POCKET[col];
      ring(c, R(0.27), R(0.4), a0 - 0.002, a1 + 0.002);
      ctx.fill();
      // The pocket itself sits a little deeper: shade it with ink.
      ctx.fillStyle = 'rgb(24 18 43 / 0.34)';
      ring(c, R(0.27), R(0.322), a0, a1);
      ctx.fill();
      const am = a0 + STEP / 2;
      ctx.save();
      ctx.translate(c + Math.cos(am) * R(0.362), c + Math.sin(am) * R(0.362));
      ctx.rotate(am + Math.PI / 2);
      ctx.fillStyle = NUMBER[col];
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    }
    // Frets between pockets, and the rings that frame them.
    ctx.strokeStyle = INK;
    ctx.lineWidth = line(0.0045);
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = wheelAngle + i * STEP;
      ctx.moveTo(c + Math.cos(a) * R(0.27), c + Math.sin(a) * R(0.27));
      ctx.lineTo(c + Math.cos(a) * R(0.4), c + Math.sin(a) * R(0.4));
    }
    ctx.stroke();
    ctx.lineWidth = line(0.004);
    disc(c, R(0.322));
    ctx.stroke();

    if (landed != null) {
      // The pocket the ball landed in: a yellow frame edged in ink.
      const a0 = wheelAngle + landed * STEP;
      ctx.lineJoin = 'round';
      ring(c, R(0.272), R(0.398), a0, a0 + STEP);
      ctx.strokeStyle = INK;
      ctx.lineWidth = line(0.02);
      ctx.stroke();
      ctx.strokeStyle = YELLOW;
      ctx.lineWidth = line(0.011);
      ctx.stroke();
    }

    drawHub(c, R(0.268), wheelAngle);

    // Ball: white, ink edge and a hard offset shadow.
    if (ball) {
      const bx = c + Math.cos(ball.angle) * R(ball.radius);
      const by = c + Math.sin(ball.angle) * R(ball.radius);
      const br = R(0.02);
      ctx.fillStyle = 'rgb(24 18 43 / 0.45)';
      ctx.beginPath();
      ctx.arc(bx + br * 0.35, by + br * 0.35, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = INK;
      ctx.lineWidth = line(0.0045);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // The hub: a yellow cone with an ink edge and a cut gem at its centre.
  function drawHub(c, r, rot) {
    const S = canvas.width;
    const pt = (a, f) => [c + Math.cos(a + rot) * r * f, c + Math.sin(a + rot) * r * f];
    const poly = (pts) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    disc(c, r);
    ctx.fillStyle = YELLOW;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, S * 0.012);
    ctx.stroke();
    // Spokes to the pockets, like the turret's arms.
    ctx.lineWidth = Math.max(1, S * 0.006);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      ctx.moveTo(...pt(a, 0.72));
      ctx.lineTo(...pt(a, 0.96));
    }
    ctx.stroke();
    const outer = Array.from({ length: 8 }, (_, i) => pt((i * Math.PI) / 4 + Math.PI / 8, 0.66));
    const inner = Array.from({ length: 8 }, (_, i) => pt((i * Math.PI) / 4 + Math.PI / 8, 0.33));
    poly(outer);
    ctx.fillStyle = GEM;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, S * 0.009);
    ctx.stroke();
    poly(inner);
    ctx.fillStyle = GEM_LIGHT;
    ctx.fill();
    ctx.lineWidth = Math.max(1, S * 0.006);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 8; i += 2) {
      ctx.moveTo(...inner[i]);
      ctx.lineTo(...outer[i]);
    }
    ctx.stroke();
    // A cream glint on the table facet.
    ctx.strokeStyle = CREAM;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, S * 0.008);
    ctx.beginPath();
    ctx.moveTo(...pt(Math.PI * 1.1, 0.2));
    ctx.lineTo(...pt(Math.PI * 1.35, 0.2));
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function resize() {
    if (fitCanvas(canvas, 1)) draw();
  }
  new ResizeObserver(resize).observe(canvas);
  document.fonts?.ready.then(() => draw());

  // ---------- the table ----------
  const chip = () => Number(chipRadios.find((r) => r.checked)?.value || CHIPS[0]);

  function renderBets() {
    for (const b of buttons) {
      const id = b.dataset.bet;
      const amount = bets[id] || 0;
      b.querySelector('.bet__chip').textContent = amount ? fmt(amount) : '';
      b.setAttribute('aria-label', amount ? `${b.dataset.label}. ${carats(amount)} on it.` : b.dataset.label);
    }
    const t = total();
    totalEl.textContent = fmt(t);
    root.querySelector('[data-stake-label]').textContent = fmt(t);
    setOff(undoBtn, ui.busy || !placed.length);
    setOff(clearBtn, ui.busy || !placed.length);
    setOff(rebetBtn, ui.busy || !lastBets || placed.length > 0);
    ui.refresh();
  }

  function clearWinners() {
    buttons.forEach((b) => b.classList.remove('is-winner'));
  }

  function place(id, amount = chip()) {
    if (ui.busy) return;
    const status = ui.allowed(total() + amount);
    if (!status) return;
    if (total() + amount > TABLE_LIMIT) {
      ui.say(`The table limit is ${carats(TABLE_LIMIT)} a spin.`, 'locked');
      return;
    }
    clearWinners();
    landed = null;
    draw();
    bets[id] = (bets[id] || 0) + amount;
    placed.push({ id, amount });
    sound.chip();
    buzz(8);
    renderBets();
    ui.say(`${carats(amount)} on ${BETS[id].label}. ${carats(total())} on the table.`);
  }

  function lift(id) {
    if (ui.busy) return;
    const i = placed.map((p) => p.id).lastIndexOf(id);
    if (i < 0) return;
    const [p] = placed.splice(i, 1);
    bets[p.id] -= p.amount;
    if (!bets[p.id]) delete bets[p.id];
    renderBets();
    ui.say(`Took ${carats(p.amount)} off ${BETS[p.id].label}. ${carats(total())} on the table.`);
  }

  board.addEventListener('click', (e) => {
    const b = e.target.closest('.bet');
    if (b) place(b.dataset.bet);
  });

  // Roving focus: arrow keys move to the nearest bet in that direction.
  let current = buttons[0];
  buttons.forEach((b) => (b.tabIndex = b === current ? 0 : -1));
  function focusBet(b) {
    current.tabIndex = -1;
    current = b;
    b.tabIndex = 0;
    b.focus();
  }
  board.addEventListener('keydown', (e) => {
    const b = e.target.closest('.bet');
    if (!b) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      lift(b.dataset.bet);
      return;
    }
    const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      focusBet(e.key === 'Home' ? buttons[0] : buttons.at(-1));
      return;
    }
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();
    const r0 = b.getBoundingClientRect();
    const cx = r0.left + r0.width / 2;
    const cy = r0.top + r0.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const o of buttons) {
      if (o === b) continue;
      const r = o.getBoundingClientRect();
      const dx = r.left + r.width / 2 - cx;
      const dy = r.top + r.height / 2 - cy;
      const along = dx * d[0] + dy * d[1];
      if (along <= 1) continue;
      const across = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    if (best) focusBet(best);
  });
  board.addEventListener('focusin', (e) => {
    const b = e.target.closest('.bet');
    if (b && b !== current) {
      current.tabIndex = -1;
      current = b;
      b.tabIndex = 0;
    }
  });

  undoBtn.addEventListener('click', () => {
    if (isOff(undoBtn)) return;
    const last = placed.at(-1);
    if (last) lift(last.id);
  });
  clearBtn.addEventListener('click', () => {
    if (isOff(clearBtn)) return;
    bets = {};
    placed = [];
    renderBets();
    ui.say('Table cleared.');
  });
  rebetBtn.addEventListener('click', () => {
    if (isOff(rebetBtn) || !lastBets) return;
    const sum = lastBets.reduce((a, p) => a + p.amount, 0);
    if (!ui.allowed(sum)) return;
    clearWinners();
    landed = null;
    draw();
    bets = {};
    placed = [];
    for (const p of lastBets) {
      bets[p.id] = (bets[p.id] || 0) + p.amount;
      placed.push({ ...p });
    }
    sound.chip();
    renderBets();
    ui.say(`Same again: ${carats(total())} on the table.`);
  });

  // ---------- a spin ----------
  function animate(index) {
    return new Promise((resolve) => {
      const T = 4.6;
      const LAND = 3.55;
      const w0 = wheelAngle;
      const omega = 1.25;
      const wheelAt = (t) => w0 + omega * (t - (0.35 * t * t) / (2 * T));
      const pocketAngle = (t) => wheelAt(t) + index * STEP + STEP / 2;
      const b0 = ball ? ball.angle : -Math.PI / 2;
      // The ball runs the other way, about three and a half turns.
      let target = pocketAngle(LAND);
      while (target > b0 - Math.PI * 7) target -= Math.PI * 2;
      const span = target - b0;
      const ease = (u) => 1 - Math.pow(1 - u, 2.2);
      const t0 = performance.now();
      let lastPocket = null;
      function frame(now) {
        const t = Math.min(T, (now - t0) / 1000);
        wheelAngle = wheelAt(t);
        if (t < LAND) {
          const u = t / LAND;
          const angle = b0 + span * ease(u);
          let radius = 0.437;
          if (u > 0.62) {
            const v = (u - 0.62) / 0.38;
            radius = 0.437 - (0.437 - 0.296) * (v * v * (3 - 2 * v)) + Math.sin(v * Math.PI * 5) * 0.012 * (1 - v);
            const rel = Math.floor((((angle - wheelAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / STEP);
            if (rel !== lastPocket) {
              lastPocket = rel;
              sound.tick();
            }
          }
          ball = { angle, radius };
        } else {
          const settleT = t - LAND;
          ball = { angle: pocketAngle(t), radius: 0.296 + Math.exp(-settleT * 9) * Math.sin(settleT * 30) * 0.006 };
          if (lastPocket !== -1) {
            lastPocket = -1;
            sound.stop();
            buzz(14);
          }
        }
        draw();
        if (t >= T) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  async function spin() {
    if (ui.busy) return;
    const staked = total();
    if (staked <= 0) {
      ui.say('Place a chip on the table first.');
      return;
    }
    if (!ui.allowed(staked)) return;
    wallet.stake(staked);
    const index = randomInt(N);
    const number = WHEEL[index];
    const outcome = settle(bets, number);
    wallet.credit(outcome.returned, { defer: true });
    lastBets = placed.map((p) => ({ ...p }));

    ui.busy = true;
    renderBets();
    landed = null;
    clearWinners();
    ui.say('The ball is running…');
    canvas.setAttribute('aria-label', 'The wheel is spinning.');
    if (reducedMotion()) {
      wheelAngle = -Math.PI / 2 - index * STEP - STEP / 2;
      ball = { angle: -Math.PI / 2, radius: 0.296 };
      draw();
    } else {
      await animate(index);
    }
    landed = index;
    draw();

    const winners = outcome.winners;
    for (const w of winners) board.querySelector(`[data-bet="${w.id}"]`)?.classList.add('is-winner');
    board.querySelector(`[data-bet="n${number}"]`)?.classList.add('is-winner');
    const li = document.createElement('li');
    li.className = `is-${colourOf(number)}`;
    li.textContent = number;
    li.setAttribute('aria-label', spoken(number));
    historyEl.prepend(li);
    while (historyEl.children.length > 12) historyEl.lastElementChild.remove();

    wallet.reveal();
    canvas.setAttribute('aria-label', `The ball is in ${spoken(number)}.`);
    const detail = `The ball lands on ${spoken(number)}.${winners.length ? ' ' + winners.map((w) => `${w.id.startsWith('n') ? `${BETS[w.id].label} straight up` : BETS[w.id].label} returns ${fmt(w.back)}.`).join(' ') : ''}`;
    ui.settled({ staked, returned: outcome.returned, detail });
    ui.celebrate(staked, outcome.returned);

    bets = {};
    placed = [];
    ui.busy = false;
    renderBets();
  }

  ui.play.addEventListener('click', spin);
  shortcuts(root, { s: spin });
  wallet.on(renderBets);

  resize();
  renderBets();
  draw();
}
