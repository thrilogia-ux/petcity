# Matriz E2E PetCity (producción)

Completar en Vercel + Supabase con cuentas separadas. Marcar: OK / Fallo / N/A.

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

## Admin

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'TU_EMAIL'
on conflict (user_id) do nothing;
```
