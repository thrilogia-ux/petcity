/**
 * Crea preferencia MP sandbox. Requiere en Vercel:
 * MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: 'Pagos no configurados en el servidor.' });
  }
  const { booking_id: bookingId } = req.body || {};
  if (!bookingId) return res.status(400).json({ error: 'booking_id requerido' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sesión requerida' });
  }
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!anonKey) {
    return res.status(503).json({ error: 'Falta SUPABASE_ANON_KEY en el servidor.' });
  }
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Sesión inválida' });
  const user = await userRes.json();
  const userId = user?.id;
  if (!userId) return res.status(401).json({ error: 'Sesión inválida' });

  const bookingRes = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=id,owner_id,total_price_ars,status`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const bookings = await bookingRes.json();
  const booking = bookings?.[0];
  if (!booking || !['accepted', 'payment_pending'].includes(booking.status)) {
    return res.status(400).json({ error: 'Reserva no disponible para pago' });
  }
  if (booking.owner_id !== userId) {
    return res.status(403).json({ error: 'Solo el dueño puede pagar esta reserva' });
  }

  const amount = Number(booking.total_price_ars);
  const fee = Math.round(amount * 0.1);
  const preference = {
    items: [{ title: 'Cuidado PetCity', quantity: 1, unit_price: amount, currency_id: 'ARS' }],
    metadata: { booking_id: bookingId, fee_ars: String(fee) },
    back_urls: { success: `${req.headers.origin}/`, failure: `${req.headers.origin}/`, pending: `${req.headers.origin}/` },
    auto_return: 'approved',
  };

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(preference),
  });
  const data = await mpRes.json();
  if (!mpRes.ok) return res.status(502).json({ error: data.message || 'Mercado Pago error' });

  await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}`, {
    method: 'PATCH',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'payment_pending' }),
  });

  return res.status(200).json({ init_point: data.init_point, preference_id: data.id });
};
