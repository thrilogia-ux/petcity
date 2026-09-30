-- Reglas multi-servicio y edición post-aprobación (precios visibles solo si approved).
begin;

create or replace function public.petcity_upsert_sitter_offer(
  p_service text, p_price_ars integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_app public.sitter_applications;
  v_unit text;
  v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para continuar'; end if;
  select * into v_app from public.sitter_applications where user_id = (select auth.uid());
  if not found then raise exception 'Completá tu postulación primero'; end if;
  if v_app.status not in ('draft','changes_requested','approved','pending') then
    raise exception 'No podés editar la oferta en este estado';
  end if;
  v_unit := case
    when p_service in ('alojamiento','vacaciones') then 'noche'
    when p_service = 'paseo' then 'paseo'
    else 'dia'
  end;
  insert into public.sitter_offers(sitter_id, service, price_ars, unit)
  values (v_app.id, p_service, p_price_ars, v_unit)
  on conflict (sitter_id, service) do update set price_ars = excluded.price_ars, unit = excluded.unit
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.petcity_upsert_sitter_offer(text, integer) from public;
grant execute on function public.petcity_upsert_sitter_offer(text, integer) to authenticated;

create or replace function public.petcity_review_sitter_photo(photo_id uuid, decision text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.petcity_is_admin()) then raise exception 'Acceso denegado'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decisión inválida'; end if;
  update public.sitter_offer_photos set status = decision where id = photo_id and status = 'pending';
end;
$$;

revoke all on function public.petcity_review_sitter_photo(uuid, text) from public;
grant execute on function public.petcity_review_sitter_photo(uuid, text) to authenticated;

commit;
