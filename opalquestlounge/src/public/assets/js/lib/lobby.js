// Lobby filter chips: show only the tiles whose data-tags include the chosen
// filter, and say how many are showing.
//
// Markup contract (src/lib/ui/tiles.mjs writes it):
//   [data-lobby]                     one lobby: its filter bar and its tiles
//     [data-filters]                 the chip row
//       button.chip[data-filter]     "all" or a tag; aria-pressed marks the choice
//       [data-filter-count]          polite live region with the count
//     [data-lobby-group]             optional section; hidden when it has no tiles left
//       li[data-tags]                a tile; hidden (the attribute) when filtered out
//
// The chips are toggle buttons, one pressed at a time. Pressing the pressed
// chip again goes back to All. Arrow keys, Home and End move between chips.
// The choice is kept in history.state, so Back to the lobby brings it back;
// nothing is written to storage.

const STATE_KEY = 'oqlLobby';

const countText = (shown, total) =>
  shown === total ? `Showing all ${total} ${total === 1 ? 'game' : 'games'}` : `Showing ${shown} of ${total} games`;

function readState() {
  try {
    return (history.state && history.state[STATE_KEY]) || {};
  } catch {
    return {};
  }
}

function saveState(key, filter) {
  try {
    const all = { ...readState(), [key]: filter };
    history.replaceState({ ...(history.state || {}), [STATE_KEY]: all }, '');
  } catch {}
}

function setup(root, key) {
  const bar = root.querySelector('[data-filters]');
  if (!bar || bar.hasAttribute('data-ready')) return;
  bar.setAttribute('data-ready', '');
  const chips = [...bar.querySelectorAll('button.chip[data-filter]')];
  const count = root.querySelector('[data-filter-count]');
  const tiles = [...root.querySelectorAll('li[data-tags]')];
  const groups = [...root.querySelectorAll('[data-lobby-group]')];
  if (!chips.length || !tiles.length) return;

  function apply(filter, { remember = true } = {}) {
    if (!chips.some((c) => c.dataset.filter === filter)) filter = 'all';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === filter)));
    let shown = 0;
    for (const t of tiles) {
      const show = filter === 'all' || t.dataset.tags.split(/\s+/).includes(filter);
      t.hidden = !show;
      if (show) shown++;
    }
    for (const g of groups) g.hidden = !g.querySelector('li[data-tags]:not([hidden])');
    const text = countText(shown, tiles.length);
    if (count && count.textContent !== text) count.textContent = text;
    if (remember) saveState(key, filter);
  }

  bar.addEventListener('click', (e) => {
    const chip = e.target.closest('button.chip[data-filter]');
    if (!chip || !bar.contains(chip) || chip.getAttribute('aria-disabled') === 'true') return;
    const on = chip.getAttribute('aria-pressed') === 'true';
    apply(on && chip.dataset.filter !== 'all' ? 'all' : chip.dataset.filter);
  });

  bar.addEventListener('keydown', (e) => {
    const i = chips.indexOf(document.activeElement);
    if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    const last = chips.length - 1;
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    chips[Math.min(last, Math.max(0, next))].focus();
  });

  // A same-page link into a group the filter has hidden (the nav's "Slots"
  // and "Table games", the dock's "Slots" and "Tables" on /games/) would
  // otherwise go nowhere. Show every game again before the browser follows
  // the link: it then scrolls there itself, keeps the scroll margin and moves
  // the Tab starting point, even when the hash is already in the address.
  // The live count says "Showing all …", so the change isn't silent.
  const hiddenTarget = (hash) => {
    if (!hash || hash.length < 2) return null;
    let t = null;
    try {
      t = document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {}
    const g = t && root.contains(t) ? t.closest('[data-lobby-group]') : null;
    return g && g.hidden ? t : null;
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href*="#"]');
    if (!a || (a.target && a.target !== '_self')) return;
    if (a.origin !== location.origin || a.pathname !== location.pathname || a.search !== location.search) return;
    if (hiddenTarget(a.hash)) apply('all');
  });
  // Back, Forward or a typed #tables: the same, then scroll there ourselves.
  addEventListener('hashchange', () => {
    const t = hiddenTarget(location.hash);
    if (!t) return;
    apply('all');
    t.scrollIntoView();
  });

  // Back from a game page: put the last choice back, without announcing it.
  // (Not undone for a hash in the address: this is the view the player left.)
  const saved = readState()[key];
  if (saved && saved !== 'all') apply(saved, { remember: false });
}

export function startLobby(doc = document) {
  const roots = [...doc.querySelectorAll('[data-lobby]')].filter((r) => r.querySelector('[data-filters]'));
  // A filter bar outside any [data-lobby] filters every lobby tile on the page.
  if (!roots.length && doc.querySelector('[data-filters]')) roots.push(doc.body);
  roots.forEach((root, i) => setup(root, `${location.pathname}#${i}`));
}
