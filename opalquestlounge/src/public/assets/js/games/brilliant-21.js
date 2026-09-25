// Brilliant Twenty-One: blackjack against the dealer. The shoe is shuffled
// with crypto.getRandomValues (Fisher–Yates) and dealt in order.
import {
  freshShoe, score, isBrilliant, canSplit, dealerShouldDraw, basicStrategy, settleHand, cardValue, cardName,
  DECKS, CUT_AT, MOVE_NAMES,
} from './brilliant-21.math.js';
import { shuffle } from '../lib/rng.js';
import { wallet } from '../lib/wallet.js';
import { settings } from '../lib/settings.js';
import { sound } from '../lib/sound.js';
import { buzz } from '../lib/haptics.js';
import { reducedMotion, cssColours, spring } from '../lib/ui.js';
import { fmt, carats } from '../lib/format.js';
import { shell, shortcuts, fitCanvas, setOff, isOff } from './common.js';

const RATIO = 420 / 720;
const RESHUFFLE_AT = Math.round(DECKS * 52 * CUT_AT);
const RED = new Set(['hearts', 'diamonds']);
const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion() ? 0 : ms));

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
  let colours = null;

  function readColours() {
    colours = { ...cssColours(['--ink', '--paper', '--paper-2', '--rule', '--garnet', '--jet', '--label'], root), dark: settings.isDark() };
  }

  // ---------- layout ----------
  function geometry() {
    const W = canvas.width;
    const H = canvas.height;
    const ch = H * 0.3;
    const cw = ch * 0.7;
    return { W, H, cw, ch, shoe: [W - cw * 0.9, H * 0.06] };
  }
  function slotFor(who, handIndex, cardIndex, handCount) {
    const g = geometry();
    const gap = g.cw * 0.32;
    if (who === 'dealer') return [g.W * 0.5 - g.cw * 0.9 + cardIndex * (g.cw * 0.62), g.H * 0.12];
    const width = g.W / handCount;
    const left = width * handIndex + width / 2 - g.cw * (handCount > 1 ? 0.8 : 1.1);
    return [left + cardIndex * (handCount > 1 ? gap * 1.2 : g.cw * 0.78), g.H * 0.56 - cardIndex * g.H * 0.012];
  }

  function layoutSprites(instant = false) {
    if (!round) return;
    const hc = round.hands.length;
    const all = [];
    round.dealer.forEach((card, i) => all.push({ card, to: slotFor('dealer', 0, i, 1), faceUp: i === 0 || round.revealed }));
    round.hands.forEach((h, hi) => h.cards.forEach((card, i) => all.push({ card, to: slotFor('player', hi, i, hc), faceUp: true, hand: hi })));
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
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  }

  function drawCardFace(card, x, y, w, h) {
    const k = colours;
    const r = w * 0.07;
    roundRect(x, y, w, h, r);
    ctx.fillStyle = k.label;
    ctx.fill();
    ctx.strokeStyle = k.jet;
    ctx.lineWidth = Math.max(1, w / 90);
    ctx.stroke();
    // double rule, like a specimen label
    const inset = w * 0.06;
    ctx.lineWidth = Math.max(0.75, w / 160);
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    ctx.globalAlpha = 1;
    const ink = RED.has(card.suit) ? k.garnet : k.jet;
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const court = ['J', 'Q', 'K'].includes(card.rank);
    // corners
    const cs = w * 0.2;
    ctx.font = `600 ${cs}px "Bodoni Moda", "Bodoni fallback", serif`;
    ctx.fillText(card.rank, x + inset + cs * 0.55, y + inset + cs * 1.05);
    suitPath(ctx, card.suit, x + inset + cs * 0.55, y + inset + cs * 1.6, cs * 0.62);
    ctx.fill();
    ctx.save();
    ctx.translate(x + w, y + h);
    ctx.rotate(Math.PI);
    ctx.fillText(card.rank, inset + cs * 0.55, inset + cs * 1.05);
    suitPath(ctx, card.suit, inset + cs * 0.55, inset + cs * 1.6, cs * 0.62);
    ctx.fill();
    ctx.restore();
    // centre: court cards carry a letter, not a portrait
    if (court || card.rank === 'A') {
      ctx.font = `${court ? 'italic 500' : '500'} ${w * 0.56}px "Bodoni Moda", "Bodoni fallback", serif`;
      ctx.fillText(card.rank, x + w / 2, y + h * 0.62);
      suitPath(ctx, card.suit, x + w / 2, y + h * 0.78, w * 0.16);
      ctx.fill();
    } else {
      suitPath(ctx, card.suit, x + w / 2, y + h / 2, w * 0.42);
      ctx.fill();
    }
  }

  function drawCardBack(x, y, w, h) {
    const k = colours;
    roundRect(x, y, w, h, w * 0.07);
    ctx.fillStyle = k.jet;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // a hexagonal crystal lattice
    ctx.strokeStyle = k.label;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = Math.max(0.75, w / 150);
    const s = w / 7;
    const hh = s * Math.sqrt(3);
    for (let row = -1; row < h / hh + 2; row++) {
      for (let col = -1; col < w / (s * 3) + 2; col++) {
        const cx = x + col * s * 3 + (row % 2 ? s * 1.5 : 0);
        const cy = y + row * hh * 0.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const px = cx + Math.cos(a) * s;
          const py = cy + Math.sin(a) * s;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = k.label;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = Math.max(1, w / 90);
    roundRect(x + w * 0.06, y + w * 0.06, w - w * 0.12, h - w * 0.12, w * 0.04);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function draw(now = performance.now()) {
    if (!colours) readColours();
    const g = geometry();
    const k = colours;
    ctx.clearRect(0, 0, g.W, g.H);
    // table rules: the dealer's line and the shoe
    ctx.strokeStyle = k.rule;
    ctx.lineWidth = Math.max(1, g.W / 700);
    ctx.setLineDash([g.W / 120, g.W / 160]);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.06, g.H * 0.5);
    ctx.lineTo(g.W * 0.94, g.H * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = k.ink;
    ctx.globalAlpha = 0.6;
    ctx.font = `500 ${Math.round(g.W / 64)}px "Martian Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('DEALER STANDS ON EVERY 17 · A BRILLIANT PAYS 3 TO 2', g.W / 2, g.H * 0.5 - g.H * 0.02);
    ctx.globalAlpha = 1;
    // the shoe
    drawCardBack(g.shoe[0], g.shoe[1], g.cw * 0.8, g.ch * 0.8);

    for (const sp of sprites) {
      let scaleX = 1;
      let showFace = sp.faceUp;
      if (sp.flipT0) {
        const ft = Math.min(1, (now - sp.flipT0) / 280);
        scaleX = Math.abs(Math.cos(ft * Math.PI));
        showFace = ft < 0.5 ? !sp.faceUp : sp.faceUp;
      }
      ctx.save();
      ctx.translate(sp.x + g.cw / 2, sp.y);
      ctx.scale(scaleX || 0.001, 1);
      if (showFace) drawCardFace(sp.card, -g.cw / 2, 0, g.cw, g.ch);
      else drawCardBack(-g.cw / 2, 0, g.cw, g.ch);
      ctx.restore();
    }
    // mark the active hand when split
    if (round && round.hands.length > 1 && round.phase === 'player') {
      const [x, y] = slotFor('player', round.active, 0, round.hands.length);
      ctx.strokeStyle = k.ink;
      ctx.lineWidth = Math.max(2, g.W / 300);
      ctx.beginPath();
      ctx.moveTo(x, y + g.ch + g.H * 0.04);
      ctx.lineTo(x + g.cw * 1.4, y + g.ch + g.H * 0.04);
      ctx.stroke();
    }
  }

  function resize() {
    if (fitCanvas(canvas, RATIO)) {
      layoutSprites(true);
      draw();
    }
  }
  new ResizeObserver(resize).observe(canvas);
  const recolour = () => {
    colours = null;
    requestAnimationFrame(() => draw());
  };
  settings.on(({ key }) => key === 'theme' && recolour());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolour);
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
          win: `${who} wins.`,
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
