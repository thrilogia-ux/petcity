-- Confirmar carrito como pedido (Fase 2 shop).
begin;

create or replace function public.petcity_submit_shop_cart()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cart_id uuid;
  v_new_cart uuid;
  v_total bigint := 0;
  r record;
begin
  select id into v_cart_id
  from public.shop_orders
  where user_id = (select auth.uid()) and status = 'cart'
  order by created_at desc
  limit 1
  for update;

  if v_cart_id is null then
    raise exception 'No hay carrito activo';
  end if;

  if not exists (select 1 from public.shop_order_items where order_id = v_cart_id) then
    raise exception 'El carrito está vacío';
  end if;

  for r in
    select i.product_id, i.quantity, i.unit_price_ars, p.stock, p.name
    from public.shop_order_items i
    join public.shop_products p on p.id = i.product_id
    where i.order_id = v_cart_id
  loop
    if r.stock < r.quantity then
      raise exception 'Sin stock suficiente para %', r.name;
    end if;
    v_total := v_total + r.quantity * r.unit_price_ars;
  end loop;

  for r in
    select i.product_id, i.quantity
    from public.shop_order_items i
    where i.order_id = v_cart_id
  loop
    update public.shop_products
    set stock = stock - r.quantity
    where id = r.product_id;
  end loop;

  update public.shop_orders
  set status = 'pending_payment', total_ars = v_total, updated_at = now()
  where id = v_cart_id;

  insert into public.shop_orders(user_id, status)
  values ((select auth.uid()), 'cart')
  returning id into v_new_cart;

  return v_new_cart;
end;
$$;

revoke all on function public.petcity_submit_shop_cart() from public;
grant execute on function public.petcity_submit_shop_cart() to authenticated;

commit;
