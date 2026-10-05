-- Perfil público editable (aprobados) + resumen de ingresos/trabajos.
begin;

create or replace function public.petcity_update_sitter_public_profile(
  p_public_name text,
  p_city text,
  p_neighborhood text,
  p_headline text,
  p_bio text,
  p_max_pets smallint,
  p_home_type text,
  p_accepts_cats boolean,
  p_accepts_large_dogs boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_app public.sitter_applications;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para continuar'; end if;
  select * into v_app from public.sitter_applications where user_id = (select auth.uid());
  if not found then raise exception 'Completá tu postulación primero'; end if;
  if v_app.status <> 'approved' then raise exception 'Solo cuidadores aprobados pueden editar la tarjeta pública'; end if;
  if length(trim(coalesce(p_public_name, ''))) < 2 then raise exception 'Nombre público muy corto'; end if;
  if length(trim(coalesce(p_city, ''))) < 2 then raise exception 'Indicá ciudad o barrio'; end if;
  if length(trim(coalesce(p_bio, ''))) < 30 then raise exception 'La descripción debe tener al menos 30 caracteres'; end if;
  if p_home_type is not null and p_home_type not in ('casa', 'depto', 'finca') then
    raise exception 'Tipo de hogar inválido';
  end if;
  if p_max_pets is not null and (p_max_pets < 1 or p_max_pets > 20) then
    raise exception 'Máximo de mascotas inválido';
  end if;
  update public.sitter_applications set
    public_name = left(trim(p_public_name), 80),
    city = left(trim(p_city), 100),
    neighborhood = nullif(left(trim(coalesce(p_neighborhood, '')), 100), ''),
    headline = nullif(left(trim(coalesce(p_headline, '')), 120), ''),
    bio = left(trim(p_bio), 2000),
    max_pets = p_max_pets,
    home_type = p_home_type,
    accepts_cats = coalesce(p_accepts_cats, true),
    accepts_large_dogs = coalesce(p_accepts_large_dogs, true)
  where id = v_app.id;
end;
$$;
revoke all on function public.petcity_update_sitter_public_profile(text, text, text, text, text, smallint, text, boolean, boolean) from public;
grant execute on function public.petcity_update_sitter_public_profile(text, text, text, text, text, smallint, text, boolean, boolean) to authenticated;

create or replace function public.petcity_sitter_business_dashboard()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_app uuid;
  v_gross bigint;
  v_collected bigint;
begin
  if (select auth.uid()) is null then raise exception 'Ingresá para continuar'; end if;
  select id into v_app from public.sitter_applications where user_id = (select auth.uid()) and status = 'approved';
  if not found then raise exception 'Perfil de cuidador no aprobado'; end if;

  select coalesce(sum(b.total_price_ars), 0) into v_gross
  from public.bookings b
  join public.sitter_offers o on o.id = b.offer_id
  where o.sitter_id = v_app
    and b.status in ('accepted', 'in_progress', 'payment_pending', 'completed', 'paid');

  select coalesce(sum(p.amount_ars - p.fee_ars), 0) into v_collected
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  join public.sitter_offers o on o.id = b.offer_id
  where o.sitter_id = v_app and p.status = 'approved';

  return json_build_object(
    'active_jobs', (
      select count(*)::int from public.bookings b
      join public.sitter_offers o on o.id = b.offer_id
      where o.sitter_id = v_app and b.status in ('accepted', 'in_progress', 'payment_pending')
    ),
    'pending_requests', (
      select count(*)::int from public.bookings b
      join public.sitter_offers o on o.id = b.offer_id
      where o.sitter_id = v_app and b.status = 'pending'
    ),
    'completed_jobs', (
      select count(*)::int from public.bookings b
      join public.sitter_offers o on o.id = b.offer_id
      where o.sitter_id = v_app and b.status in ('completed', 'paid')
    ),
    'gross_estimated_ars', v_gross,
    'collected_ars', v_collected,
    'pending_payout_ars', greatest(v_gross - v_collected, 0),
    'recent_settlements', coalesce((
      select json_agg(json_build_object(
        'payment_id', p.id,
        'booking_id', b.id,
        'amount_ars', p.amount_ars,
        'fee_ars', p.fee_ars,
        'net_ars', p.amount_ars - p.fee_ars,
        'status', p.status,
        'paid_at', p.updated_at,
        'service_date', b.start_date
      ) order by p.updated_at desc)
      from public.payments p
      join public.bookings b on b.id = p.booking_id
      join public.sitter_offers o on o.id = b.offer_id
      where o.sitter_id = v_app
      limit 8
    ), '[]'::json)
  );
end;
$$;
revoke all on function public.petcity_sitter_business_dashboard() from public;
grant execute on function public.petcity_sitter_business_dashboard() to authenticated;

commit;
