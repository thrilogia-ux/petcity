function showBootError(message) {
  console.error('PetCity boot:', message);
  const text = typeof message === 'string' ? message : message?.message || 'PetCity no cargó. Probá Ctrl+F5.';
  const btn = document.querySelector('#login-nav');
  if (btn && !btn.dataset.petcityFallback) {
    btn.dataset.petcityFallback = '1';
    btn.addEventListener('click', () => alert(text));
  }
  const banner = document.createElement('p');
  banner.className = 'notice';
  banner.style.cssText = 'margin:12px clamp(20px,4vw,64px);max-width:900px';
  banner.textContent = text;
  document.getElementById('guest-main')?.prepend(banner);
}

function startWhenSupabaseReady(attempt = 0) {
  if (window.supabase?.createClient) {
    import('./js/app.js')
      .then(({ bootPetCity }) => {
        try {
          bootPetCity();
        } catch (error) {
          showBootError(error);
        }
      })
      .catch(error => showBootError(error));
    return;
  }
  if (attempt < 120) {
    setTimeout(() => startWhenSupabaseReady(attempt + 1), 100);
    return;
  }
  showBootError('No se pudo cargar Supabase. Revisá la conexión o bloqueadores y recargá la página.');
}

startWhenSupabaseReady();
