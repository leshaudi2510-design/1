// Our own games' panels: Lapidary Wheel, Brilliant Twenty-One and (when the
// Pragmatic demos are switched off) Seven Systems. Spec 7.20.
//
// Markup contract with assets/js/games/*.js: the section carries data-game,
// the result line carries data-result, and every button keeps its
// data-action. Buttons that change state during play use aria-disabled,
// never disabled, so keyboard focus stays on them.
//
// The head band's colour comes from the panel's class (.game.wheel,
// .game.twentyone, .game.slot in 80-tables.css), not an inline style: CSP.
import { html, esc, num, oneIn } from '../html.mjs';
import { icons, icon } from '../icons.mjs';
import { gameList } from './tiles.mjs';

/** The verbatim disclaimer, then what Carats cost: nothing. */
function disclaimer(ctx) {
  const c = ctx.cur;
  const note = ctx.cfg.purchases
    ? `This game offers optional in-game purchases of ${esc(c.plural)}. Purchased ${esc(c.plural)} have no cash value and can't be exchanged.`
    : `${esc(c.plural)} are free and can't be bought.`;
  return `<p class="game__disclaimer"><span>${esc(ctx.disclaimer)}</span> <span class="game__purchases">${note}</span></p>`;
}

// Asks the age question again if it was closed without an answer; common.js
// shows it only while that is why the game is locked.
const AGE_ASK = '<p data-age-ask hidden><button type="button" class="btn btn--secondary btn--sm" data-open="age-gate" aria-haspopup="dialog">Confirm my age</button></p>';

function stakeField(name, stakes, cur) {
  return html`<fieldset class="segmented stake">
    <legend>Stake <span class="visually-hidden">in ${esc(cur.plural)}</span></legend>
    ${stakes.map(
      (s, i) => `<label><input type="radio" name="${name}" value="${s}"${i === 0 ? ' checked' : ''}><span class="num">${num(s)}</span></label>`,
    )}
  </fieldset>`;
}

/** Head band: yellow crest disc with an ink icon, the title and two fact pills. */
function head(ctx, g, { icon, headingId, level = 2, title = g.name, stakes }) {
  const h = `h${level}`;
  const rtp = g.rtpLabel.replace('about ', '≈ ');
  return html`<header class="game__head">
    <span class="game__crest" aria-hidden="true">${icon}</span>
    <${h} class="game__title" id="${headingId}"><span class="visually-hidden">Play </span>${title}</${h}>
    <dl class="game__facts">
      <div><dt><abbr title="Return to player">RTP</abbr></dt><dd class="num">${rtp}</dd></div>
      <div><dt>Stakes</dt><dd class="num">${stakes}<span class="visually-hidden"> ${esc(ctx.cur.plural)}</span></dd></div>
    </dl>
  </header>`;
}

/** A play button whose label holds a number: one <span> keeps "Spin for 35 Carats" on one line of flex content (spec 7.3). */
const playLabel = (verb, stake, cur) => `<span>${verb} for <span class="num" data-stake-label>${stake}</span> ${esc(cur.plural)}</span>`;

const topUp = (ctx) => `<button type="button" class="btn btn--primary" data-action="topup" hidden><span>Claim <span class="num">${num(ctx.cur.topUpAmount)}</span> free ${esc(ctx.cur.plural)}</span></button>`;

// ---------- Seven Systems ----------

export function slotPaytable(ctx, { compact = false } = {}) {
  const { SYMBOLS, SETS, TRIPLE } = ctx.slot;
  const odds = ctx.slotStats.lineOdds;
  const rows = [
    ...Object.keys(TRIPLE).map((k) => ({
      key: k,
      label: k === 'O' ? 'Three Opals' : `Three ${SYMBOLS[k].name}`,
      sub: k === 'O' ? 'Wild, and the top pay' : SYMBOLS[k].system,
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
  return html`<table class="paytable slot-pays${compact ? ' paytable--compact' : ''}">
    <caption${compact ? ' class="visually-hidden"' : ''}>Seven Systems pays, as multiples of the line stake. The line stake is your spin stake divided by 5.</caption>
    <thead><tr><th scope="col">Line shows</th><th scope="col">Pays</th>${compact ? '' : '<th scope="col">Chance on any one line</th><th scope="col">At a 10-Carat spin</th>'}</tr></thead>
    <tbody>
      ${rows.map(
        (r) => html`<tr data-sym="${r.key}">
          <th scope="row"><span class="pt__name"><i class="sym sym--${r.key.replace('set:', 'set-')}" aria-hidden="true"></i>${esc(r.label)}</span>${compact ? '' : `<small>${esc(r.sub)}</small>`}</th>
          <td class="num">${r.pays}×</td>
          ${compact ? '' : `<td class="num">${oneIn(r.p)}</td><td class="num">${num(r.pays * 2)} ${esc(ctx.cur.plural)}</td>`}
        </tr>`,
      )}
    </tbody>
  </table>`;
}

export function slotPanel(ctx, { variant = 'page', headingId = 'play-slot', headingLevel = 2 } = {}) {
  const g = ctx.game('seven-systems');
  const { STAKES } = ctx.slot;
  const pid = `paytable-${variant}`;
  const first = ['Opal', 'Beryl', 'Quartz'];
  return html`<section class="game slot" data-game="seven-systems" data-variant="${variant}" aria-labelledby="${headingId}">
  ${head(ctx, g, { icon: icons.reels, headingId, level: headingLevel, stakes: `${num(STAKES[0])}–${num(STAKES.at(-1))}` })}
  <div class="slot__layout">
    <div class="game__stage slot__stage">
      <canvas class="slot__canvas" width="660" height="444" role="img" aria-label="Three reels of crystals, three rows showing.">
        Three reels, each showing three minerals: ${first.join(', ')}.
      </canvas>
    </div>
    <div class="slot__side">
      <div class="game__controls">
        <p class="game__result" data-result aria-live="polite" aria-atomic="true">Choose a stake and spin. Opal stands in for any mineral.</p>
        ${AGE_ASK}
        <div class="game__buttons">
          <button type="button" class="btn btn--primary btn--play" data-action="spin" aria-disabled="true">${playLabel('Spin', STAKES[0], ctx.cur)}</button>
          ${topUp(ctx)}
          <button type="button" class="btn btn--quiet" popovertarget="${pid}">Paytable</button>
        </div>
        ${stakeField(`ss-stake-${variant}`, STAKES, ctx.cur)}
        <p class="game__keys">Keys, while you're in the game: <kbd>S</kbd> spins, <kbd>1</kbd> to <kbd>4</kbd> pick a stake.</p>
      </div>
    </div>
  </div>
  ${disclaimer(ctx)}
  <div id="${pid}" class="pop paytable-pop" popover aria-labelledby="${pid}-h">
    <div class="pop__head">
      <h3 class="pop__title" id="${pid}-h">Paytable <small>× line stake</small></h3>
      <button type="button" class="icon-btn" popovertarget="${pid}" popovertargetaction="hide" aria-label="Close the paytable">${icons.close}</button>
    </div>
    ${slotPaytable(ctx, { compact: true })}
    <p class="pop__foot">Opal is wild. Only the best pay on each line counts. RTP ${g.rtpLabel}. <a href="${g.path}#rules">Full rules</a></p>
  </div>
</section>`;
}

// ---------- Lapidary Wheel ----------

export function wheelPanel(ctx, { headingId = 'play-wheel', headingLevel = 2 } = {}) {
  const g = ctx.game('lapidary-wheel');
  const { colourOf, CHIPS, TABLE_LIMIT } = ctx.wheel;
  const name = (n) => `${n} ${n === 0 ? 'Malachite' : colourOf(n) === 'garnet' ? 'Garnet' : 'Jet'}`;
  // Numbers in columns of three, top row first: 3 2 1, 6 5 4 … The CSS lays
  // this order out as the standard table (grid-auto-flow: column) and, on
  // phones, as the upright table (rows of three, right to left).
  const cells = [];
  for (let c = 1; c <= 12; c++) for (let r = 0; r < 3; r++) cells.push(3 * c - r);
  const btn = (id, label, cls, aria) =>
    `<button type="button" class="bet ${cls}" data-bet="${id}" data-label="${esc(aria || label)}" aria-label="${esc(aria || label)}"><span class="bet__label">${label}</span><span class="bet__chip num" aria-hidden="true"></span></button>`;
  return html`<section class="game wheel" data-game="lapidary-wheel" aria-labelledby="${headingId}">
  ${head(ctx, g, { icon: icons.wheel, headingId, level: headingLevel, stakes: `${num(CHIPS[0])}–${num(TABLE_LIMIT)}` })}
  <div class="wheel__layout">
    <div class="game__stage wheel__stage">
      <canvas class="wheel__canvas" width="560" height="560" role="img" aria-label="Roulette wheel with 37 pockets, at rest.">A single-zero roulette wheel.</canvas>
      <div class="wheel__last">
        <p class="wheel__last-label" id="${headingId}-last">Last results</p>
        <ol class="wheel__history" aria-labelledby="${headingId}-last" data-history></ol>
      </div>
    </div>
    <div class="wheel__table">
      <p class="game__result" data-result aria-live="polite" aria-atomic="true">Pick a chip, place it on the table, then spin.</p>
      ${AGE_ASK}
      <fieldset class="segmented chips">
        <legend>Chip value <span class="visually-hidden">in ${esc(ctx.cur.plural)}</span></legend>
        ${CHIPS.map((c, i) => `<label class="chip-${c}"><input type="radio" name="lw-chip" value="${c}"${i === 0 ? ' checked' : ''}><span class="num">${c}</span></label>`)}
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
        <p class="wheel__staked">On the table: <span class="num" data-total>0</span> ${esc(ctx.cur.plural)} <small>(limit <span class="num">${num(TABLE_LIMIT)}</span>)</small></p>
        <div class="game__buttons">
          <button type="button" class="btn btn--primary btn--play" data-action="spin" aria-disabled="true">${playLabel('Spin', 0, ctx.cur)}</button>
          ${topUp(ctx)}
          <button type="button" class="btn btn--quiet" data-action="undo" aria-disabled="true">Undo</button>
          <button type="button" class="btn btn--quiet" data-action="clear" aria-disabled="true">Clear</button>
          <button type="button" class="btn btn--quiet" data-action="rebet" aria-disabled="true">Same again</button>
        </div>
        <p class="game__keys">Keys, while you're in the game: arrows move around the table, <kbd>Enter</kbd> places a chip, <kbd>Backspace</kbd> takes one off, <kbd>S</kbd> spins.</p>
      </div>
    </div>
  </div>
  ${disclaimer(ctx)}
</section>`;
}

// ---------- Brilliant Twenty-One ----------

export function twentyOnePanel(ctx, { headingId = 'play-21', headingLevel = 2 } = {}) {
  const g = ctx.game('brilliant-twenty-one');
  const { STAKES, DECKS, CUT_AT } = ctx.bj;
  const shoe = DECKS * 52;
  return html`<section class="game twentyone" data-game="brilliant-twenty-one" aria-labelledby="${headingId}">
  ${head(ctx, g, { icon: icons.cards, headingId, level: headingLevel, title: 'Brilliant <span class="nobr">Twenty-One</span>', stakes: `${num(STAKES[0])}–${num(STAKES.at(-1))}` })}
  <div class="twentyone__layout">
    <div class="game__stage twentyone__stage">
      <canvas class="twentyone__canvas" width="720" height="420" role="img" aria-label="The table, waiting for a deal.">A blackjack table.</canvas>
      <p class="hand hand--dealer"><span class="hand__who">Dealer</span> <span class="num" data-dealer-total>–</span></p>
      <p class="hand hand--player"><span class="hand__who">You</span> <span class="num" data-player-total>–</span></p>
    </div>
    <div class="twentyone__side">
      <div class="game__controls">
        <p class="game__result" data-result aria-live="polite" aria-atomic="true">Choose a stake, then deal.</p>
        ${AGE_ASK}
        <p class="twentyone__hint" data-hint-text aria-live="polite" hidden></p>
        <div class="game__buttons twentyone__moves" role="group" aria-label="Your move">
          <button type="button" class="btn btn--secondary" data-action="hit" aria-disabled="true">Hit</button>
          <button type="button" class="btn btn--secondary" data-action="stand" aria-disabled="true">Stand</button>
          <button type="button" class="btn btn--secondary" data-action="double" aria-disabled="true">Double</button>
          <button type="button" class="btn btn--secondary" data-action="split" aria-disabled="true">Split</button>
        </div>
        <div class="game__buttons">
          <button type="button" class="btn btn--primary btn--play" data-action="deal" aria-disabled="true">${playLabel('Deal', STAKES[0], ctx.cur)}</button>
          ${topUp(ctx)}
        </div>
        ${stakeField('b21-stake', STAKES, ctx.cur)}
        <label class="switch switch--inline"><input type="checkbox" role="switch" data-hint><span>Show the basic-strategy move</span></label>
        <p class="twentyone__shoe"><span class="num" data-shoe>${num(shoe)}</span> cards left in the shoe. It's reshuffled when <span class="num">${Math.round(shoe * CUT_AT)}</span> remain.</p>
        <p class="game__keys">Keys, while you're in the game: <kbd>1</kbd> to <kbd>4</kbd> pick a stake, <kbd>D</kbd> deal, <kbd>H</kbd> hit, <kbd>S</kbd> stand, <kbd>X</kbd> double, <kbd>P</kbd> split.</p>
      </div>
    </div>
  </div>
  ${disclaimer(ctx)}
</section>`;
}

// ---------- Page parts shared by the three table pages ----------
// The game-hero recipe (spec 7.9) with the panel in place of the stage, the
// facts aside, the questions and the More games row.

/** Title band: crumbs, H1 and fact pills, then the panel and a back-to-lobby row. */
export function tablePageHero(ctx, g, { crumbs, title = esc(g.name), panel, back, summary }) {
  return html`<section class="game-hero game-hero--table" aria-labelledby="game-h">
  <div class="wrap">
    ${crumbs}
    <div class="game-hero__title">
      <h1 id="game-h" class="display">${title}</h1>
      <p class="game-hero__meta"><span class="fact"><i class="dot dot--oq" aria-hidden="true"></i>${esc(ctx.brand)}</span><span class="fact">Free to play</span><span class="fact"><abbr title="Return to player">RTP</abbr>&nbsp;${g.rtpLabel.replace('about ', '≈ ')}</span></p>
    </div>
    ${panel}
    <div class="stage__after">
      <a class="btn btn--secondary" href="${back}">${icons.back}<span>Back to lobby</span></a>
      <p>${summary} <a href="#how-to-play">How to play</a></p>
    </div>
  </div>
</section>`;
}

/**
 * The facts table (spec 7.18), a note and an "On this page" list. It comes
 * first in the source so phones show it before the long rules; wide screens
 * place it in the right-hand column.
 */
export function tablePageFacts(g, rows, { note = '', toc = [] } = {}) {
  return html`<aside class="table-side" aria-labelledby="facts-h">
    <h2 id="facts-h" class="visually-hidden">Game facts</h2>
    <table class="paytable facts">
      <thead><tr><th scope="col">Fact</th><th scope="col">${esc(g.name).replace('Twenty-One', '<span class="nobr">Twenty-One</span>')}</th></tr></thead>
      <tbody>
        ${rows.map(([k, v, small]) => `<tr><th scope="row">${k}</th><td>${v}${small ? `<small>${small}</small>` : ''}</td></tr>`)}
      </tbody>
    </table>
    ${note ? `<p class="side-note">${note}</p>` : ''}
    ${toc.length
      ? html`<nav class="toc" aria-labelledby="toc-h">
      <h2 class="toc__head" id="toc-h">On this page</h2>
      <ol>${toc.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`)}</ol>
    </nav>`
      : ''}
  </aside>`;
}

/** Questions, as FAQ cards (spec 7.12). Answers are trusted template HTML. */
export function tablePageQuestions(items) {
  return html`<div class="wrap faq__grid table-faq">
    <div><h2 id="questions" class="display h2">Questions</h2></div>
    <div>
      ${items.map(
        ([q, a]) => html`<details class="qa" name="q">
        <summary><span class="q" aria-hidden="true">?</span>${q}${icon('i-chev', 'chev')}</summary>
        <div class="a"><p>${a}</p></div>
      </details>`,
      )}
    </div>
  </div>`;
}

/** More games: five tiles from the lobby (ui/tiles.mjs). */
export function tablePageMore(ctx, g) {
  return html`<section class="lobby table-more" aria-labelledby="more-h">
  <div class="wrap">
    <div class="sechead"><h2 id="more-h" class="display">More games</h2><p><a href="/games/">All games</a></p></div>
    ${gameList(ctx, { current: g.path, limit: 5 })}
  </div>
</section>`;
}
