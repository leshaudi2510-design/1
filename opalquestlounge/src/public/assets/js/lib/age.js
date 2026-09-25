// Age confirmation on the first visit. The page's content is the same for
// everyone; the check only decides whether the games can be played here.
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

  // The question needs an answer: Escape doesn't dismiss it.
  dialog.addEventListener('cancel', (e) => e.preventDefault());
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
      close.focus();
      rg.refresh();
      return;
    }
    if (b.dataset.age === 'close') dialog.close();
  });
  dialog.showModal();
}
