// Responsible gaming: session clock, a reality check every 15, 30 or 60
// minutes (30 by default), an optional daily time limit, and breaks that lock
// the games. Games ask rg.canPlay() before every stake and listen for changes.
//
// Stored (localStorage, via store.js):
//   oql.limits   { minutes, pending: { minutes, from } | null, reality }
//                reality is the reality-check interval in minutes (15, 30 or 60)
//   oql.playtime { date, seconds }
//   oql.pause    { until, kind: 'break' | 'cooloff' }
//   oql.age      { answer, at }
import { store } from './store.js';
import { session } from './session.js';
import { wallet } from './wallet.js';
import { clock, fmt, spokenDuration, shortDuration, timeOfDay, dayAndDate, today } from './format.js';
import { openDialog, toast, ask } from './ui.js';
import { sound } from './sound.js';

const REALITY_CHOICES = [15, 30, 60]; // minutes
const REALITY_DEFAULT = 30;
const SHORT_BREAK = 5 * 60 * 1000;
const target = new EventTarget();
const emit = () => target.dispatchEvent(new Event('change'));

// ---------- stored state ----------
function limits() {
  const l = store.get('limits', { minutes: 0, pending: null });
  if (l.pending && l.pending.from <= today()) {
    l.minutes = l.pending.minutes;
    l.pending = null;
    store.set('limits', l);
  }
  return l;
}
function realityMinutes() {
  const m = Number(store.get('limits', {})?.reality);
  return REALITY_CHOICES.includes(m) ? m : REALITY_DEFAULT;
}
function playtime() {
  const p = store.get('playtime', null);
  return p && p.date === today() ? p : { date: today(), seconds: 0 };
}
function pause() {
  const p = store.get('pause', null);
  if (p && p.until > Date.now()) return p;
  if (p) store.remove('pause');
  return null;
}
function ageLock() {
  const a = store.get('age', null);
  if (a && a.answer === 'no' && Date.now() - a.at < 30 * 24 * 3600 * 1000) return a;
  return null;
}

export const rg = {
  /** Can the player stake right now? If not, why not, in plain words. */
  canPlay() {
    if (ageLock()) return { ok: false, reason: 'age', message: 'Games are locked on this device because you told us you’re under 18.' };
    const age = store.get('age', null);
    if (!age || age.answer !== 'yes') return { ok: false, reason: 'unconfirmed', message: 'Please confirm you’re 18 or over to play.' };
    const p = pause();
    if (p) {
      const when = p.until - Date.now() < 20 * 3600 * 1000 ? `until ${timeOfDay(p.until)}` : `until ${dayAndDate(p.until)}`;
      return { ok: false, reason: p.kind, message: p.kind === 'break' ? `You’re on a short break ${when}.` : `Games are paused ${when}, as you asked.` };
    }
    const l = limits();
    if (l.minutes && playtime().seconds >= l.minutes * 60) {
      return { ok: false, reason: 'limit', message: `You’ve reached your daily limit of ${spokenDuration(l.minutes * 60)}. Games open again at midnight.` };
    }
    return { ok: true };
  },
  onChange(fn) {
    target.addEventListener('change', fn);
  },
  refresh: emit,
  limits,
  playtime,
  pause,
  /** The reality-check interval in minutes: 15, 30 or 60. */
  realityMinutes,
  /** Change how often the reality check appears. Applies at once. */
  setReality(minutes) {
    const m = Number(minutes);
    if (!REALITY_CHOICES.includes(m)) return false;
    const l = limits();
    l.reality = m;
    store.set('limits', l);
    emit();
    return true;
  },
  setLimit(minutes) {
    const l = limits();
    const current = l.minutes || Infinity;
    const next = minutes || Infinity;
    if (next <= current) {
      l.minutes = minutes;
      l.pending = null;
      store.set('limits', l);
      emit();
      return { applied: 'now' };
    }
    const tomorrow = today(Date.now() + 24 * 3600 * 1000);
    l.pending = { minutes, from: tomorrow };
    store.set('limits', l);
    emit();
    return { applied: 'tomorrow' };
  },
  startPause(ms, kind) {
    const current = pause();
    if (current && current.until >= Date.now() + ms) return; // never shorten a longer break
    store.set('pause', { until: Date.now() + ms, kind });
    emit();
  },
};

// ---------- the clock ----------
const shownLimit = { value: false };

function fillStats(root = document) {
  const s = session.state;
  root.querySelectorAll('[data-session]').forEach((el) => (el.textContent = clock(session.elapsed())));
  root.querySelectorAll('[data-rc-staked]').forEach((el) => (el.textContent = fmt(s.staked)));
  root.querySelectorAll('[data-rc-returned]').forEach((el) => (el.textContent = fmt(s.returned)));
  root.querySelectorAll('[data-playtime]').forEach((el) => (el.textContent = spokenDuration(playtime().seconds)));
}

// The game (a [data-game] root) that had focus when the reality check opened.
let rcFrom = null;

function showReminder() {
  const d = document.getElementById('reality-check-dialog');
  if (!d) return;
  d.querySelector('[data-rc-time]').textContent = spokenDuration(session.elapsed());
  fillStats(d);
  d.querySelectorAll('[data-balance]').forEach((el) => (el.textContent = fmt(wallet.settled)));
  sound.soft();
  if (!d.open) rcFrom = document.activeElement?.closest?.('[data-game]') || null;
  openDialog('reality-check-dialog');
}

function tick() {
  if (document.visibilityState !== 'visible') return;
  session.touch();
  const p = playtime();
  p.seconds += 1;
  store.set('playtime', p);

  // Reality check: due once the chosen interval has passed since the last one.
  // (Sessions saved before remindedAt existed counted 30-minute reminders.)
  const s = session.state;
  const elapsed = session.elapsed();
  const last = s.remindedAt ?? (s.reminders || 0) * 30 * 60;
  if (elapsed - last >= realityMinutes() * 60) {
    s.remindedAt = elapsed;
    s.reminders = (s.reminders || 0) + 1;
    session.save();
    if (rg.canPlay().ok) showReminder();
  }

  const status = rg.canPlay();
  if (status.reason === 'limit' && !shownLimit.value) {
    shownLimit.value = true;
    toast(status.message, 8000);
    emit();
  }
  const pz = store.get('pause', null);
  if (pz && pz.until <= Date.now()) {
    store.remove('pause');
    toast('Your break is over. The games are open again.');
    emit();
  }
  fillStats();
}

export function startRg() {
  fillStats();
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      session.touch();
      fillStats();
      emit();
    }
  });

  // A 5-minute break: from the reality check, or from Settings
  // ([data-action="break-5"] anywhere). A break never shortens a longer one.
  const shortBreak = () => {
    const before = pause();
    rg.startPause(SHORT_BREAK, 'break');
    const now = pause();
    if (before && now && now.until === before.until && before.until > Date.now() + SHORT_BREAK) {
      toast(`You're already on a break until ${timeOfDay(now.until)}${now.until - Date.now() > 20 * 3600 * 1000 ? ` on ${dayAndDate(now.until)}` : ''}.`);
    } else {
      toast(`Break started. The games open again at ${timeOfDay(Date.now() + SHORT_BREAK)}.`);
    }
  };
  const rc = document.getElementById('reality-check-dialog');
  rc?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rc]');
    if (!b) return;
    // Close first: focus goes back to the control that had it while that is
    // still shown, so a demo stage the break is about to block can move it on.
    rc.close();
    if (b.dataset.rc === 'break') shortBreak();
  });
  // The browser can't give focus back into a game's frame, or to a control
  // the break has hidden; it would fall to <body>. Then the game the check
  // interrupted puts it somewhere visible. (This runs for Escape too.)
  rc?.addEventListener('close', () => {
    const game = rcFrom;
    rcFrom = null;
    const a = document.activeElement;
    if (a && a !== document.body && !rc.contains(a) && a.checkVisibility?.() !== false) return;
    game?.dispatchEvent(new CustomEvent('oql:refocus'));
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action="break-5"]');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    shortBreak();
    showStates();
  });

  // Reality-check interval: radios named "rc" (Settings, and any page that offers them)
  const syncReality = () => {
    const m = String(realityMinutes());
    document.querySelectorAll('input[name="rc"]').forEach((r) => (r.checked = r.value === m));
  };
  syncReality();
  document.addEventListener('change', (e) => {
    const r = e.target;
    if (!(r instanceof HTMLInputElement) || r.name !== 'rc' || !r.checked) return;
    if (!rg.setReality(r.value)) return;
    syncReality();
    showStates();
    toast(`Saved. You'll see a reality check every ${realityMinutes()} minutes.`);
  });

  // Daily limit: settings dialog and responsible gaming page
  const describeLimit = () => {
    const l = limits();
    const parts = [];
    parts.push(l.minutes ? `Your limit is ${spokenDuration(l.minutes * 60)} a day.` : 'No daily limit is set.');
    if (l.pending) parts.push(`From tomorrow it will be ${l.pending.minutes ? spokenDuration(l.pending.minutes * 60) : 'off'}.`);
    parts.push(`Today: ${spokenDuration(playtime().seconds)} on the site.`);
    return parts.join(' ');
  };
  document.querySelectorAll('select[name="limit"]').forEach((sel) => {
    sel.value = String(limits().minutes || 0);
  });
  const settingsLimit = document.querySelector('#settings select[name="limit"]');
  settingsLimit?.addEventListener('change', () => {
    const r = rg.setLimit(Number(settingsLimit.value));
    toast(r.applied === 'now' ? describeLimit() : `Saved. Your new limit starts tomorrow.`);
    if (r.applied === 'tomorrow') settingsLimit.value = String(limits().minutes || 0);
    showStates();
  });
  const form = document.querySelector('[data-rg="limit"]');
  const limitStatus = document.querySelector('[data-rg-limit-status]');
  if (limitStatus) limitStatus.textContent = describeLimit();
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const sel = form.querySelector('select');
    const r = rg.setLimit(Number(sel.value));
    limitStatus.textContent = (r.applied === 'now' ? 'Saved. ' : 'Saved. The change starts tomorrow. ') + describeLimit();
    if (r.applied === 'tomorrow') sel.value = String(limits().minutes || 0);
    if (settingsLimit) settingsLimit.value = String(limits().minutes || 0);
  });

  // Longer breaks
  const coolStatus = document.querySelector('[data-rg-pause-status]');
  const describePause = () => {
    const p = pause();
    if (!p) return '';
    return `Games are paused on this device until ${timeOfDay(p.until)} on ${dayAndDate(p.until)}.`;
  };
  if (coolStatus) coolStatus.textContent = describePause();
  document.querySelector('[data-rg="cooloff"]')?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-days]');
    if (!b) return;
    const days = Number(b.dataset.days);
    const label = days === 1 ? '24 hours' : `${days} days`;
    const ok = await ask({
      title: `Pause the games for ${label}?`,
      body: "They stay paused on this device until the time is up. You won't be able to undo this early.",
      yes: `Pause for ${label}`,
      no: 'Not now',
    });
    if (!ok) return;
    rg.startPause(days * 24 * 3600 * 1000, 'cooloff');
    coolStatus.textContent = describePause();
  });

  // State pills in Settings ([data-rg-state]), refreshed whenever anything changes
  const showStates = () => {
    const l = limits();
    const set = (key, text) =>
      document.querySelectorAll(`[data-rg-state="${key}"]`).forEach((el) => {
        el.textContent = text;
        el.hidden = !text;
      });
    set('limit', l.minutes ? `${shortDuration(l.minutes)} a day` : 'Off');
    set('limit-pending', l.pending ? `From tomorrow: ${l.pending.minutes ? `${spokenDuration(l.pending.minutes * 60)} a day` : 'no limit'}.` : '');
    set('reality', `Every ${realityMinutes()} min`);
    const p = pause();
    set('break', p ? `Until ${timeOfDay(p.until)}${p.until - Date.now() > 20 * 3600 * 1000 ? `, ${dayAndDate(p.until)}` : ''}` : 'None set');
    if (settingsLimit && document.activeElement !== settingsLimit) settingsLimit.value = String(l.minutes || 0);
  };
  showStates();
  rg.onChange(() => {
    showStates();
    syncReality();
  });
  document.getElementById('settings')?.addEventListener('toggle', showStates);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open="settings"]')) showStates();
  });

  store.watch('pause', emit);
  store.watch('limits', emit);
  store.watch('age', emit);
}
