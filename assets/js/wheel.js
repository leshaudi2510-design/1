/* Pixel Crown Club: Royal Wheel, European single-zero roulette with a full betting board. */
(function () {
  'use strict';

  // Pocket order on a real European wheel, clockwise from zero.
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
  const FILL = { red: '#C8384C', black: '#1A141F', green: '#2E9E72' };
  const TAU = Math.PI * 2;
  const SEG = TAU / ORDER.length;

  // ---------- Bets ----------
  // Each bet: label, what it pays (to 1), which numbers win, and its place on the
  // wide board (c, r) and on the narrow, vertical board (vc, vr).
  const DEFS = new Map();
  DEFS.set('n0', { label: '0', pays: 35, wins: (n) => n === 0, c: '1', r: '1 / span 3', vc: '1 / span 3', vr: '1', color: 'green' });
  for (let n = 1; n <= 36; n++) {
    DEFS.set('n' + n, {
      label: String(n), pays: 35, wins: (x) => x === n, color: colorOf(n),
      c: String(1 + Math.ceil(n / 3)), r: String(3 - ((n - 1) % 3)),
      vc: String(((n - 1) % 3) + 1), vr: String(1 + Math.ceil(n / 3)),
    });
  }
  [1, 2, 3].forEach((k) => {
    DEFS.set('col' + k, {
      label: '2 to 1', pays: 2, wins: (n) => n > 0 && n % 3 === k % 3,
      c: '14', r: String(4 - k), vc: String(k), vr: '14',
    });
  });
  const OUTSIDE = [
    ['d1', '1st 12', 2, (n) => n >= 1 && n <= 12, '2 / span 4', '1', '1', '1'],
    ['d2', '2nd 12', 2, (n) => n >= 13 && n <= 24, '6 / span 4', '1', '2', '1'],
    ['d3', '3rd 12', 2, (n) => n >= 25, '10 / span 4', '1', '3', '1'],
    ['low', '1–18', 1, (n) => n >= 1 && n <= 18, '2 / span 2', '2', '1', '2'],
    ['even', 'Even', 1, (n) => n > 0 && n % 2 === 0, '4 / span 2', '2', '2', '2'],
    ['red', 'Red', 1, (n) => RED.has(n), '6 / span 2', '2', '3', '2'],
    ['black', 'Black', 1, (n) => n > 0 && !RED.has(n), '8 / span 2', '2', '1', '3'],
    ['odd', 'Odd', 1, (n) => n % 2 === 1, '10 / span 2', '2', '2', '3'],
    ['high', '19–36', 1, (n) => n >= 19, '12 / span 2', '2', '3', '3'],
  ];
  OUTSIDE.forEach(([key, label, pays, wins, c, r, vc, vr]) => {
    DEFS.set(key, { label, pays, wins, c, r, vc, vr, outside: true, color: key === 'red' ? 'red' : key === 'black' ? 'black' : null });
  });

  const numbersEl = document.getElementById('board-numbers');
  const outsideEl = document.getElementById('board-outside');
  const cells = new Map();

  DEFS.forEach((d, key) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bet' + (d.color ? ` bet--${d.color}` : '') + (d.outside || key.startsWith('col') ? ' bet--outside' : '');
    b.style.setProperty('--c', d.c);
    b.style.setProperty('--r', d.r);
    b.style.setProperty('--vc', d.vc);
    b.style.setProperty('--vr', d.vr);
    b.textContent = d.label;
    const badge = document.createElement('span');
    badge.className = 'bet__stake';
    badge.hidden = true;
    b.appendChild(badge);
    b.addEventListener('click', () => place(key));
    (d.outside ? outsideEl : numbersEl).appendChild(b);
    cells.set(key, { el: b, badge, name: key.startsWith('col') ? `Column ${key.slice(3)}, pays 2 to 1` : d.label });
    b.setAttribute('aria-label', `Bet on ${cells.get(key).name}`);
  });

  const bets = new Map();
  const stakeOut = document.getElementById('wheel-stake');
  const msg = document.getElementById('wheel-msg');
  const spinBtn = document.getElementById('wheel-spin');
  const clearBtn = document.getElementById('wheel-clear');
  const historyEl = document.getElementById('wheel-history');
  const chip = Lounge.chips(document.getElementById('wheel-chips'), [16, 32, 64, 128, 256], 32);

  const total = () => [...bets.values()].reduce((a, b) => a + b, 0);
  const short = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));

  function renderBets() {
    cells.forEach(({ el, badge, name }, key) => {
      const v = bets.get(key) || 0;
      badge.hidden = !v;
      badge.textContent = short(v);
      el.setAttribute('aria-label', v ? `${name}: ${v} Crowns placed` : `Bet on ${name}`);
    });
    stakeOut.textContent = Wallet.fmt(total());
  }

  let spinning = false;
  function place(key) {
    if (spinning) return;
    const v = chip.get();
    if (total() + v > Wallet.get()) {
      msg.textContent = 'That chip would take you past your balance.';
      return;
    }
    bets.set(key, (bets.get(key) || 0) + v);
    cells.forEach(({ el }) => el.classList.remove('is-hit'));
    renderBets();
  }
  clearBtn.addEventListener('click', () => {
    if (spinning) return;
    bets.clear();
    renderBets();
    msg.textContent = 'Board cleared. Place your chips.';
  });

  // ---------- Wheel drawing ----------
  const canvas = document.getElementById('wheel');
  const ctx = canvas.getContext('2d');
  let S = 0;
  let rot = 0;
  let ball = null; // { angle, radius } while moving, or { pocket } once settled

  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    S = r.width;
    canvas.width = Math.round(S * dpr);
    canvas.height = Math.round(S * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    if (!S) return;
    const c = S / 2, R = S / 2 - 2;
    ctx.clearRect(0, 0, S, S);

    // Rim and ball track.
    ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fillStyle = '#2A1B10'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#B8862B'; ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, R * 0.93, 0, TAU); ctx.fillStyle = '#1C1522'; ctx.fill();

    const rOut = R * 0.88, rIn = R * 0.6, rNum = R * 0.8;
    ORDER.forEach((n, i) => {
      const mid = rot + i * SEG - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(c, c, rOut, mid - SEG / 2, mid + SEG / 2);
      ctx.arc(c, c, rIn, mid + SEG / 2, mid - SEG / 2, true);
      ctx.closePath();
      ctx.fillStyle = FILL[colorOf(n)];
      ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(242,193,78,0.55)'; ctx.stroke();

      ctx.save();
      ctx.translate(c + Math.cos(mid) * rNum, c + Math.sin(mid) * rNum);
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = '#F4EBDD';
      ctx.font = `${Math.max(8, Math.round(S * 0.034))}px Silkscreen, "Pixelify Sans", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    });

    // Cone and turret.
    const g = ctx.createRadialGradient(c, c - rIn * 0.3, rIn * 0.1, c, c, rIn);
    g.addColorStop(0, '#3A2C45'); g.addColorStop(1, '#1C1522');
    ctx.beginPath(); ctx.arc(c, c, rIn, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#B8862B'; ctx.stroke();
    ctx.save();
    ctx.translate(c, c); ctx.rotate(rot);
    ctx.fillStyle = '#F2C14E';
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-2, -rIn * 0.62, 4, rIn * 0.5);
      ctx.fillRect(-5, -rIn * 0.66, 10, 6);
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(c, c, rIn * 0.14, 0, TAU); ctx.fillStyle = '#FFE59A'; ctx.fill();

    // Ball.
    if (ball) {
      let a, rad;
      if (ball.pocket != null) { a = rot + ball.pocket * SEG - Math.PI / 2; rad = R * 0.68; }
      else { a = ball.angle; rad = R * ball.radius; }
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * rad, c + Math.sin(a) * rad, Math.max(4, S * 0.022), 0, TAU);
      ctx.fillStyle = '#FFF8E7'; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
    }
  }

  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeOutQuart = (p) => 1 - Math.pow(1 - p, 4);

  function animateTo(pocket) {
    return new Promise((resolve) => {
      const reduce = Lounge.reduceMotion();
      const dur = reduce ? 500 : 5200;
      const r0 = rot;
      const want = (((-pocket * SEG) % TAU) + TAU) % TAU;
      const have = ((r0 % TAU) + TAU) % TAU;
      const r1 = r0 + ((want - have + TAU) % TAU) + (reduce ? 0 : TAU * 4);
      // The ball runs the other way and ends at the top, where the pocket stops.
      const b0 = -Math.PI / 2 + Lounge.rint(360) * (TAU / 360);
      const b1 = -Math.PI / 2 - TAU * (reduce ? 1 : 7);
      const bStart = b0 > b1 ? b0 : b0 + TAU;
      const t0 = performance.now();

      function step(now) {
        const p = Math.min(1, (now - t0) / dur);
        rot = r0 + (r1 - r0) * easeOut(p);
        const drop = p < 0.72 ? 0 : easeOut((p - 0.72) / 0.28);
        ball = { angle: bStart + (b1 - bStart) * easeOutQuart(p), radius: 0.965 - drop * (0.965 - 0.68) };
        draw();
        if (p < 1) requestAnimationFrame(step);
        else { ball = { pocket }; draw(); resolve(); }
      }
      requestAnimationFrame(step);
    });
  }

  function addHistory(n) {
    historyEl.querySelector('.history__empty')?.remove();
    const s = document.createElement('span');
    s.className = `ball ball--${colorOf(n)}`;
    s.textContent = n;
    historyEl.prepend(s);
    while (historyEl.children.length > 8) historyEl.lastElementChild.remove();
  }

  spinBtn.addEventListener('click', async () => {
    if (spinning) return;
    const stake = total();
    if (!stake) { msg.textContent = 'Place at least one chip on the board first.'; return; }
    if (!Wallet.take(stake)) { msg.textContent = 'Not enough Crowns to cover the board. Remove some chips.'; return; }

    spinning = true;
    spinBtn.disabled = true;
    clearBtn.disabled = true;
    chip.disable(true);
    cells.forEach(({ el }) => el.classList.remove('is-hit'));
    msg.classList.remove('is-win');
    msg.textContent = 'No more bets…';

    const pocket = Lounge.rint(ORDER.length);
    const n = ORDER[pocket];
    await animateTo(pocket);

    let win = 0;
    bets.forEach((amount, key) => {
      if (DEFS.get(key).wins(n)) win += amount * (DEFS.get(key).pays + 1);
    });
    DEFS.forEach((d, key) => { if (d.wins(n)) cells.get(key).el.classList.add('is-hit'); });
    addHistory(n);

    const name = `${n} ${colorOf(n)}`;
    if (win) {
      Wallet.give(win);
      msg.classList.add('is-win');
      msg.textContent = `${name}. You win ${Wallet.fmt(win)} Crowns.`;
    } else {
      msg.textContent = `${name}. No win this spin.`;
    }

    // Bets stay on the board; trim them if the purse can no longer cover them.
    if (total() > Wallet.get()) {
      bets.clear();
      msg.textContent += ' Board cleared, it was more than your balance.';
    }
    renderBets();
    spinning = false;
    spinBtn.disabled = false;
    clearBtn.disabled = false;
    chip.disable(false);
  });

  // Example layout so the board reads at a glance: a chip on red and on 17.
  bets.set('red', 32);
  bets.set('n17', 16);
  renderBets();

  document.addEventListener('table:show', (e) => { if (e.detail === 'wheel') size(); });
  window.addEventListener('resize', size);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
  size();
})();
