// One page per Pragmatic Play demo (spec §8), written from
// src/data/pragmatic-games.json in our own words. Facts listed in a game's
// "verify" array carry data-verify, so they are easy to find and check
// against the demo's own information screen before launch.
import { existsSync, readFileSync } from 'node:fs';
import { html, esc, num } from '../lib/html.mjs';
import { breadcrumbs } from '../lib/layout.mjs';
import { pragmaticStage, gameList } from '../lib/games-ui.mjs';
import { icon } from '../lib/icons.mjs';

const PUBLIC = new URL('../public/', import.meta.url);
// The researched data as written. ctx.games maps each game's tags to the lobby
// filters (tumble, megaways, freespins); the page needs the full mechanic list.
const DATA = new Map(JSON.parse(readFileSync(new URL('../data/pragmatic-games.json', import.meta.url), 'utf8')).games.map((d) => [d.slug, d]));

// ---------- copy helpers ----------

/** House style: "pays", not "wins", in game rules. */
const plain = (s) =>
  String(s ?? '')
    .replace(/\bthe winning symbols\b/g, 'the paying symbols')
    .replace(/\bwinning\b/g, 'paying')
    .replace(/\bwins tumble\b/g, 'paying symbols tumble away')
    .replace(/\btumbling wins\b/g, 'tumbling pays');

const sentences = (s) => plain(s).split(/(?<=[.!?])\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** "6×5" → "6 reels × 5 rows"; anything else as written. */
const layoutText = (grid) => grid.replace(/^(\d+)×(\d+)$/, '$1 reels × $2 rows');

/** The "Ways to pay" cell: a short answer plus the detail underneath. */
function paysCell(d) {
  const [head, tail] = d.pays.split(/:\s*/);
  if (/^anywhere/i.test(head)) return { main: 'Pays anywhere', small: tail ? `${capital(tail.replace(/ of the same /, ' of a '))}, anywhere on the grid` : '' };
  return { main: capital(head), small: tail ? capital(tail) : '' };
}

/** "February 2021" from the notes where they give the month; otherwise the year. */
function released(d) {
  for (const f of d.features || []) {
    const m = f.match(/(?:released|launched)(?: by Pragmatic Play)? (?:in|on) ((?:\d{1,2} )?[A-Z][a-z]+ \d{4})/i);
    if (m) return m[1];
  }
  return d.released ? String(d.released) : '';
}

/** "a 6×5 pay-anywhere slot", "a Megaways slot", "a 5×3 slot with 10 fixed paylines" */
function kind(d) {
  if (d.tags.includes('megaways')) return 'a Megaways slot';
  if (d.tags.includes('pay-anywhere')) return `a ${d.grid} pay-anywhere slot`;
  if (d.tags.includes('cluster')) return `a ${d.grid} cluster-pays slot`;
  if (/\d/.test(d.pays)) return `a ${d.grid} slot with ${lower(d.pays)}`;
  return `a ${d.grid} line slot`;
}

const PURE_RELEASE = /^(?:released|launched)(?: by Pragmatic Play)? (?:in|on) [^,.]+\.$/i;

// ---------- feature cards ----------

// A sentence from the game's own rules that mentions `re`, trimmed to its
// first clause when it runs long.
function ruleSentence(d, re) {
  const pool = [...(d.howItPlays || []).flatMap(sentences), ...sentences(d.bonus), ...sentences(d.summary)];
  let s = pool.find((x) => re.test(x));
  if (s && s.length > 130 && s.includes(';')) s = `${s.split(';')[0]}.`;
  return s;
}

// How a game pays: one card, used to fill the grid when it has fewer than four features.
const PAYS_CARD = [
  ['pay-anywhere', (d) => ({ id: 'i-gem', title: 'Pays anywhere', text: ruleSentence(d, /anywhere/i) })],
  ['cluster', (d) => ({ id: 'i-gem', title: 'Cluster pays', text: ruleSentence(d, /cluster/i) })],
  ['megaways', (d) => ({ id: 'i-reels', title: 'Megaways', text: ruleSentence(d, /ways to pay/i) })],
  ['paylines', (d) => ({ id: 'i-arrow', title: 'Paylines', text: /\d/.test(d.pays) ? `Symbols pay from left to right along ${lower(d.pays)}.` : 'Symbols pay from left to right along fixed lines.' })],
];

const FEATURE_CARDS = [
  ['tumble', () => ({ id: 'i-tumble', title: 'Tumble', text: 'Paying symbols clear and new ones fall into the gaps, so one spin can pay several times.' })],
  ['multipliers', (d) => {
    // Sentences lifted from the free-spins rules can start mid-story ("You then choose…").
    const text = (ruleSentence(d, /multipl/i) || 'Multipliers raise what a spin pays.').replace(/^You then choose\b/, 'In the free spins you choose').replace(/^(A|The) (\w+) then\b/, '$1 $2');
    const title = /\borbs?\b/i.test(text) ? 'Multiplier orbs' : /\bbombs?\b/i.test(text) ? 'Multiplier bombs' : /collection multiplier/i.test(text) ? 'Collection multiplier'
      : /starting multiplier/i.test(text) ? 'Starting multiplier' : /\bwilds?\b/i.test(text) ? 'Wild multipliers' : 'Multipliers';
    return { id: 'i-orb', title, text };
  }],
  ['free-spins', (d) => ({ id: 'i-spins', title: 'Free spins', text: sentences(d.bonus)[0] })],
  ['respins', (d) => ({ id: 'i-reels', title: 'Respins', text: ruleSentence(d, /respin/i) })],
  ['sticky-wilds', (d) => ({ id: 'i-gem', title: 'Sticky wilds', text: ruleSentence(d, /stay(?:s)? (?:in place|put)/i) })],
];

function featureCards(d) {
  const cards = FEATURE_CARDS.filter(([tag]) => d.tags.includes(tag)).map(([, make]) => make(d));
  const ante = (d.features || []).find((f) => /\bante bet\b/i.test(f));
  if (ante) cards.push({ id: 'i-plus', title: 'Ante bet', text: plain(ante), from: ante });
  if (cards.length < 4) {
    const pays = PAYS_CARD.find(([tag]) => d.tags.includes(tag));
    if (pays) cards.unshift(pays[1](d));
  }
  return cards.filter((c) => c.text).slice(0, 4);
}

function volatilityNote(d) {
  const v = (d.volatility || '').toLowerCase();
  if (/^(very )?high/.test(v)) return 'Long quiet spells are normal on a high-volatility slot, and every spin is independent of the last. In the demo they cost nothing, because demo credits have no value.';
  if (/^medium/.test(v)) return 'On a medium-volatility slot, pays tend to come more often than on the high-volatility games here, and to be smaller. Every spin is independent of the last.';
  return 'Every spin is independent of the last: a run of quiet spins doesn’t make the next one any more likely to pay.';
}

// ---------- the page ----------

export default function pragmaticGame(ctx, game) {
  const g = { ...game, tags: DATA.get(game.slug)?.tags || [] };
  const name = esc(g.name);
  const verify = new Set(g.verify || []);
  const v = (field) => (verify.has(field) ? ' data-verify' : '');
  const pays = paysCell(g);
  const when = released(g);
  // Share image: the game's own card once tools/make-images.mjs draws one; the site card until then.
  const hasOg = existsSync(new URL(`.${g.image}`, PUBLIC));
  const ogImage = hasOg ? g.image : '/assets/img/og-home.png';
  const summary = plain(g.summary);
  const cards = featureCards(g);
  // Release dates are in the facts table, the ante bet has a card and the callout covers quiet spells.
  const notes = (g.features || []).filter((f) => !PURE_RELEASE.test(f) && !/quiet spells/i.test(f) && !cards.some((c) => c.from === f)).map(plain);

  // Visible crumbs link to the lobby's slot section; the structured data names the lobby page itself.
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Slots', path: '/games/#slots' },
    { name: g.name, path: g.path },
  ];
  const crumbsLd = crumbs.map((c) => ({ ...c, path: c.path.replace(/#.*$/, '') }));

  // Titles ≤ 60 characters and descriptions ≤ 155, for every name in the data.
  const title = [`${g.name} free demo · ${ctx.brand}`, `${g.name} demo · ${ctx.brand}`, `${g.name} · ${ctx.brand}`].find((t) => t.length <= 60) || g.name;
  const description = [
    `Play the free ${g.name} demo from Pragmatic Play, ${kind(g)}. Rules, features and RTP. No real money, no prizes. 18+.`,
    `Play the free ${g.name} demo from Pragmatic Play. Rules, features and RTP. No real money, no prizes. 18+.`,
    `The free ${g.name} demo from Pragmatic Play. No real money, no prizes. 18+.`,
  ].find((t) => t.length <= 155);

  const facts = [
    ['Layout', layoutText(g.grid), '', 'grid'],
    ['Ways to pay', pays.main, pays.small, 'pays'],
    ['Volatility', g.volatility || '', '', 'volatility'],
    ['Top payout', g.topPayout ? `${num(g.topPayout)}× stake` : '', '', 'topPayout'],
    ['<abbr title="Return to player">RTP</abbr>', g.rtpLabel, 'Pragmatic Play’s figure for this version', 'rtp'],
    ['Released', when, '', 'released'],
  ].filter(([, value]) => value);

  const videoGame = {
    '@type': 'VideoGame',
    '@id': `${g.url}#game`,
    name: g.name,
    url: g.url,
    description: summary,
    image: ctx.origin + ogImage,
    genre: g.genre,
    gamePlatform: 'Web browser',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any operating system with a modern web browser',
    playMode: 'SinglePlayer',
    inLanguage: 'en',
    isAccessibleForFree: true,
    contentRating: '18+',
    audience: { '@type': 'PeopleAudience', suggestedMinAge: 18 },
    author: { '@type': 'Organization', name: 'Pragmatic Play' },
    publisher: { '@type': 'Organization', name: 'Pragmatic Play' },
    ...(g.released ? { datePublished: String(g.released) } : {}),
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: g.url,
      category: 'free',
    },
  };

  return {
    id: `game-${g.slug}`,
    path: g.path,
    title,
    description,
    ogImage,
    ...(hasOg ? { ogAlt: `${g.name}: our own cover art for Pragmatic Play’s free demo.` } : {}),
    breadcrumbs: crumbsLd,
    crumbsInBody: true,
    jsonld: [videoGame],
    modules: ['/assets/js/games/pragmatic.js'],
    bodyClass: 'is-game is-pragmatic',
    body: html`
<section class="game-hero" aria-labelledby="game-h">
  <div class="wrap">
    ${breadcrumbs(crumbs)}
    <div class="game-hero__title">
      <h1 id="game-h" class="display">${name}</h1>
      <p class="game-hero__meta">
        <span class="fact"><i class="dot dot--pp" aria-hidden="true"></i>Pragmatic Play</span>
        <span class="fact">Free demo</span>
        ${g.rtpLabel ? `<span class="fact"${v('rtp')}>RTP <span class="num">${g.rtpLabel}</span></span>` : ''}
      </p>
    </div>
    <div class="game-hero__grid">
      <div class="game-hero__main">
        ${pragmaticStage(ctx, g)}
        <div class="stage__after">
          <a class="btn btn--secondary" href="/games/#slots">${icon('i-back')}Back to lobby</a>
          <p>${esc(summary)} <a href="#how-to-play">How to play</a></p>
        </div>
      </div>
      <aside class="game__side" aria-labelledby="facts-h">
        <h2 id="facts-h" class="visually-hidden">Game facts</h2>
        <table class="paytable facts">
          <thead><tr><th scope="col">Fact</th><th scope="col">${name}</th></tr></thead>
          <tbody>
            ${facts.map(([label, value, small, field]) => `<tr${v(field)}><th scope="row">${label}</th><td>${esc(value)}${small ? `<small>${esc(small)}</small>` : ''}</td></tr>`)}
          </tbody>
        </table>
        <div class="side-note">
          <p>RTP is Pragmatic Play’s figure for this version of the game. Casinos can run versions set lower, so the same game may return less elsewhere. Press the i button inside the demo for its own paytable and rules.</p>
          <p class="side-note__disclaimer">${esc(ctx.disclaimer)}</p>
        </div>
      </aside>
    </div>
  </div>
</section>

<section class="game-body" aria-labelledby="how-to-play">
  <div class="wrap game-body__grid">
    <div class="prose">
      <h2 id="how-to-play" class="display">How to play</h2>
      ${g.howItPlays?.length ? `<ol>
        ${g.howItPlays.map((s) => `<li>${esc(plain(s))}</li>`).join('\n        ')}
      </ol>` : ''}
      <p class="callout callout--note">${esc(volatilityNote(g))}</p>
      ${notes.length ? `<h3>Good to know</h3>
      <ul>
        ${notes.map((s) => `<li>${esc(s)}</li>`).join('\n        ')}
      </ul>` : ''}
    </div>
    <div class="game-body__features">
      <h2 id="features" class="display h2">Free spins and features</h2>
      ${g.bonus ? `<p class="features__bonus"${v('bonus')}>${esc(plain(g.bonus))}</p>` : ''}
      ${cards.length ? `<ul class="features">
        ${cards.map((c) => `<li class="feature"><span class="fi" aria-hidden="true">${icon(c.id)}</span><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></li>`).join('\n        ')}
      </ul>` : ''}
    </div>
  </div>
</section>

<section class="game-faq" aria-labelledby="questions-h">
  <div class="wrap faq__grid">
    <div><h2 id="questions-h" class="display h2">Questions</h2></div>
    <div>
      <details class="qa" open>
        <summary><span class="q" aria-hidden="true">?</span>Is any real money involved?${icon('i-chev', 'chev')}</summary>
        <div class="a">
          <p>No. This is Pragmatic Play’s free demo of ${name}, and it plays with demo credits. Demo credits have no value: they can’t be bought, paid out or carried over, and they aren’t ${esc(ctx.cur.plural)}. Nothing you do in the demo can be exchanged for money or prizes.</p>
        </div>
      </details>
      <details class="qa">
        <summary><span class="q" aria-hidden="true">?</span>Why does the demo load from Pragmatic Play’s servers?${icon('i-chev', 'chev')}</summary>
        <div class="a">
          <p>Pragmatic Play makes ${name} and hosts the demo, so the game runs on their servers. We don’t contact them until you press Play. When you do, your browser sends them what any website receives: your IP address, your browser and device type, and our site’s address.</p>
          <p>Inside the demo, Pragmatic Play may set its own cookies and run its own analytics, and its privacy policy applies. Our <a href="/cookies/#third-party">cookies page</a> has the details.</p>
        </div>
      </details>
      <details class="qa">
        <summary><span class="q" aria-hidden="true">?</span>How do breaks and limits work here?${icon('i-chev', 'chev')}</summary>
        <div class="a">
          <p>They cover the demos as well as our own tables. Your session clock stays in the header, and a reality check appears every 30 minutes unless you change it. If you take a break or reach your daily time limit, the demo closes and stays closed until the break or the day is over.</p>
          <p>A lower limit applies at once; a higher one starts tomorrow. Breaks can’t be cut short. Set them in <button type="button" class="linkish" data-open="settings" aria-haspopup="dialog">Settings</button>, or read more under <a href="/responsible-gaming/">Responsible gaming</a>.</p>
        </div>
      </details>
    </div>
  </div>
</section>

<section class="lobby lobby--more" aria-labelledby="more-h">
  <div class="wrap">
    <div class="sechead"><h2 id="more-h" class="display">More demos</h2><p><a href="/games/#slots">All slot demos</a></p></div>
    ${gameList(ctx, { current: g.path, limit: 5 })}
  </div>
</section>`,
  };
}
