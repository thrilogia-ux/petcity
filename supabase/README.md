# Migraciones de PetCity

Proyecto actual: https://ifvfadgcyevmsklotrql.supabase.co

## Proyecto existente

El usuario informó haber ejecutado hasta 005. Antes de tocar la base, comprobar tablas y políticas existentes. NO repetir las migraciones anteriores solo porque están en este paquete.

**Nuevas (ejecutar en orden, una sola vez cada una):**

6. 006_sitter_public_profile.sql
7. 007_sitter_offers_rules.sql
8. 008_booking_lifecycle_reviews.sql
9. 009_sitter_availability.sql
10. 010_geo_offers.sql
11. 011_payments.sql
12. 012_shop.sql
13. 013_walk_tracking.sql
14. 014_shop_submit.sql

## Proyecto nuevo / vacío

Ejecutar una sola vez, en orden: 001 → 005 (ver lista histórica abajo), luego 006 → 013.

1. 001_petcity_core.sql
2. 002_bookings_and_public_profiles.sql
3. 003_profiles_care_community.sql
4. 004_community_30_day_visibility.sql
5. 005_private_booking_messages.sql

`003_profiles_care_community_v2.sql` es alternativa de 003 — **no ejecutar ambas**.

Cada archivo completo (`begin;` … `commit;`).

## Administrador (pruebas Fase 1)

Email admin acordado: `thrilogia@gmail.com` (debe estar registrado en Auth antes):

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'thrilogia@gmail.com'
on conflict (user_id) do nothing;
```

Dueño de prueba: `dario@thrilogia.com` · Cuidador: `thrilogia@hotmail.com` · Detalle en `docs/E2E.md`.

## URLs

Ver docs/VERCEL.md y docs/E2E.md.
