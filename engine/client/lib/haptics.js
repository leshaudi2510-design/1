// Short vibrations on phones that support them, if the player allows it.
import { settings } from './settings.js';

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
export const hasHaptics = canVibrate && matchMedia('(pointer: coarse)').matches;

export function buzz(pattern = 10) {
  if (!hasHaptics || !settings.get('haptics')) return;
  try {
    navigator.vibrate(pattern);
  } catch {}
}
