// The current session: when it started and what's been staked and returned.
// Lives in sessionStorage, so it follows you between pages in one tab.
import { store } from './store.js';

const IDLE_RESET = 30 * 60 * 1000; // a gap this long starts a new session

function fresh() {
  // remindedAt: seconds into the session when the last reality check was due.
  return { start: Date.now(), seen: Date.now(), staked: 0, returned: 0, reminders: 0, remindedAt: 0 };
}

let state = store.get('session', null, 'session');
if (!state || Date.now() - (state.seen || 0) > IDLE_RESET) state = fresh();

export const session = {
  get state() {
    return state;
  },
  elapsed() {
    return Math.max(0, Math.floor((Date.now() - state.start) / 1000));
  },
  touch() {
    const now = Date.now();
    if (now - state.seen > IDLE_RESET) state = fresh();
    state.seen = now;
    this.save();
  },
  add(field, n) {
    state[field] += n;
    this.save();
  },
  save() {
    store.set('session', state, 'session');
  },
};
