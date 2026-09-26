// What every game shares: stake radios, the play and top-up buttons,
// responsible-gaming locks, the result line and keyboard shortcuts.
import { wallet } from '../lib/wallet.js';
import { rg } from '../lib/rg.js';
import { fmt, carats } from '../lib/format.js';
import { sound } from '../lib/sound.js';
import { buzz } from '../lib/haptics.js';
import { track } from '../lib/consent.js';
import { toast, reducedMotion } from '../lib/ui.js';

// Buttons that change state during play use aria-disabled rather than
// disabled, so keyboard focus stays on them instead of falling to <body>.
export const setOff = (el, off) => el && el.setAttribute('aria-disabled', String(Boolean(off)));
export const isOff = (el) => !el || el.getAttribute('aria-disabled') === 'true';

export function shell(root, { playSelector = '[data-action="spin"]', needed }) {
  const play = root.querySelector(playSelector);
  const topup = root.querySelector('[data-action="topup"]');
  const result = root.querySelector('[data-result]');
  const stakeLabel = root.querySelector('[data-stake-label]');
  const radios = [...root.querySelectorAll('.stake input[type="radio"]')];
  const state = { busy: false, lockedMessage: '' };
  let flashTimer = 0;

  const api = {
    play,
    get busy() {
      return state.busy;
    },
    set busy(v) {
      state.busy = v;
      play?.setAttribute('aria-busy', String(v));
      radios.forEach((r) => (r.disabled = v));
      api.refresh();
    },
    stake() {
      const r = radios.find((x) => x.checked);
      return r ? Number(r.value) : 0;
    },
    say(text, tone = '') {
      if (!result) return;
      clearTimeout(flashTimer);
      result.classList.remove('is-flash');
      result.dataset.tone = tone;
      result.textContent = text;
    },
    /** Check the player may stake `amount` now; explain if not. */
    allowed(amount) {
      const status = rg.canPlay();
      if (!status.ok) {
        api.say(status.message, 'locked');
        return false;
      }
      if (!wallet.canStake(amount)) {
        api.say(`That needs ${carats(amount)} and you have ${fmt(wallet.balance)}.${wallet.canTopUp() ? ` Claim a free top-up to carry on.` : ''}`, 'locked');
        return false;
      }
      return true;
    },
    refresh() {
      const status = rg.canPlay();
      const need = needed ? needed() : api.stake();
      root.toggleAttribute('data-locked', !status.ok);
      if (play) {
        play.disabled = false;
        setOff(play, state.busy || !status.ok || need <= 0 || !wallet.canStake(need));
      }
      if (topup) topup.hidden = state.busy || !wallet.canTopUp() || !status.ok;
      if (!status.ok && !state.busy) {
        if (state.lockedMessage !== status.message) api.say(status.message, 'locked');
        state.lockedMessage = status.message;
      } else if (state.lockedMessage) {
        state.lockedMessage = '';
        api.say('The games are open. Choose a stake and play.', '');
      }
    },
    /** Tell the player how a round went, honestly: net result first. */
    settled({ staked, returned, detail = '' }) {
      const net = returned - staked;
      let line;
      if (returned === 0) line = `${detail || 'Nothing back this time.'} Balance ${fmt(wallet.settled)}.`;
      else if (net > 0) line = `${detail} ${fmt(returned)} back from your ${fmt(staked)}: ${fmt(net)} up. Balance ${fmt(wallet.settled)}.`;
      else if (net === 0) line = `${detail} ${fmt(returned)} back: you broke even. Balance ${fmt(wallet.settled)}.`;
      else line = `${detail} ${fmt(returned)} back from your ${fmt(staked)} stake, so ${fmt(-net)} down on this one. Balance ${fmt(wallet.settled)}.`;
      api.say(line.trim(), net > 0 ? 'up' : 'down');
      track('game_round', { game: root.dataset.game, staked, returned });
      return net;
    },
    /**
     * Only a round that returns more than it cost gets any celebration, so a
     * loss is never dressed up as a win. The celebration is one short flash
     * and starburst on the result box (CSS, .is-flash), played once. With
     * reduced motion there is none.
     */
    celebrate(staked, returned) {
      if (!(returned > staked)) return;
      const size = returned >= staked * 10 ? 3 : returned >= staked * 3 ? 2 : 1;
      sound.chime(size);
      buzz([18, 40, 26]);
      if (!result || reducedMotion()) return;
      result.classList.remove('is-flash');
      void result.offsetWidth; // restart the animation if the last one is still fading
      result.dataset.size = String(size);
      result.classList.add('is-flash');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => result.classList.remove('is-flash'), 1000);
    },
  };

  radios.forEach((r) =>
    r.addEventListener('change', () => {
      if (stakeLabel) stakeLabel.textContent = fmt(api.stake());
      api.refresh();
    }),
  );
  topup?.addEventListener('click', () => {
    if (wallet.topUp()) {
      toast(`${carats(wallet.balance)} ready. Top-ups are always free.`);
      api.say(`Topped up. Your balance is ${fmt(wallet.balance)}.`);
      play?.focus();
    }
    api.refresh();
  });
  wallet.on(() => api.refresh());
  rg.onChange(() => api.refresh());
  if (stakeLabel) stakeLabel.textContent = fmt(api.stake());
  api.refresh();
  return api;
}

/**
 * Single-key shortcuts, active only while focus is inside the game
 * (WCAG 2.1.4). Number keys pick stakes.
 */
export function shortcuts(root, map, stakeRadios) {
  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.matches('textarea, input[type="text"], select')) return;
    const k = e.key.toLowerCase();
    if (/^[1-9]$/.test(k) && stakeRadios?.length) {
      const r = stakeRadios[Number(k) - 1];
      if (r && !r.disabled) {
        r.checked = true;
        r.dispatchEvent(new Event('change', { bubbles: true }));
        e.preventDefault();
      }
      return;
    }
    const fn = map[k];
    if (fn) {
      e.preventDefault();
      fn();
    }
  });
}

/** Canvas backing store sized to its CSS box at the device's pixel ratio. */
export function fitCanvas(canvas, ratio) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.getBoundingClientRect().width * dpr);
  const h = Math.round(w * ratio);
  if (w > 0 && (canvas.width !== w || canvas.height !== h)) {
    canvas.width = w;
    canvas.height = h;
    return true;
  }
  return false;
}
