/* Pixel Crown Club: page chrome. Purse display, table tabs, allowance, age notice, break reminders. */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  // ---------- Purse in the top bar ----------
  const balance = $('#balance');
  const purse = balance.closest('.purse');
  $('.purse__coin').style.backgroundImage = `url(${Lounge.sprite(Lounge.SPRITES.coin)})`;

  function renderBalance(value, delta) {
    if (Lounge.countTo) Lounge.countTo(balance, value);
    else balance.textContent = Wallet.fmt(value);
    document.querySelectorAll('[data-balance]').forEach((el) => { el.textContent = Wallet.fmt(value); });
    if (delta) {
      purse.classList.remove('is-up', 'is-down');
      void purse.offsetWidth; // restart the animation
      purse.classList.add(delta > 0 ? 'is-up' : 'is-down');
    }
    renderAllowance();
  }
  Wallet.onChange(renderBalance);

  // ---------- Table tabs ----------
  const tabs = [...document.querySelectorAll('.tab')];
  const names = tabs.map((t) => t.dataset.tab);

  function selectTab(name, focus) {
    // Cross-fade between tables where the browser supports View Transitions.
    if (document.startViewTransition && !Lounge.reduceMotion() && tabs.some((t) => t.getAttribute('aria-selected') === 'true' && t.dataset.tab !== name)) {
      document.startViewTransition(() => applyTab(name, focus));
    } else {
      applyTab(name, focus);
    }
  }

  function applyTab(name, focus) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    document.dispatchEvent(new CustomEvent('table:show', { detail: name }));
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => {
      selectTab(t.dataset.tab);
      try { history.replaceState(null, '', '#' + t.dataset.tab); } catch (e) { /* sandboxed */ }
    });
    t.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      selectTab(names[(i + step + names.length) % names.length], true);
    });
  });

  const fromHash = location.hash.slice(1);
  if (names.includes(fromHash)) {
    selectTab(fromHash);
    requestAnimationFrame(() => $('#tables').scrollIntoView());
  }

  // ---------- 8-bit allowance ----------
  const clock = $('#allow-clock');
  const claim = $('#allow-claim');
  const refill = $('#refill');
  const bits = [...document.querySelectorAll('#allow-bits span')];

  function fmtLeft(ms) {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function renderAllowance() {
    const left = Wallet.allowanceIn();
    const elapsed = Wallet.ALLOWANCE_MS - left;
    const hours = elapsed / 3600000;
    bits.forEach((b, i) => {
      const full = left === 0 || hours >= i + 1;
      const filling = !full && hours > i;
      b.classList.toggle('is-on', full);
      b.classList.toggle('is-filling', filling);
      if (filling) b.style.setProperty('--fill', `${((hours - i) * 100).toFixed(1)}%`);
    });
    if (left === 0) {
      clock.textContent = 'Ready';
      claim.disabled = false;
      claim.textContent = `Claim ${Wallet.fmt(Wallet.ALLOWANCE)} Crowns`;
    } else {
      clock.textContent = fmtLeft(left);
      claim.disabled = true;
      claim.textContent = 'Allowance claimed';
    }
    refill.hidden = !Wallet.canRefill();
  }

  claim.addEventListener('click', () => {
    if (Wallet.claimAllowance()) {
      Lounge.toast(`+${Wallet.fmt(Wallet.ALLOWANCE)} Crowns added to your purse.`);
      Lounge.sfx('coin');
      if (Lounge.confetti) Lounge.confetti(claim, 60);
      Lounge.emit('allowance');
    }
    renderAllowance();
  });
  refill.addEventListener('click', () => {
    if (Wallet.refill()) Lounge.toast(`Purse refilled to ${Wallet.fmt(Wallet.ALLOWANCE)} Crowns.`);
  });

  renderBalance(Wallet.get());
  setInterval(renderAllowance, 1000);

  // ---------- Age notice ----------
  const gate = $('#age-gate');
  if (store.get('pcc.age') !== 'yes' && gate && typeof gate.showModal === 'function') {
    gate.showModal();
    gate.addEventListener('cancel', (e) => {
      if (store.get('pcc.age') !== 'yes') e.preventDefault();
    });
  }
  $('#age-yes').addEventListener('click', () => {
    store.set('pcc.age', 'yes');
    gate.close();
  });
  $('#age-no').addEventListener('click', () => {
    $('#age-ask').hidden = true;
    $('#age-left').hidden = false;
  });

  // ---------- Break reminders ----------
  const started = Date.now();
  const sessionOut = $('#session-time');
  let reminded = 0;
  function renderSession() {
    const min = Math.floor((Date.now() - started) / 60000);
    sessionOut.textContent = min < 1 ? 'under a minute' : `${min} min`;
    const due = Math.floor(min / 30);
    if (due > reminded) {
      reminded = due;
      Lounge.toast(`You've been in the club for ${min} minutes. A good moment for a break.`);
    }
  }
  setInterval(renderSession, 15000);
  renderSession();

  $('#year').textContent = new Date().getFullYear();
})();
