/* Pixel Crown Club: the shared purse, fair randomness, pixel sprites and small helpers. */
(function () {
  'use strict';

  // ---------- Purse ----------
  // Everything counts in powers of two: 4,096 to start, 1,024 every 8 hours.
  const KEY = 'pcc.wallet.v1';
  const START = 4096;
  const ALLOWANCE = 1024;
  const ALLOWANCE_MS = 8 * 60 * 60 * 1000;
  const FLOOR = 16;

  const state = { crowns: START, lastClaim: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Number.isFinite(saved.crowns) && saved.crowns >= 0) {
      state.crowns = Math.floor(saved.crowns);
      state.lastClaim = Number(saved.lastClaim) || 0;
    }
  } catch (e) { /* storage unavailable: play with a fresh purse */ }

  const listeners = [];
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function notify(delta) { listeners.forEach((fn) => fn(state.crowns, delta)); }

  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  window.Wallet = {
    START, ALLOWANCE, ALLOWANCE_MS, FLOOR, fmt,
    get: () => state.crowns,
    take(n) {
      if (!(n > 0) || n > state.crowns) return false;
      state.crowns -= n; save(); notify(-n);
      return true;
    },
    give(n) {
      n = Math.floor(n);
      if (!(n > 0)) return;
      state.crowns += n; save(); notify(n);
    },
    allowanceIn() { return Math.max(0, state.lastClaim + ALLOWANCE_MS - Date.now()); },
    claimAllowance() {
      if (this.allowanceIn() > 0) return false;
      state.lastClaim = Date.now();
      this.give(ALLOWANCE);
      return true;
    },
    canRefill() { return state.crowns < FLOOR; },
    refill() {
      if (!this.canRefill()) return false;
      const delta = ALLOWANCE - state.crowns;
      state.crowns = ALLOWANCE; save(); notify(delta);
      return true;
    },
    onChange(fn) { listeners.push(fn); },
  };

  // ---------- Fair random integers in [0, n) ----------
  function rint(n) {
    if (window.crypto && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      const limit = Math.floor(0x100000000 / n) * n; // reject the biased tail
      do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
      return buf[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  // ---------- Pixel sprites ----------
  const PALETTE = {
    G: '#F2C14E', L: '#FFE59A', D: '#B8862B', W: '#FFF8E7',
    R: '#E0475B', Q: '#A32A3E',
    E: '#35C08A', M: '#1F7F5B',
    P: '#FF7AA2', p: '#C24D78',
    S: '#D9D3E6', s: '#8C84A0',
  };

  const SPRITES = {
    crown: [
      '.........',
      'G...G...G',
      'GG.GGG.GG',
      'GLGGGGGGG',
      'GRGGEGGRG',
      'GGGGGGGGG',
      'DDDDDDDDD',
      'DDDDDDDDD',
      '.........',
    ],
    seven: [
      '.........',
      '.RRRRRRR.',
      '.RWRRRRRQ',
      '......RRQ',
      '.....RRQ.',
      '....RRQ..',
      '...RRQ...',
      '...RRQ...',
      '.........',
    ],
    gem: [
      '.........',
      '..EEEEE..',
      '.EWEEEEM.',
      'EWEEEEEMM',
      '.EEEEEEM.',
      '..EEEEM..',
      '...EEM...',
      '....M....',
      '.........',
    ],
    heart: [
      '.........',
      '.PP...PP.',
      'PWPP.PPPp',
      'PPPPPPPPp',
      'PPPPPPPPp',
      '.PPPPPPp.',
      '..PPPPp..',
      '...PPp...',
      '....p....',
    ],
    coin: [
      '.........',
      '..GGGGG..',
      '.GLLGGGD.',
      'GLGDDDGGD',
      'GLGDGGGGD',
      'GLGDDDGGD',
      '.GGGGGGD.',
      '..DDDDD..',
      '.........',
    ],
    bell: [
      '....S....',
      '...SSS...',
      '..SWSSs..',
      '..SWSSs..',
      '.SWSSSSs.',
      '.SSSSSSs.',
      'SSSSSSSSs',
      'sssssssss',
      '....s....',
    ],
  };

  const SUITS = {
    spade: ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', '.X.X.X.', '..XXX..'],
    heart: ['.......', '.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    diamond: ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    club: ['..XXX..', '..XXX..', 'XXXXXXX', 'XXXXXXX', 'XX.X.XX', '...X...', '..XXX..'],
  };

  const spriteCache = new Map();
  function sprite(rows, colors = PALETTE, scale = 8) {
    const key = rows.join('|') + JSON.stringify(colors);
    if (spriteCache.has(key)) return spriteCache.get(key);
    const c = document.createElement('canvas');
    c.width = rows[0].length * scale;
    c.height = rows.length * scale;
    const x = c.getContext('2d');
    rows.forEach((row, y) => {
      [...row].forEach((ch, i) => {
        const col = colors[ch];
        if (!col) return;
        x.fillStyle = col;
        x.fillRect(i * scale, y * scale, scale, scale);
      });
    });
    const url = c.toDataURL('image/png');
    spriteCache.set(key, url);
    return url;
  }

  // ---------- Events ----------
  // Games announce 'bet' and 'result'; the club, sound and celebrations listen.
  const handlers = {};
  const on = (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); };
  const emit = (name, data) => { (handlers[name] || []).forEach((fn) => fn(data)); };

  // ---------- Chip selector ----------
  // Chip values grow with membership tier; see club.js.
  const BASE_CHIPS = [16, 32, 64, 128, 256];
  let chipValues = BASE_CHIPS.slice();
  const chipSets = [];

  function chips(el, initial, onChange) {
    let current = initial;
    let disabled = false;
    function build(first) {
      if (!chipValues.includes(current)) current = chipValues[1];
      el.replaceChildren(...chipValues.map((v) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip' + (v > 256 ? ' chip--vip' : '');
        b.textContent = v >= 1024 ? `${v / 1024}K` : v;
        b.disabled = disabled;
        b.setAttribute('aria-label', `${v} Crowns`);
        b.setAttribute('aria-pressed', String(v === current));
        b.addEventListener('click', () => {
          current = v;
          [...el.children].forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
          emit('chip', v);
          if (onChange) onChange(v);
        });
        return b;
      }));
      if (!first && onChange) onChange(current);
    }
    build(true);
    const api = {
      get: () => current,
      disable(state) { disabled = state; [...el.children].forEach((c) => { c.disabled = state; }); },
      rebuild: () => build(false),
    };
    chipSets.push(api);
    return api;
  }
  function setChipValues(values) {
    chipValues = values.slice();
    chipSets.forEach((s) => s.rebuild());
  }

  // ---------- Toast ----------
  let toastTimer = 0;
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 3600);
  }

  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Sound effects are provided by fx.js; this keeps games working without it.
  const sfx = (name) => { if (window.Lounge.playSound) window.Lounge.playSound(name); };

  window.Lounge = {
    rint, PALETTE, SPRITES, SUITS, sprite, chips, setChipValues, BASE_CHIPS,
    toast, reduceMotion, sleep, on, emit, sfx,
  };
})();
