// Line icons drawn for the site: 24 × 24, stroked in currentColor.
const svg = (body, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  // A cabochon seen from the side, on a plinth: the lounge.
  lounge: svg('<path d="M4 17h16"/><path d="M6 17c0-4 2.7-7 6-7s6 3 6 7"/><path d="M9.5 12.5l1.5 1.5M13 11.5l2 2.5"/><path d="M3 20h18"/>'),
  // Specimen cabinet with three drawers: the games.
  cabinet: svg('<rect x="4" y="3.5" width="16" height="17" rx=".5"/><path d="M4 9.2h16M4 14.8h16"/><path d="M10.5 6.3h3M10.5 12h3M10.5 17.6h3"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.25"/><path d="M12 7.5V12l3 2"/>'),
  sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  arrow: svg('<path d="M4 12h15M14 7l5 5-5 5"/>'),
  arrowDown: svg('<path d="M12 4v15M7 14l5 5 5-5"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  info: svg('<circle cx="12" cy="12" r="8.25"/><path d="M12 11v5"/><path d="M12 7.6v.4"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  phone: svg('<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2.5 2.5 0 0 1 17.5 20 14 14 0 0 1 4 6.5 2.5 2.5 0 0 1 6.5 4z"/>'),
  mail: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="1"/><path d="M4 6.5l8 6 8-6"/>'),
  pause: svg('<circle cx="12" cy="12" r="8.25"/><path d="M10 9v6M14 9v6"/>'),
  loupe: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/><path d="M8 9.5a3 3 0 0 1 2.5-2"/>'),
};
