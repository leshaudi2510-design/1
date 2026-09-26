// Brilliant Twenty-One: blackjack rules and basic strategy, with no DOM.
//
// Six decks. Dealer stands on all 17s. A two-card 21 (a "Brilliant") pays 3 to 2.
// Double on any first two cards, including after a split. Split once.
// Split Aces take one card each. Dealer checks for a Brilliant under an Ace
// or ten-value card. No insurance, no surrender.

export const DECKS = 6;
export const CUT_AT = 0.25; // reshuffle when a quarter of the shoe is left
export const STAKES = [10, 25, 50, 100];
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RANK_NAMES = {
  A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King',
};

export function cardValue(card) {
  if (card.rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return Number(card.rank);
}

export function cardName(card) {
  return `${RANK_NAMES[card.rank] || card.rank} of ${card.suit}`;
}

/** A fresh, unshuffled six-deck shoe. */
export function freshShoe() {
  const shoe = [];
  for (let d = 0; d < DECKS; d++) {
    for (const suit of SUITS) for (const rank of RANKS) shoe.push({ rank, suit });
  }
  return shoe;
}

/** Hand total, counting Aces as 11 unless that would go over 21. */
export function score(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBrilliant = (cards) => cards.length === 2 && score(cards).total === 21;

export function canSplit(hand, handsInPlay) {
  return handsInPlay === 1 && hand.cards.length === 2 && cardValue(hand.cards[0]) === cardValue(hand.cards[1]);
}

/** Dealer draws to 17 and stands on all 17s. */
export function dealerShouldDraw(cards) {
  return score(cards).total < 17;
}

/**
 * Basic strategy for these rules: the move that returns the most, on average,
 * for your hand against the dealer's face-up card. H hit, S stand, D double, P split.
 */
export function basicStrategy(cards, upCard, { canDouble, canSplitNow }) {
  const up = cardValue(upCard);
  const { total, soft } = score(cards);
  if (canSplitNow) {
    const p = cardValue(cards[0]);
    if (p === 11 || p === 8) return 'P';
    if (p === 9 && ![7, 10, 11].includes(up)) return 'P';
    if ((p === 2 || p === 3 || p === 7) && up <= 7) return 'P';
    if (p === 6 && up <= 6) return 'P';
    if (p === 4 && (up === 5 || up === 6)) return 'P';
  }
  const dbl = (fallback) => (canDouble ? 'D' : fallback);
  if (soft) {
    if (total >= 19) return 'S';
        if (total === 18) {
      if (up >= 2 && up <= 6) return up === 2 ? 'S' : dbl('S');
      if (up <= 8) return 'S';
      return 'H';
    }
    if (total === 17) return up >= 3 && up <= 6 ? dbl('H') : 'H';
    if (total >= 15) return up >= 4 && up <= 6 ? dbl('H') : 'H';
    if (total >= 13) return up >= 5 && up <= 6 ? dbl('H') : 'H';
    return 'H';
  }
  if (total >= 17) return 'S';
  if (total >= 13) return up <= 6 ? 'S' : 'H';
  if (total === 12) return up >= 4 && up <= 6 ? 'S' : 'H';
  if (total === 11) return up === 11 ? 'H' : dbl('H');
  if (total === 10) return up <= 9 ? dbl('H') : 'H';
  if (total === 9) return up >= 3 && up <= 6 ? dbl('H') : 'H';
  return 'H';
}

export const MOVE_NAMES = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split' };

/**
 * What comes back for one finished player hand.
 * `hand.stake` already includes any double.
 */
export function settleHand(hand, dealerCards) {
  const p = score(hand.cards).total;
  const d = score(dealerCards).total;
  if (p > 21) return { outcome: 'bust', back: 0 };
  if (!hand.split && isBrilliant(hand.cards) && !isBrilliant(dealerCards)) {
    return { outcome: 'brilliant', back: hand.stake * 2.5 };
  }
  if (isBrilliant(dealerCards)) {
    if (!hand.split && isBrilliant(hand.cards)) return { outcome: 'push', back: hand.stake };
    return { outcome: 'lose', back: 0 };
  }
  if (d > 21 || p > d) return { outcome: 'win', back: hand.stake * 2 };
  if (p === d) return { outcome: 'push', back: hand.stake };
  return { outcome: 'lose', back: 0 };
}
