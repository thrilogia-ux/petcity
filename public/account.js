import { bootPetCity } from './js/app.js';

function showBootError(message) {
  console.error('PetCity boot:', message);
  const btn = document.querySelector('#login-nav');
  if (!btn || btn.dataset.petcityFallback) return;
  btn.dataset.petcityFallback = '1';
  btn.addEventListener('click', () => {
    alert(typeof message === 'string' ? message : message?.message || 'PetCity no cargó. Probá Ctrl+F5.');
  });
}

function startWhenSupabaseReady(attempt = 0) {
  if (window.supabase?.createClient) {
    try {
      bootPetCity();
    } catch (error) {
      showBootError(error);
    }
    return;
  }
  if (attempt < 80) {
    setTimeout(() => startWhenSupabaseReady(attempt + 1), 100);
    return;
  }
  showBootError('No se pudo cargar Supabase. Revisá la conexión o bloqueadores y recargá la página.');
}

startWhenSupabaseReady();
