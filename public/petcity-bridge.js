/** Respaldo: Ingresar funciona aunque el módulo tarde o falle al cargar. */
(function () {
  function goAccount() {
    if (typeof window.__petcitySignIn === 'function') {
      window.__petcitySignIn();
      return;
    }
    const slug = (location.hash || '').replace(/^#\/?/, '').split('/')[0].toLowerCase();
    if (slug !== 'cuenta') location.hash = '#/cuenta';
  }

  document.getElementById('login-nav')?.addEventListener(
    'click',
    function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      goAccount();
    },
    true
  );

  window.addEventListener('hashchange', function () {
    const slug = (location.hash || '').replace(/^#\/?/, '').split('/')[0].toLowerCase();
    if (slug === 'cuenta' && typeof window.__petcitySignIn === 'function') {
      window.__petcitySignIn();
    }
  });
})();
