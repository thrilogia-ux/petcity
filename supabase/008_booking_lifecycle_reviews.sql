-- Ciclo in_progress / completed y reseñas verificadas.
begin;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending','accepted','rejected','cancelled','in_progress','completed','payment_pending','paid'));

alter table public.bookings
  add column if not exists service_time time,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create table if not exists public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (length(body) between 10 and 2000),
  created_at timestamptz not null default now()
);

alter table public.booking_reviews enable row level security;
revoke all on public.booking_reviews from anon, authenticated;
grant select on public.booking_reviews to anon, authenticated;

create policy reviews_public_read on public.booking_reviews for select to anon, authenticated using (true);

create or replace function public.petcity_start_service(chosen_booking uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.bookings b set status = 'in_progress', started_at = coalesce(started_at, now())
  where b.id = chosen_booking and b.status = 'accepted'
  and exists (
    select 1 from public.sitter_offers o
    join public.sitter_applications a on a.id = o.sitter_id
    where o.id = b.offer_id and a.user_id = (select auth.uid()) and a.status = 'approved'
  );
  if not found then raise exception 'No se pudo iniciar el servicio'; end if;
end;
$$;

create or replace function public.petcity_complete_service(chosen_booking uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.bookings b set status = 'completed', completed_at = now()
  where b.id = chosen_booking and b.status in ('accepted','in_progress')
  and (
    b.owner_id = (select auth.uid())
    or exists (
      select 1 from public.sitter_offers o
      join public.sitter_applications a on a.id = o.sitter_id
      where o.id = b.offer_id and a.user_id = (select auth.uid())
    )
  );
  if not found then raise exception 'No se pudo finalizar el servicio'; end if;
end;
$$;

create or replace function public.petcity_submit_review(chosen_booking uuid, p_rating smallint, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.bookings b
    where b.id = chosen_booking and b.owner_id = (select auth.uid()) and b.status = 'completed'
    and b.completed_at > now() - interval '30 days'
  ) then raise exception 'Solo podés reseñar servicios completados recientes'; end if;
  insert into public.booking_reviews(booking_id, reviewer_id, rating, body)
  values (chosen_booking, (select auth.uid()), p_rating, trim(p_body));
end;
$$;

revoke all on function public.petcity_start_service(uuid) from public;
grant execute on function public.petcity_start_service(uuid) to authenticated;
revoke all on function public.petcity_complete_service(uuid) from public;
grant execute on function public.petcity_complete_service(uuid) to authenticated;
revoke all on function public.petcity_submit_review(uuid, smallint, text) from public;
grant execute on function public.petcity_submit_review(uuid, smallint, text) to authenticated;

create or replace function public.petcity_can_send_booking_message(chosen_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b
    where b.id = chosen_booking and b.status in ('pending','accepted','in_progress')
    and (
      b.owner_id = (select auth.uid())
      or exists (
        select 1 from public.sitter_offers o
        join public.sitter_applications a on a.id = o.sitter_id
        where o.id = b.offer_id and a.user_id = (select auth.uid())
      )
    )
  );
$$;

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
    ), '[]'::json),
    'rating_avg', (select round(avg(r.rating)::numeric, 1) from public.booking_reviews r
      join public.bookings b on b.id = r.booking_id
      join public.sitter_offers so on so.id = b.offer_id
      where so.sitter_id = a.id),
    'rating_count', (select count(*)::int from public.booking_reviews r
      join public.bookings b on b.id = r.booking_id
      join public.sitter_offers so on so.id = b.offer_id
      where so.sitter_id = a.id)
  ) into result
  from public.sitter_offers o
  join public.sitter_applications a on a.id = o.sitter_id
  where o.id = chosen_offer and a.status = 'approved';
  if result is null then raise exception 'Oferta no disponible'; end if;
  return result;
end;
$$;

commit;
