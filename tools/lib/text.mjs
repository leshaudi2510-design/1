// Visible-text extraction, shingles and MinHash for the uniqueness gate.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', times: '×', middot: '·', copy: '©', reg: '®', trade: '™', pound: '£', euro: '€', minus: '−', shy: '' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Remove whole elements (with content) by tag name. */
export function stripElements(html, tags) {
  let out = html;
  for (const t of tags) out = out.replace(new RegExp(`<${t}\\b[^>]*>[\\s\\S]*?<\\/${t}>`, 'gi'), ' ');
  return out;
}

/** Remove elements whose class attribute contains one of the given class names (balanced for nested same tags). */
export function stripByClass(html, classes) {
  let out = html;
  for (const cls of classes) {
    const re = new RegExp(`<(\\w+)\\b[^>]*\\bclass="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, 'i');
    let guard = 0;
    for (let m = out.match(re); m && guard < 200; m = out.match(re), guard++) {
      const tag = m[1].toLowerCase();
      const start = m.index;
      let depth = 0; let i = start; let end = -1;
      const tagRe = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
      tagRe.lastIndex = start;
      for (let t = tagRe.exec(out); t; t = tagRe.exec(out)) {
        if (t[0][1] === '/') depth--; else if (!t[0].endsWith('/>')) depth++;
        if (depth === 0) { end = t.index + t[0].length; break; }
        i = t.index;
      }
      void i;
      out = end < 0 ? out.slice(0, start) + out.slice(start + m[0].length) : `${out.slice(0, start)} ${out.slice(end)}`;
    }
  }
  return out;
}

export function tagsToText(html) {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|div|li|h[1-6]|section|article|td|th|dt|dd|summary|figcaption|button)>/gi, ' . ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

/** The main content of a page: <main> if present, else <body> without header/footer/nav. */
export function mainHtml(html) {
  const cleaned = stripElements(html, ['script', 'style', 'noscript', 'template', 'svg', 'head']);
  const m = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  let body = m ? m[1] : (cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i) || [null, cleaned])[1];
  if (!m) body = stripElements(body, ['header', 'footer', 'nav']);
  // compliance chrome is shared infrastructure, never evidence (SPEC 15.4)
  return stripByClass(body, ['age-notice', 'disclaimer', 'helpline', 'rg-help', 'trademark']);
}

export const visibleText = (html) => tagsToText(mainHtml(html));

export function words(text) {
  return text.toLowerCase().replace(/[’']/g, '').match(/[\p{L}\p{N}]+/gu) || [];
}

/** k-word shingles as a Set of strings (whole text as one shingle when shorter than k). */
export function shingles(text, k = 8) {
  const w = words(text);
  const out = new Set();
  if (!w.length) return out;
  if (w.length < k) { out.add(w.join(' ')); return out; }
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(' '));
  return out;
}

export function jaccard(A, B) {
  if (!A.size && !B.size) return 0;
  let inter = 0;
  const [small, big] = A.size < B.size ? [A, B] : [B, A];
  for (const x of small) if (big.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const PRIME = 4294967311; // > 2^32
// Fixed permutation coefficients (deterministic, so signatures are comparable across runs and sites).
const PERMS = (() => {
  const out = []; let s = 0x9e3779b9;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
  for (let i = 0; i < 128; i++) out.push([(next() % (PRIME - 1)) + 1, next() % PRIME]);
  return out;
})();
const mulmod = (a, b, m) => Number((BigInt(a) * BigInt(b)) % BigInt(m));

/** 128-permutation MinHash signature of a shingle set. */
export function minhash(set) {
  const sig = new Array(128).fill(PRIME);
  for (const sh of set) {
    const x = fnv1a(sh);
    for (let i = 0; i < 128; i++) {
      const [a, b] = PERMS[i];
      const v = (mulmod(a, x, PRIME) + b) % PRIME;
      if (v < sig[i]) sig[i] = v;
    }
  }
  return sig;
}
export function minhashJaccard(s1, s2) {
  if (!s1 || !s2 || s1.length !== s2.length) return null;
  let eq = 0;
  for (let i = 0; i < s1.length; i++) if (s1[i] === s2[i] && s1[i] !== PRIME) eq++;
  return eq / s1.length;
}

/** Headings (h1-h3) and button/CTA labels in the main content. */
export function headingsAndButtons(html) {
  const main = mainHtml(html);
  const out = [];
  for (const m of main.matchAll(/<(h[1-3]|button)\b[^>]*>([\s\S]*?)<\/\1>/gi)) out.push(tagsToText(m[2]));
  for (const m of main.matchAll(/<a\b[^>]*class="[^"]*\b(btn|button|cta)[\w-]*\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) out.push(tagsToText(m[2]));
  return out.filter(Boolean);
}

/** FAQ entries from <details><summary> pairs: [{ q, a }]. */
export function faqEntries(html) {
  const out = [];
  for (const m of mainHtml(html).matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)) {
    const s = m[1].match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    if (!s) continue;
    out.push({ q: tagsToText(s[1]), a: tagsToText(m[1].replace(s[0], '')) });
  }
  return out;
}

/** First <h1> text of a page. */
export function h1(html) {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? tagsToText(stripElements(m[1], ['svg'])) : '';
}

/** Ordered section signature of the home page main: id, else the first class token, of each <section>. */
export function sectionSequence(html) {
  const main = mainHtml(html);
  const out = [];
  for (const m of main.matchAll(/<section\b([^>]*)>/gi)) {
    const id = m[1].match(/\bid="([^"]+)"/);
    const cls = m[1].match(/\bclass="([^"]+)"/);
    out.push(id ? id[1] : cls ? cls[1].split(/\s+/)[0] : 'section');
  }
  return out;
}

/** Link labels inside the first <nav>. */
export function navLabels(html) {
  const cleaned = stripElements(html, ['script', 'style', 'svg']);
  const nav = cleaned.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i);
  if (!nav) return [];
  return [...nav[1].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => tagsToText(m[1])).filter(Boolean);
}
