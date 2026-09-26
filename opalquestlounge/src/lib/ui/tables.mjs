// Our own games' panels: Lapidary Wheel, Brilliant Twenty-One and (when the
// Pragmatic demos are switched off) Seven Systems.
import { html, esc, num, pct, oneIn } from '../html.mjs';
import { icons } from '../icons.mjs';

function purchasesNote(ctx) {
  return ctx.cfg.purchases
    ? `<p class="game__purchases">This game offers optional in-game purchases of ${esc(ctx.cur.plural)}. Purchased ${esc(ctx.cur.plural)} have no cash value and can't be exchanged.</p>`
    : `<p class="game__purchases">No purchases. ${esc(ctx.cur.plural)} are free and can't be bought.</p>`;
}

function stakeField(name, stakes, cur) {
  return html`<fieldset class="segmented stake">
    <legend>Stake <span class="visually-hidden">in ${esc(cur.plural)}</span></legend>
    ${stakes.map(
      (s, i) => `<label><input type="radio" name="${name}" value="${s}"${i === 0 ? ' checked' : ''}><span class="num">${num(s)}</span></label>`,
    )}
  </fieldset>`;
}

function crest(no, kind, spec) {
  return html`<canvas class="game__crest" data-opal="crest" width="80" height="60" aria-hidden="true"></canvas>
    <p class="game__no"><span class="num">No. ${no}</span> · ${esc(kind)}<span class="game__spec"> · ${esc(spec)}</span></p>`;
}

function facts(g) {
  return html`<dl class="game__facts">
    <div><dt><abbr title="Return to player">RTP</abbr></dt><dd class="num">${g.rtpLabel.replace('about ', '≈ ')}</dd></div>
    <div><dt>Stakes</dt><dd>${esc(g.stakes.replace(/ a (spin|hand)$/, ''))}</dd></div>
  </dl>`;
}

// ---------- Seven Systems ----------

export function slotPaytable(ctx, { compact = false } = {}) {
  const { SYMBOLS, SETS, TRIPLE } = ctx.slot;
  const odds = ctx.slotStats.lineOdds;
  const rows = [
    ...Object.keys(TRIPLE).map((k) => ({
      key: k,
      label: k === 'O' ? 'Three Opals' : `Three ${SYMBOLS[k].name}`,
      sub: k === 'O' ? 'Amorphous' : SYMBOLS[k].system,
      pays: TRIPLE[k],
      p: odds[k],
    })),
    ...Object.entries(SETS).map(([k, s]) => ({
      key: `set:${k}`,
      label: `${s.name}, mixed`,
      sub: s.note,
      pays: s.pays,
      p: odds[`set:${k}`],
    })),
  ];
  return html`<table class="paytable${compact ? ' paytable--compact' : ''}">
    <caption${compact ? ' class="visually-hidden"' : ''}>Seven Systems pays, as multiples of the line stake. The line stake is your spin stake divided by 5.</caption>
    <thead><tr><th scope="col">Line shows</th><th scope="col">Pays</th>${compact ? '' : '<th scope="col">Chance on any one line</th><th scope="col">At a 10-Carat spin</th>'}</tr></thead>
    <tbody>
      ${rows.map(
        (r) => html`<tr data-sym="${r.key}">
          <th scope="row"><span class="pt__name">${esc(r.label)}</span>${compact ? '' : `<small>${esc(r.sub)}</small>`}</th>
          <td class="num">${r.pays}×</td>
          ${compact ? '' : `<td class="num">${oneIn(r.p)}</td><td class="num">${num(r.pays * 2)} ${esc(ctx.cur.plural)}</td>`}
        </tr>`,
      )}
    </tbody>
  </table>`;
}

export function slotPanel(ctx, { variant = 'page', headingId, headingLevel = 2 } = {}) {
  const g = ctx.game('seven-systems');
  const { SYMBOLS } = ctx.slot;
  const h = `h${headingLevel}`;
  const pid = `paytable-${variant}`;
  const first = ['Opal', 'Beryl', 'Quartz'];
  return html`<section class="game slot" data-game="seven-systems" data-variant="${variant}" aria-labelledby="${headingId}">
  <header class="game__head">
    ${crest(g.no, g.kind, g.spec)}
    <${h} class="game__title" id="${headingId}">${variant === 'hero' ? 'Seven Systems' : 'Play Seven Systems'}</${h}>
    ${facts(g)}
  </header>
  <div class="game__stage slot__stage">
    <canvas class="slot__canvas" width="660" height="444" role="img" aria-label="Three reels of crystal drawings, three rows showing.">
      Three reels, each showing three minerals: ${first.join(', ')}.
    </canvas>
  </div>
  <div class="game__side">
  <div class="game__controls">
    <div class="game__buttons">
      <button type="button" class="btn btn--primary btn--play" data-action="spin" aria-disabled="true">Spin for <span class="num" data-stake-label>${ctx.slot.STAKES[0]}</span> ${esc(ctx.cur.plural)}</button>
      <button type="button" class="btn btn--primary" data-action="topup" hidden>Claim ${ctx.carats(ctx.cur.topUpAmount)}</button>
      <button type="button" class="btn btn--quiet" popovertarget="${pid}">Paytable</button>
    </div>
    ${stakeField(`ss-stake-${variant}`, ctx.slot.STAKES, ctx.cur)}
  </div>
  <p class="game__result" data-result aria-live="polite" aria-atomic="true">Choose a stake and spin. Opal stands in for any mineral.</p>
  <p class="game__disclaimer">${esc(ctx.disclaimer)}</p>
  ${purchasesNote(ctx)}
  <p class="game__keys">Keys, while you're in the game: <kbd>S</kbd> spins, <kbd>1</kbd>–<kbd>4</kbd> pick a stake.</p>
  </div>
  <div id="${pid}" class="pop paytable-pop" popover>
    <p class="pop__head">Paytable <small>× line stake</small></p>
    ${slotPaytable(ctx, { compact: true })}
    <p class="pop__foot">Opal is wild. Only the best pay on each line counts. RTP ${g.rtpLabel}. <a href="${g.path}#rules">Full rules</a></p>
  </div>
</section>`;
}

// ---------- Lapidary Wheel ----------

export function wheelPanel(ctx, { headingId = 'play-wheel' } = {}) {
  const g = ctx.game('lapidary-wheel');
  const { colourOf, CHIPS } = ctx.wheel;
  const name = (n) => `${n} ${n === 0 ? 'Malachite' : colourOf(n) === 'garnet' ? 'Garnet' : 'Jet'}`;
  // Numbers in columns of three, top row first: 3 2 1, 6 5 4 …
  const cells = [];
  for (let c = 1; c <= 12; c++) for (let r = 0; r < 3; r++) cells.push(3 * c - r);
  const btn = (id, label, cls, aria) =>
    `<button type="button" class="bet ${cls}" data-bet="${id}" data-label="${esc(aria || label)}" aria-label="${esc(aria || label)}"><span class="bet__label">${label}</span><span class="bet__chip num" aria-hidden="true"></span></button>`;
  return html`<section class="game wheel" data-game="lapidary-wheel" aria-labelledby="${headingId}">
  <header class="game__head">
    ${crest(g.no, g.kind, g.spec)}
    <h2 class="game__title" id="${headingId}">Play Lapidary Wheel</h2>
    ${facts(g)}
  </header>
  <div class="wheel__layout">
    <div class="game__stage wheel__stage">
      <canvas class="wheel__canvas" width="560" height="560" role="img" aria-label="Roulette wheel with 37 pockets, at rest.">A single-zero roulette wheel.</canvas>
      <ol class="wheel__history" aria-label="Last results" data-history></ol>
    </div>
    <div class="wheel__table">
      <p class="game__result" data-result aria-live="polite" aria-atomic="true">Pick a chip, place it on the table, then spin.</p>
      <fieldset class="segmented chips">
        <legend>Chip value</legend>
        ${CHIPS.map((c, i) => `<label><input type="radio" name="lw-chip" value="${c}"${i === 0 ? ' checked' : ''}><span class="num">${c}</span></label>`)}
      </fieldset>
      <div class="board" role="group" aria-label="Betting table. Use the arrow keys to move between bets, Enter to place a chip, Backspace to take one off." data-board>
        <div class="board__numbers">
          ${btn('n0', '0', 'bet--zero is-malachite', name(0))}
          ${cells.map((n) => btn(`n${n}`, String(n), `bet--n is-${colourOf(n)}`, name(n)))}
          ${btn('c3', '2:1', 'bet--col', 'Column 3: 3 to 36, pays 2 to 1')}
          ${btn('c2', '2:1', 'bet--col', 'Column 2: 2 to 35, pays 2 to 1')}
          ${btn('c1', '2:1', 'bet--col', 'Column 1: 1 to 34, pays 2 to 1')}
        </div>
        <div class="board__dozens">
          ${btn('d1', '1st 12', 'bet--out', '1st dozen: 1 to 12, pays 2 to 1')}
          ${btn('d2', '2nd 12', 'bet--out', '2nd dozen: 13 to 24, pays 2 to 1')}
          ${btn('d3', '3rd 12', 'bet--out', '3rd dozen: 25 to 36, pays 2 to 1')}
        </div>
        <div class="board__even">
          ${btn('low', '1–18', 'bet--out', 'Low: 1 to 18, pays evens')}
          ${btn('even', 'Even', 'bet--out', 'Even numbers, pays evens')}
          ${btn('garnet', 'Garnet', 'bet--out is-garnet', 'Garnet (red), pays evens')}
          ${btn('jet', 'Jet', 'bet--out is-jet', 'Jet (black), pays evens')}
          ${btn('odd', 'Odd', 'bet--out', 'Odd numbers, pays evens')}
          ${btn('high', '19–36', 'bet--out', 'High: 19 to 36, pays evens')}
        </div>
      </div>
      <div class="game__controls">
        <p class="wheel__staked">On the table: <span class="num" data-total>0</span> ${esc(ctx.cur.plural)} <small>(limit ${num(ctx.wheel.TABLE_LIMIT)})</small></p>
        <div class="game__buttons">
          <button type="button" class="btn btn--primary btn--play" data-action="spin" aria-disabled="true">Spin for <span class="num" data-stake-label>0</span> ${esc(ctx.cur.plural)}</button>
          <button type="button" class="btn btn--primary" data-action="topup" hidden>Claim ${ctx.carats(ctx.cur.topUpAmount)}</button>
          <button type="button" class="btn btn--quiet" data-action="undo" disabled>Undo</button>
          <button type="button" class="btn btn--quiet" data-action="clear" disabled>Clear</button>
          <button type="button" class="btn btn--quiet" data-action="rebet" disabled>Same again</button>
        </div>
      </div>
    </div>
  </div>
  <p class="game__disclaimer">${esc(ctx.disclaimer)}</p>
  ${purchasesNote(ctx)}
  <p class="game__keys">Keys, while you're in the game: arrows move around the table, <kbd>Enter</kbd> places a chip, <kbd>Backspace</kbd> removes one, <kbd>S</kbd> spins.</p>
</section>`;
}

// ---------- Brilliant Twenty-One ----------

export function twentyOnePanel(ctx, { headingId = 'play-21' } = {}) {
  const g = ctx.game('brilliant-twenty-one');
  return html`<section class="game twentyone" data-game="brilliant-twenty-one" aria-labelledby="${headingId}">
  <header class="game__head">
    ${crest(g.no, g.kind, g.spec)}
    <h2 class="game__title" id="${headingId}">Play Brilliant Twenty-One</h2>
    ${facts(g)}
  </header>
  <div class="game__stage twentyone__stage">
    <canvas class="twentyone__canvas" width="720" height="420" role="img" aria-label="The table, waiting for a deal.">A blackjack table.</canvas>
    <p class="hand hand--dealer"><span class="hand__who">Dealer</span> <span class="num" data-dealer-total>–</span></p>
    <p class="hand hand--player"><span class="hand__who">You</span> <span class="num" data-player-total>–</span></p>
  </div>
  <div class="game__side">
  <div class="game__controls">
    <div class="game__buttons">
      <button type="button" class="btn btn--primary btn--play" data-action="deal" aria-disabled="true">Deal for <span class="num" data-stake-label>${ctx.bj.STAKES[0]}</span> ${esc(ctx.cur.plural)}</button>
      <button type="button" class="btn btn--primary" data-action="topup" hidden>Claim ${ctx.carats(ctx.cur.topUpAmount)}</button>
    </div>
    <div class="game__buttons twentyone__moves">
      <button type="button" class="btn btn--secondary" data-action="hit" aria-disabled="true">Hit</button>
      <button type="button" class="btn btn--secondary" data-action="stand" aria-disabled="true">Stand</button>
      <button type="button" class="btn btn--secondary" data-action="double" aria-disabled="true">Double</button>
      <button type="button" class="btn btn--secondary" data-action="split" aria-disabled="true">Split</button>
    </div>
    ${stakeField('b21-stake', ctx.bj.STAKES, ctx.cur)}
    <label class="switch switch--inline"><input type="checkbox" role="switch" data-hint><span>Show the basic-strategy move</span></label>
    <p class="twentyone__hint" data-hint-text hidden></p>
  </div>
  <p class="game__result" data-result aria-live="polite" aria-atomic="true">Choose a stake, then deal.</p>
  <p class="twentyone__shoe"><span class="num" data-shoe>312</span> cards left in the shoe. It's reshuffled when 78 remain.</p>
  <p class="game__disclaimer">${esc(ctx.disclaimer)}</p>
  ${purchasesNote(ctx)}
  <p class="game__keys">Keys, while you're in the game: <kbd>1</kbd>–<kbd>4</kbd> pick a stake, <kbd>D</kbd> deal, <kbd>H</kbd> hit, <kbd>S</kbd> stand, <kbd>X</kbd> double, <kbd>P</kbd> split.</p>
  </div>
</section>`;
}
