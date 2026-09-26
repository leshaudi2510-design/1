// Responsible gaming: session clock, a break reminder every 30 minutes,
// an optional daily time limit, and breaks that lock the games.
// Games ask rg.canPlay() before every stake and listen for changes.
import { store } from './store.js';
import { session } from './session.js';
import { wallet } from './wallet.js';
import { clock, fmt, spokenDuration, timeOfDay, dayAndDate, today } from './format.js';
import { openDialog, toast, ask } from './ui.js';
import { sound } from './sound.js';

const REMINDER_EVERY = 30 * 60; // seconds
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

function showReminder() {
  const d = document.getElementById('reality-check');
  if (!d) return;
  d.querySelector('[data-rc-time]').textContent = spokenDuration(session.elapsed());
  fillStats(d);
  d.querySelectorAll('[data-balance]').forEach((el) => (el.textContent = fmt(wallet.settled)));
  sound.soft();
  openDialog('reality-check');
}

function tick() {
  if (document.visibilityState !== 'visible') return;
  session.touch();
  const p = playtime();
  p.seconds += 1;
  store.set('playtime', p);

  const s = session.state;
  const due = Math.floor(session.elapsed() / REMINDER_EVERY);
  if (due > s.reminders) {
    s.reminders = due;
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

  // Reality check buttons
  const rc = document.getElementById('reality-check');
  rc?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rc]');
    if (!b) return;
    if (b.dataset.rc === 'break') {
      rg.startPause(SHORT_BREAK, 'break');
      toast(`Break started. The games open again at ${timeOfDay(Date.now() + SHORT_BREAK)}.`);
    }
    rc.close();
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

  store.watch('pause', emit);
  store.watch('limits', emit);
  store.watch('age', emit);
}
