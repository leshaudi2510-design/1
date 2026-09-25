// Lapidary Wheel: single-zero roulette. The winning pocket is chosen with
// crypto.getRandomValues the moment you spin; the ball is then drawn on a
// path that ends in that pocket.
import { WHEEL, BETS, CHIPS, TABLE_LIMIT, colourOf, settle } from './lapidary-wheel.math.js';
import { randomInt } from '../lib/rng.js';
import { wallet } from '../lib/wallet.js';
import { settings } from '../lib/settings.js';
import { sound } from '../lib/sound.js';
import { buzz } from '../lib/haptics.js';
import { reducedMotion, cssColours } from '../lib/ui.js';
import { fmt, carats } from '../lib/format.js';
import { shell, shortcuts, fitCanvas } from './common.js';

const N = WHEEL.length;
const STEP = (Math.PI * 2) / N;
const COLOUR_NAME = { garnet: 'Garnet', jet: 'Jet', malachite: 'Malachite' };
const spoken = (n) => `${n} ${COLOUR_NAME[colourOf(n)]}`;

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
  let colours = null;

  function readColours() {
    colours = {
      ...cssColours(['--ink', '--paper', '--paper-2', '--paper-3', '--rule', '--rule-strong', '--garnet', '--jet', '--malachite', '--label'], root),
      dark: settings.isDark(),
    };
  }

  function draw() {
    if (!colours) readColours();
    const S = canvas.width;
    const c = S / 2;
    const k = colours;
    ctx.clearRect(0, 0, S, S);
    const R = (f) => f * S;

    // Bowl rim and ball track
    ctx.fillStyle = k.jet;
    ctx.beginPath();
    ctx.arc(c, c, R(0.495), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = k.dark ? k.paper3 : k.paper2;
    ctx.beginPath();
    ctx.arc(c, c, R(0.47), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = k.ruleStrong;
    ctx.lineWidth = Math.max(1, S / 500);
    for (const f of [0.47, 0.405]) {
      ctx.beginPath();
      ctx.arc(c, c, R(f), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Number ring and pockets, turning with the wheel
    const fs = Math.round(S * 0.034);
    ctx.font = `500 ${fs}px "Martian Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < N; i++) {
      const n = WHEEL[i];
      const a0 = wheelAngle + i * STEP;
      const a1 = a0 + STEP;
      const col = k[colourOf(n)];
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(c, c, R(0.4), a0, a1);
      ctx.arc(c, c, R(0.325), a1, a0, true);
      ctx.closePath();
      ctx.fill();
      // pocket (a little deeper)
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(c, c, R(0.325), a0, a1);
      ctx.arc(c, c, R(0.27), a1, a0, true);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgb(0 0 0 / 0.28)';
      ctx.fill();
      // number
      const am = a0 + STEP / 2;
      ctx.save();
      ctx.translate(c + Math.cos(am) * R(0.3625), c + Math.sin(am) * R(0.3625));
      ctx.rotate(am + Math.PI / 2);
      ctx.fillStyle = k.label;
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    }
    // Frets
    ctx.strokeStyle = k.label;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, S / 420);
    for (let i = 0; i < N; i++) {
      const a = wheelAngle + i * STEP;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * R(0.27), c + Math.sin(a) * R(0.27));
      ctx.lineTo(c + Math.cos(a) * R(0.4), c + Math.sin(a) * R(0.4));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (landed != null) {
      const a0 = wheelAngle + landed * STEP;
      ctx.strokeStyle = k.label;
      ctx.lineWidth = Math.max(2, S / 160);
      ctx.beginPath();
      ctx.arc(c, c, R(0.4) - ctx.lineWidth / 2, a0, a0 + STEP);
      ctx.arc(c, c, R(0.27) + ctx.lineWidth / 2, a0 + STEP, a0, true);
      ctx.closePath();
      ctx.stroke();
    }

    // The turret: a brilliant cut seen from above.
    drawBrilliant(c, R(0.265), wheelAngle);

    // Ball
    if (ball) {
      const bx = c + Math.cos(ball.angle) * R(ball.radius);
      const by = c + Math.sin(ball.angle) * R(ball.radius);
      const br = R(0.018);
      ctx.fillStyle = 'rgb(0 0 0 / 0.25)';
      ctx.beginPath();
      ctx.arc(bx + br * 0.25, by + br * 0.3, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = k.label;
      ctx.strokeStyle = k.jet;
      ctx.lineWidth = Math.max(1, S / 600);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgb(255 255 255 / 0.9)';
      ctx.beginPath();
      ctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBrilliant(c, r, rot) {
    const k = colours;
    const pt = (a, f) => [c + Math.cos(a + rot) * r * f, c + Math.sin(a + rot) * r * f];
    ctx.fillStyle = k.dark ? k.paper2 : k.paper;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = k.ink;
    ctx.lineWidth = Math.max(1, r / 90);
    ctx.stroke();
    const table = Array.from({ length: 8 }, (_, i) => pt((i * Math.PI) / 4 + Math.PI / 8, 0.5));
    const stars = Array.from({ length: 8 }, (_, i) => pt((i * Math.PI) / 4, 0.74));
    const girdle = Array.from({ length: 16 }, (_, i) => pt((i * Math.PI) / 8 + Math.PI / 16, 1));
    ctx.beginPath();
    table.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.closePath();
    for (let i = 0; i < 8; i++) {
      const a = table[i];
      const b = table[(i + 1) % 8];
      const s = stars[(i + 1) % 8];
      ctx.moveTo(...a);
      ctx.lineTo(...s);
      ctx.lineTo(...b);
      ctx.moveTo(...s);
      ctx.lineTo(...girdle[(2 * i + 1) % 16]);
      ctx.moveTo(...s);
      ctx.lineTo(...girdle[(2 * i + 2) % 16]);
      ctx.moveTo(...a);
      ctx.lineTo(...girdle[(2 * i) % 16]);
    }
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function resize() {
    if (fitCanvas(canvas, 1)) draw();
  }
  new ResizeObserver(resize).observe(canvas);
  const recolour = () => {
    colours = null;
    requestAnimationFrame(draw);
  };
  settings.on(({ key }) => key === 'theme' && recolour());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolour);
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
    undoBtn.disabled = ui.busy || !placed.length;
    clearBtn.disabled = ui.busy || !placed.length;
    rebetBtn.disabled = ui.busy || !lastBets || placed.length > 0;
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
    const last = placed.at(-1);
    if (last) lift(last.id);
  });
  clearBtn.addEventListener('click', () => {
    bets = {};
    placed = [];
    renderBets();
    ui.say('Table cleared.');
  });
  rebetBtn.addEventListener('click', () => {
    if (!lastBets) return;
    const sum = lastBets.reduce((a, p) => a + p.amount, 0);
    if (!ui.allowed(sum)) return;
    clearWinners();
    landed = null;
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
            radius = 0.437 - (0.437 - 0.3) * (v * v * (3 - 2 * v)) + Math.sin(v * Math.PI * 5) * 0.012 * (1 - v);
            const rel = Math.floor((((angle - wheelAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / STEP);
            if (rel !== lastPocket) {
              lastPocket = rel;
              sound.tick();
            }
          }
          ball = { angle, radius };
        } else {
          const settleT = t - LAND;
          ball = { angle: pocketAngle(t), radius: 0.3 + Math.exp(-settleT * 9) * Math.sin(settleT * 30) * 0.006 };
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
      ball = { angle: -Math.PI / 2, radius: 0.3 };
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
