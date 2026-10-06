/* Pixel Crown Club: sensory layer. Chiptune sound, haptics, pixel confetti, counters, spotlight and tilt. */
(function () {
  'use strict';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // ---------- Sound: synthesised 8-bit effects, off until the player turns them on ----------
  let enabled = store.get('pcc.sound') === 'on';
  let ac = null;
  function audio() {
    if (!ac) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ac = new Ctx();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(freq, start, dur, { type = 'square', vol = 0.06, slide = 0 } = {}) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + start;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(start, dur, { freq = 1800, q = 1.2, vol = 0.08 } = {}) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + start;
    const len = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }

  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const SOUNDS = {
    chip: () => { noise(0, 0.035, { freq: 3200, q: 2, vol: 0.09 }); tone(2100, 0, 0.03, { type: 'triangle', vol: 0.03 }); },
    spin: () => { noise(0, 0.25, { freq: 700, q: 0.8, vol: 0.05 }); },
    stop: () => { tone(130, 0, 0.07, { vol: 0.07 }); noise(0, 0.03, { freq: 900, vol: 0.05 }); },
    deal: () => { noise(0, 0.08, { freq: 1500, q: 0.9, vol: 0.07 }); },
    ball: () => { tone(1400, 0, 0.04, { type: 'triangle', vol: 0.05 }); tone(900, 0.06, 0.05, { type: 'triangle', vol: 0.04 }); },
    coin: () => { tone(NOTE(83), 0, 0.08); tone(NOTE(88), 0.08, 0.28); },
    win: () => { [72, 76, 79, 84].forEach((n, i) => tone(NOTE(n), i * 0.075, 0.12)); },
    jackpot: () => {
      [72, 76, 79, 84, 79, 84, 88, 91].forEach((n, i) => tone(NOTE(n), i * 0.09, 0.16));
      [72, 76, 79].forEach((n) => tone(NOTE(n), 0.75, 0.6, { type: 'triangle', vol: 0.05 }));
    },
    unlock: () => { [79, 83, 86, 91].forEach((n, i) => tone(NOTE(n), i * 0.06, 0.2, { type: 'triangle', vol: 0.07 })); },
    tier: () => { [67, 72, 76, 79, 84].forEach((n, i) => tone(NOTE(n), i * 0.1, 0.3, { vol: 0.05 })); },
  };

  const HAPTICS = { chip: 8, stop: 12, deal: 8, win: [20, 40, 30], jackpot: [30, 50, 30, 50, 80], unlock: [15, 30, 15], tier: [40, 60, 40] };

  function playSound(name) {
    if (!enabled) return;
    try { if (SOUNDS[name]) SOUNDS[name](); } catch (e) { /* audio unavailable */ }
    if (HAPTICS[name] && navigator.vibrate) navigator.vibrate(HAPTICS[name]);
  }

  const toggles = [...document.querySelectorAll('[data-sound-toggle]')];
  function renderToggles() {
    toggles.forEach((b) => {
      b.setAttribute('aria-pressed', String(enabled));
      b.setAttribute('aria-label', enabled ? 'Sound and haptics on' : 'Sound and haptics off');
      b.title = enabled ? 'Sound on' : 'Sound off';
    });
  }
  toggles.forEach((b) => b.addEventListener('click', () => {
    enabled = !enabled;
    store.set('pcc.sound', enabled ? 'on' : 'off');
    renderToggles();
    if (enabled) playSound('coin');
  }));
  renderToggles();

  // ---------- Pixel confetti ----------
  const COLORS = ['#F2C14E', '#FFE59A', '#E0475B', '#35C08A', '#FF7AA2', '#FFF8E7'];
  let layer = null, lctx = null, bits = [], running = false;

  function confetti(originEl, amount = 90) {
    if (Lounge.reduceMotion()) return;
    if (!layer) {
      layer = document.createElement('canvas');
      layer.className = 'confetti';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
      lctx = layer.getContext('2d');
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    layer.width = innerWidth * dpr; layer.height = innerHeight * dpr;
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = originEl ? originEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    for (let i = 0; i < amount; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const v = 5 + Math.random() * 9;
      bits.push({
        x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        s: 4 + Math.floor(Math.random() * 3) * 2, c: COLORS[i % COLORS.length], life: 0, max: 70 + Math.random() * 50,
      });
    }
    if (!running) { running = true; requestAnimationFrame(step); }
  }
  function step() {
    lctx.clearRect(0, 0, innerWidth, innerHeight);
    bits = bits.filter((b) => b.life < b.max && b.y < innerHeight + 20);
    for (const b of bits) {
      b.life++; b.vy += 0.32; b.vx *= 0.985; b.x += b.vx; b.y += b.vy;
      lctx.globalAlpha = Math.max(0, 1 - b.life / b.max);
      lctx.fillStyle = b.c;
      // Snap to a 2px grid so the confetti stays pixel-crisp.
      lctx.fillRect(Math.round(b.x / 2) * 2, Math.round(b.y / 2) * 2, b.s, b.s);
    }
    lctx.globalAlpha = 1;
    if (bits.length) requestAnimationFrame(step);
    else { running = false; lctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  // ---------- Count-up numbers ----------
  const counting = new WeakMap();
  function countTo(el, to, fmt = Wallet.fmt) {
    const from = Number(el.dataset.value ?? to);
    el.dataset.value = to;
    if (Lounge.reduceMotion() || from === to) { el.textContent = fmt(to); return; }
    cancelAnimationFrame(counting.get(el));
    const dur = Math.min(900, 250 + Math.abs(to - from) / 4);
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) counting.set(el, requestAnimationFrame(tick));
    };
    counting.set(el, requestAnimationFrame(tick));
  }

  // ---------- Spotlight: panels light up under the pointer ----------
  let spotFrame = 0;
  document.addEventListener('pointermove', (e) => {
    if (!finePointer.matches || spotFrame) return;
    spotFrame = requestAnimationFrame(() => {
      spotFrame = 0;
      const el = e.target.closest && e.target.closest('[data-spot]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }, { passive: true });

  // ---------- Tilt: the membership card follows the pointer ----------
  function tilt(el) {
    if (!el) return;
    const reset = () => {
      el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--gx', '50%'); el.style.setProperty('--gy', '50%');
      el.classList.remove('is-tilting');
    };
    el.addEventListener('pointermove', (e) => {
      if (Lounge.reduceMotion()) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', `${(0.5 - py) * 16}deg`);
      el.style.setProperty('--ry', `${(px - 0.5) * 22}deg`);
      el.style.setProperty('--gx', `${px * 100}%`);
      el.style.setProperty('--gy', `${py * 100}%`);
      el.classList.add('is-tilting');
    });
    el.addEventListener('pointerleave', reset);
    reset();
  }

  // ---------- Magnetic primary buttons ----------
  document.querySelectorAll('.btn--gold').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      if (!finePointer.matches || Lounge.reduceMotion() || b.disabled) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--tx', `${((e.clientX - r.left) / r.width - 0.5) * 8}px`);
      b.style.setProperty('--ty', `${((e.clientY - r.top) / r.height - 0.5) * 6}px`);
    });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--tx', '0px'); b.style.setProperty('--ty', '0px'); });
  });

  // ---------- Reactions to game events ----------
  Lounge.on('chip', () => playSound('chip'));
  Lounge.on('result', (r) => {
    if (!r.win) return;
    const big = r.win >= r.bet * 8;
    playSound(big ? 'jackpot' : 'win');
    if (big) confetti(document.getElementById(`panel-${r.game}`)?.querySelector('.stage'), 140);
  });

  Object.assign(window.Lounge, { playSound, confetti, countTo, tilt });
})();
