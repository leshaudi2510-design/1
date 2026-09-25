/* Pixel Crown Club: Crown Reels, a three-reel slot with a powers-of-two paytable. */
(function () {
  'use strict';

  // Weights out of 27 per reel; three of a kind pays the multiplier.
  // Two Crowns anywhere pay 4x, one Crown pays 2x. Long-run return is about 94.5%.
  const SYMBOLS = [
    { id: 'crown', name: 'Crown', w: 2, pay: 128 },
    { id: 'seven', name: 'Seven', w: 3, pay: 64 },
    { id: 'gem', name: 'Gem', w: 4, pay: 32 },
    { id: 'heart', name: 'Heart', w: 5, pay: 16 },
    { id: 'coin', name: 'Coin', w: 6, pay: 8 },
    { id: 'bell', name: 'Bell', w: 7, pay: 4 },
  ];
  const TOTAL = SYMBOLS.reduce((a, s) => a + s.w, 0);
  const art = Object.fromEntries(SYMBOLS.map((s) => [s.id, Lounge.sprite(Lounge.SPRITES[s.id])]));

  function pick() {
    let r = Lounge.rint(TOTAL);
    for (const s of SYMBOLS) {
      if (r < s.w) return s;
      r -= s.w;
    }
    return SYMBOLS[SYMBOLS.length - 1];
  }

  // ---------- Paytable ----------
  const icon = (id, label) => `<span class="pt-sym" style="background-image:url(${art[id]})" role="img" aria-label="${label}"></span>`;
  const rows = SYMBOLS.map((s) =>
    `<tr><th scope="row"><span class="pt-row">${icon(s.id, `Three ${s.name}s`)}${icon(s.id, '')}${icon(s.id, '')}</span></th><td>${s.pay}×</td></tr>`);
  rows.push(`<tr><th scope="row"><span class="pt-row">Any two ${icon('crown', 'Crowns')}</span></th><td>4×</td></tr>`);
  rows.push(`<tr><th scope="row"><span class="pt-row">Any one ${icon('crown', 'Crown')}</span></th><td>2×</td></tr>`);
  document.getElementById('paytable').innerHTML = rows.join('');
  document.querySelectorAll('#paytable .pt-sym[aria-label=""]').forEach((el) => {
    el.removeAttribute('role');
    el.removeAttribute('aria-label');
    el.setAttribute('aria-hidden', 'true');
  });

  // ---------- Reels ----------
  const reelsEl = document.getElementById('reels');
  const strips = [...reelsEl.querySelectorAll('.reel__strip')];
  const msg = document.getElementById('reels-msg');
  const spinBtn = document.getElementById('reels-spin');

  const stake = Lounge.chips(document.getElementById('reels-chips'), [16, 32, 64, 128, 256], 32, label);
  function label() { spinBtn.textContent = `Spin for ${Wallet.fmt(stake.get())} Crowns`; }

  let showing = strips.map(() => [pick(), pick(), pick()]);

  function cell(s) {
    const d = document.createElement('div');
    d.className = 'sym';
    d.style.backgroundImage = `url(${art[s.id]})`;
    return d;
  }
  function paint(strip, list) {
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    strip.replaceChildren(...list.map(cell));
  }
  function describe() {
    reelsEl.setAttribute('aria-label', 'Reels showing ' + showing.map((v) => v[1].name).join(', '));
  }
  showing.forEach((v, i) => paint(strips[i], v));
  describe();

  function evaluate(line, bet) {
    const [a, b, c] = line;
    if (a === b && b === c) return { win: bet * a.pay, text: `Three ${a.name}s` };
    const crowns = line.filter((s) => s.id === 'crown').length;
    if (crowns === 2) return { win: bet * 4, text: 'Two Crowns' };
    if (crowns === 1) return { win: bet * 2, text: 'One Crown' };
    return { win: 0 };
  }

  const MISSES = ['No line this spin.', 'Close, but no crown.', 'The reels keep their secrets.', 'Nothing on the line.'];
  let spinning = false;

  function spinReel(strip, i, result) {
    return new Promise((resolve) => {
      const reduce = Lounge.reduceMotion();
      const extra = reduce ? 4 : 18 + i * 7;
      const list = [...showing[i]];
      for (let k = 0; k < extra; k++) list.push(pick());
      const above = pick(), below = pick();
      list.push(above, result, below);
      paint(strip, list);

      const h = strip.firstElementChild.getBoundingClientRect().height;
      void strip.offsetHeight;
      const dur = reduce ? 200 : 1100 + i * 420;
      strip.style.transition = `transform ${dur}ms cubic-bezier(.12,.72,.18,1.03)`;
      strip.style.transform = `translateY(${-(list.length - 3) * h}px)`;

      setTimeout(() => {
        showing[i] = [above, result, below];
        paint(strip, showing[i]);
        resolve();
      }, dur + 40);
    });
  }

  spinBtn.addEventListener('click', async () => {
    if (spinning) return;
    const bet = stake.get();
    if (!Wallet.take(bet)) {
      msg.classList.remove('is-win');
      msg.textContent = 'Not enough Crowns for that stake. Pick a smaller chip or claim your allowance.';
      return;
    }
    spinning = true;
    spinBtn.disabled = true;
    stake.disable(true);
    reelsEl.classList.remove('is-win');
    msg.classList.remove('is-win');
    msg.textContent = 'Spinning…';

    const line = [pick(), pick(), pick()];
    await Promise.all(strips.map((s, i) => spinReel(s, i, line[i])));
    describe();

    const { win, text } = evaluate(line, bet);
    if (win) {
      Wallet.give(win);
      reelsEl.classList.add('is-win');
      msg.classList.add('is-win');
      msg.textContent = `${text}. You win ${Wallet.fmt(win)} Crowns.`;
    } else {
      msg.textContent = MISSES[Lounge.rint(MISSES.length)];
    }

    spinning = false;
    spinBtn.disabled = false;
    stake.disable(false);
  });
})();
