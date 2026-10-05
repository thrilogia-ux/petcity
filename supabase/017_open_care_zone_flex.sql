-- Solicitud abierta: match de zona flexible + validación de fechas por servicio.
begin;

create or replace function public.petcity_zone_matches(p_a text, p_b text)
returns boolean language sql immutable parallel safe as $$
  select case
    when coalesce(trim(p_a), '') = '' or coalesce(trim(p_b), '') = '' then false
    when lower(trim(p_a)) = lower(trim(p_b)) then true
    when position(lower(trim(p_a)) in lower(trim(p_b))) > 0 then true
    when position(lower(trim(p_b)) in lower(trim(p_a))) > 0 then true
    else exists (
      select 1
      from unnest(regexp_split_to_array(lower(trim(p_a)), '[,\s·]+')) ta(w),
           unnest(regexp_split_to_array(lower(trim(p_b)), '[,\s·]+')) tb(w)
      where length(ta.w) >= 3 and ta.w = tb.w
    )
  end;
$$;

drop policy if exists ocr_sitter_read on public.open_care_requests;
create policy ocr_sitter_read on public.open_care_requests for select to authenticated
  using (
    status = 'open'
    and exists (
      select 1 from public.sitter_applications a
      join public.sitter_offers o on o.sitter_id = a.id
      where a.user_id = (select auth.uid()) and a.status = 'approved'
        and o.service = open_care_requests.service
        and public.petcity_zone_matches(open_care_requests.city, a.city)
    )
  );

create or replace function public.petcity_create_open_request(
  p_pet uuid, p_service text, p_city text, p_start date, p_end date, p_notes text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para continuar'; end if;
  if p_service not in ('paseo','cuidado_en_casa','alojamiento','vacaciones') then raise exception 'Servicio inválido'; end if;
  if p_start is null or p_start < current_date or p_end is null or p_end < p_start then raise exception 'Fechas inválidas'; end if;
  if p_service in ('paseo', 'cuidado_en_casa') and p_end <> p_start then
    raise exception 'Para paseos y cuidado en casa usá un solo día (misma fecha inicio y fin)';
  end if;
  if p_service in ('alojamiento', 'vacaciones') and (p_end - p_start) > 30 then
    raise exception 'Elegí una estadía de hasta 30 noches';
  end if;
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

create or replace function public.petcity_interest_open_request(p_request uuid, p_offer uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req public.open_care_requests;
  v_app uuid;
  v_sitter_city text;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para continuar'; end if;
  select * into v_req from public.open_care_requests where id = p_request and status = 'open';
  if not found then raise exception 'Solicitud no disponible'; end if;
  select a.id, a.city into v_app, v_sitter_city from public.sitter_offers o
  join public.sitter_applications a on a.id = o.sitter_id
  where o.id = p_offer and a.user_id = (select auth.uid()) and a.status = 'approved' and o.service = v_req.service;
  if not found then raise exception 'Oferta inválida para esta solicitud'; end if;
  if not public.petcity_zone_matches(v_req.city, v_sitter_city) then
    raise exception 'Tu zona no coincide con la solicitud';
  end if;
  insert into public.open_care_request_interests (request_id, offer_id, sitter_note)
  values (p_request, p_offer, left(p_note, 400))
  on conflict (request_id, offer_id) do update set status = 'interested', sitter_note = excluded.sitter_note;
end;
$$;

commit;
