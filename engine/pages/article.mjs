// A content-only page (SPEC 3.5): a title band and text sections, from data.
// Type packs use it for pages that carry no type-specific markup; in Phase 1
// the stub packs build every page from it.
//
//   article(ctx, {
//     id, path, title, description,          // page object fields (title <= 60, description <= 155)
//     heading, eyebrow?, lede?,              // the title band (heading defaults to title)
//     sections: [{ id, title, paragraphs: [html] }],
//     file?, noindex?, sitemap?, canonical?, breadcrumbs?, ogImage?, ogAlt?,
//   })
//
// Text may use {brand}, {company}, {email} and {updated}, filled from the
// config. Paragraphs are trusted HTML from the pack or the site (limited
// inline markup: <a>, <em>, <strong>, <span class="nobr">); headings are
// escaped.
import { readFileSync } from 'node:fs';
import { html, esc } from '../lib/html.mjs';
import { pageHero } from './misc.mjs';

/** Fill {brand}, {company}, {email}, {updated} in a string: as plain text, or with the values HTML-escaped for markup. */
export function fill(ctx, s, { markup = false } = {}) {
  const values = { brand: ctx.brand, company: ctx.op.companyName, email: ctx.op.email, updated: ctx.updated };
  return String(s ?? '').replace(/\{(brand|company|email|updated)\}/g, (_, k) => (markup ? esc(values[k]) : values[k]));
}
const fillHtml = (ctx, s) => fill(ctx, s, { markup: true });

const PAGE_KEYS = ['id', 'path', 'title', 'description', 'file', 'noindex', 'sitemap', 'canonical', 'breadcrumbs', 'ogImage', 'ogAlt', 'legal'];

export default function article(ctx, spec) {
  const page = {};
  for (const k of PAGE_KEYS) if (spec[k] !== undefined) page[k] = spec[k];
  page.title = fill(ctx, spec.title);
  page.description = fill(ctx, spec.description);
  page.ogAlt = spec.ogAlt ? fill(ctx, spec.ogAlt) : ctx.brand;
  page.bodyClass = 'page-article';
  const sections = spec.sections || [];
  page.body = html`
${pageHero(page, {
  eyebrow: spec.eyebrow ? esc(fill(ctx, spec.eyebrow)) : '',
  title: esc(fill(ctx, spec.heading || spec.title)),
  lede: spec.lede ? fillHtml(ctx, spec.lede) : '',
})}
${sections.map(
  (s) => html`<section class="page-body prose" aria-labelledby="${s.id}">
  <h2 id="${s.id}">${esc(fill(ctx, s.title))}</h2>
  ${(s.paragraphs || []).map((p) => `<p>${fillHtml(ctx, p)}</p>`)}
</section>`,
)}`;
  return page;
}

/**
 * Every page of a content-only site: the site's content/pages.json when it
 * has one, else the type's defaults (a JSON file of { pages: [spec] }).
 * Returns { pages, source } so the caller can say where they came from.
 */
export function articlePages(ctx, defaultsFile) {
  const own = ctx.site.path('content/pages.json');
  let source = defaultsFile;
  let data;
  try {
    data = ctx.site.readJson('content/pages.json');
    source = own;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    data = JSON.parse(readFileSync(defaultsFile, 'utf8'));
  }
  return { pages: (data.pages || []).map((spec) => article(ctx, spec)), source, isDefault: data._default === true };
}
