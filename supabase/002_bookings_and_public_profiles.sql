-- Second migration. Run only after 001_petcity_core.sql succeeded.
begin;

alter table public.sitter_applications
add column public_name text not null default 'Cuidador PetCity'
check (length(public_name) between 2 and 80);
grant insert (public_name), update (public_name) on public.sitter_applications to authenticated;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  offer_id uuid not null references public.sitter_offers(id) on delete restrict,
  pet_id uuid not null references public.pets(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  total_price_ars bigint not null check (total_price_ars > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_petcity_bookings_owner on public.bookings(owner_id, created_at desc);
create index idx_petcity_bookings_offer on public.bookings(offer_id, created_at desc);
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;

create policy bookings_participants on public.bookings for select to authenticated
using (
  owner_id = (select auth.uid())
  or (select public.petcity_is_admin())
  or exists (
    select 1 from public.sitter_offers o
    join public.sitter_applications a on a.id = o.sitter_id
    where o.id = offer_id and a.user_id = (select auth.uid())
  )
);

create or replace function public.petcity_request_booking(
  chosen_offer uuid, chosen_pet uuid, requested_start date, requested_end date
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_service text;
  v_price integer;
  v_units integer;
  v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para reservar'; end if;
  if requested_start is null or requested_start < current_date or requested_end is null or requested_end < requested_start then
    raise exception 'Fechas inválidas';
  end if;
  if not exists (select 1 from public.pets where id = chosen_pet and owner_id = (select auth.uid())) then
    raise exception 'Elegí una de tus mascotas';
  end if;
  select o.service, o.price_ars into v_service, v_price
  from public.sitter_offers o join public.sitter_applications a on a.id = o.sitter_id
  where o.id = chosen_offer and a.status = 'approved';
  if not found then raise exception 'La oferta no está disponible'; end if;
  if v_service in ('alojamiento', 'vacaciones') then
    v_units := requested_end - requested_start;
  else
    if requested_end <> requested_start then raise exception 'Elegí un solo día para este servicio'; end if;
    v_units := 1;
  end if;
  if v_units < 1 or v_units > 30 then raise exception 'Elegí una estadía de 1 a 30 noches'; end if;
  insert into public.bookings(owner_id, offer_id, pet_id, start_date, end_date, total_price_ars)
  values ((select auth.uid()), chosen_offer, chosen_pet, requested_start, requested_end, v_price::bigint * v_units)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.petcity_request_booking(uuid, uuid, date, date) from public;
grant execute on function public.petcity_request_booking(uuid, uuid, date, date) to authenticated;

create or replace function public.petcity_decide_booking(chosen_booking uuid, decision text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if decision not in ('accepted', 'rejected') then raise exception 'Decisión inválida'; end if;
  update public.bookings b set status = decision
  where b.id = chosen_booking and b.status = 'pending'
  and exists (
    select 1 from public.sitter_offers o
    join public.sitter_applications a on a.id = o.sitter_id
    where o.id = b.offer_id and a.user_id = (select auth.uid()) and a.status = 'approved'
  );
  if not found then raise exception 'Solicitud pendiente no encontrada'; end if;
end;
$$;
revoke all on function public.petcity_decide_booking(uuid, text) from public;
grant execute on function public.petcity_decide_booking(uuid, text) to authenticated;

create or replace function public.petcity_cancel_pending_booking(chosen_booking uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.bookings set status = 'cancelled'
  where id = chosen_booking and owner_id = (select auth.uid()) and status = 'pending';
  if not found then raise exception 'Solo podés cancelar solicitudes pendientes'; end if;
end;
$$;
revoke all on function public.petcity_cancel_pending_booking(uuid) from public;
grant execute on function public.petcity_cancel_pending_booking(uuid) to authenticated;

commit;
