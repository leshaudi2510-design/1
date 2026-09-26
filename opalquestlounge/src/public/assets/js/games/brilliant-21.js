// Brilliant Twenty-One: blackjack against the dealer. The shoe is shuffled
// with crypto.getRandomValues (Fisher–Yates) and dealt in order.
import {
  freshShoe, score, isBrilliant, canSplit, dealerShouldDraw, basicStrategy, settleHand, cardValue, cardName,
  DECKS, CUT_AT, MOVE_NAMES,
} from './brilliant-21.math.js';
import { shuffle } from '../lib/rng.js';
import { wallet } from '../lib/wallet.js';
import { sound } from '../lib/sound.js';
import { buzz } from '../lib/haptics.js';
import { reducedMotion, spring } from '../lib/ui.js';
import { fmt, carats } from '../lib/format.js';
import { shell, shortcuts, fitCanvas, setOff, isOff } from './common.js';

const RATIO = 420 / 720;
const RESHUFFLE_AT = Math.round(DECKS * 52 * CUT_AT);
const RED = new Set(['hearts', 'diamonds']);
const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion() ? 0 : ms));

// Print colours (spec 3.1 and 7.20), the same by day and by night.
const INK = '#18122B';
const SHADOW = 'rgb(5 3 12 / 0.55)';
const GARNET = '#C8102E';
const RED_SUIT = '#FF4A3D';
const BLACK_SUIT = '#3DD6FF';
const VIOLET = '#5B2BD6';
const YELLOW = '#FFE11A';
const MAGENTA = '#FF2E93';
const CREAM = '#FFF5E1';

// ---------- suit shapes, drawn rather than typed ----------
function suitPath(ctx, suit, x, y, s) {
  ctx.beginPath();
  if (suit === 'hearts') {
    ctx.moveTo(x, y + s * 0.42);
    ctx.bezierCurveTo(x - s * 0.62, y - s * 0.02, x - s * 0.42, y - s * 0.5, x, y - s * 0.2);
    ctx.bezierCurveTo(x + s * 0.42, y - s * 0.5, x + s * 0.62, y - s * 0.02, x, y + s * 0.42);
  } else if (suit === 'diamonds') {
    ctx.moveTo(x, y - s * 0.5);
    ctx.lineTo(x + s * 0.36, y);
    ctx.lineTo(x, y + s * 0.5);
    ctx.lineTo(x - s * 0.36, y);
  } else if (suit === 'spades') {
    ctx.moveTo(x, y - s * 0.48);
    ctx.bezierCurveTo(x + s * 0.62, y + s * 0.02, x + s * 0.4, y + s * 0.42, x, y + s * 0.16);
    ctx.bezierCurveTo(x - s * 0.4, y + s * 0.42, x - s * 0.62, y + s * 0.02, x, y - s * 0.48);
    ctx.moveTo(x, y + s * 0.1);
    ctx.lineTo(x + s * 0.14, y + s * 0.48);
    ctx.lineTo(x - s * 0.14, y + s * 0.48);
  } else {
    const r = s * 0.2;
    ctx.arc(x, y - s * 0.22, r, 0, Math.PI * 2);
    ctx.moveTo(x - s * 0.2 + r, y + s * 0.06);
    ctx.arc(x - s * 0.2, y + s * 0.06, r, 0, Math.PI * 2);
    ctx.moveTo(x + s * 0.2 + r, y + s * 0.06);
    ctx.arc(x + s * 0.2, y + s * 0.06, r, 0, Math.PI * 2);
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 0.13, y + s * 0.48);
    ctx.lineTo(x - s * 0.13, y + s * 0.48);
  }
  ctx.closePath();
}

export function mount(root) {
  const canvas = root.querySelector('.twentyone__canvas');
  const ctx = canvas.getContext('2d');
  const dealBtn = root.querySelector('[data-action="deal"]');
  const btn = Object.fromEntries(['hit', 'stand', 'double', 'split'].map((a) => [a, root.querySelector(`[data-action="${a}"]`)]));
  const hintToggle = root.querySelector('[data-hint]');
  const hintText = root.querySelector('[data-hint-text]');
  const shoeEl = root.querySelector('[data-shoe]');
  const dealerTotalEl = root.querySelector('[data-dealer-total]');
  const playerTotalEl = root.querySelector('[data-player-total]');
  const radios = [...root.querySelectorAll('.stake input')];
  const ui = shell(root, { playSelector: '[data-action="deal"]' });

  let shoe = shuffle(freshShoe());
  let round = null;
  let sprites = []; // cards on the table, with positions for animation

  // ---------- layout ----------
  // Wide tables are 720 × 420. Narrow ones (phones) are nearly square, so
  // the dealer's cards sit below the dealer's badge and the player's above
  // the player's badge, and the cards stay big enough to read.
  const ratioFor = (cssWidth) => (cssWidth < 520 ? 0.86 : RATIO);
  function geometry() {
    const W = canvas.width;
    const H = canvas.height;
    const tall = H / W > 0.8;
    const ch = H * (tall ? 0.25 : 0.32);
    const cw = ch * 0.7;
    return { W, H, cw, ch, tall, dealerY: H * (tall ? 0.185 : 0.1), playerY: H * 0.54, shoe: [W - cw * 0.92, H * 0.05] };
  }
  /** Cards in a row step right from `start`, closing up if they would run past `end`. */
  const step = (pref, start, end, cw, count) => (count > 1 ? Math.max(cw * 0.18, Math.min(pref, (end - start - cw) / (count - 1))) : pref);
  function slotFor(who, handIndex, cardIndex, handCount, cardCount) {
    const g = geometry();
    if (who === 'dealer') {
      // On a narrow table the dealer's cards start right of centre, clear of the dealer's badge.
      const start = g.W * 0.5 - g.cw * (g.tall ? 0.45 : 0.9);
      return [start + cardIndex * step(g.cw * 0.72, start, g.W - g.cw * 1.02, g.cw, cardCount), g.dealerY];
    }
    const width = g.W / handCount;
    const start = width * handIndex + width / 2 - g.cw * (handCount > 1 ? 0.8 : 1.1);
    const end = handCount > 1 ? width * (handIndex + 1) - g.W * 0.02 : g.W * 0.97;
    const pref = handCount > 1 ? g.cw * 0.38 : g.cw * 0.78;
    return [start + cardIndex * step(pref, start, end, g.cw, cardCount), g.playerY - cardIndex * g.H * 0.012];
  }
  // A slight, fixed tilt per card, as if dealt by hand.
  const TILT = [-4, 3, -2, 4, -3, 2].map((d) => (d * Math.PI) / 180);

  function layoutSprites(instant = false) {
    if (!round) return;
    const hc = round.hands.length;
    const all = [];
    round.dealer.forEach((card, i) =>
      all.push({ card, to: slotFor('dealer', 0, i, 1, round.dealer.length), faceUp: i === 0 || round.revealed, tilt: TILT[(i + 3) % 6] }),
    );
    round.hands.forEach((h, hi) =>
      h.cards.forEach((card, i) => all.push({ card, to: slotFor('player', hi, i, hc, h.cards.length), faceUp: true, hand: hi, tilt: TILT[i % 6] })),
    );
    const now = performance.now();
    for (const s of all) {
      let sp = sprites.find((x) => x.card === s.card);
      if (!sp) {
        const g = geometry();
        sp = { card: s.card, x: g.shoe[0], y: g.shoe[1], from: g.shoe.slice(), to: s.to, t0: now, flip: 0 };
        sprites.push(sp);
      } else if (sp.to[0] !== s.to[0] || sp.to[1] !== s.to[1]) {
        sp.from = [sp.x, sp.y];
        sp.to = s.to;
        sp.t0 = now;
      }
      if (sp.faceUp !== s.faceUp) {
        sp.flipFrom = sp.faceUp == null ? (s.faceUp ? 1 : 0) : sp.faceUp ? 1 : 0;
        sp.flipT0 = now;
        sp.faceUp = s.faceUp;
      }
      sp.hand = s.hand;
      sp.tilt = s.tilt;
      if (instant || reducedMotion()) {
        sp.x = s.to[0];
        sp.y = s.to[1];
        sp.from = s.to.slice();
        sp.flipT0 = 0;
      }
    }
    sprites = sprites.filter((sp) => all.some((a) => a.card === sp.card));
    loop();
  }

  let raf = 0;
  function loop() {
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0;
    let moving = false;
    for (const sp of sprites) {
      const t = (now - sp.t0) / 1000;
      const k = Math.min(1, spring(t, { stiffness: 210, damping: 22 }));
      if (t < 0.7) moving = true;
      sp.x = sp.from[0] + (sp.to[0] - sp.from[0]) * (t >= 0.7 ? 1 : k);
      sp.y = sp.from[1] + (sp.to[1] - sp.from[1]) * (t >= 0.7 ? 1 : k);
      if (sp.flipT0) {
        const ft = (now - sp.flipT0) / 280;
        if (ft < 1) moving = true;
        else sp.flipT0 = 0;
      }
    }
    draw(now);
    if (moving) loop();
  }

  // ---------- drawing ----------
  // Cards are artwork in the site's print style and look the same in both
  // themes: white cards with a thick ink edge and a hard shadow on the blue
  // felt (the felt itself is CSS). Red suits print in red, black suits in
  // cyan, both outlined in ink. The face-down card is violet with a dashed
  // yellow inset and a magenta gem.
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  }

  function cardShape(x, y, w, h, fill) {
    const r = w * 0.11;
    roundRect(x + w * 0.06, y + w * 0.06, w, h, r);
    ctx.fillStyle = SHADOW;
    ctx.fill();
    roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, w * 0.05);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function suit(card, x, y, s) {
    suitPath(ctx, card.suit, x, y, s);
    ctx.fillStyle = RED.has(card.suit) ? RED_SUIT : BLACK_SUIT;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s * 0.09);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawCardFace(card, x, y, w, h) {
    cardShape(x, y, w, h, '#FFFFFF');
    // Corner: the rank in heavy type, and a small suit under it. Court
    // cards carry a letter, never a portrait.
    ctx.fillStyle = RED.has(card.suit) ? GARNET : INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const rs = w * (card.rank === '10' ? 0.3 : 0.36);
    ctx.font = `900 ${rs}px Archivo, "Arial Black", Arial, sans-serif`;
    ctx.fillText(card.rank, x + w * 0.12, y + w * 0.43);
    suit(card, x + w * 0.24, y + w * 0.62, w * 0.2);
    // Centre: one big suit.
    suit(card, x + w * 0.56, y + h * 0.64, w * (card.rank === 'A' ? 0.52 : 0.42));
  }

  function drawCardBack(x, y, w, h, shadow = true) {
    if (shadow) cardShape(x, y, w, h, VIOLET);
    else {
      roundRect(x, y, w, h, w * 0.11);
      ctx.fillStyle = VIOLET;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, w * 0.05);
      ctx.stroke();
    }
    const i = w * 0.1;
    roundRect(x + i, y + i, w - i * 2, h - i * 2, w * 0.06);
    ctx.setLineDash([w * 0.07, w * 0.055]);
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = Math.max(1, w * 0.032);
    ctx.stroke();
    ctx.setLineDash([]);
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.16);
    ctx.lineTo(cx + w * 0.15, cy);
    ctx.lineTo(cx, cy + h * 0.16);
    ctx.lineTo(cx - w * 0.15, cy);
    ctx.closePath();
    ctx.fillStyle = MAGENTA;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, w * 0.032);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function draw(now = performance.now()) {
    const g = geometry();
    ctx.clearRect(0, 0, g.W, g.H);
    // The table's rule and its two lines of small print.
    const line = g.H * 0.5;
    ctx.strokeStyle = CREAM;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1.5, g.W / 360);
    ctx.setLineDash([g.W / 90, g.W / 120]);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.05, line);
    ctx.lineTo(g.W * 0.95, line);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = CREAM;
    const dpr = g.W / Math.max(1, canvas.getBoundingClientRect().width);
    ctx.font = `800 ${Math.round(Math.max(10.5 * dpr, g.W / (g.tall ? 30 : 58)))}px Archivo, "Arial Narrow", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(g.tall ? 'STANDS ON 17 · BRILLIANT PAYS 3 TO 2' : 'DEALER STANDS ON EVERY 17 · A BRILLIANT PAYS 3 TO 2', g.W / 2, line - g.H * 0.022);
    ctx.globalAlpha = 1;
    // The shoe: a short stack of backs in the corner.
    const sw = g.cw * 0.8;
    const sh = g.ch * 0.8;
    drawCardBack(g.shoe[0] + sw * 0.08, g.shoe[1] + sw * 0.08, sw, sh, false);
    drawCardBack(g.shoe[0], g.shoe[1], sw, sh, false);

    for (const sp of sprites) {
      let scaleX = 1;
      let showFace = sp.faceUp;
      if (sp.flipT0) {
        const ft = Math.min(1, (now - sp.flipT0) / 280);
        scaleX = Math.abs(Math.cos(ft * Math.PI));
        showFace = ft < 0.5 ? !sp.faceUp : sp.faceUp;
      }
      ctx.save();
      ctx.translate(sp.x + g.cw / 2, sp.y + g.ch / 2);
      ctx.rotate(sp.tilt || 0);
      ctx.scale(scaleX || 0.001, 1);
      if (showFace) drawCardFace(sp.card, -g.cw / 2, -g.ch / 2, g.cw, g.ch);
      else drawCardBack(-g.cw / 2, -g.ch / 2, g.cw, g.ch);
      ctx.restore();
    }
    // Mark the hand in play when split: a yellow bar edged in ink.
    if (round && round.hands.length > 1 && round.phase === 'player') {
      const [x, y] = slotFor('player', round.active, 0, round.hands.length, 1);
      const by = y + g.ch + g.H * 0.045;
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(5, g.W / 110);
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(x + g.cw * 1.4, by);
      ctx.stroke();
      ctx.strokeStyle = YELLOW;
      ctx.lineWidth = Math.max(2.5, g.W / 220);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  function resize() {
    if (fitCanvas(canvas, ratioFor(canvas.getBoundingClientRect().width))) {
      layoutSprites(true);
      draw();
    }
  }
  new ResizeObserver(resize).observe(canvas);
  document.fonts?.ready.then(() => draw());

  // ---------- words ----------
  const handText = (cards) => {
    const s = score(cards);
    return `${s.soft && s.total <= 21 ? 'soft ' : ''}${s.total}`;
  };
  function updateTotals() {
    if (!round) {
      dealerTotalEl.textContent = '–';
      playerTotalEl.textContent = '–';
      return;
    }
    if (!round.dealer.length) {
      dealerTotalEl.textContent = '–';
      playerTotalEl.textContent = round.hands[0].cards.length ? handText(round.hands[0].cards) : '–';
      return;
    }
    dealerTotalEl.textContent = round.revealed ? handText(round.dealer) : `${cardValue(round.dealer[0])} showing`;
    playerTotalEl.textContent = round.hands
      .map((h, i) => (round.hands.length > 1 && i === round.active && round.phase === 'player' ? `▸ ${handText(h.cards)}` : handText(h.cards)))
      .join(' · ');
    shoeEl.textContent = fmt(shoe.length);
    const dealerDesc = round.revealed ? round.dealer.map(cardName).join(', ') : `${cardName(round.dealer[0])} and a face-down card`;
    const handsDesc = round.hands.map((h, i) => `${round.hands.length > 1 ? `Hand ${i + 1}` : 'You'}: ${h.cards.map(cardName).join(', ')} (${handText(h.cards)})`).join('. ');
    canvas.setAttribute('aria-label', `Dealer: ${dealerDesc}. ${handsDesc}.`);
  }

  function updateButtons() {
    const inPlay = round && round.phase === 'player';
    const hand = inPlay ? round.hands[round.active] : null;
    Object.values(btn).forEach((b) => (b.disabled = false));
    setOff(btn.hit, !inPlay);
    setOff(btn.stand, !inPlay);
    setOff(btn.double, !inPlay || hand.cards.length !== 2 || !wallet.canStake(hand.stake));
    setOff(btn.split, !inPlay || !canSplit(hand, round.hands.length) || !wallet.canStake(hand.stake));
    ui.busy = Boolean(round && round.phase !== 'over');
    if (hintToggle.checked && inPlay) {
      const move = basicStrategy(hand.cards, round.dealer[0], {
        canDouble: !isOff(btn.double),
        canSplitNow: !isOff(btn.split),
      });
      hintText.hidden = false;
      hintText.textContent = `Basic strategy says: ${MOVE_NAMES[move]}.`;
    } else {
      hintText.hidden = true;
    }
  }

  function draw1(target) {
    const card = shoe.pop();
    target.push(card);
    sound.card();
    buzz(6);
    return card;
  }

  // ---------- the round ----------
  async function deal() {
    if (ui.busy && round && round.phase !== 'over') return;
    const stake = ui.stake();
    if (!ui.allowed(stake)) return;
    let shuffled = false;
    if (shoe.length < RESHUFFLE_AT) {
      shoe = shuffle(freshShoe());
      shuffled = true;
    }
    wallet.stake(stake);
    sprites = [];
    round = { dealer: [], hands: [{ cards: [], stake, split: false, done: false }], active: 0, phase: 'dealing', revealed: false, staked: stake };
    ui.busy = true;
    updateButtons();
    ui.say(shuffled ? 'The shoe has been reshuffled. Dealing…' : 'Dealing…');
    const p = round.hands[0].cards;
    for (const target of [p, round.dealer, p, round.dealer]) {
      draw1(target);
      layoutSprites();
      updateTotals();
      await wait(230);
    }
    const up = round.dealer[0];
    const upTen = cardValue(up) >= 10;
    let peekNote = '';
    if (upTen) {
      peekNote = ' The dealer checks for a Brilliant.';
      if (isBrilliant(round.dealer)) return finish(`The dealer has a Brilliant.`);
      peekNote += ' No Brilliant.';
    }
    if (isBrilliant(p)) return finish('You have a Brilliant.');
    round.phase = 'player';
    updateTotals();
    updateButtons();
    ui.say(`You have ${cardName(p[0])} and ${cardName(p[1])}: ${handText(p)}. The dealer shows ${cardName(up)}.${peekNote}`);
    btn.hit.focus({ preventScroll: true });
  }

  function current() {
    return round.hands[round.active];
  }

  async function next() {
    const h = current();
    h.done = true;
    if (round.active < round.hands.length - 1) {
      round.active += 1;
      const n = current();
      if (n.cards.length < 2) {
        draw1(n.cards);
        layoutSprites();
        await wait(230);
      }
      updateTotals();
      updateButtons();
      if (n.aces || score(n.cards).total === 21) return next();
      ui.say(`Hand ${round.active + 1}: ${n.cards.map(cardName).join(' and ')}, ${handText(n.cards)}.`);
      return;
    }
    return dealerTurn();
  }

  async function hit() {
    if (!round || round.phase !== 'player') return;
    const h = current();
    const card = draw1(h.cards);
    layoutSprites();
    updateTotals();
    const t = score(h.cards).total;
    if (t > 21) {
      ui.say(`${cardName(card)}. That’s ${t}: over 21.`);
      await wait(350);
      return next();
    }
    if (t === 21) {
      ui.say(`${cardName(card)}. That’s 21.`);
      await wait(250);
      return next();
    }
    updateButtons();
    ui.say(`${cardName(card)}. You have ${handText(h.cards)}.`);
  }

  async function stand() {
    if (!round || round.phase !== 'player') return;
    return next();
  }

  async function double() {
    if (!round || round.phase !== 'player' || isOff(btn.double)) return;
    const h = current();
    if (!ui.allowed(h.stake)) return;
    wallet.stake(h.stake);
    round.staked += h.stake;
    h.stake *= 2;
    const card = draw1(h.cards);
    layoutSprites();
    updateTotals();
    ui.say(`Doubled to ${carats(h.stake)}. ${cardName(card)}: ${handText(h.cards)}.`);
    await wait(350);
    return next();
  }

  async function split() {
    if (!round || round.phase !== 'player' || isOff(btn.split)) return;
    const h = current();
    if (!ui.allowed(h.stake)) return;
    wallet.stake(h.stake);
    round.staked += h.stake;
    const moved = h.cards.pop();
    const aces = moved.rank === 'A';
    h.split = true;
    h.aces = aces;
    round.hands.push({ cards: [moved], stake: h.stake, split: true, done: false, aces });
    draw1(h.cards);
    layoutSprites();
    updateTotals();
    await wait(230);
    if (aces) {
      ui.say('Split Aces take one card each.');
      return next();
    }
    updateButtons();
    ui.say(`Split into two hands. Hand 1: ${h.cards.map(cardName).join(' and ')}, ${handText(h.cards)}.`);
    if (score(h.cards).total === 21) return next();
  }

  async function dealerTurn() {
    round.phase = 'dealer';
    updateButtons();
    round.revealed = true;
    layoutSprites();
    updateTotals();
    ui.say(`The dealer turns over ${cardName(round.dealer[1])}: ${handText(round.dealer)}.`);
    await wait(500);
    const live = round.hands.some((h) => score(h.cards).total <= 21);
    while (live && dealerShouldDraw(round.dealer)) {
      draw1(round.dealer);
      layoutSprites();
      updateTotals();
      await wait(480);
    }
    const d = score(round.dealer).total;
    return finish(d > 21 ? `The dealer has ${d} and is bust.` : `The dealer has ${d}.`);
  }

  function finish(opening) {
    round.revealed = true;
    round.phase = 'over';
    layoutSprites();
    let returned = 0;
    const parts = [];
    round.hands.forEach((h, i) => {
      const r = settleHand(h, round.dealer);
      returned += r.back;
      const who = round.hands.length > 1 ? `Hand ${i + 1} (${handText(h.cards)})` : `Your ${handText(h.cards)}`;
      parts.push(
        {
          brilliant: 'Your Brilliant pays 3 to 2.',
          win: `${who} beats the dealer.`,
          push: `${who} is a push.`,
          lose: `${who} loses.`,
          bust: `${who} is bust.`,
        }[r.outcome],
      );
    });
    wallet.credit(returned);
    updateTotals();
    const staked = round.staked;
    ui.busy = false;
    updateButtons();
    ui.settled({ staked, returned, detail: `${opening} ${parts.join(' ')}` });
    ui.celebrate(staked, returned);
    if (returned === staked && returned > 0) sound.soft();
    dealBtn.focus({ preventScroll: true });
  }

  // A hand left unfinished is cancelled and its stakes returned.
  addEventListener('pagehide', () => {
    if (round && round.phase !== 'over') {
      wallet.refund(round.staked);
      round = null;
    }
  });

  dealBtn.addEventListener('click', deal);
  btn.hit.addEventListener('click', hit);
  btn.stand.addEventListener('click', stand);
  btn.double.addEventListener('click', double);
  btn.split.addEventListener('click', split);
  hintToggle.addEventListener('change', updateButtons);
  shortcuts(root, { d: deal, h: hit, s: stand, x: double, p: split }, radios);
  wallet.on(() => round?.phase === 'player' && updateButtons());

  shoeEl.textContent = fmt(shoe.length);
  updateButtons();
  resize();
  draw();
}
