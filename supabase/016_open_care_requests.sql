-- Solicitud abierta: dueño publica; cuidadores se ofrecen; dueño elige uno → booking pending.
begin;

create table if not exists public.open_care_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  service text not null check (service in ('paseo','cuidado_en_casa','alojamiento','vacaciones')),
  city text not null,
  start_date date not null,
  end_date date not null,
  notes text,
  status text not null default 'open' check (status in ('open','chosen','cancelled')),
  chosen_offer_id uuid references public.sitter_offers(id),
  created_at timestamptz not null default now()
);

create table if not exists public.open_care_request_interests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.open_care_requests(id) on delete cascade,
  offer_id uuid not null references public.sitter_offers(id) on delete cascade,
  sitter_note text,
  status text not null default 'interested' check (status in ('interested','withdrawn','selected')),
  created_at timestamptz not null default now(),
  unique (request_id, offer_id)
);

alter table public.open_care_requests enable row level security;
alter table public.open_care_request_interests enable row level security;
revoke all on public.open_care_requests, public.open_care_request_interests from anon;
grant select, insert, update on public.open_care_requests to authenticated;
grant select, insert, update on public.open_care_request_interests to authenticated;

drop policy if exists ocr_owner on public.open_care_requests;
drop policy if exists ocr_sitter_read on public.open_care_requests;
drop policy if exists ocri_owner_read on public.open_care_request_interests;
drop policy if exists ocri_sitter on public.open_care_request_interests;

create policy ocr_owner on public.open_care_requests for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy ocr_sitter_read on public.open_care_requests for select to authenticated
  using (
    status = 'open'
    and exists (
      select 1 from public.sitter_applications a
      join public.sitter_offers o on o.sitter_id = a.id
      where a.user_id = (select auth.uid()) and a.status = 'approved'
        and o.service = open_care_requests.service
        and lower(trim(a.city)) = lower(trim(open_care_requests.city))
    )
  );

create policy ocri_owner_read on public.open_care_request_interests for select to authenticated
  using (exists (select 1 from public.open_care_requests r where r.id = request_id and r.owner_id = (select auth.uid())));

create policy ocri_sitter on public.open_care_request_interests for all to authenticated
  using (exists (
    select 1 from public.sitter_offers o
    join public.sitter_applications a on a.id = o.sitter_id
    where o.id = offer_id and a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.sitter_offers o
    join public.sitter_applications a on a.id = o.sitter_id
    where o.id = offer_id and a.user_id = (select auth.uid())
  ));

create or replace function public.petcity_create_open_request(
  p_pet uuid, p_service text, p_city text, p_start date, p_end date, p_notes text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para continuar'; end if;
  if p_service not in ('paseo','cuidado_en_casa','alojamiento','vacaciones') then raise exception 'Servicio inválido'; end if;
  if p_start is null or p_start < current_date or p_end is null or p_end < p_start then raise exception 'Fechas inválidas'; end if;
  if trim(coalesce(p_city, '')) = '' then raise exception 'Indicá la zona o ciudad'; end if;
  if not exists (select 1 from public.pets where id = p_pet and owner_id = (select auth.uid())) then
    raise exception 'Elegí una de tus mascotas';
  end if;
  insert into public.open_care_requests (owner_id, pet_id, service, city, start_date, end_date, notes)
  values ((select auth.uid()), p_pet, p_service, left(trim(p_city), 100), p_start, p_end, left(p_notes, 800))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.petcity_create_open_request(uuid, text, text, date, date, text) from public;
grant execute on function public.petcity_create_open_request(uuid, text, text, date, date, text) to authenticated;

create or replace function public.petcity_interest_open_request(p_request uuid, p_offer uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req public.open_care_requests;
  v_app uuid;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para continuar'; end if;
  select * into v_req from public.open_care_requests where id = p_request and status = 'open';
  if not found then raise exception 'Solicitud no disponible'; end if;
  select a.id into v_app from public.sitter_offers o
  join public.sitter_applications a on a.id = o.sitter_id
  where o.id = p_offer and a.user_id = (select auth.uid()) and a.status = 'approved' and o.service = v_req.service;
  if not found then raise exception 'Oferta inválida para esta solicitud'; end if;
  if lower(trim(v_req.city)) <> (select lower(trim(city)) from public.sitter_applications where id = v_app) then
    raise exception 'Tu zona no coincide con la solicitud';
  end if;
  insert into public.open_care_request_interests (request_id, offer_id, sitter_note)
  values (p_request, p_offer, left(p_note, 400))
  on conflict (request_id, offer_id) do update set status = 'interested', sitter_note = excluded.sitter_note;
end;
$$;
revoke all on function public.petcity_interest_open_request(uuid, uuid, text) from public;
grant execute on function public.petcity_interest_open_request(uuid, uuid, text) to authenticated;

create or replace function public.petcity_choose_open_request(p_request uuid, p_offer uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_req public.open_care_requests;
  v_booking uuid;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para continuar'; end if;
  select * into v_req from public.open_care_requests where id = p_request and owner_id = (select auth.uid()) and status = 'open';
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if not exists (
    select 1 from public.open_care_request_interests i
    where i.request_id = p_request and i.offer_id = p_offer and i.status = 'interested'
  ) then raise exception 'Ese cuidador no se ofreció para esta solicitud'; end if;
  v_booking := public.petcity_request_booking(p_offer, v_req.pet_id, v_req.start_date, v_req.end_date);
  update public.open_care_requests set status = 'chosen', chosen_offer_id = p_offer where id = p_request;
  update public.open_care_request_interests set status = 'selected' where request_id = p_request and offer_id = p_offer;
  update public.open_care_request_interests set status = 'withdrawn' where request_id = p_request and offer_id <> p_offer and status = 'interested';
  return v_booking;
end;
$$;
revoke all on function public.petcity_choose_open_request(uuid, uuid) from public;
grant execute on function public.petcity_choose_open_request(uuid, uuid) to authenticated;

create or replace function public.petcity_cancel_open_request(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para continuar'; end if;
  update public.open_care_requests set status = 'cancelled'
  where id = p_request and owner_id = (select auth.uid()) and status = 'open';
  if not found then raise exception 'No podés cancelar esta solicitud'; end if;
end;
$$;
revoke all on function public.petcity_cancel_open_request(uuid) from public;
grant execute on function public.petcity_cancel_open_request(uuid) to authenticated;

commit;
