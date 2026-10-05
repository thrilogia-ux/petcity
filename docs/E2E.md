# Matriz E2E PetCity (producción)

Completar en Vercel + Supabase con cuentas separadas. Marcar: OK / Fallo / N/A.

## Cuentas de prueba (Fase 1)

| Rol | Email | Uso |
|-----|--------|-----|
| **Admin / moderación** | `thrilogia@gmail.com` | Aprobar postulaciones y comunidad |
| **Dueño de mascota** | `dario@thrilogia.com` | Mascotas, solicitudes, reseñas, shop |
| **Cuidador** | `thrilogia@hotmail.com` | Postulación, aceptar servicios, novedades, GPS paseo |

Cada cuenta debe existir en **Supabase Auth** (registro + email confirmado). Cerrar sesión al cambiar de rol.

### Hacer admin a thrilogia@gmail.com

Ejecutar en SQL Editor **después** de que ese email se haya registrado al menos una vez:

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'thrilogia@gmail.com'
on conflict (user_id) do nothing;
```

Comprobar:

```sql
select u.email, a.user_id
from public.admin_users a
join auth.users u on u.id = a.user_id
where u.email = 'thrilogia@gmail.com';
```

---

## Fase 1 — Circuito de cuidado (prioridad)

Objetivo: un paseo real de punta a punta sin pagos (Fase 2).

| # | Paso | Quién | Dónde en la app |
|---|------|--------|-----------------|
| 1 | Ver oferta verificada + mapa | Anónimo | Home → tarjeta / pin |
| 2 | Login dueño + mascota cargada | `dario@thrilogia.com` | Mi perfil → Mis mascotas |
| 3 | **Solicitar cuidado** (fecha + mascota) | Dueño | Solicitar cuidado → **Mis cuidados** |
| 4 | **Aceptar** solicitud | `thrilogia@hotmail.com` | Mis cuidados → Aceptar |
| 5 | **Chat** del servicio | Ambos | Ver servicio → Mensajes |
| 6 | **Novedad** con foto (opcional) | Cuidador | Ver servicio → Compartir novedad |
| 7 | **Iniciar** → **Finalizar** servicio | Cuidador | Ver servicio |
| 8 | **Reseña** verificada | Dueño | Ver servicio (completado) |

Checklist rápido:

- [ ] 1–3 Dueño solicita paseo a cuidador aprobado
- [ ] 4 Cuidador acepta
- [ ] 5 Chat ida y vuelta
- [ ] 6–7 Ciclo in_progress → completed
- [ ] 8 Reseña visible en ficha pública (★ en tarjeta)

---

## Fase 1b — Solicitud abierta (Cooper)

Requiere migraciones **016** y **017** en Supabase.

| # | Paso | Quién | Dónde |
|---|------|--------|--------|
| 1 | Publicar solicitud (zona + servicio + fechas) | Dueño | Home → **Publicar solicitud abierta** o Mis cuidados |
| 2 | Ver solicitud en bandeja | Cuidador (misma zona aprox.) | Mis cuidados → **Solicitudes en tu zona** |
| 3 | **Me interesa** + mensaje | Cuidador | Modal → enviar |
| 4 | **Ver ofertas** → Ver perfil / Elegir | Dueño | Mis cuidados → Ver ofertas (N) |
| 5 | Reserva **pending** + cuidador acepta | Ambos | Igual que Fase 1 pasos 4–8 |

Checklist:

- [ ] Dueño publica paseo en Palermo (un solo día inicio=fin)
- [ ] Cuidador con ciudad “Palermo Soho” ve la solicitud (match flexible 017)
- [ ] Dueño elige cuidador → booking pending
- [ ] Cuidador acepta y completa circuito

---

## Fase 2 — Paseo GPS, pagos y comunidad

Ejecutar migración **014_shop_submit.sql** si aún no está aplicada.

| # | Paso | Quién | Dónde |
|---|------|--------|--------|
| 1 | Paseo **in_progress** + GPS | Cuidador | Mis cuidados → Ver servicio → **Activar GPS** / **Detener** |
| 2 | Ver recorrido en vivo | Dueño | Mismo servicio → mapa + contador de puntos |
| 3 | MP sandbox | Dueño | Tras aceptación → **Pagar con MP** (requiere env Vercel + `/api/config/payments` → `enabled: true`) |
| 4 | Webhook marca **paid** | — | MP Developers → webhook → `/api/mp/webhook` |
| 5 | Comunidad | Usuario | Comunidad → publicar → tarjeta **En revisión** |
| 6 | Moderar post | Admin | Moderación → Revisar comunidad |
| 7 | Shop | Dueño | Shop → carrito → **Confirmar pedido** (RPC `petcity_submit_shop_cart`) |

Checklist Fase 2:

- [ ] GPS: polyline + puntos en mapa OSM
- [ ] Pago: preferencia MP solo con sesión del dueño
- [ ] Comunidad: pending visible para autor
- [ ] Shop: pedido `pending_payment` y stock descontado

---

## Matriz general

| Paso | Dueño | Cuidador | Admin | Anónimo |
|------|-------|----------|-------|---------|
| Ver ofertas aprobadas | — | — | — | OK esperado |
| Registro + confirmación email | | | | N/A |
| Login / logout | | | | N/A |
| Recuperar contraseña | | | | N/A |
| CRUD mascota + foto | | | N/A | N/A |
| Postulación cuidador | N/A | | N/A | N/A |
| Moderar postulación | N/A | N/A | | N/A |
| Solicitar cuidado (RPC precio) | | N/A | N/A | N/A |
| Aceptar / rechazar solicitud | N/A | | N/A | N/A |
| Chat booking_messages | | | N/A | N/A |
| Novedades care_updates | N/A | | N/A | N/A |
| Iniciar / completar servicio | N/A | | N/A | N/A |
| Reseña post-completado | | N/A | N/A | N/A |
| Comunidad publicar (pendiente) | | | | bloqueado |
| Comunidad moderar | N/A | N/A | | N/A |
| Shop pedido persistente | | | | N/A |
| Pago sandbox (flag) | | | N/A | N/A |

## Supabase URL Configuration

- **Site URL:** URL de producción Vercel
- **Redirect URLs:** `https://<proyecto>.vercel.app/**`, `http://localhost:3000/**`

## Admin (referencia)

Ver bloque **Cuentas de prueba** arriba para el email activo del entorno.
