// Runs before the first paint (a classic script in <head>, because the CSP
// allows no inline script): applies a Day or Night theme chosen in Settings,
// so the page doesn't flash the device theme first. lib/settings.js owns the
// setting ("oql.settings" → theme) and keeps it in step after this.
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('oql.settings') || 'null');
    if (s && (s.theme === 'light' || s.theme === 'dark')) document.documentElement.setAttribute('data-theme', s.theme);
  } catch (e) {}
})();
