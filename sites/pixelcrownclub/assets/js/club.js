/* Pixel Crown Club: membership. Tiers, lifetime stats, trophies and the shareable big-win card. */
(function () {
  'use strict';

  const KEY = 'pcc.club.v1';
  const $ = (s) => document.querySelector(s);

  // Every Crown staked counts toward the next tier. Higher tiers open larger chips.
  const TIERS = [
    { id: 'copper', name: 'Copper', at: 0, perk: 'Chips from 16 to 256' },
    { id: 'silver', name: 'Silver', at: 4096, perk: 'Silver card finish' },
    { id: 'gold', name: 'Gold', at: 32768, perk: 'Unlocks the 512 chip', chip: 512 },
    { id: 'platinum', name: 'Platinum', at: 131072, perk: 'Unlocks the 1K chip', chip: 1024 },
    { id: 'crown', name: 'Crown', at: 524288, perk: 'Unlocks the 2K chip and the holo card', chip: 2048 },
  ];

  const TROPHIES = [
    { id: 'first', name: 'First Move', how: 'Play any table', sprite: 'coin' },
    { id: 'allowance', name: 'On Schedule', how: 'Claim an 8-bit allowance', sprite: 'bell' },
    { id: 'natural', name: 'Natural', how: 'Get blackjack at Club 21', sprite: 'spade' },
    { id: 'straight', name: 'Straight Up', how: 'Win a single-number bet', sprite: 'gem' },
    { id: 'sevens', name: 'Lucky Sevens', how: 'Line up three Sevens', sprite: 'seven' },
    { id: 'crowns', name: 'Triple Crown', how: 'Line up three Crowns', sprite: 'crown' },
    { id: 'big', name: 'Big Win', how: 'Win 1,024 Crowns in one go', sprite: 'heart' },
    { id: 'regular', name: 'Regular', how: 'Play 100 games', sprite: 'club' },
  ];

  const blank = () => ({
    staked: 0, games: 0, biggest: 0, trophies: [],
    since: Date.now(), no: Array.from({ length: 3 }, () => String(Lounge.rint(10000)).padStart(4, '0')).join(' '),
  });
  let club = blank();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Number.isFinite(saved.staked)) club = Object.assign(blank(), saved);
  } catch (e) { /* fresh membership */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(club)); } catch (e) { /* ignore */ } };
  save();

  const tierIndex = () => TIERS.reduce((idx, t, i) => (club.staked >= t.at ? i : idx), 0);
  const chipsFor = (idx) => Lounge.BASE_CHIPS.concat(TIERS.slice(0, idx + 1).filter((t) => t.chip).map((t) => t.chip));

  // ---------- Rendering ----------
  const card = $('#member-card');
  const suitArt = (id) => Lounge.sprite(Lounge.SUITS[id], { X: '#F2C14E' }, 6);
  const art = (id) => (Lounge.SPRITES[id] ? Lounge.sprite(Lounge.SPRITES[id]) : suitArt(id));

  const ladder = $('#tier-ladder');
  ladder.innerHTML = TIERS.map((t) => `
    <li class="ladder__row" data-tier="${t.id}">
      <span class="ladder__swatch ladder__swatch--${t.id}" aria-hidden="true"></span>
      <span class="ladder__name">${t.name}</span>
      <span class="ladder__at">${t.at ? Wallet.fmt(t.at) : 'Start'}</span>
      <span class="ladder__perk">${t.perk}</span>
    </li>`).join('');

  const shelf = $('#trophies');
  shelf.innerHTML = TROPHIES.map((t) => `
    <li class="trophy" data-trophy="${t.id}" data-spot>
      <span class="trophy__art" style="background-image:url(${art(t.sprite)})" aria-hidden="true"></span>
      <span class="trophy__name">${t.name}</span>
      <span class="trophy__how">${t.how}</span>
      <span class="trophy__state"></span>
    </li>`).join('');

  const since = new Date(club.since).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).toUpperCase();

  function render() {
    const i = tierIndex();
    const t = TIERS[i];
    const next = TIERS[i + 1];
    card.dataset.tier = t.id;
    $('#card-tier').textContent = t.name;
    $('#card-no').textContent = club.no;
    $('#card-since').textContent = since;

    [...ladder.children].forEach((row, k) => {
      row.classList.toggle('is-current', k === i);
      row.classList.toggle('is-reached', k < i);
    });

    const bar = $('#tier-progress');
    if (next) {
      const p = (club.staked - t.at) / (next.at - t.at);
      bar.style.setProperty('--p', `${Math.min(100, p * 100).toFixed(1)}%`);
      $('#tier-progress-label').textContent = `${Wallet.fmt(club.staked)} of ${Wallet.fmt(next.at)} Crowns staked to reach ${next.name}`;
    } else {
      bar.style.setProperty('--p', '100%');
      $('#tier-progress-label').textContent = 'Crown tier. You have reached the top of the club.';
    }

    $('#stat-games').textContent = Wallet.fmt(club.games);
    $('#stat-biggest').textContent = Wallet.fmt(club.biggest);
    $('#stat-staked').textContent = Wallet.fmt(club.staked);
    $('#stat-trophies').textContent = `${club.trophies.length}/${TROPHIES.length}`;

    shelf.querySelectorAll('.trophy').forEach((el) => {
      const got = club.trophies.includes(el.dataset.trophy);
      el.classList.toggle('is-earned', got);
      el.querySelector('.trophy__state').textContent = got ? 'Earned' : 'Locked';
    });
  }

  function award(id) {
    if (club.trophies.includes(id)) return;
    club.trophies.push(id);
    save();
    const t = TROPHIES.find((x) => x.id === id);
    Lounge.playSound && Lounge.playSound('unlock');
    Lounge.toast(`Trophy earned: ${t.name}`);
    render();
  }

  // ---------- Listening to the tables ----------
  let lastTier = tierIndex();
  Lounge.setChipValues(chipsFor(lastTier));

  Lounge.on('bet', ({ amount }) => {
    club.staked += amount;
    save();
    const now = tierIndex();
    if (now > lastTier) {
      lastTier = now;
      Lounge.setChipValues(chipsFor(now));
      Lounge.playSound && Lounge.playSound('tier');
      Lounge.toast(`Welcome to ${TIERS[now].name}. ${TIERS[now].perk}.`);
      Lounge.confetti && Lounge.confetti(card, 120);
    }
    render();
  });

  Lounge.on('result', (r) => {
    club.games += 1;
    if (r.win > club.biggest) club.biggest = r.win;
    save();
    award('first');
    if (club.games >= 100) award('regular');
    if (r.win >= 1024) award('big');
    if (r.trophy) award(r.trophy);
    render();
    if (r.win >= r.bet * 8) showBigWin(r);
  });
  Lounge.on('allowance', () => award('allowance'));

  // ---------- Big win sheet & share card ----------
  const sheet = $('#bigwin');
  const GAME_NAMES = { reels: 'Crown Reels', wheel: 'Royal Wheel', club21: 'Club 21' };
  let lastWin = null;

  function showBigWin(r) {
    lastWin = r;
    $('#bigwin-mult').textContent = `${Math.round(r.win / r.bet)}×`;
    $('#bigwin-amount').textContent = `${Wallet.fmt(r.win)} Crowns`;
    $('#bigwin-where').textContent = `${GAME_NAMES[r.game]} · ${r.text || 'Big win'}`;
    $('#bigwin-status').textContent = '';
    if (typeof sheet.showModal === 'function' && !sheet.open) setTimeout(() => sheet.showModal(), 650);
  }
  $('#bigwin-close').addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

  function drawShareCard(r) {
    const W = 1200, H = 630;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(W * 0.72, H * 0.45, 40, W * 0.72, H * 0.45, 620);
    g.addColorStop(0, '#33273D'); g.addColorStop(1, '#130E17');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#B8862B';
    [[0, 0, W, 12], [0, H - 12, W, 12], [0, 0, 12, H], [W - 12, 0, 12, H]].forEach((a) => x.fillRect(...a));

    const crown = new Image();
    return new Promise((resolve) => {
      crown.onload = () => {
        x.imageSmoothingEnabled = false;
        x.drawImage(crown, 760, 150, 340, 340);
        x.fillStyle = '#F2C14E';
        x.font = '28px Silkscreen, monospace';
        x.fillText('PIXEL CROWN CLUB', 80, 110);
        x.fillStyle = '#FFE59A';
        x.font = '600 180px "Pixelify Sans", monospace';
        x.fillText(`${Math.round(r.win / r.bet)}×`, 72, 330);
        x.fillStyle = '#F4EBDD';
        x.font = '600 56px "Pixelify Sans", monospace';
        x.fillText(`${Wallet.fmt(r.win)} Crowns`, 80, 420);
        x.fillStyle = '#A99BB2';
        x.font = '26px "Instrument Sans", sans-serif';
        x.fillText(`${GAME_NAMES[r.game]} · ${r.text || 'Big win'}`, 80, 472);
        x.fillStyle = '#F2C14E';
        x.font = '22px Silkscreen, monospace';
        x.fillText('PIXELCROWNCLUB.COM · FREE TO PLAY · NO REAL MONEY · 18+', 80, 560);
        c.toBlob((b) => resolve(b), 'image/png');
      };
      crown.src = Lounge.sprite(Lounge.SPRITES.crown, Lounge.PALETTE, 16);
    });
  }

  $('#bigwin-share').addEventListener('click', async () => {
    if (!lastWin) return;
    const status = $('#bigwin-status');
    const blob = await drawShareCard(lastWin);
    const file = new File([blob], 'pixel-crown-club-win.png', { type: 'image/png' });
    const text = `I just hit ${Math.round(lastWin.win / lastWin.bet)}× at ${GAME_NAMES[lastWin.game]} in Pixel Crown Club.`;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, url: 'https://pixelcrownclub.com/' });
        status.textContent = 'Shared.';
        return;
      }
      if (navigator.share) {
        await navigator.share({ text, url: 'https://pixelcrownclub.com/' });
        status.textContent = 'Shared.';
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = 'Win card saved as an image.';
  });

  Lounge.tilt && Lounge.tilt(card);
  render();
})();
