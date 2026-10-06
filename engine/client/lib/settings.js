// Player settings: theme, sound and vibration. Sound is always off until
// the player turns it on.
import { store } from './store.js';

const DEFAULTS = { theme: 'system', sound: false, haptics: true };
const target = new EventTarget();
let state = { ...DEFAULTS, ...store.get('settings', {}) };

const THEME_COLOURS = [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => [m, m.media, m.content]);

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'light' || state.theme === 'dark') root.dataset.theme = state.theme;
  else delete root.dataset.theme;
  // Keep the browser's own UI colour in step with a chosen theme.
  for (const [meta, media, content] of THEME_COLOURS) {
    const forced = state.theme !== 'system';
    const matches = media.includes(state.theme);
    meta.media = forced ? (matches ? 'all' : 'not all') : media;
    meta.content = content;
  }
}
applyTheme();

export const settings = {
  get(key) {
    return state[key];
  },
  set(key, value) {
    state = { ...state, [key]: value };
    store.set('settings', state);
    if (key === 'theme') applyTheme();
    target.dispatchEvent(new CustomEvent('change', { detail: { key, value } }));
  },
  on(fn) {
    target.addEventListener('change', (e) => fn(e.detail));
  },
};

store.watch('settings', (v) => {
  if (!v) return;
  state = { ...DEFAULTS, ...v };
  applyTheme();
  target.dispatchEvent(new CustomEvent('change', { detail: { key: 'theme', value: state.theme } }));
});
