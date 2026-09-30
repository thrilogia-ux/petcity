/** Navegación entre landing y vistas de app a pantalla completa. */
let onViewChange = () => {};

export function onPetCityViewChange(fn) {
  onViewChange = fn;
}

export function initShell() {
  if (document.getElementById('petcity-app')) return;
  const main = document.getElementById('guest-main');
  const app = document.createElement('div');
  app.id = 'petcity-app';
  app.innerHTML = `
    <section id="view-shop" class="app-view" hidden aria-label="Shop PetCity">
      <header class="app-toolbar">
        <button type="button" class="secondary app-back" data-nav="home">← Inicio</button>
        <div><div class="eyebrow">INSUMOS</div><h1 class="app-title">Shop PetCity</h1></div>
        <button type="button" class="primary" id="shop-cart-btn">Carrito</button>
      </header>
      <div class="shop-layout">
        <div id="shop-catalog" class="shop-grid" role="list"></div>
        <aside id="shop-cart-panel" class="shop-cart" aria-label="Carrito">
          <h2>Tu carrito</h2>
          <div id="shop-cart-body"><p class="fine">Todavía no agregaste productos.</p></div>
        </aside>
      </div>
    </section>
    <section id="view-community" class="app-view" hidden aria-label="Comunidad PetCity">
      <header class="app-toolbar app-toolbar-community">
        <button type="button" class="secondary app-back" data-nav="home">← Inicio</button>
        <div><div class="eyebrow">COMUNIDAD</div><h1 class="app-title">Historias de mascotas</h1></div>
        <button type="button" class="primary" id="community-compose-btn" hidden>+ Publicar</button>
      </header>
      <div class="ig-stories" id="ig-stories" aria-hidden="true">
        <div class="ig-story"><span class="ig-story-ring">🐾</span><small>PetCity</small></div>
      </div>
      <div id="community-feed" class="ig-feed"></div>
      <div id="community-composer-wrap" class="ig-composer-wrap" hidden></div>
      <p id="community-page-status" class="fine" role="status" style="padding:0 24px 24px"></p>
    </section>
    <section id="view-account" class="app-view" hidden aria-label="Mi cuenta">
      <div class="account-layout">
        <aside class="account-sidebar" aria-label="Menú de cuenta">
          <p class="account-sidebar-eyebrow">MI ESPACIO</p>
          <nav id="account-sidebar-nav"></nav>
          <button type="button" class="secondary account-sidebar-out" id="account-sidebar-home">Volver al inicio</button>
        </aside>
        <div class="account-panel-wrap">
          <div id="account-panel" class="account-panel"></div>
          <p id="account-status" class="account-status-bar" role="status" aria-live="polite"></p>
        </div>
      </div>
    </section>`;
  main?.after(app);
  app.querySelectorAll('[data-nav="home"]').forEach(btn => {
    btn.onclick = () => setView('home');
  });
  document.getElementById('account-sidebar-home')?.addEventListener('click', () => setView('home'));
  document.querySelector('.brand')?.addEventListener('click', e => {
    e.preventDefault();
    setView('home');
  });
  window.addEventListener('hashchange', syncViewFromHash);
  syncViewFromHash();
}

const hashMap = { shop: 'shop', tienda: 'shop', comunidad: 'community', community: 'community', cuenta: 'account', account: 'account' };

export function syncViewFromHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '').split('/')[0].toLowerCase();
  if (hashMap[raw]) setView(hashMap[raw], false);
  else if (!raw && document.body.classList.contains('app-mode')) setView('home', false);
}

export function setView(name, pushHash = true) {
  const guest = document.getElementById('guest-main');
  document.querySelectorAll('.app-view').forEach(v => { v.hidden = true; });
  if (name === 'home') {
    guest?.removeAttribute('hidden');
    document.body.classList.remove('app-mode');
    if (pushHash) history.replaceState(null, '', location.pathname + location.search);
  } else {
    guest?.setAttribute('hidden', '');
    document.body.classList.add('app-mode');
    const view = document.getElementById(`view-${name}`);
    if (view) view.hidden = false;
    if (pushHash) {
      const slug = name === 'community' ? 'comunidad' : name === 'account' ? 'cuenta' : name;
      if (location.hash !== `#/${slug}`) history.pushState(null, '', `#/${slug}`);
    }
  }
  window.scrollTo(0, 0);
  onViewChange(name);
}

export function panelEl(id) {
  return document.getElementById(id);
}
