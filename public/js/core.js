export const projectUrl = 'https://ifvfadgcyevmsklotrql.supabase.co';
export const publishableKey = 'sb_publishable_5Y2umR15QdQZ5GzreS0sog_CGFsglFX';
export const paymentsEnabled = typeof window !== 'undefined' && window.PETCITY_PAYMENTS === true;

export const serviceLabels = {
  paseo: 'Paseos',
  cuidado_en_casa: 'Cuidado en casa',
  alojamiento: 'Alojamiento',
  vacaciones: 'Vacaciones',
};

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
  const node = document.querySelector('#account-status');
  if (node) node.textContent = message;
}

let serviceMessageTimer;
export function clearServiceMessageTimer() {
  if (serviceMessageTimer) clearInterval(serviceMessageTimer);
  serviceMessageTimer = null;
}
export function openModal(html) {
  clearServiceMessageTimer();
  const modal = document.querySelector('.modal');
  modal.classList.add('wide');
  modal.classList.remove('community-wide');
  document.querySelector('#modal-content').innerHTML = html;
  document.querySelector('#overlay').classList.add('open');
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
