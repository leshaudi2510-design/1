// Contact form: accessible validation with an error summary, then either
// opens the visitor's email app (default) or posts to a configured endpoint.
const form = document.querySelector('[data-contact]');

if (form) {
  const summary = form.querySelector('[data-summary]');
  const status = form.querySelector('[data-status]');
  const message = form.elements.message;
  const count = form.querySelector('[data-count]');
  const nf = new Intl.NumberFormat('en-GB');

  const MESSAGES = {
    name: { valueMissing: 'Enter your name.' },
    email: { valueMissing: 'Enter your email address.', typeMismatch: 'Enter an email address like name@example.co.uk.' },
    topic: { valueMissing: 'Choose what your message is about.' },
    message: { valueMissing: 'Write your message.', tooShort: 'Your message needs at least 20 characters.' },
  };

  function errorFor(el) {
    const v = el.validity;
    if (v.valid) return '';
    const m = MESSAGES[el.name] || {};
    for (const key of ['valueMissing', 'typeMismatch', 'tooShort', 'tooLong']) if (v[key]) return m[key] || el.validationMessage;
    return el.validationMessage;
  }

  function show(el) {
    const text = errorFor(el);
    const slot = form.querySelector(`#${el.id}-err`);
    if (slot) slot.textContent = text;
    el.setAttribute('aria-invalid', text ? 'true' : 'false');
    return text;
  }

  // The browser may restore a draft after a reload or Back: count it.
  const updateCount = () => (count.textContent = nf.format(message.value.length));
  updateCount();
  addEventListener('pageshow', updateCount);

  // Validate on leaving a field once it has been touched, and re-check as they fix it.
  form.addEventListener('focusout', (e) => {
    if (e.target.matches('input, select, textarea') && e.target.value) show(e.target);
  });
  form.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') show(e.target);
    if (e.target === message) updateCount();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Counting characters also catches text shorter than minlength that the browser skips when pasted programmatically.
    const fields = [...form.querySelectorAll('input, select, textarea')];
    const errors = fields.map((el) => [el, show(el)]).filter(([, t]) => t);
    if (message.value.trim().length < 20 && !errors.some(([el]) => el === message)) {
      const slot = form.querySelector('#f-message-err');
      slot.textContent = MESSAGES.message.tooShort;
      message.setAttribute('aria-invalid', 'true');
      errors.push([message, MESSAGES.message.tooShort]);
    }
    const list = summary.querySelector('ul');
    list.replaceChildren();
    if (errors.length) {
      for (const [el, text] of errors) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${el.id}`;
        a.textContent = text;
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          el.focus();
        });
        li.append(a);
        list.append(li);
      }
      summary.hidden = false;
      summary.focus();
      return;
    }
    summary.hidden = true;

    const data = Object.fromEntries(new FormData(form));
    const endpoint = form.getAttribute('method') === 'post' ? form.action : '';
    if (endpoint) {
      status.textContent = 'Sending…';
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        updateCount();
        status.textContent = 'Thanks. Your message has been sent and we’ll reply by email.';
      } catch {
        status.textContent = `Sorry, that didn’t send. Please email us at ${form.dataset.email}.`;
      }
      return;
    }
    const subject = `${data.topic}: message from ${data.name}`;
    const body = `${data.message}\n\n${data.name}\n${data.email}`;
    location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = `Your email app should now open with the message ready. If it doesn’t, email us at ${form.dataset.email}.`;
  });
}
