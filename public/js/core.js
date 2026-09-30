export const projectUrl = 'https://ifvfadgcyevmsklotrql.supabase.co';
export const publishableKey = 'sb_publishable_5Y2umR15QdQZ5GzreS0sog_CGFsglFX';
export const paymentsEnabled = typeof window !== 'undefined' && window.PETCITY_PAYMENTS === true;

export const serviceLabels = {
  paseo: 'Paseos',
  cuidado_en_casa: 'Cuidado en casa',
  alojamiento: 'Alojamiento',
  vacaciones: 'Vacaciones',
};

const serviceIconMap = {
  paseo: '🐕',
  cuidado_en_casa: '⌂',
  alojamiento: '☾',
  vacaciones: '☀',
  Paseos: '🐕',
  'Cuidado en casa': '⌂',
  Alojamiento: '☾',
  Vacaciones: '☀',
};

export function serviceIcon(key) {
  return serviceIconMap[key] || '🐾';
}

export function formatMapPrice(amount) {
  return '$' + Number(amount).toLocaleString('es-AR');
}

export function buildMapPinHtml({ photoUrl, serviceKey, price, active = false }) {
  const thumb = String(photoUrl ?? '').replace(/"/g, '&quot;');
  return `<div class="map-pin-chip${active ? ' is-active' : ''}"><img class="map-pin-thumb" src="${thumb}" alt=""><span class="map-pin-svc" aria-hidden="true">${serviceIcon(serviceKey)}</span><span class="map-pin-price">${esc(formatMapPrice(price))}</span></div>`;
}

export function createMapPinIcon(L, options) {
  if (!L) return null;
  return L.divIcon({
    className: 'pet-map-icon',
    html: buildMapPinHtml(options),
    iconSize: [142, 52],
    iconAnchor: [71, 52],
  });
}

export const stateLabels = {
  draft: 'Borrador',
  pending: 'Pendiente',
  approved: 'Aprobado',
  changes_requested: 'Se pidieron cambios',
  rejected: 'Rechazado',
  accepted: 'Aceptada',
  cancelled: 'Cancelada',
  in_progress: 'En curso',
  completed: 'Completada',
  payment_pending: 'Pago pendiente',
  paid: 'Pagada',
};

let client;
export function getClient() {
  if (!window.supabase?.createClient) throw new Error('No se pudo cargar la conexión. Reintentá en unos segundos.');
  return client ??= window.supabase.createClient(projectUrl, publishableKey);
}

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function status(message) {
  document.querySelectorAll('#account-status, .account-status-bar, #community-page-status').forEach(node => {
    if (node) node.textContent = message;
  });
}

let serviceMessageTimer;
export function clearServiceMessageTimer() {
  if (serviceMessageTimer) clearInterval(serviceMessageTimer);
  serviceMessageTimer = null;
}
export function openModal(html, { wide = true, community = false } = {}) {
  clearServiceMessageTimer();
  const modal = document.querySelector('.modal');
  modal.classList.toggle('wide', wide);
  modal.classList.toggle('community-wide', community);
  document.querySelector('#modal-content').innerHTML = html;
  document.querySelector('#overlay').classList.add('open');
}

export function closeModal() {
  clearServiceMessageTimer();
  document.querySelector('#overlay')?.classList.remove('open');
  document.querySelector('.modal')?.classList.remove('wide', 'community-wide');
}

/** Contenido en panel de cuenta (sin popup). */
export function fillAccountPanel(html) {
  clearServiceMessageTimer();
  const panel = document.querySelector('#account-panel');
  if (panel) panel.innerHTML = html;
}

export function setServiceMessageTimer(fn) {
  clearServiceMessageTimer();
  serviceMessageTimer = fn;
}

export async function signedPhoto(path) {
  if (!path) return '';
  const { data } = await getClient().storage.from('petcity-media').createSignedUrl(path, 3600);
  return data?.signedUrl || '';
}

export async function uploadPhoto(file, folder) {
  if (!file?.size) return null;
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!extensions[file.type] || file.size > 5242880) throw new Error('Elegí una imagen JPG, PNG o WebP de hasta 5 MB.');
  const { data: { user } } = await getClient().auth.getUser();
  if (!user) throw new Error('Ingresá de nuevo para subir una foto.');
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const { error } = await getClient().storage.from('petcity-media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}
