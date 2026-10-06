// Artwork for the site: the shared SVG sprite, the Gates of Olympus stage
// art and one cover motif per game. Everything is our own drawing. There are
// no characters, animals or faces, and no Pragmatic Play artwork.

export const SPRITE = `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id="opal-clip"><path d="M24 4c10 0 17 9 17 20s-7 20-17 20S7 35 7 24 14 4 24 4z"/></clipPath>
    <radialGradient id="g-ball" cx="38%" cy="34%" r="70%"><stop offset="0" stop-color="#E9FBFF"/><stop offset=".45" stop-color="#3DD6FF"/><stop offset="1" stop-color="#8B3CF0"/></radialGradient>
    <radialGradient id="g-gate" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="#FFFBD6"/><stop offset=".55" stop-color="#FFE11A"/><stop offset="1" stop-color="#FF9A1F"/></radialGradient>
    <pattern id="p-dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.25" fill="#18122B" opacity=".35"/></pattern>
    <symbol id="burst-b" viewBox="0 0 100 100"><polygon points="50.0,3.0 56.2,11.2 65.6,2.0 68.0,14.6 78.7,10.4 77.9,22.1 91.0,20.2 85.5,31.9 95.0,35.4 89.5,43.7 100.6,50.0 90.0,56.3 94.9,64.6 85.9,68.3 89.8,78.9 77.5,77.5 79.6,90.7 68.4,86.1 65.5,97.6 56.1,88.7 50.0,96.5 43.8,89.1 34.6,97.5 31.7,85.9 20.8,90.2 22.0,78.0 12.0,77.6 13.9,68.4 6.5,64.1 9.9,56.3 2.0,50.0 10.4,43.7 5.6,35.6 14.2,31.8 13.4,23.4 21.9,21.9 22.4,12.0 32.4,15.4 35.3,4.6 43.9,11.3" class="burst-shape burst-shape--heavy" vector-effect="non-scaling-stroke"/></symbol>
    <symbol id="burst-c" viewBox="0 0 100 100"><polygon points="50.0,1.1 59.5,17.6 75.3,10.6 74.3,28.9 92.2,30.7 83.2,45.2 95.8,56.6 79.7,63.6 87.6,82.6 67.7,77.5 63.7,96.7 50.0,83.7 35.7,98.6 32.1,77.8 14.6,80.7 20.1,63.7 2.8,56.8 17.2,45.3 7.6,30.6 24.6,28.0 25.2,11.5 40.5,17.8" class="burst-shape" vector-effect="non-scaling-stroke"/></symbol>

    <symbol id="i-gem" viewBox="0 0 24 24"><path d="M5 9l3-5h8l3 5-7 11z" fill="#FFFFFF" stroke="#18122B" stroke-width="2" stroke-linejoin="round"/><path d="M5 9h14M9.5 9L12 20l2.5-11M8 4l1.5 5M16 4l-1.5 5" fill="none" stroke="#18122B" stroke-width="1.6" stroke-linejoin="round"/></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="#FFFFFF" stroke="#18122B" stroke-width="2.2"/><path d="M12 7.5V12l3 2" fill="none" stroke="#18122B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-gear" viewBox="0 0 24 24"><path d="M10.3 3h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9L6 12.9V11L4.2 9.4l1.7-2.9 2.3.8 1.6-.9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
    <symbol id="i-play" viewBox="0 0 24 24"><path d="M6 3.5v17l14-8.5z" fill="#FFE11A"/></symbol>
    <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.4" fill="currentColor"/></symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-back" viewBox="0 0 24 24"><path d="M20 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-phone" viewBox="0 0 24 24"><path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></symbol>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="M3.5 11L12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-reels" viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8.8 5v14M15.2 5v14" stroke="currentColor" stroke-width="2"/><circle cx="5.7" cy="12" r="1.5" fill="currentColor"/><path d="M12 10.2l1.6 1.8-1.6 1.8-1.6-1.8z" fill="currentColor"/><rect x="17" y="10.6" width="3" height="2.8" rx=".6" fill="currentColor"/></symbol>
    <symbol id="i-cards" viewBox="0 0 24 24"><rect x="3" y="6" width="11" height="15" rx="2" transform="rotate(-10 8.5 13.5)" fill="none" stroke="currentColor" stroke-width="2.1"/><rect x="10" y="4" width="11" height="15" rx="2" transform="rotate(8 15.5 11.5)" fill="none" stroke="currentColor" stroke-width="2.1"/><path d="M15.7 8.6l1.8 2.4-1.8 2.4-1.8-2.4z" fill="currentColor"/></symbol>
    <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-timer" viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 9.5V13h3M9.5 2.8h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
    <symbol id="i-pause" viewBox="0 0 24 24"><rect x="5.5" y="4.5" width="4.5" height="15" rx="1.4" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="14" y="4.5" width="4.5" height="15" rx="1.4" fill="none" stroke="currentColor" stroke-width="2.2"/></symbol>
    <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
    <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></symbol>
    <symbol id="i-full" viewBox="0 0 24 24"><path d="M4 9.5V4h5.5M14.5 4H20v5.5M20 14.5V20h-5.5M9.5 20H4v-5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-tick" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#00AEEF" stroke="#18122B" stroke-width="2"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#18122B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-tumble" viewBox="0 0 24 24"><path d="M12 3v10M7.5 8.5L12 13l4.5-4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="4.5" y="16" width="15" height="5" rx="1.6" fill="none" stroke="currentColor" stroke-width="2.2"/></symbol>
    <symbol id="i-orb" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
    <symbol id="i-spins" viewBox="0 0 24 24"><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
    <symbol id="i-book" viewBox="0 0 24 24"><path d="M3.5 5.5c3-1.2 5.8-1 8.5.8 2.7-1.8 5.5-2 8.5-.8V19c-3-1.2-5.8-1-8.5.8-2.7-1.8-5.5-2-8.5-.8zM12 6.3v13.5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/></symbol>
    <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 3.5l9.5 16.5h-19z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.3" fill="currentColor"/></symbol>
    <symbol id="i-ext" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-wheel" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21M5.6 5.6l4 4M14.4 14.4l4 4M18.4 5.6l-4 4M9.6 14.4l-4 4" stroke="currentColor" stroke-width="1.8"/></symbol>

    <symbol id="opal" viewBox="0 0 48 48">
      <g clip-path="url(#opal-clip)">
        <rect width="48" height="48" fill="#00AEEF"/>
        <path d="M0 16L21 6l14 13-19 10z" fill="#FF2E93"/>
        <path d="M24 29l24-8v20l-18 7z" fill="#FFE11A"/>
        <path d="M2 34l15-4 5 18H0z" fill="#FF4A3D"/>
        <path d="M30 4l18 2v10l-13 3z" fill="#13C08B"/>
        <rect width="48" height="48" fill="url(#p-dots)"/>
      </g>
      <path d="M24 4c10 0 17 9 17 20s-7 20-17 20S7 35 7 24 14 4 24 4z" fill="none" stroke="#18122B" stroke-width="3"/>
      <path d="M14 17c1.5-4.5 4.5-7 8.5-8" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M40 4l1.3 3.2 3.2 1.3-3.2 1.3L40 13l-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#FFE11A" stroke="#18122B" stroke-width="1.4" stroke-linejoin="round"/>
    </symbol>
  </defs>
</svg>`;

// Gates of Olympus, drawn for the 16:10 stage (viewBox 640 x 400)
export const STAGE_OLYMPUS = `<svg class="stage__art" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <rect x="266" y="150" width="108" height="170" fill="url(#g-gate)"/>
  <g class="ink" fill="#FFF5E1">
    <polygon points="150,126 320,58 490,126"/>
    <rect x="138" y="126" width="364" height="24" rx="3"/>
    <rect x="170" y="150" width="34" height="170"/><rect x="224" y="150" width="34" height="170"/>
    <rect x="382" y="150" width="34" height="170"/><rect x="436" y="150" width="34" height="170"/>
    <rect x="120" y="318" width="400" height="16" rx="2"/><rect x="96" y="334" width="448" height="18" rx="2"/>
  </g>
  <path class="ink-t" fill="none" d="M181 158v152M193 158v152M235 158v152M247 158v152M393 158v152M405 158v152M447 158v152M459 158v152"/>
  <polygon class="ink" points="338,150 292,236 322,236 300,318 372,212 338,212 360,150" fill="#FFE11A"/>
  <g class="ink" fill="#FFF5E1">
    <path d="M-10 400v-44c0-16 22-24 34-12 6-22 40-26 52-6 16-10 38 0 36 20 18 0 26 22 12 42z"/>
    <path d="M650 400v-50c0-14-18-22-30-12-6-20-38-24-50-6-16-8-36 4-34 22-18 2-24 24-10 46z"/>
  </g>
  <g class="ink">
    <path d="M70 176l16-18h28l16 18-30 38z" fill="#3DD6FF"/>
    <path d="M70 176h60M92 158l-6 18 14 38 14-38-6-18" fill="none" stroke-width="2.5"/>
    <path d="M540 196l14-16h24l14 16-26 32z" fill="#FF4A3D"/>
    <path d="M540 196h52M560 180l-5 16 11 32 11-32-5-16" fill="none" stroke-width="2.5"/>
    <path d="M568 96l12 12-12 18-12-18z" fill="#13C08B"/>
    <path d="M50 280l10 10-10 15-10-15z" fill="#FFE11A"/>
  </g>
  <g fill="#FFF5E1">
    <path d="M110 44l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/>
    <path d="M530 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>
    <path d="M596 292l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>
  </g>
</svg>`;

// A single-zero wheel of 18 wedges with a gem hub, reused by the tile cover and the table panel
const WEDGES = (() => {
  const out = [];
  const cx = 100, cy = 78, R = 58, r = 34, n = 18;
  const pt = (rad, a) => [(cx + rad * Math.sin(a)).toFixed(1), (cy - rad * Math.cos(a)).toFixed(1)];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI;
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
    const fill = i === 0 ? '#13C08B' : i % 2 ? '#FF4A3D' : '#18122B';
    out.push(`<path d="M${x0},${y0} A${R} ${R} 0 0 1 ${x1},${y1} L${x2},${y2} A${r} ${r} 0 0 0 ${x3},${y3}Z" fill="${fill}"/>`);
  }
  return out.join('');
})();
export const WHEEL = `<circle class="ink" cx="100" cy="78" r="66" fill="#FFC21A"/>
  <g stroke="#18122B" stroke-width="1.5" stroke-linejoin="round">${WEDGES}</g>
  <circle cx="100" cy="78" r="58" fill="none" stroke="#18122B" stroke-width="3.5"/>
  <circle class="ink" cx="100" cy="78" r="34" fill="#FFE11A"/>
  <polygon class="ink-t" points="100,56 115.6,62.4 122,78 115.6,93.6 100,100 84.4,93.6 78,78 84.4,62.4" fill="#3DD6FF"/>
  <polygon class="ink-t" points="100,68 107,71 110,78 107,85 100,88 93,85 90,78 93,71" fill="#C9F4FF"/>
  <path class="ink-t" d="M100 56v12M122 78h-12M100 100V88M78 78h12" fill="none"/>
  <circle class="ink-t" cx="107.5" cy="24" r="5" fill="#FFFFFF"/>`;

const star = (x, y, s, fill, cls = '') => {
  const k = +(s * 0.3).toFixed(2), m = +(s - k).toFixed(2);
  return `<path${cls ? ` class="${cls}"` : ''} d="M${x} ${y - s}l${k} ${m} ${m} ${k}-${m} ${k}-${k} ${m}-${k}-${m}-${m}-${k} ${m}-${k}z" fill="${fill}"/>`;
};

// Motifs drawn twice: once for the 4:3 tile, whose lettering sits at the
// bottom, and once for the 16:10 stage, whose lettering sits at the top and
// whose Play button covers the lower middle (src/lib/ui/stage.mjs).
const BONANZA_FLOAT = (sun) => `<circle class="ink" ${sun} fill="#FFE11A"/>
      <path d="M100 0v56" stroke="#18122B" stroke-width="2.5"/>
      <rect class="ink" x="95" y="40" width="10" height="20" rx="3" fill="#FFF5E1"/>
      <path class="ink" d="M68 90a32 32 0 0 1 64 0z" fill="#FF4A3D"/>
      <path class="ink" d="M68 90a32 32 0 0 0 64 0z" fill="#FFF5E1"/>
      <rect class="ink-t" x="66" y="85" width="68" height="10" rx="3" fill="#FFE11A"/>
      <path class="ink" d="M-4 108q13-9 26 0t26 0 26 0 26 0 26 0 26 0 26 0 26 0V150H-4z" fill="#0A4FA0"/>
      <path d="M48 118q26 8 52 0t52 0" fill="none" stroke="#FFF5E1" stroke-width="3" stroke-linecap="round"/>
      <g fill="none" stroke="#FFF5E1" stroke-width="2.5"><circle cx="160" cy="70" r="6"/><circle cx="172" cy="50" r="4"/><circle cx="150" cy="44" r="3"/></g>`;

const SHERIFF_STAR = (place) => {
  const badge = `<polygon class="ink" points="100,24 112,52 144,50 124,76 144,102 112,100 100,128 88,100 56,102 76,76 56,50 88,52" fill="#FFE11A"/>
      <g class="ink-t" fill="#FFE11A"><circle cx="100" cy="22" r="6"/><circle cx="146" cy="49" r="6"/><circle cx="146" cy="103" r="6"/><circle cx="100" cy="130" r="6"/><circle cx="54" cy="103" r="6"/><circle cx="54" cy="49" r="6"/></g>
      <circle class="ink-t" cx="100" cy="76" r="18" fill="#FFC21A"/>
      <circle cx="100" cy="76" r="9" fill="none" stroke="#18122B" stroke-width="2.5" stroke-dasharray="3 3"/>`;
  return `<circle class="ink" cx="170" cy="26" r="14" fill="#FFE11A"/>
      <path class="ink" d="M26 146V120H18a8 8 0 0 1-8-8V100a5 5 0 0 1 10 0v10h6V92a7 7 0 0 1 14 0v14h4v-8a5 5 0 0 1 10 0v12a8 8 0 0 1-8 8h-6V146z" fill="#2BB673"/>
      <path class="ink" transform="translate(200 0) scale(-1 1)" d="M26 146V120H18a8 8 0 0 1-8-8V100a5 5 0 0 1 10 0v10h6V92a7 7 0 0 1 14 0v14h4v-8a5 5 0 0 1 10 0v12a8 8 0 0 1-8 8h-6V146z" fill="#2BB673"/>
      ${place ? `<g transform="${place}">${badge}</g>` : badge}`;
};

const BUFFALO_CROWN = (sun) => `<circle class="ink" ${sun} fill="#FFE11A"/>
      ${star(30, 24, 9, '#FFF5E1')}<circle cx="54" cy="52" r="2.5" fill="#FFF5E1"/><circle cx="136" cy="16" r="2" fill="#FFF5E1"/>
      <path class="ink" d="M-4 116q30-18 64-8t70-6 74 8V152H-4z" fill="#7A1650"/>
      <path class="ink" d="M-4 132q40-12 80-2t80-2 48 2V152H-4z" fill="#4A0B33"/>
      <path class="ink" d="M58 94L50 46l26 22 24-34 24 34 26-22-8 48z" fill="#FFE11A"/>
      <rect class="ink" x="55" y="92" width="90" height="16" rx="3" fill="#FFB21A"/>
      <g class="ink-t"><circle cx="50" cy="44" r="6" fill="#3DD6FF"/><circle cx="100" cy="32" r="7" fill="#FF4FB0"/><circle cx="150" cy="44" r="6" fill="#3DD6FF"/></g>
      <path class="ink-t" d="M100 94l7 6-7 6-7-6z" fill="#13C08B"/><circle class="ink-t" cx="76" cy="100" r="3.5" fill="#FF4A3D"/><circle class="ink-t" cx="124" cy="100" r="3.5" fill="#FF4A3D"/>`;

const OLYMPUS_1000 = (plaque) => `<g class="ink" fill="#FFF5E1"><rect x="10" y="30" width="16" height="84"/><rect x="174" y="30" width="16" height="84"/><rect x="4" y="22" width="28" height="9" rx="2"/><rect x="168" y="22" width="28" height="9" rx="2"/></g>
      <path class="ink-t" d="M16 36v72M20 36v72M180 36v72M184 36v72" fill="none"/>
      <polygon class="ink" points="112,0 70,70 96,70 76,142 138,52 110,52 132,0" fill="#FFE11A"/>
      <g transform="${plaque}">
        <rect class="ink" x="34" y="64" width="132" height="46" rx="7" fill="#18122B"/>
        <text class="cover__num" x="103" y="104" text-anchor="middle" font-size="44" fill="#FF2E93">1000</text>
        <text class="cover__num" x="100" y="101" text-anchor="middle" font-size="44" fill="#FFE11A">1000</text>
      </g>
      <g class="ink-t"><path d="M40 30l6-7h11l6 7-12 14z" fill="#3DD6FF"/><path d="M144 30l6-7h11l6 7-12 14z" fill="#13C08B"/></g>
      ${star(64, 16, 7, '#FFF5E1')}${star(158, 128, 7, '#FFF5E1')}`;

const SPLASH_FLOAT = (sun) => `<circle class="ink" ${sun} fill="#FFE11A"/>
      ${star(30, 26, 8, '#FFF5E1')}<circle cx="62" cy="16" r="2.4" fill="#FFF5E1"/>
      <path class="ink" d="M-4 96q13-8 26 0t26 0 26 0 26 0 26 0 26 0 26 0 26 0V150H-4z" fill="#0A4FA0"/>
      <g fill="none" stroke="#FFF5E1" stroke-linecap="round"><ellipse cx="100" cy="106" rx="76" ry="13" stroke-width="3"/><ellipse cx="100" cy="104" rx="52" ry="9" stroke-width="3.5"/><ellipse cx="100" cy="102" rx="30" ry="6" stroke-width="4"/></g>
      <g class="ink-t" fill="#FFF5E1">
        <path d="M62 66q-8-10-4-18q8 6 4 18z"/><path d="M138 66q8-10 4-18q-8 6-4 18z"/>
        <path d="M48 84q-12-4-14-12q10 0 14 12z"/><path d="M152 84q12-4 14-12q-10 0-14 12z"/>
      </g>
      <g transform="rotate(10 100 80)">
        <rect class="ink" x="95" y="34" width="10" height="22" rx="3" fill="#FFF5E1"/>
        <path class="ink" d="M78 80a22 22 0 0 1 44 0z" fill="#FF4A3D"/>
        <path class="ink" d="M78 80a22 22 0 0 0 44 0z" fill="#FFF5E1"/>
        <rect class="ink-t" x="76" y="76" width="48" height="9" rx="3" fill="#FFE11A"/>
        <path d="M86 68a14 14 0 0 1 8-6" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
      </g>`;

// One entry per game: gradient pair (c1, c2), lettering fill (tf), tile shadow
// accent at night (acc), and optionally a stage variant of the motif:
// stage: { dy, art }, where dy moves the motif down (SVG units of the 200 × 150
// drawing) and art replaces it. Only the stage reads it; tiles use `art`.
export const COVERS = {
  'gates-of-olympus': {
    c1: '#5B2BD6', c2: '#E0288F', tf: 'gold', acc: '#FF4FB0',
    art: `<g class="ink" fill="#FFF5E1"><polygon points="46,44 100,16 154,44"/><rect x="40" y="44" width="120" height="11" rx="2"/><rect x="50" y="55" width="20" height="64"/><rect x="130" y="55" width="20" height="64"/><rect x="36" y="119" width="128" height="10" rx="2"/></g>
      <path class="ink-t" d="M57 60v54M63 60v54M137 60v54M143 60v54" fill="none"/>
      <polygon class="ink" points="108,54 82,96 98,96 88,134 124,82 106,82 118,54" fill="#FFE11A"/>
      <g class="ink"><path d="M14 40l8-9h14l8 9-15 19z" fill="#3DD6FF"/><path d="M166 76l7-8h12l7 8-13 16z" fill="#FF4A3D"/></g>
      ${star(178, 26, 8, '#FFF5E1')}`,
    title: `<small>Gates of</small><span class="toon" data-text="Olympus">Olympus</span>`,
  },
  'big-bass-bonanza': {
    c1: '#26C6F5', c2: '#0A62C4', tf: 'gold', acc: '#3DD6FF',
    art: BONANZA_FLOAT('cx="36" cy="32" r="16"'),
    // the float's top clears BONANZA, and the sun moves out from behind its B
    stage: { dy: 6, art: BONANZA_FLOAT('cx="16" cy="24" r="12"') },
    title: `<small>Big Bass</small><span class="toon" data-text="Bonanza">Bonanza</span>`,
  },
  'wolf-gold': {
    c1: '#FF9A1F', c2: '#8A2BA6', tf: 'gold', acc: '#FF9A1F',
    art: `<circle class="ink" cx="66" cy="52" r="38" fill="#FFE11A"/>
      <g class="ink-t" fill="#FFC21A"><circle cx="52" cy="42" r="8"/><circle cx="80" cy="64" r="6"/><circle cx="76" cy="34" r="4"/></g>
      <g fill="#FFF5E1">${star(150, 30, 8, '#FFF5E1')}<circle cx="178" cy="52" r="2.5"/><circle cx="124" cy="46" r="2"/></g>
      <path class="ink" d="M-4 150V100h26l8-16h32l10 16h20V150z" fill="#4A1F70"/>
      <path class="ink" d="M104 150V94l10-14h44l8 14h38V150z" fill="#2E1450"/>
      <path class="ink" d="M104 144l6-15h34l6 15z" fill="#FFB21A"/><path class="ink" d="M148 144l6-15h34l6 15z" fill="#FFB21A"/><path class="ink" d="M126 129l6-15h34l6 15z" fill="#FFE11A"/>
      <path d="M136 120h24M114 135h24M158 135h24" stroke="#FFF5E1" stroke-width="3" stroke-linecap="round"/>`,
    title: `<span class="toon" data-text="Wolf Gold">Wolf Gold</span>`,
  },
  'great-rhino-megaways': {
    c1: '#FFD21A', c2: '#FF6B1F', tf: 'cream', acc: '#FFD21A', rib: '#FFE11A',
    art: `<circle class="ink" cx="82" cy="72" r="44" fill="#FF4A3D"/>
      <g stroke="#FF9A1F" stroke-width="5"><path d="M40 90h84M44 102h76M52 113h60"/></g>
      <circle cx="82" cy="72" r="44" fill="none" stroke="#18122B" stroke-width="4"/>
      <path class="ink" d="M-4 124q34-16 70-6t72-8 66 6V150H-4z" fill="#B8420F"/>
      <path d="M146 144c2-16 1-26-6-36M148 144c1-14 4-24 14-34M146 124l-14-10" fill="none" stroke="#18122B" stroke-width="5" stroke-linecap="round"/>
      <path d="M114 106q20-16 44-12q16-8 34 2q6 6-4 10q-38 6-72 4q-8-2-2-4z" fill="#18122B"/>
      <rect x="-4" y="140" width="208" height="12" fill="#18122B"/>`,
    title: `<span class="toon" data-text="Great Rhino">Great Rhino</span><br><span class="rib">Megaways</span>`,
    size: '11.5cqi',
  },
  'madame-destiny-megaways': {
    c1: '#4A25B8', c2: '#1B0E5A', tf: 'ice', acc: '#9B7BFF', rib: '#FF4FB0',
    art: `<path class="ink" d="M70 118h60l12 22H58z" fill="#FFC21A"/>
      <circle class="ink" cx="100" cy="72" r="46" fill="url(#g-ball)"/>
      <ellipse cx="100" cy="80" rx="38" ry="11" transform="rotate(-16 100 80)" fill="none" stroke="#FF2E93" stroke-width="5"/>
      ${star(112, 94, 8, '#FFFFFF')}
      <path d="M72 56a32 32 0 0 1 20-18" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
      ${star(30, 36, 10, '#FFE11A', 'ink-t')}${star(170, 46, 8, '#FFE11A', 'ink-t')}${star(162, 112, 7, '#FFE11A', 'ink-t')}`,
    title: `<small>Madame</small><span class="toon" data-text="Destiny">Destiny</span><br><span class="rib">Megaways</span>`,
    size: '11.5cqi',
  },
  'zeus-vs-hades-gods-of-war': {
    c1: '#2A8CFF', c2: '#0A2C8A', tf: 'gold', acc: '#5AA9FF', rib: '#FF6A4D',
    art: `<path d="M116 -2H204V152H84z" fill="#D7263D"/>
      <path d="M116 -2L84 152" fill="none" stroke="#18122B" stroke-width="4"/>
      <polygon class="ink" points="60,8 30,66 50,66 38,116 84,48 62,48 78,8" fill="#FFE11A"/>
      <path class="ink" d="M150 116c-21 0-33-15-30-32 2-13 12-19 12-33 10 7 15 17 13 28 6-3 9-10 9-17 12 11 18 25 16 37-2 11-9 17-20 17z" fill="#FF9A1F"/>
      <path class="ink-t" d="M150 110c-9 0-14-7-12-15 1-6 6-9 7-16 7 6 9 11 8 16 3-1 5-4 5-8 6 6 8 12 7 16-1 5-6 7-15 7z" fill="#FFE11A"/>
      ${star(24, 24, 7, '#FFF5E1')}<circle cx="178" cy="30" r="3" fill="#FFD0A0"/><circle cx="126" cy="22" r="2.2" fill="#FFD0A0"/>`,
    title: `<span class="toon" data-text="Zeus vs Hades">Zeus vs Hades</span><br><span class="rib">Gods of War</span>`,
    size: '11cqi',
  },
  'wild-west-gold': {
    c1: '#FFB347', c2: '#D2561B', tf: 'cream', acc: '#FFB347',
    art: SHERIFF_STAR(),
    // a smaller star, lower down, so its top point clears GOLD
    stage: { art: SHERIFF_STAR('translate(100 94) scale(.8) translate(-100 -76)') },
    title: `<small>Wild West</small><span class="toon" data-text="Gold">Gold</span>`,
  },
  'buffalo-king-megaways': {
    c1: '#E8364F', c2: '#6A1248', tf: 'gold', acc: '#FF6A4D', rib: '#FFE11A',
    art: BUFFALO_CROWN('cx="164" cy="30" r="16"'),
    // the crown's top jewel clears the lettering, and the sun moves out from under KING
    stage: { dy: 14, art: BUFFALO_CROWN('cx="180" cy="30" r="14"') },
    title: `<span class="toon" data-text="Buffalo King">Buffalo King</span><br><span class="rib">Megaways</span>`,
    size: '11.5cqi',
  },
  // The bolt again, struck through a plaque that reads 1000.
  'gates-of-olympus-1000': {
    c1: '#FF3FA4', c2: '#6B21C8', tf: 'gold', acc: '#FF6FC0',
    art: OLYMPUS_1000('rotate(-5 100 86)'),
    // the plaque lifted, so "1000" (what tells this game from Gates of Olympus) clears the phone Play button
    stage: { art: OLYMPUS_1000('translate(0 -18) rotate(-5 100 86)') },
    title: `<small>Gates of</small><span class="toon" data-text="Olympus">Olympus</span>`,
  },
  // A slice of watermelon and a cherry pair. No faces.
  'fruit-party': {
    c1: '#18CFC4', c2: '#0B5E8E', tf: 'gold', acc: '#3DE0D6',
    art: `${star(176, 22, 9, '#FFF5E1')}<circle cx="24" cy="24" r="2.6" fill="#FFF5E1"/><circle cx="124" cy="14" r="2.2" fill="#FFF5E1"/>
      <g transform="rotate(-14 74 50)">
        <path class="ink" d="M24 50a50 50 0 0 0 100 0z" fill="#1E9E4A"/>
        <path d="M31 50a43 43 0 0 0 86 0z" fill="#FFF5E1"/>
        <path class="ink-t" d="M36 50a38 38 0 0 0 76 0z" fill="#FF3D5A"/>
        <path d="M24 50h100" stroke="#18122B" stroke-width="4" stroke-linecap="round"/>
        <g fill="#18122B"><ellipse cx="58" cy="64" rx="2.4" ry="4" transform="rotate(20 58 64)"/><ellipse cx="74" cy="72" rx="2.4" ry="4"/><ellipse cx="90" cy="64" rx="2.4" ry="4" transform="rotate(-20 90 64)"/><ellipse cx="66" cy="80" rx="2.4" ry="4" transform="rotate(12 66 80)"/><ellipse cx="82" cy="80" rx="2.4" ry="4" transform="rotate(-12 82 80)"/></g>
      </g>
      <path d="M134 90q0-30 20-52M160 86q2-28-6-48" fill="none" stroke="#18122B" stroke-width="4" stroke-linecap="round"/>
      <path class="ink-t" d="M154 38q16-14 30-4q-14 14-30 4z" fill="#2BB673"/>
      <circle class="ink" cx="132" cy="100" r="15" fill="#E0263C"/>
      <circle class="ink" cx="162" cy="96" r="15" fill="#E0263C"/>
      <path d="M125 94a8 8 0 0 1 6-5M155 90a8 8 0 0 1 6-5" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`,
    title: `<span class="toon" data-text="Fruit Party">Fruit Party</span>`,
  },
  // A float bobbing in rings of splash ripples.
  'big-bass-splash': {
    c1: '#8A5CFF', c2: '#0E6CC4', tf: 'gold', acc: '#A487FF',
    art: SPLASH_FLOAT('cx="164" cy="30" r="15"'),
    // the float's stem clears SPLASH, and the sun moves off its H
    stage: { dy: 6, art: SPLASH_FLOAT('cx="178" cy="40" r="12"') },
    title: `<small>Big Bass</small><span class="toon" data-text="Splash">Splash</span>`,
  },
  // Our own slot (shown only when the Pragmatic demos are switched off): a
  // faceted crystal point between two smaller ones, with an opal at its foot.
  'seven-systems': {
    c1: '#FF4FB0', c2: '#7A1FA8', tf: 'gold', acc: '#FF4FB0', ours: true,
    art: `${star(30, 24, 9, '#FFF5E1')}${star(172, 30, 7, '#FFF5E1')}<circle cx="152" cy="12" r="2.4" fill="#FFF5E1"/>
      <g transform="rotate(-24 52 92)">
        <polygon class="ink" points="52,48 64,62 64,112 40,112 40,62" fill="#B58BFF"/>
        <path class="ink-t" d="M52 48v64M40 62l12 6 12-6" fill="none"/>
        <polygon points="52,48 40,62 52,68" fill="#E6DAFF"/>
      </g>
      <g transform="rotate(22 150 92)">
        <polygon class="ink" points="150,50 162,64 162,112 138,112 138,64" fill="#FFC21A"/>
        <path class="ink-t" d="M150 50v62M138 64l12 6 12-6" fill="none"/>
        <polygon points="150,50 138,64 150,70" fill="#FFF3A6"/>
      </g>
      <polygon points="78,36 100,50 100,122 78,110" fill="#C9F4FF"/>
      <polygon points="100,50 122,36 122,110 100,122" fill="#3DD6FF"/>
      <polygon points="100,6 78,36 100,50" fill="#FFFFFF"/>
      <polygon points="100,6 122,36 100,50" fill="#8FE6FF"/>
      <path class="ink-t" d="M78 36l22 14 22-14M100 50v72" fill="none"/>
      <polygon class="ink" points="100,6 122,36 122,110 100,122 78,110 78,36" fill="none"/>
      <path d="M86 44v50" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="100" cy="126" rx="26" ry="14" fill="#00AEEF"/>
      <path d="M78 122q10-10 22-6-4 8-22 6z" fill="#FF2E93"/><path d="M104 116q14-2 20 8-12 2-20-8z" fill="#FFE11A"/><path d="M92 132q8-6 18 0-8 6-18 0z" fill="#13C08B"/>
      <ellipse class="ink" cx="100" cy="126" rx="26" ry="14" fill="none"/>
      <path d="M84 120q6-5 14-5" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`,
    title: `<small>Seven</small><span class="toon" data-text="Systems">Systems</span>`,
  },
  'lapidary-wheel': {
    c1: '#18CF96', c2: '#067A5E', tf: 'gold', acc: '#18CF96', ours: true,
    art: WHEEL,
    title: `<small>Lapidary</small><span class="toon" data-text="Wheel">Wheel</span>`,
  },
  'brilliant-twenty-one': {
    c1: '#1CB8F2', c2: '#1740B8', tf: 'gold', acc: '#3DD6FF', ours: true,
    art: `<g transform="rotate(-12 82 82)"><rect class="ink" x="50" y="34" width="64" height="90" rx="8" fill="#FFFFFF"/>
        <text x="60" y="62" font-family="Archivo, sans-serif" font-weight="900" font-size="24" fill="#C8102E">A</text>
        <path class="ink-t" d="M82 70l12 16-12 16-12-16z" fill="#FF4A3D"/></g>
      <g transform="rotate(10 124 82)"><rect class="ink" x="90" y="36" width="64" height="90" rx="8" fill="#FFFFFF"/>
        <text x="100" y="64" font-family="Archivo, sans-serif" font-weight="900" font-size="24" fill="#18122B">K</text>
        <path class="ink-t" d="M106 84l7-8h22l7 8-18 22z" fill="#3DD6FF"/>
        <path d="M106 84h36M118 76l-3 8 9 22 9-22-3-8" fill="none" stroke="#18122B" stroke-width="1.6" stroke-linejoin="round"/></g>
      ${star(30, 40, 10, '#FFE11A', 'ink-t')}`,
    // A plain hyphen kept on one line by .nobr (the fonts have no U+2011).
    title: `<small>Brilliant</small><span class="toon nobr" data-text="Twenty-One">Twenty-One</span>`,
    size: '9.8cqi',
  },
};

/**
 * A cover for a game that has no drawing of its own yet (a new entry in
 * pragmatic-games.json, say): a cut gem on the default violet-to-magenta
 * ground, with the game's name as the lettering. Draw a proper one in
 * COVERS using the recipe in the spec (section 10).
 */
export function coverFor(slug, name = '') {
  if (COVERS[slug]) return COVERS[slug];
  const text = String(name).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return {
    c1: '#5B2BD6', c2: '#E0288F', tf: 'gold', acc: '#FF4FB0', generic: true,
    art: `<path class="ink" d="M62 52l16-22h44l16 22-38 54z" fill="#3DD6FF"/>
      <path class="ink-t" d="M62 52h76M88 30l-8 22 20 54 20-54-8-22" fill="none"/>
      ${star(40, 30, 9, '#FFF5E1')}${star(164, 84, 8, '#FFF5E1')}`,
    title: `<span class="toon" data-text="${text}">${text}</span>`,
  };
}

/**
 * CSS rules carrying each cover's colours. The site's CSP (style-src 'self')
 * blocks inline style attributes, so the build appends these to site.css.
 * Every rule sits on [data-cover="slug"], which tiles carry on both the tile
 * and its cover, and the stage on its screen. --ct-size sizes the lettering
 * on tiles only; the stage sets its own size.
 */
export function coverCss() {
  const tf = { gold: 'var(--tf-gold)', ice: 'var(--tf-ice)', cream: 'var(--tf-cream)', rose: 'var(--tf-rose)' };
  return Object.entries(COVERS)
    .map(([slug, c]) => {
      const vars = [`--c1:${c.c1}`, `--c2:${c.c2}`, `--tf:${tf[c.tf] || tf.gold}`, `--acc:${c.acc}`];
      if (c.rib) vars.push(`--rib:${c.rib}`);
      if (c.size) vars.push(`--ct-size:${c.size}`);
      return `[data-cover="${slug}"]{${vars.join(';')}}`;
    })
    .join('\n');
}
