// Age confirmation on the first visit. The page's content is the same for
// everyone; the check only decides whether the games can be played here.
// age-boot.js has usually opened the dialog already (it runs before this
// module graph has loaded); this module saves the answer.
import { store } from './store.js';
import { rg } from './rg.js';

const LOCK_DAYS = 30;

export function startAgeGate() {
  const dialog = document.getElementById('age-gate');
  if (!dialog) return;
  const saved = store.get('age', null);
  const expired = saved?.answer === 'no' && Date.now() - saved.at > LOCK_DAYS * 24 * 3600 * 1000;
  if (saved && !expired) return;
  if (expired) store.remove('age');

  // The question needs an answer, so Escape doesn't dismiss it. Browsers can
  // still close it without one (Chromium lets a second Escape through, and so
  // does Android's Back gesture). Nothing is stored then and the games stay
  // locked, and a "Confirm my age" button on a locked game asks again.
  dialog.addEventListener('cancel', (e) => e.preventDefault());
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-open="age-gate"]') || dialog.open) return;
    if (store.get('age', null)) return; // an answer stands; a "no" keeps its 30-day lock
    dialog.showModal();
  });
  dialog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-age]');
    if (!b) return;
    if (b.dataset.age === 'yes') {
      store.set('age', { answer: 'yes', at: Date.now() });
      dialog.close();
      rg.refresh();
      return;
    }
    if (b.dataset.age === 'no') {
      store.set('age', { answer: 'no', at: Date.now() });
      dialog.querySelector('.age__actions').hidden = true;
      const under = dialog.querySelector('.age__under');
      under.hidden = false;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'btn btn--secondary';
      close.dataset.age = 'close';
      close.textContent = 'Close and read the site';
      under.append(close);
      // Focus the explanation (it has tabindex="-1"), not the button below it:
      // on a short screen, focusing the button would scroll the message up
      // under the dialog's head. Tab goes on to the helpline, then the button.
      const msg = under.querySelector('p');
      if (msg) msg.focus();
      else close.focus();
      rg.refresh();
      return;
    }
    if (b.dataset.age === 'close') dialog.close();
  });
  dialog.dataset.ready = '1';
  if (!dialog.open) dialog.showModal();
  // A button pressed while only age-boot.js was running: apply it now.
  const pending = dialog.dataset.pending;
  if (pending) {
    delete dialog.dataset.pending;
    const b = dialog.querySelector(`[data-age="${pending}"]`);
    b?.removeAttribute('aria-busy');
    b?.click();
  }
}
