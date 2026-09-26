import { html, esc } from '../lib/html.mjs';
import { operatorCard } from './about.mjs';
import { icons } from '../lib/icons.mjs';
import { pageHero } from './misc.mjs';

export default function contact(ctx) {
  const { op } = ctx;
  const endpoint = ctx.cfg.contactEndpoint;
  const pp = ctx.pragmaticOn;
  const page = {
    id: 'contact',
    path: '/contact/',
    title: `Contact Us · ${ctx.brand}`,
    description: `Get in touch with ${ctx.brand} about a game, accessibility or your privacy. Email ${op.email}. Company details and registered office.`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Contact', path: '/contact/' },
    ],
    crumbsInBody: true,
    jsonld: [
      { '@type': 'ContactPage', name: `Contact ${ctx.brand}`, url: `${ctx.origin}/contact/`, about: { '@id': ctx.orgId } },
    ],
    // Preloaded in <head> by layout(); the <script> at the end of the body runs it
    // (page modules are only preloaded, and app.js doesn't import this one).
    modules: ['/assets/js/contact.js'],
  };

  const err = (id) => `<p class="field__error" id="${id}-err" data-error></p>`;

  page.body = html`
${pageHero(page, {
  eyebrow: 'Contact',
  title: 'Contact us',
  lede: 'Questions about a game, something that doesn’t work, a privacy request? Write to us and a person will reply, usually within five working days.',
  art: { icon: icons.mail, tone: 'y' },
})}
<div class="page-body split contact">
  <form class="form split__main" data-contact ${endpoint ? `action="${esc(endpoint)}" method="post"` : `action="mailto:${esc(op.email)}" method="get"`} data-email="${esc(op.email)}" novalidate aria-labelledby="form-title" aria-describedby="form-how">
    <header class="form__head">
      <h2 id="form-title">Send a message</h2>
    </header>
    <div class="form__body">
      <p id="form-how" class="form__how">${endpoint
        ? 'Your message goes straight to our inbox. We use your details only to reply.'
        : 'Pressing the button opens your email app with your message ready to send. Nothing is stored on this site. We use your details only to reply.'} All fields are required.</p>
      <div class="form__error" data-summary tabindex="-1" hidden>
        <h3>${icons.alert}<span>Please check the form</span></h3>
        <ul></ul>
      </div>
      <div class="form__row">
        <div class="field">
          <label for="f-name">Your name</label>
          <input id="f-name" name="name" type="text" autocomplete="name" required maxlength="80" aria-describedby="f-name-err">
          ${err('f-name')}
        </div>
        <div class="field">
          <label for="f-email">Email address</label>
          <input id="f-email" name="email" type="email" autocomplete="email" required maxlength="160" spellcheck="false" aria-describedby="f-email-hint f-email-err">
          <p class="field__hint" id="f-email-hint">So we can reply. We won’t add you to any list.</p>
          ${err('f-email')}
        </div>
      </div>
      <div class="field">
        <label for="f-topic">What’s it about?</label>
        <select id="f-topic" name="topic" required aria-describedby="f-topic-err">
          <option value="">Choose one</option>
          <option>A game or its rules</option>
          ${pp ? '<option>A Pragmatic Play demo</option>' : ''}
          <option>Something isn’t working</option>
          <option>Accessibility</option>
          <option>Privacy or my data</option>
          <option>Something else</option>
        </select>
        ${err('f-topic')}
      </div>
      <div class="field">
        <label for="f-message">Message</label>
        <textarea id="f-message" name="message" rows="7" required minlength="20" maxlength="2000" aria-describedby="f-message-hint f-message-err"></textarea>
        <p class="field__hint" id="f-message-hint"><span class="num" data-count>0</span> of 2,000 characters. At least 20, please.</p>
        ${err('f-message')}
      </div>
      <div class="form__actions">
        <button type="submit" class="btn btn--primary">${icons.mail}<span>${endpoint ? 'Send message' : 'Open email to send'}</span></button>
        <p class="form__status" data-status role="status"></p>
      </div>
    </div>
  </form>

  <aside class="split__side" aria-label="Other ways to reach us">
    <section class="side-card" aria-labelledby="direct-title">
      <h2 id="direct-title" class="side-card__head">Email us directly</h2>
      <div class="side-card__body">
        <p class="contact__email"><a href="mailto:${esc(op.email)}">${icons.mail}<span>${esc(op.email)}</span></a></p>
        ${operatorCard(ctx, { email: false })}
      </div>
    </section>
    ${pp
      ? html`<div class="callout callout--note">
      <p><strong>A demo won’t load?</strong> Tell us which one. The slot demos are run by Pragmatic Play, so we can’t fix problems inside a demo, but we can check that our page loads it properly.</p>
    </div>`
      : ''}
    <div class="callout callout--warn">
      <p><strong>Worried about gambling?</strong> We can’t help with accounts on other sites. For free, confidential support, call the National Gambling Helpline on <a class="nobr" href="tel:+448088020133">0808 8020 133</a>, 24 hours a day.</p>
    </div>
  </aside>
</div>
<script type="module" src="/assets/js/contact.js"></script>`;
  return page;
}
