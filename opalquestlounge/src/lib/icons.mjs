// Line icons for the site: 24 × 24, stroked in currentColor at 2–2.6px.
//
// Most icons are symbols in the inline sprite (SPRITE in art.mjs, written
// once at the top of every page by layout()), drawn here with <use>. The few
// the sprite doesn't have are inline SVG in the same style. Size them in CSS;
// the width and height attributes are only a fallback.
//
// No style="" anywhere: the CSP blocks inline styles, including inside SVG.

/** A sprite symbol by id, e.g. icon('i-gear') or icon('opal', 'brand__opal'). */
export const icon = (id, cls = '') =>
  `<svg class="icon${cls ? ` ${cls}` : ''}" width="24" height="24" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;

const line = (body, cls = '') =>
  `<svg class="icon${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  // ---- sprite symbols (art.mjs) ----
  gem: icon('i-gem'), //          balance disc: white gem, ink lines (fixed colours)
  clockDisc: icon('i-clock'), //  session disc: white face, ink lines (fixed colours)
  gear: icon('i-gear'), //        settings
  play: icon('i-play'), //        yellow triangle for the Play disc (fixed colour)
  info: icon('i-info'),
  arrow: icon('i-arrow'),
  back: icon('i-back'),
  chev: icon('i-chev'),
  phone: icon('i-phone'),
  home: icon('i-home'),
  reels: icon('i-reels'), //      slots
  cards: icon('i-cards'), //      table games
  shield: icon('i-shield'), //    safer play
  timer: icon('i-timer'), //      time limit
  pause: icon('i-pause'), //      breaks
  bell: icon('i-bell'), //        reality checks
  check: icon('i-check'), //      self-check list
  close: icon('i-close'),
  full: icon('i-full'), //        fullscreen
  tick: icon('i-tick'), //        cyan tick disc (fixed colours)
  tumble: icon('i-tumble'),
  orb: icon('i-orb'),
  spins: icon('i-spins'),
  plus: icon('i-plus'),
  book: icon('i-book'), //        rules
  alert: icon('i-alert'),
  external: icon('i-ext'),
  wheel: icon('i-wheel'), //      roulette
  opal: icon('opal'), //          the brand mark

  // ---- inline, same style (not in the sprite) ----
  clock: line('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  sliders: line('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  arrowDown: line('<path d="M12 4v15M6 13l6 6 6-6"/>'),
  sound: line('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mail: line('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4.5 7l7.5 6 7.5-6"/>'),
  loupe: line('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
  calendar: line('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),

  // ---- earlier names, kept so existing templates keep working ----
  lounge: icon('i-home'), //      was the cabochon "lounge" mark
  cabinet: icon('i-reels'), //    was the specimen cabinet (the games)
};
