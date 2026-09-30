-- Pagos Mercado Pago (estado en DB; cobro real vía API Vercel + webhook).
begin;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  mp_payment_id text,
  mp_preference_id text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','refunded','cancelled')),
  amount_ars bigint not null check (amount_ars > 0),
  fee_ars bigint not null default 0 check (fee_ars >= 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_petcity_payments_booking on public.payments(booking_id);

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

create policy payments_participants on public.payments for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id and (
      b.owner_id = (select auth.uid())
      or exists (
        select 1 from public.sitter_offers o
        join public.sitter_applications a on a.id = o.sitter_id
        where o.id = b.offer_id and a.user_id = (select auth.uid())
      )
    )
  )
  or (select public.petcity_is_admin())
);

create or replace function public.petcity_mark_booking_paid(p_booking uuid, p_amount bigint, p_fee bigint, p_mp_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and not (select public.petcity_is_admin()) then
    raise exception 'Solo backend autorizado';
  end if;
  update public.bookings set status = 'paid' where id = p_booking and status in ('accepted','payment_pending');
  insert into public.payments(booking_id, mp_payment_id, status, amount_ars, fee_ars, idempotency_key)
  values (p_booking, p_mp_id, 'approved', p_amount, p_fee, 'mp:' || coalesce(p_mp_id, gen_random_uuid()::text))
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public.petcity_mark_booking_paid(uuid, bigint, bigint, text) from public;
grant execute on function public.petcity_mark_booking_paid(uuid, bigint, bigint, text) to service_role;

commit;
