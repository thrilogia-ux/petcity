# Estado verificable de PetCity

Actualizado: landing con confianza, pasos, testimonios demo y cobertura dinámica; tarjetas verificadas/simuladas OK. **Fase 1 E2E** = circuito solicitud → reseña (ver [E2E.md](E2E.md)). Migraciones 006–013 aplicadas en entorno de prueba del usuario.

## Desplegado

- Frontend estático en Vercel (repo `thrilogia-ux/petcity`).
- Entrada real: **Ingresar** · Demo: **Recorrido demo** o `/?demo=1` / [`demo.html`](../public/demo.html).

## Implementado en código

| Área | Estado |
|------|--------|
| Auth, perfil, mascotas, postulación, moderación | Código + migr. 001–005 |
| Ofertas, solicitud RPC, chat, novedades, comunidad | Código + migr. 001–005 |
| Ficha pública, fotos oferta, multi-servicio | Código + **006–007** |
| Inicio/fin servicio, reseñas | Código + **008** |
| Agenda/capacidad | Código + **009** |
| Mapa ofertas reales | Código + **010** |
| Pagos MP sandbox | API Vercel + **011** + `/api/config/payments` |
| Shop checkout | Código + **012** + **014** |
| Tracking paseo (Fase 2) | Código + **013** — GPS activar/detener + mapa OSM |
| Frontend modular | `public/js/core.js`, `public/js/app.js`, `public/account.js` (ES modules) |

## Pruebas

- Matriz manual: [docs/E2E.md](E2E.md)
- `npm run build`: validación JS local
- RLS/RPC en producción: requiere migraciones 006+ y cuentas de prueba

## Criterios de aceptación (recordatorio)

- Precio en servidor; no confiar en total del navegador.
- Reseñas solo servicios **completed**; demo no mezcla reputación.
- Pagos: webhook MP, no retorno del browser.
- Secretos solo en Vercel/Supabase dashboard.

## Pendiente operativo (usuario)

1. Ejecutar SQL 006–013 en Supabase SQL Editor (en orden).
2. Configurar env Vercel para pagos (ver PAYMENTS.md).
3. Completar matriz E2E en producción.
