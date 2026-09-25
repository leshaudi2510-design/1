import { html, esc } from '../lib/html.mjs';
import { operatorCard } from './about.mjs';
import { icons } from '../lib/icons.mjs';

export default function contact(ctx) {
  const { op } = ctx;
  const endpoint = ctx.cfg.contactEndpoint;
  return {
    id: 'contact',
    path: '/contact/',
    title: `Contact Us · ${ctx.brand}`,
    description: `Get in touch with ${ctx.brand} about a game, accessibility or your privacy. Email ${op.email}. Company details and registered office.`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Contact', path: '/contact/' },
    ],
    jsonld: [
      { '@type': 'ContactPage', name: `Contact ${ctx.brand}`, url: `${ctx.origin}/contact/`, about: { '@id': ctx.orgId } },
    ],
    modules: ['/assets/js/contact.js'],
    body: html`
<header class="page-head">
  <p class="eyebrow">Contact</p>
  <h1 class="page-title">Contact us</h1>
  <p class="lede">Questions about a game, something that doesn't work, a privacy request? Write to us and a person will reply, usually within five working days.</p>
</header>

<div class="prose-grid prose-grid--plain contact">
  <aside class="aside-card" aria-labelledby="direct-title">
    <h2 id="direct-title">Email us directly</h2>
    <p class="contact__email"><a href="mailto:${esc(op.email)}">${icons.mail}${esc(op.email)}</a></p>
    ${operatorCard(ctx)}
    <p class="fine">We can't help with gambling accounts on other sites. For support with gambling, call the National Gambling Helpline on <a href="tel:+448088020133">0808 8020 133</a>.</p>
  </aside>

  <form class="form" data-contact ${endpoint ? `action="${esc(endpoint)}" method="post"` : `action="mailto:${esc(op.email)}" method="get"`} data-email="${esc(op.email)}" novalidate aria-describedby="form-how">
    <h2>Send a message</h2>
    <p id="form-how" class="fine">${endpoint
      ? 'Your message goes straight to our inbox. We use your details only to reply.'
      : 'Pressing Send opens your email app with your message ready to go. Nothing is stored on this site. We use your details only to reply.'} All fields are required.</p>
    <div class="form__error" data-summary tabindex="-1" hidden>
      <h3>Please check the form</h3>
      <ul></ul>
    </div>
    <div class="field">
      <label for="f-name">Your name</label>
      <input id="f-name" name="name" type="text" autocomplete="name" required maxlength="80" aria-describedby="f-name-err">
      <p class="field__error" id="f-name-err" data-error></p>
    </div>
    <div class="field">
      <label for="f-email">Email address</label>
      <input id="f-email" name="email" type="email" autocomplete="email" required maxlength="160" spellcheck="false" aria-describedby="f-email-hint f-email-err">
      <p class="field__hint" id="f-email-hint">So we can reply. We won't add you to any list.</p>
      <p class="field__error" id="f-email-err" data-error></p>
    </div>
    <div class="field">
      <label for="f-topic">What's it about?</label>
      <select id="f-topic" name="topic" required aria-describedby="f-topic-err">
        <option value="">Choose one</option>
        <option>A game or its rules</option>
        <option>Something isn't working</option>
        <option>Accessibility</option>
        <option>Privacy or my data</option>
        <option>Something else</option>
      </select>
      <p class="field__error" id="f-topic-err" data-error></p>
    </div>
    <div class="field">
      <label for="f-message">Message</label>
      <textarea id="f-message" name="message" rows="7" required minlength="20" maxlength="2000" aria-describedby="f-message-hint f-message-err"></textarea>
      <p class="field__hint" id="f-message-hint"><span data-count>0</span> of 2,000 characters. At least 20, please.</p>
      <p class="field__error" id="f-message-err" data-error></p>
    </div>
    <button type="submit" class="btn btn--primary">${endpoint ? 'Send message' : 'Open email to send'}</button>
    <p class="form__status" data-status role="status"></p>
  </form>
</div>`,
  };
}
