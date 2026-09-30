-- Perfil público del cuidador y fotos moderadas. Ejecutar una sola vez después de 005.
begin;

alter table public.sitter_applications
  add column if not exists headline text check (headline is null or length(headline) <= 120),
  add column if not exists neighborhood text check (neighborhood is null or length(neighborhood) <= 100),
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists max_pets smallint check (max_pets is null or (max_pets between 1 and 20)),
  add column if not exists home_type text check (home_type is null or home_type in ('casa','depto','finca')),
  add column if not exists accepts_cats boolean not null default true,
  add column if not exists accepts_large_dogs boolean not null default true;

create table if not exists public.sitter_offer_photos (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.sitter_applications(id) on delete cascade,
  photo_path text not null,
  sort_order smallint not null default 0 check (sort_order between 0 and 20),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists idx_petcity_offer_photos_app on public.sitter_offer_photos(application_id, sort_order);

alter table public.sitter_offer_photos enable row level security;
revoke all on public.sitter_offer_photos from anon, authenticated;
grant select on public.sitter_offer_photos to anon, authenticated;
grant insert, update, delete on public.sitter_offer_photos to authenticated;

create policy sitter_photos_read on public.sitter_offer_photos for select to anon, authenticated
using (
  status = 'approved'
  or exists (select 1 from public.sitter_applications a where a.id = application_id and a.user_id = (select auth.uid()))
  or (select public.petcity_is_admin())
);

create policy sitter_photos_write on public.sitter_offer_photos for insert to authenticated
with check (
  exists (
    select 1 from public.sitter_applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  )
);

create policy sitter_photos_update on public.sitter_offer_photos for update to authenticated
using (
  exists (
    select 1 from public.sitter_applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  )
);

create or replace function public.petcity_public_sitter_profile(chosen_offer uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  result json;
begin
  select json_build_object(
    'offer_id', o.id,
    'service', o.service,
    'price_ars', o.price_ars,
    'unit', o.unit,
    'public_name', a.public_name,
    'city', a.city,
    'neighborhood', a.neighborhood,
    'headline', a.headline,
    'bio', a.bio,
    'max_pets', a.max_pets,
    'home_type', a.home_type,
    'accepts_cats', a.accepts_cats,
    'accepts_large_dogs', a.accepts_large_dogs,
    'lat', a.lat,
    'lng', a.lng,
    'photos', coalesce((
      select json_agg(json_build_object('path', p.photo_path, 'sort_order', p.sort_order) order by p.sort_order)
      from public.sitter_offer_photos p
      where p.application_id = a.id and p.status = 'approved'
    ), '[]'::json)
  ) into result
  from public.sitter_offers o
  join public.sitter_applications a on a.id = o.sitter_id
  where o.id = chosen_offer and a.status = 'approved';
  if result is null then raise exception 'Oferta no disponible'; end if;
  return result;
end;
$$;

revoke all on function public.petcity_public_sitter_profile(uuid) from public;
grant execute on function public.petcity_public_sitter_profile(uuid) to anon, authenticated;

commit;
