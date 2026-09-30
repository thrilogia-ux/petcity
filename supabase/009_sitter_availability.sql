-- Disponibilidad semanal, excepciones y validación en solicitud.
begin;

create table if not exists public.sitter_availability_rules (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.sitter_applications(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  capacity smallint not null default 1 check (capacity between 1 and 10),
  unique (application_id, weekday)
);

create table if not exists public.sitter_availability_blackouts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.sitter_applications(id) on delete cascade,
  blackout_date date not null,
  unique (application_id, blackout_date)
);

alter table public.sitter_availability_rules enable row level security;
alter table public.sitter_availability_blackouts enable row level security;
revoke all on public.sitter_availability_rules, public.sitter_availability_blackouts from anon, authenticated;
grant select, insert, update, delete on public.sitter_availability_rules, public.sitter_availability_blackouts to authenticated;

create policy avail_rules_owner on public.sitter_availability_rules for all to authenticated
using (exists (select 1 from public.sitter_applications a where a.id = application_id and a.user_id = (select auth.uid())))
with check (exists (select 1 from public.sitter_applications a where a.id = application_id and a.user_id = (select auth.uid())));

create policy avail_blackouts_owner on public.sitter_availability_blackouts for all to authenticated
using (exists (select 1 from public.sitter_applications a where a.id = application_id and a.user_id = (select auth.uid())))
with check (exists (select 1 from public.sitter_applications a where a.id = application_id and a.user_id = (select auth.uid())));

create or replace function public.petcity_request_booking(
  chosen_offer uuid, chosen_pet uuid, requested_start date, requested_end date
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_service text;
  v_price integer;
  v_units integer;
  v_id uuid;
  v_sitter_id uuid;
  d date;
  v_dow int;
  v_cap int;
  v_booked int;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para reservar'; end if;
  if requested_start is null or requested_start < current_date or requested_end is null or requested_end < requested_start then
    raise exception 'Fechas inválidas';
  end if;
  if not exists (select 1 from public.pets where id = chosen_pet and owner_id = (select auth.uid())) then
    raise exception 'Elegí una de tus mascotas';
  end if;
  select o.service, o.price_ars, a.id into v_service, v_price, v_sitter_id
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

  d := requested_start;
  while d <= requested_end loop
    if exists (select 1 from public.sitter_availability_blackouts b where b.application_id = v_sitter_id and b.blackout_date = d) then
      raise exception 'El cuidador no está disponible en %', d;
    end if;
    v_dow := extract(dow from d)::int;
    select r.capacity into v_cap from public.sitter_availability_rules r
    where r.application_id = v_sitter_id and r.weekday = v_dow;
    if found then
      select count(*) into v_booked from public.bookings b
      join public.sitter_offers o on o.id = b.offer_id
      where o.sitter_id = v_sitter_id and b.status in ('pending','accepted','in_progress','paid')
        and d between b.start_date and b.end_date;
      if v_booked >= v_cap then raise exception 'Sin cupo para %', d; end if;
    end if;
    d := d + 1;
  end loop;

  insert into public.bookings(owner_id, offer_id, pet_id, start_date, end_date, total_price_ars)
  values ((select auth.uid()), chosen_offer, chosen_pet, requested_start, requested_end, v_price::bigint * v_units)
  returning id into v_id;
  return v_id;
end;
$$;

commit;
