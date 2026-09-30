/**
 * Webhook Mercado Pago (sandbox/producción). Verificar firma en producción.
 * Env: MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MP_WEBHOOK_SECRET (opcional)
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !supabaseUrl || !serviceKey) return res.status(503).end();

  const body = req.body;
  const paymentId = body?.data?.id;
  if (!paymentId) return res.status(200).end();

  const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payment = await payRes.json();
  if (payment.status !== 'approved') return res.status(200).end();

  const bookingId = payment.metadata?.booking_id;
  if (!bookingId) return res.status(200).end();

  const amount = Math.round(Number(payment.transaction_amount));
  const fee = Number(payment.metadata?.fee_ars || 0);

  await fetch(`${supabaseUrl}/rest/v1/rpc/petcity_mark_booking_paid`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_booking: bookingId, p_amount: amount, p_fee: fee, p_mp_id: String(paymentId) }),
  });

  return res.status(200).end();
};
