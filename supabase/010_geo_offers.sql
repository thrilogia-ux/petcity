-- Geolocalización de cuidadores y listado público para mapa.
begin;

create or replace function public.petcity_update_sitter_location(p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.sitter_applications
  set lat = p_lat, lng = p_lng
  where user_id = (select auth.uid()) and status = 'approved';
  if not found then raise exception 'Solo cuidadores aprobados pueden actualizar ubicación'; end if;
end;
$$;

revoke all on function public.petcity_update_sitter_location(double precision, double precision) from public;
grant execute on function public.petcity_update_sitter_location(double precision, double precision) to authenticated;

create or replace function public.petcity_list_approved_offers_map()
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object(
    'offer_id', o.id,
    'service', o.service,
    'price_ars', o.price_ars,
    'unit', o.unit,
    'public_name', a.public_name,
    'city', a.city,
    'lat', a.lat,
    'lng', a.lng
  )), '[]'::json)
  from public.sitter_offers o
  join public.sitter_applications a on a.id = o.sitter_id
  where a.status = 'approved' and a.lat is not null and a.lng is not null;
$$;

revoke all on function public.petcity_list_approved_offers_map() from public;
grant execute on function public.petcity_list_approved_offers_map() to anon, authenticated;

commit;
