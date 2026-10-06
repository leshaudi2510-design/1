// The Carat balance. Stakes come off at once. Returns are stored at once
// too (so a closed tab never loses a settled result), but a game can hold
// back the on-screen update until its animation has finished.
import config from '../config.js';
import { store } from './store.js';
import { session } from './session.js';

const target = new EventTarget();
const { startingBalance, topUpAmount, topUpBelow } = config.currency;

let balance = Number(store.get('wallet', {})?.balance);
if (!Number.isFinite(balance) || balance < 0) {
  balance = startingBalance;
  save();
}
let shown = balance;

function save() {
  store.set('wallet', { balance });
}
function emit() {
  shown = balance;
  target.dispatchEvent(new CustomEvent('change', { detail: { balance } }));
}

store.watch('wallet', (v) => {
  if (v && Number.isFinite(v.balance)) {
    balance = v.balance;
    emit();
  }
});

export const wallet = {
  /** What the player should see right now. */
  get balance() {
    return shown;
  },
  /** The settled balance, including returns not yet shown. */
  get settled() {
    return balance;
  },
  canStake(n) {
    return Number.isFinite(n) && n > 0 && n <= balance;
  },
  stake(n) {
    if (!this.canStake(n)) return false;
    balance -= n;
    save();
    session.add('staked', n);
    emit();
    return true;
  },
  /** Credit a return. With { defer: true } the display waits for reveal(). */
  credit(n, { defer = false } = {}) {
    if (n <= 0) return;
    balance += n;
    save();
    session.add('returned', n);
    if (!defer) emit();
  },
  /** Give back a stake from a round that was never finished. */
  refund(n) {
    if (n <= 0) return;
    balance += n;
    save();
    session.add('staked', -n);
    emit();
  },
  reveal() {
    if (shown !== balance) emit();
  },
  canTopUp() {
    return balance < topUpBelow;
  },
  topUp() {
    if (!this.canTopUp()) return false;
    balance += topUpAmount;
    save();
    emit();
    return true;
  },
  reset() {
    balance = startingBalance;
    save();
    emit();
  },
  on(fn) {
    target.addEventListener('change', (e) => fn(e.detail));
  },
};
