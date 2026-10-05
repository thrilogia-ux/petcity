-- Reglas de paseo en perfil + campos expuestos en ficha pública.
begin;

alter table public.sitter_applications
  add column if not exists walk_mode text check (walk_mode is null or walk_mode in ('individual', 'small_group', 'flexible')),
  add column if not exists walk_max_dogs smallint check (walk_max_dogs is null or (walk_max_dogs between 1 and 8));

create or replace function public.petcity_update_walk_settings(
  p_walk_mode text,
  p_walk_max_dogs smallint
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_app public.sitter_applications;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para continuar'; end if;
  select * into v_app from public.sitter_applications where user_id = (select auth.uid());
  if not found then raise exception 'Completá tu postulación primero'; end if;
  if v_app.status <> 'approved' then raise exception 'Solo cuidadores aprobados pueden editar reglas de paseo'; end if;
  if p_walk_mode is not null and p_walk_mode not in ('individual', 'small_group', 'flexible') then
    raise exception 'Modalidad de paseo inválida';
  end if;
  if p_walk_max_dogs is not null and (p_walk_max_dogs < 1 or p_walk_max_dogs > 8) then
    raise exception 'Máximo de perros inválido (1–8)';
  end if;
  update public.sitter_applications
  set
    walk_mode = p_walk_mode,
    walk_max_dogs = case when p_walk_mode = 'individual' then 1 else p_walk_max_dogs end
  where id = v_app.id;
end;
$$;

revoke all on function public.petcity_update_walk_settings(text, smallint) from public;
grant execute on function public.petcity_update_walk_settings(text, smallint) to authenticated;

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
    'walk_mode', a.walk_mode,
    'walk_max_dogs', a.walk_max_dogs,
    'reviewed_at', a.reviewed_at,
    'lat', a.lat,
    'lng', a.lng,
    'photos', coalesce((
      select json_agg(json_build_object('path', p.photo_path, 'sort_order', p.sort_order) order by p.sort_order)
      from public.sitter_offer_photos p
      where p.application_id = a.id and p.status = 'approved'
    ), '[]'::json),
    'photo_count', (
      select count(*)::int from public.sitter_offer_photos p
      where p.application_id = a.id and p.status = 'approved'
    ),
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

revoke all on function public.petcity_public_sitter_profile(uuid) from public;
grant execute on function public.petcity_public_sitter_profile(uuid) to anon, authenticated;

commit;
