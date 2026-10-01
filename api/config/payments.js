/** Indica si Mercado Pago está configurado en el servidor (sin exponer secretos). */
module.exports = async function handler(_req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  const enabled = Boolean(
    process.env.MP_ACCESS_TOKEN
    && process.env.SUPABASE_URL
    && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return res.status(200).json({ enabled });
};
