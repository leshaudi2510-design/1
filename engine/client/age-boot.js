// Opens the age question as soon as the page has been parsed, before the
// app.js module graph has loaded: on a first visit the question is the
// largest thing on a phone screen, so it decides when the page looks ready.
// A classic deferred script with no imports, placed before app.js so it
// runs first. It only opens the dialog: lib/age.js still saves the answer.
// A button pressed before age.js is ready is kept (data-pending) and
// applied by age.js as soon as it runs, so no tap is lost.
(function () {
  function open() {
    var d = document.getElementById('age-gate');
    if (!d || d.open || !d.showModal) return;
    var s = null;
    try {
      s = JSON.parse(localStorage.getItem('oql.age') || 'null');
    } catch (e) {}
    // Answered, and not a "no" older than 30 days (LOCK_DAYS in lib/age.js).
    if (s && !(s.answer === 'no' && Date.now() - s.at > 30 * 864e5)) return;
    // The question needs an answer: Escape doesn't dismiss it.
    d.addEventListener('cancel', function (e) {
      e.preventDefault();
    });
    d.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-age]');
      if (!b || d.dataset.ready) return;
      d.dataset.pending = b.dataset.age;
      b.setAttribute('aria-busy', 'true');
    });
    d.showModal();
  }
  // A prerendered page asks only once it is actually shown.
  if (document.prerendering) document.addEventListener('prerenderingchange', open, { once: true });
  else open();
})();
