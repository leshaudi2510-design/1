// Every sound is synthesised with the Web Audio API: no audio files, and
// nothing plays until the player switches sound on.
import { settings } from './settings.js';

let ctx = null;
let master = null;
let noiseBuffer = null;

function audio() {
  if (!settings.get('sound')) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function envelope(node, t, attack, peak, decay) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function noise(t, { freq = 3000, q = 1, peak = 0.5, decay = 0.03, type = 'bandpass' } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  envelope(g, t, 0.002, peak, decay);
  src.connect(filter).connect(g).connect(master);
  src.start(t, Math.random() * 0.3, attackTail(decay));
  return filter;
}
const attackTail = (d) => d + 0.05;

function tone(t, freq, { peak = 0.3, decay = 0.4, type = 'sine' } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  envelope(g, t, 0.004, peak, decay);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + decay + 0.1);
}

// A struck crystal: a few inharmonic partials that ring and fade.
function crystal(t, freq, peak = 0.22) {
  [1, 2.76, 5.4, 8.93].forEach((ratio, i) => tone(t, freq * ratio, { peak: peak / (i + 1.4), decay: 1.4 / (i + 1) }));
}

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

export const sound = {
  /** Reel or ball tick: a tap of stone on stone. */
  tick() {
    if (!audio()) return;
    noise(ctx.currentTime, { freq: 2400 + Math.random() * 800, q: 6, peak: 0.18, decay: 0.018 });
  },
  /** A reel settling into place. */
  stop() {
    if (!audio()) return;
    const t = ctx.currentTime;
    tone(t, 140, { peak: 0.25, decay: 0.09, type: 'triangle' });
    noise(t, { freq: 900, q: 1.2, peak: 0.12, decay: 0.05 });
  },
  /** A card sliding across baize. */
  card() {
    if (!audio()) return;
    const f = noise(ctx.currentTime, { freq: 1800, q: 0.9, peak: 0.16, decay: 0.07 });
    f.frequency.exponentialRampToValueAtTime(4200, ctx.currentTime + 0.07);
  },
  /** A chip placed on the table. */
  chip() {
    if (!audio()) return;
    const t = ctx.currentTime;
    noise(t, { freq: 5200, q: 8, peak: 0.16, decay: 0.02 });
    noise(t + 0.035, { freq: 4600, q: 8, peak: 0.1, decay: 0.02 });
  },
  /** Pays back more than the stake: a rising run of crystal notes. */
  chime(size = 1) {
    if (!audio()) return;
    const t = ctx.currentTime;
    const n = Math.min(PENTATONIC.length, 2 + size);
    for (let i = 0; i < n; i++) crystal(t + i * 0.09, PENTATONIC[i]);
  },
  /** Something neutral: a push, or a reminder. */
  soft() {
    if (!audio()) return;
    crystal(ctx.currentTime, 440, 0.12);
  },
};
