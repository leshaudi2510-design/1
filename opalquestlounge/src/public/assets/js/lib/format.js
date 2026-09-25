import config from '../config.js';

const nf = new Intl.NumberFormat('en-GB');
export const fmt = (n) => nf.format(n);
export const carats = (n) => `${fmt(n)} ${n === 1 ? config.currency.singular : config.currency.plural}`;
export const plural = config.currency.plural;

/** 75 → "1 minute 15 seconds"; 1800 → "30 minutes" */
export function spokenDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m || !h) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** 754 → "12:34"; 3754 → "1:02:34" */
export function clock(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "14:35" in UK time */
export const timeOfDay = (ts) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));

/** "Friday 2 October" */
export const dayAndDate = (ts) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ts));

/** Local calendar date as YYYY-MM-DD */
export function today(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
