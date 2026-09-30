# Pagos Mercado Pago (Argentina)

## Tu intervención

1. Crear aplicación en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers) (cuenta Argentina).
2. Obtener **Access Token de prueba** (sandbox) y, más adelante, credenciales de producción.
3. Confirmar costos vigentes (comisión MP + retenciones) y si aplica **marketplace/split** para pagar al cuidador. PetCity no liquida automáticamente hasta verificar split.

## Variables en Vercel (nunca en `public/`)

| Variable | Uso |
|----------|-----|
| `MP_ACCESS_TOKEN` | API MP |
| `SUPABASE_URL` | `https://ifvfadgcyevmsklotrql.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo serverless (webhook / preferencia) |
| `MP_WEBHOOK_SECRET` | Opcional: validación de firma |

## Flujo

1. Dueño paga tras reserva **accepted** → `POST /api/mp/create-preference` (monto desde DB).
2. MP redirige al usuario; **no** marcar pagado por retorno del navegador.
3. `POST /api/mp/webhook` consulta pago en MP y llama `petcity_mark_booking_paid` (migración 011).

## Frontend

Activar pagos en preview/producción:

```html
<script>window.PETCITY_PAYMENTS = true;</script>
```

(Solo cuando las variables de Vercel estén configuradas.)

## Comisión referencia

La UI histórica muestra 10% como referencia visual. El cálculo en servidor usa `fee_ars` en metadata; revisar números antes de cobrar en producción.
