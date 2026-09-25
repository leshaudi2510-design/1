/* Pixel Crown Club: Club 21, six-deck blackjack. Dealer stands on all 17s, blackjack pays 3 to 2. */
(function () {
  'use strict';

  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RANK_NAMES = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
  const SUITS = [
    { id: 'spade', name: 'spades', red: false },
    { id: 'heart', name: 'hearts', red: true },
    { id: 'diamond', name: 'diamonds', red: true },
    { id: 'club', name: 'clubs', red: false },
  ];
  const art = {};
  SUITS.forEach((s) => {
    art[s.id] = Lounge.sprite(Lounge.SUITS[s.id], { X: s.red ? '#A32A3E' : '#130E17' }, 6);
  });

  // ---------- Shoe ----------
  let shoe = [];
  function shuffleShoe() {
    shoe = [];
    for (let d = 0; d < 6; d++) for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s });
    for (let i = shoe.length - 1; i > 0; i--) {
      const j = Lounge.rint(i + 1);
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
  }
  function drawCard() {
    if (shoe.length < 52) {
      shuffleShoe();
      Lounge.toast('Fresh shoe: six decks shuffled.');
    }
    return shoe.pop();
  }
  shuffleShoe();

  function score(hand) {
    let total = 0, aces = 0;
    for (const c of hand) {
      if (c.r === 'A') { total += 11; aces++; }
      else if (c.r === 'J' || c.r === 'Q' || c.r === 'K') total += 10;
      else total += Number(c.r);
    }
    while (total > 21 && aces) { total -= 10; aces--; }
    return { total, soft: aces > 0 };
  }
  const isBlackjack = (hand) => hand.length === 2 && score(hand).total === 21;

  // ---------- Elements ----------
  const dealerCards = document.getElementById('dealer-cards');
  const playerCards = document.getElementById('player-cards');
  const dealerTotal = document.getElementById('dealer-total');
  const playerTotal = document.getElementById('player-total');
  const msg = document.getElementById('bj-msg');
  const dealBtn = document.getElementById('bj-deal');
  const hitBtn = document.getElementById('bj-hit');
  const standBtn = document.getElementById('bj-stand');
  const doubleBtn = document.getElementById('bj-double');
  const stake = Lounge.chips(document.getElementById('bj-chips'), 32, label);
  function label() { dealBtn.textContent = `Deal for ${Wallet.fmt(stake.get())} Crowns`; }

  function cardEl(card, faceDown) {
    const el = document.createElement('div');
    if (faceDown) {
      el.className = 'card card--back';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Face-down card');
      return el;
    }
    const suit = card.s;
    el.className = 'card' + (suit.red ? ' is-red' : '');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `${RANK_NAMES[card.r] || card.r} of ${suit.name}`);
    const idx = `<span class="card__idx" aria-hidden="true">${card.r}<span class="card__suit" style="background-image:url(${art[suit.id]})"></span></span>`;
    el.innerHTML = idx +
      `<span class="card__big" aria-hidden="true" style="background-image:url(${art[suit.id]})"></span>` +
      idx.replace('card__idx', 'card__idx card__idx--flip');
    return el;
  }

  // ---------- Game state ----------
  let dealer = [], player = [], bet = 0, holeHidden = true, phase = 'idle';

  function render() {
    const want = (el, hand, hideSecond) => {
      // Only new cards are appended, so each one animates in once.
      if (el.children.length > hand.length) el.replaceChildren();
      hand.forEach((c, i) => {
        const face = !(hideSecond && i === 1);
        const existing = el.children[i];
        if (!existing) { el.appendChild(cardEl(c, !face)); Lounge.sfx('deal'); }
        else if (existing.classList.contains('card--back') && face) existing.replaceWith(cardEl(c, false));
      });
    };
    want(dealerCards, dealer, holeHidden);
    want(playerCards, player, false);

    const p = score(player);
    playerTotal.textContent = player.length ? (p.soft && p.total < 21 ? `Soft ${p.total}` : String(p.total)) : '';
    dealerTotal.textContent = !dealer.length ? '' : holeHidden ? String(score([dealer[0]]).total) : String(score(dealer).total);

    const playing = phase === 'player';
    hitBtn.disabled = !playing;
    standBtn.disabled = !playing;
    doubleBtn.disabled = !(playing && player.length === 2 && Wallet.get() >= bet);
    dealBtn.disabled = phase === 'player' || phase === 'dealer';
    stake.disable(phase === 'player' || phase === 'dealer');
  }

  const pause = () => Lounge.sleep(Lounge.reduceMotion() ? 60 : 480);

  function settle(outcome) {
    phase = 'done';
    holeHidden = false;
    msg.classList.remove('is-win');
    let paid = 0;
    let text = '';
    switch (outcome) {
      case 'blackjack': paid = Math.floor(bet * 2.5); text = `Blackjack! You win ${Wallet.fmt(paid - bet)} Crowns.`; break;
      case 'win': paid = bet * 2; text = `You win ${Wallet.fmt(bet)} Crowns.`; break;
      case 'dealer-bust': paid = bet * 2; text = `Dealer busts. You win ${Wallet.fmt(bet)} Crowns.`; break;
      case 'push': paid = bet; text = 'Push. Your stake comes back.'; break;
      case 'bust': text = 'Bust. The house takes this one.'; break;
      case 'dealer-blackjack': text = 'Dealer has blackjack.'; break;
      default: text = 'Dealer wins this hand.';
    }
    if (paid) Wallet.give(paid);
    if (paid > bet) msg.classList.add('is-win');
    msg.textContent = text;
    render();
    Lounge.emit('result', {
      game: 'club21', bet, win: paid > bet ? paid : 0, text: text.split('.')[0],
      trophy: outcome === 'blackjack' ? 'natural' : null,
    });
  }

  async function deal() {
    const b = stake.get();
    if (!Wallet.take(b)) {
      msg.textContent = 'Not enough Crowns for that stake. Pick a smaller chip or claim your allowance.';
      return;
    }
    bet = b;
    Lounge.emit('bet', { game: 'club21', amount: b });
    dealer = []; player = [];
    dealerCards.replaceChildren(); playerCards.replaceChildren();
    holeHidden = true;
    phase = 'dealing';
    msg.classList.remove('is-win');
    msg.textContent = 'Dealing…';
    render();

    for (const hand of [player, dealer, player, dealer]) {
      hand.push(drawCard());
      render();
      await pause();
    }

    const pBJ = isBlackjack(player), dBJ = isBlackjack(dealer);
    if (pBJ || dBJ) {
      holeHidden = false;
      render();
      await pause();
      return settle(pBJ && dBJ ? 'push' : pBJ ? 'blackjack' : 'dealer-blackjack');
    }
    phase = 'player';
    msg.textContent = 'Hit, stand or double?';
    render();
  }

  async function dealerPlays() {
    phase = 'dealer';
    holeHidden = false;
    render();
    await pause();
    while (score(dealer).total < 17) {
      dealer.push(drawCard());
      render();
      await pause();
    }
    const d = score(dealer).total, p = score(player).total;
    if (d > 21) return settle('dealer-bust');
    if (p > d) return settle('win');
    if (p === d) return settle('push');
    return settle('lose');
  }

  async function hit() {
    if (phase !== 'player') return;
    player.push(drawCard());
    render();
    const t = score(player).total;
    if (t > 21) return settle('bust');
    if (t === 21) { phase = 'dealer'; render(); await pause(); return dealerPlays(); }
  }

  async function double() {
    if (phase !== 'player' || player.length !== 2 || !Wallet.take(bet)) return;
    Lounge.emit('bet', { game: 'club21', amount: bet });
    bet *= 2;
    phase = 'dealer';
    player.push(drawCard());
    render();
    await pause();
    if (score(player).total > 21) return settle('bust');
    return dealerPlays();
  }

  dealBtn.addEventListener('click', deal);
  hitBtn.addEventListener('click', hit);
  standBtn.addEventListener('click', () => { if (phase === 'player') dealerPlays(); });
  doubleBtn.addEventListener('click', double);
  Wallet.onChange(() => { if (phase === 'player') render(); });

  render();
})();
