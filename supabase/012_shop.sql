-- Shop de insumos: catálogo, stock y pedidos.
begin;

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (length(name) between 2 and 120),
  description text not null default '' check (length(description) <= 2000),
  price_ars integer not null check (price_ars > 0),
  stock integer not null default 0 check (stock >= 0),
  photo_path text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'cart' check (status in ('cart','pending_payment','paid','cancelled','shipped')),
  total_ars bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid not null references public.shop_products(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 99),
  unit_price_ars integer not null check (unit_price_ars > 0),
  unique (order_id, product_id)
);

alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;

revoke all on public.shop_products, public.shop_orders, public.shop_order_items from anon, authenticated;
grant select on public.shop_products to anon, authenticated;
grant select, insert, update on public.shop_orders to authenticated;
grant select, insert, update, delete on public.shop_order_items to authenticated;

create policy shop_products_read on public.shop_products for select to anon, authenticated using (active = true or (select public.petcity_is_admin()));

create policy shop_orders_owner on public.shop_orders for all to authenticated
using (user_id = (select auth.uid()) or (select public.petcity_is_admin()))
with check (user_id = (select auth.uid()));

create policy shop_items_owner on public.shop_order_items for all to authenticated
using (exists (select 1 from public.shop_orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.petcity_is_admin()))))
with check (exists (select 1 from public.shop_orders o where o.id = order_id and o.user_id = (select auth.uid())));

create or replace function public.petcity_get_or_create_cart()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.shop_orders where user_id = (select auth.uid()) and status = 'cart' order by created_at desc limit 1;
  if v_id is null then
    insert into public.shop_orders(user_id, status) values ((select auth.uid()), 'cart') returning id into v_id;
  end if;
  return v_id;
end;
$$;

grant execute on function public.petcity_get_or_create_cart() to authenticated;

insert into public.shop_products(slug, name, description, price_ars, stock) values
  ('correa-reflectiva', 'Correa reflectiva', 'Paseos nocturnos más seguros.', 12500, 50),
  ('bolsitas-biodegradables', 'Bolsitas biodegradables', 'Pack x 60 unidades.', 8900, 100),
  ('bowl-viaje', 'Bowl de viaje', 'Acero inoxidable plegable.', 15900, 30)
on conflict (slug) do nothing;

commit;
