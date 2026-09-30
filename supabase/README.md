# Migraciones de PetCity

Proyecto actual: https://ifvfadgcyevmsklotrql.supabase.co

## Proyecto existente

El usuario informó haber ejecutado hasta 005. Antes de tocar la base, comprobar tablas y políticas existentes. NO repetir las migraciones anteriores solo porque están en este paquete. Varias usan CREATE TABLE, CREATE POLICY o ADD COLUMN sin IF NOT EXISTS.

## Proyecto nuevo / vacío

Ejecutar una sola vez, en orden:

1. 001_petcity_core.sql
2. 002_bookings_and_public_profiles.sql
3. 003_profiles_care_community.sql (ya contiene la corrección de referencias ambiguas)
4. 004_community_30_day_visibility.sql
5. 005_private_booking_messages.sql

`003_profiles_care_community_v2.sql` se incluye por fidelidad histórica: es una copia alternativa de 003, NO una migración adicional. Nunca ejecutar ambas.

Cada archivo debe ejecutarse completo, desde begin; hasta commit;. Las nuevas migraciones que produzca Cursor deben empezar en 006 y conservar los datos existentes.

## Administrador

Registrar y confirmar primero la cuenta. Asignar administrador desde SQL Editor con un email real propio:

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'TU_EMAIL_REGISTRADO'
on conflict (user_id) do nothing;
```

No dar permisos de administrador desde el navegador ni permitir que un usuario se autoapruebe como cuidador.

## URLs

En Authentication → URL Configuration, configurar el dominio de Vercel en Site URL y Redirect URLs; permitir http://localhost:3000/** para desarrollo. Ver docs/VERCEL.md.
