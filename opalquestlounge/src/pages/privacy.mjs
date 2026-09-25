import { html, esc } from '../lib/html.mjs';
import { storageTable } from './cookies.mjs';

export default function privacy(ctx) {
  const { op } = ctx;
  const a = ctx.cfg.analytics || {};
  return {
    id: 'privacy',
    path: '/privacy/',
    title: `Privacy Notice · ${ctx.brand}`,
    description: `What ${ctx.brand} stores on your device, what our host logs, how we handle emails, and your UK GDPR rights. No accounts and no tracking by default.`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Privacy notice', path: '/privacy/' },
    ],
    bodyClass: 'is-legal',
    body: html`
<header class="page-head">
  <p class="eyebrow">Legal</p>
  <h1 class="page-title">Privacy notice</h1>
  <p class="lede">Last updated <time datetime="${ctx.updatedIso}">${ctx.updated}</time>. The short version: there are no accounts, your game data stays on your device, and ${ctx.analyticsOn ? 'analytics only run if you say yes' : 'we don’t run analytics or advertising trackers'}.</p>
</header>
<div class="prose prose--legal">
  <section aria-labelledby="p1"><h2 id="p1">Who is responsible for your data</h2>
    <p>The controller is ${esc(op.companyName)}, company number ${esc(op.companyNumber)}, ${esc(op.address)}. Email <a href="mailto:${esc(op.email)}">${esc(op.email)}</a> with any privacy question or request.</p>
  </section>

  <section aria-labelledby="p2"><h2 id="p2">Data kept on your device</h2>
    <p>To run the games, the site stores a few small items in your browser's local storage and session storage. They stay on your device and aren't sent to us. Under the Privacy and Electronic Communications Regulations (PECR) this storage is strictly necessary for the service you ask for, so it doesn't need consent.</p>
    ${storageTable(ctx)}
    <p>You can delete all of it by clearing this site's data in your browser settings.</p>
  </section>

  <section aria-labelledby="p3"><h2 id="p3">What our hosting provider records</h2>
    <p>Like every website, our hosting provider receives your IP address, browser type and the pages you request, so it can deliver the site and protect it from attacks. It keeps these logs for a short time under its own policy. Our lawful basis is legitimate interests: keeping the site working and secure.</p>
  </section>

  <section aria-labelledby="p4"><h2 id="p4">When you contact us</h2>
    <p>If you email us or use the contact form, we receive your name, email address and message. ${ctx.cfg.contactEndpoint ? 'The form sends your message through our form-handling provider, which passes it to our inbox.' : 'The form doesn’t send anything itself: it opens your own email app with the message filled in, and you send it.'} We use your details only to reply. Our lawful basis is legitimate interests. We keep messages for up to 24 months, then delete them.</p>
  </section>

  <section aria-labelledby="p5"><h2 id="p5">Analytics and advertising</h2>
    ${ctx.analyticsOn
      ? html`<p>With your consent only, we use ${a.ga4 ? 'Google Analytics 4 to count visits and see which games are played' : ''}${a.ga4 && a.adsConversionId ? ', and ' : ''}${a.adsConversionId ? 'Google Ads measurement to see whether an advert led to a visit' : ''}. Nothing from Google loads until you choose "Accept all" or switch it on in Cookie settings. Our lawful basis is consent. You can change your mind at any time from Cookie settings in the footer.</p>
      <p>Google processes this data as our processor and may transfer it to the United States under the UK Extension to the EU–US Data Privacy Framework or standard contractual clauses. We use Google Consent Mode, with every signal set to "denied" until you choose otherwise. IP addresses are not logged or stored by Google Analytics 4.</p>`
      : html`<p>We don't use analytics, advertising pixels, social media plug-ins or any other third-party tracking. No request goes to another company's server when you visit. If that changes, we'll ask for your consent first and update this notice.</p>`}
  </section>

  <section aria-labelledby="p6"><h2 id="p6">What we don't do</h2>
    <p>We don't have accounts, sell data, build profiles, use your data to decide anything about you automatically, or send marketing.</p>
  </section>

  <section aria-labelledby="p7"><h2 id="p7">Your rights</h2>
    <p>Under UK data protection law you have the right to access your personal data, have it corrected or deleted, restrict or object to how we use it, and receive a copy in a portable form. Where we rely on consent, you can take it back at any time. Email us and we'll reply within one month.</p>
    <p>If you're unhappy with how we've handled your data, you can complain to the Information Commissioner's Office at <a href="https://ico.org.uk/make-a-complaint/" rel="noopener" target="_blank">ico.org.uk<span class="visually-hidden"> (opens in a new tab)</span></a> or on 0303 123 1113. We'd appreciate the chance to put it right first.</p>
  </section>

  <section aria-labelledby="p8"><h2 id="p8">Children</h2>
    <p>The site is for adults 18 and over. We don't knowingly collect data from anyone under 18.</p>
  </section>

  <section aria-labelledby="p9"><h2 id="p9">Changes</h2>
    <p>If we change this notice, we'll update the date at the top. Significant changes, such as adding analytics, will also be shown on the site.</p>
  </section>
</div>`,
  };
}
