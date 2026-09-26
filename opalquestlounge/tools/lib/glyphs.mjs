// What the site draws in its web fonts, for build.mjs's glyph-coverage lint:
// the visible text of a page, the strings in a script and the text in a
// stylesheet. A character the self-hosted fonts don't have is drawn in a
// fallback face (a thin "≈" next to heavy Archivo digits, for example).

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decode every character reference, so "&#8776;" can't slip past as plain ASCII. Unknown named ones stay as written. */
export const decodeEntities = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m));

/** Named references other than &amp; &lt; &gt; &quot; &apos; &nbsp; (write the character itself instead, so the lint can see it). */
export const unknownEntities = (html) => [...new Set([...html.matchAll(/&([a-z][a-z0-9]*);/gi)].map((m) => m[1]).filter((e) => !(e.toLowerCase() in ENTITIES)))];

/**
 * The text a page shows: the body's text and the attributes drawn on screen
 * (placeholder, a button's value, data-label, which the stylesheet prints).
 * Leaves out the <head> (the title, meta tags and JSON-LD aren't drawn in
 * the web fonts), scripts, styles, comments and SVG titles.
 */
export function pageText(html) {
  const body = html.slice(Math.max(0, html.search(/<body[\s>]/)));
  const markup = body.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|title)\b[\s\S]*?<\/\1>/gi, ' ');
  const attrs = [...markup.matchAll(/\s(?:placeholder|value|data-label)="([^"]*)"/g)].map((m) => m[1]);
  return decodeEntities([markup.replace(/<[^>]+>/g, ' '), ...attrs].join(' '));
}

const REGEX_AFTER = /^(?:[(,=:[!&|?{};+\-*%<>~^]|return|typeof|case|in|of|void|delete|new|throw|yield|await|else|do)$/;
const unescapeJs = (s) =>
  s.replace(/\\(u\{[0-9a-f]+\}|u[0-9a-f]{4}|x[0-9a-f]{2}|[\s\S])/gi, (m, e) =>
    /^u\{/i.test(e) ? String.fromCodePoint(parseInt(e.slice(2, -1), 16)) : /^[ux][0-9a-f]/i.test(e) ? String.fromCodePoint(parseInt(e.slice(1), 16)) : e);

/**
 * The contents of a script's string and template literals, escapes decoded.
 * Comments and regular expressions are left out: they're never drawn.
 * A small tokenizer, enough for the site's own hand-written modules.
 */
export function scriptStrings(src) {
  const out = [];
  const opens = []; // brace depth at which each open ${ … } closes
  let depth = 0;
  let prev = ''; // the last token, to tell a regular expression from a division
  let i = 0;
  const n = src.length;
  const template = () => {
    let s = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        s += src.slice(i, i + 2);
        i += 2;
      } else if (c === '`') {
        i++;
        prev = 'x';
        break;
      } else if (c === '$' && src[i + 1] === '{') {
        i += 2;
        opens.push(depth++);
        prev = '{';
        break;
      } else s += src[i++];
    }
    out.push(unescapeJs(s));
  };
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      i = end < 0 ? n : end;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
    } else if (c === '"' || c === "'") {
      let s = '';
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') {
          s += src.slice(j, j + 2);
          j += 2;
        } else s += src[j++];
      }
      out.push(unescapeJs(s));
      i = j + 1;
      prev = 'x';
    } else if (c === '`') {
      i++;
      template();
    } else if (c === '{') {
      depth++;
      prev = c;
      i++;
    } else if (c === '}') {
      depth--;
      i++;
      if (opens.length && opens.at(-1) === depth) {
        opens.pop();
        template();
      } else prev = c;
    } else if (c === '/' && (prev === '' || REGEX_AFTER.test(prev))) {
      let j = i + 1;
      let inClass = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') {
          j += 2;
          continue;
        }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) break;
        j++;
      }
      i = j + 1;
      while (/[a-z]/i.test(src[i] || '')) i++;
      prev = 'x';
    } else if (/[\w$]/.test(c)) {
      let j = i;
      while (j < n && /[\w$]/.test(src[j])) j++;
      prev = src.slice(i, j);
      i = j;
    } else {
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  return out.join('\n');
}

/** A stylesheet without its comments (what's left, such as content: "…", can be drawn). */
export const styleText = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\\([0-9a-f]{1,6})\s?/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)));

/** "U+2248 ≈" */
export const describe = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${JSON.stringify(String.fromCodePoint(cp)).slice(1, -1)}`;

/** Code points above U+007E in `text` that aren't in `covered` (a Set of numbers), with a count each. */
export function uncovered(text, covered) {
  const found = new Map();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp > 0x7e && !covered.has(cp)) found.set(cp, (found.get(cp) || 0) + 1);
  }
  return found;
}
