/** Respaldo: Ingresar → cuenta (sin bucles con el módulo). */
(function () {
  document.getElementById('login-nav')?.addEventListener(
    'click',
    function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (typeof window.__petcitySignIn === 'function') {
        window.__petcitySignIn();
        return;
      }
      if ((location.hash || '').replace(/^#\/?/, '').split('/')[0].toLowerCase() !== 'cuenta') {
        location.hash = '#/cuenta';
      }
    },
    true
  );
})();
