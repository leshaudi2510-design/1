import { html, esc } from '../lib/html.mjs';
import { storageTable } from './cookies.mjs';
import { pageHero, updatedPill, legalBody, ext, pageIcons } from './misc.mjs';
import { PRAGMATIC_TERMS } from './terms.mjs';

export default function privacy(ctx) {
  const { op } = ctx;
  const a = ctx.cfg.analytics || {};
  const pp = ctx.pragmaticOn;
  const hosts = (ctx.cfg.pragmatic?.frameHosts || []).map((h) => `<code>${esc(new URL(h).host)}</code>`);
  const tables = ctx.houseGames.filter((g) => g.table).map((g) => `<span class="nobr">${esc(g.name)}</span>`);

  const page = {
    id: 'privacy',
    path: '/privacy/',
    title: `Privacy Notice · ${ctx.brand}`,
    description: `What ${ctx.brand} stores on your device, what happens when you press Play on a demo, what our host logs, and your UK GDPR rights. No accounts.`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Privacy notice', path: '/privacy/' },
    ],
    crumbsInBody: true,
    bodyClass: 'is-legal',
  };
  if (!pp) page.description = `What ${ctx.brand} stores on your device, what our host logs, how we handle emails, and your UK GDPR rights. No accounts and no tracking by default.`;

  const sections = [
    {
      id: 'controller',
      title: 'Who is responsible for your data',
      body: html`<p>The controller is ${esc(op.companyName)}, company number ${esc(op.companyNumber)}, ${esc(op.address)}. Email <a href="mailto:${esc(op.email)}">${esc(op.email)}</a> with any privacy question or request.</p>`,
    },
    {
      id: 'on-your-device',
      title: 'Data kept on your device',
      body: html`<p>To run the games, the site stores a few small items in your browser’s local storage and session storage. They stay on your device and aren’t sent to us. Under the Privacy and Electronic Communications Regulations (PECR) this storage is strictly necessary for the service you ask for, so it doesn’t need consent.</p>
    ${storageTable(ctx)}
    <p>You can delete all of it by clearing this site’s data in your browser settings.</p>`,
    },
    pp && {
      id: 'demos',
      title: 'When you press Play on a demo',
      body: html`<p>The slot demos are made and hosted by Pragmatic Play. Until you press a Play button, your browser makes no request to Pragmatic Play. When you press Play:</p>
    <ul>
      <li>Your browser connects to Pragmatic Play’s servers (${hosts.join(', ')}) and loads the demo in a frame on our page. Like any website, those servers receive your IP address, details of your browser and device, and our site’s address.</li>
      <li>Pragmatic Play, and Google Analytics running inside the demo, may set cookies or read and write storage on your device under Pragmatic Play’s domain. The <a href="/cookies/#third-party">cookies page</a> explains this.</li>
      <li>The demo’s address carries only the game’s code and display settings, such as language. We don’t send Pragmatic Play your balance, your settings or anything else about you, and we don’t receive anything from inside the demo.</li>
    </ul>
    <p>Pragmatic Play decides what its demos collect and how it uses that information. Its ${ext(PRAGMATIC_TERMS, 'terms of use')} apply inside the demo.</p>
    <p>If you’d rather not connect to Pragmatic Play at all, don’t press Play. Our own tables, ${tables.join(' and ')}, work without it.</p>
    ${ctx.analyticsOn ? '<p>If you’ve allowed analytics, we also record that a demo was opened and which game it was. That record doesn’t include anything from inside the demo.</p>' : ''}`,
    },
    {
      id: 'hosting',
      title: 'What our hosting provider records',
      body: html`<p>Like every website, our hosting provider receives your IP address, browser type and the pages you request, so it can deliver the site and protect it from attacks. It keeps these logs for a short time under its own policy. Our lawful basis is legitimate interests: keeping the site working and secure.</p>`,
    },
    {
      id: 'contact',
      title: 'When you contact us',
      body: html`<p>If you email us or use the contact form, we receive your name, email address and message. ${ctx.cfg.contactEndpoint ? 'The form sends your message through our form-handling provider, which passes it to our inbox.' : 'The form doesn’t send anything itself: it opens your own email app with the message filled in, and you send it.'} We use your details only to reply. Our lawful basis is legitimate interests. We keep messages for up to 24 months, then delete them.</p>`,
    },
    {
      id: 'analytics',
      title: 'Analytics and advertising',
      body: ctx.analyticsOn
        ? html`<p>With your consent only, we use ${a.ga4 ? 'Google Analytics 4 to count visits and see which games are played' : ''}${a.ga4 && a.adsConversionId ? ', and ' : ''}${a.adsConversionId ? 'Google Ads measurement to see whether an advert led to a visit' : ''}. Nothing from Google loads on our pages until you choose “Accept all” or switch it on in Cookie settings. Our lawful basis is consent. You can change your mind at any time from Cookie settings in the footer.</p>
      <p>Google processes this data as our processor and may transfer it to the United States under the UK Extension to the EU–US Data Privacy Framework or standard contractual clauses. We use Google Consent Mode, with every signal set to “denied” until you choose otherwise. IP addresses are not logged or stored by Google Analytics 4.</p>
      ${pp ? '<p>This is separate from any analytics Pragmatic Play runs inside its demos, which our settings can’t switch off. If you choose “Reject all”, each Play button asks before it loads a demo.</p>' : ''}`
        : html`<p>We don’t use analytics, advertising pixels, social media plug-ins or any other tracking on our pages. ${pp ? 'No request goes to another company’s server when you visit, except a Pragmatic Play demo after you press Play.' : 'No request goes to another company’s server when you visit.'} If that changes, we’ll ask for your consent first and update this notice.</p>`,
    },
    {
      id: 'we-dont',
      title: 'What we don’t do',
      body: html`<p>We don’t have accounts, sell data, build profiles, use your data to decide anything about you automatically, or send marketing.</p>`,
    },
    {
      id: 'rights',
      title: 'Your rights',
      body: html`<p>Under UK data protection law you have the right to access your personal data, have it corrected or deleted, restrict or object to how we use it, and receive a copy in a portable form. Where we rely on consent, you can take it back at any time. Email us and we’ll reply within one month.${pp ? ' For anything a demo collected, contact Pragmatic Play, because we don’t hold it.' : ''}</p>
    <p>If you’re unhappy with how we’ve handled your data, you can complain to the Information Commissioner’s Office at ${ext('https://ico.org.uk/make-a-complaint/', 'ico.org.uk')} or on <a href="tel:+443031231113" class="nobr">0303 123 1113</a>. We’d appreciate the chance to put it right first.</p>`,
    },
    {
      id: 'children',
      title: 'Children',
      body: html`<p>The site is for adults 18 and over. We don’t knowingly collect data from anyone under 18.</p>`,
    },
    {
      id: 'changes',
      title: 'Changes',
      body: html`<p>If we change this notice, we’ll update the date at the top. Significant changes, such as adding analytics, will also be shown on the site.</p>`,
    },
  ].filter(Boolean);

  page.body = html`
${pageHero(page, {
  eyebrow: 'Legal',
  title: 'Privacy notice',
  lede: `The short version: there are no accounts, your game data stays on your device, ${ctx.analyticsOn ? 'analytics only run if you say yes' : 'we don’t run analytics or advertising trackers'}${pp ? ', and nothing loads from Pragmatic Play until you press Play' : ''}.`,
  meta: [updatedPill(ctx)],
  art: { icon: pageIcons.lock, tone: 'm' },
})}
${legalBody(sections, {
  summary: [
    'There are no accounts, and we never know your balance.',
    'Game data stays in your browser and isn’t sent to us.',
    ctx.analyticsOn ? 'Analytics only run if you say yes.' : 'We don’t run analytics or advertising trackers.',
    pp ? 'Pressing Play on a demo connects you to Pragmatic Play, whose own terms then apply.' : 'Nothing loads from another company’s servers.',
  ],
})}`;
  return page;
}
