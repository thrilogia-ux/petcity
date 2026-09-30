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
