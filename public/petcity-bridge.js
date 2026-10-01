/** Respaldo: Ingresar / cuenta / shop real antes de que termine de cargar el módulo. */
(function () {
  function hashSlug() {
    return (location.hash || '').replace(/^#\/?/, '').split('/')[0].toLowerCase();
  }

  function whenReady(fn, attempt = 0) {
    if (typeof fn === 'function' && fn()) return;
    if (attempt >= 120) return;
    setTimeout(() => whenReady(fn, attempt + 1), 100);
  }

  function openAccountWhenReady() {
    whenReady(() => {
      if (typeof window.__petcityOpenAccount === 'function') {
        window.__petcityOpenAccount();
        return true;
      }
      if (typeof window.__petcitySignIn === 'function') {
        window.__petcitySignIn();
        return true;
      }
      return false;
    });
  }

  document.getElementById('login-nav')?.addEventListener(
    'click',
    function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (typeof window.__petcitySignIn === 'function') {
        window.__petcitySignIn();
        return;
      }
      if (hashSlug() !== 'cuenta') location.hash = '#/cuenta';
      openAccountWhenReady();
    },
    true
  );

  if (hashSlug() === 'cuenta') {
    window.addEventListener('petcity-ready', () => {
      if (typeof window.__petcitySyncHash === 'function') window.__petcitySyncHash();
      if (typeof window.__petcityOpenAccount === 'function') window.__petcityOpenAccount();
    });
    openAccountWhenReady();
  }
})();
