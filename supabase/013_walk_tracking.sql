-- Tracking de paseo (solo booking in_progress + servicio paseo).
begin;

create table if not exists public.walk_track_points (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_petcity_walk_points on public.walk_track_points(booking_id, recorded_at desc);

alter table public.walk_track_points enable row level security;
revoke all on public.walk_track_points from anon, authenticated;
grant select, insert on public.walk_track_points to authenticated;

create or replace function public.petcity_can_access_walk_track(chosen_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b
    join public.sitter_offers o on o.id = b.offer_id
    where b.id = chosen_booking and b.status = 'in_progress' and o.service = 'paseo'
    and (
      b.owner_id = (select auth.uid())
      or exists (select 1 from public.sitter_applications a where a.id = o.sitter_id and a.user_id = (select auth.uid()))
    )
  );
$$;

create policy walk_points_read on public.walk_track_points for select to authenticated
using (public.petcity_can_access_walk_track(booking_id));

create policy walk_points_insert on public.walk_track_points for insert to authenticated
with check (
  public.petcity_can_access_walk_track(booking_id)
  and exists (
    select 1 from public.bookings b
    join public.sitter_offers o on o.id = b.offer_id
    join public.sitter_applications a on a.id = o.sitter_id
    where b.id = booking_id and a.user_id = (select auth.uid())
  )
);

create or replace function public.petcity_record_walk_point(chosen_booking uuid, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.petcity_can_access_walk_track(chosen_booking) then
    raise exception 'Tracking no disponible';
  end if;
  insert into public.walk_track_points(booking_id, lat, lng) values (chosen_booking, p_lat, p_lng);
end;
$$;

grant execute on function public.petcity_record_walk_point(uuid, double precision, double precision) to authenticated;
grant execute on function public.petcity_can_access_walk_track(uuid) to authenticated;

commit;
