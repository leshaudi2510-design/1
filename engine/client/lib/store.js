// Small, failure-proof wrapper around localStorage and sessionStorage.
// Every key is prefixed "oql." and listed on the cookies page. If storage is
// blocked (private mode, strict settings), values live in memory for the page.

const PREFIX = 'oql.';
const memory = new Map();

function open(kind) {
  try {
    const s = window[kind];
    s.setItem(`${PREFIX}probe`, '1');
    s.removeItem(`${PREFIX}probe`);
    return s;
  } catch {
    return null;
  }
}
const areas = { local: open('localStorage'), session: open('sessionStorage') };

export const store = {
  get(key, fallback = null, area = 'local') {
    try {
      const s = areas[area];
      const raw = s ? s.getItem(PREFIX + key) : memory.get(`${area}:${key}`);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value, area = 'local') {
    const raw = JSON.stringify(value);
    try {
      const s = areas[area];
      if (s) s.setItem(PREFIX + key, raw);
      else memory.set(`${area}:${key}`, raw);
    } catch {
      memory.set(`${area}:${key}`, raw);
    }
  },
  remove(key, area = 'local') {
    try {
      areas[area]?.removeItem(PREFIX + key);
    } catch {}
    memory.delete(`${area}:${key}`);
  },
  /** Call fn(newValue) when another tab changes `key`. */
  watch(key, fn) {
    window.addEventListener('storage', (e) => {
      if (e.key !== PREFIX + key) return;
      try {
        fn(e.newValue == null ? null : JSON.parse(e.newValue));
      } catch {}
    });
  },
};
