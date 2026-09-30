-- PetCity: private messages attached to a real care request.
-- Run after migrations 001, 002 and 003. Does not depend on migration 004.
begin;

create or replace function public.petcity_can_read_booking_messages(chosen_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.bookings b
    join public.sitter_offers o on o.id=b.offer_id
    join public.sitter_applications a on a.id=o.sitter_id
    where b.id=chosen_booking
      and (b.owner_id=(select auth.uid()) or a.user_id=(select auth.uid()))
  );
$$;

create or replace function public.petcity_can_send_booking_message(chosen_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.bookings b
    join public.sitter_offers o on o.id=b.offer_id
    join public.sitter_applications a on a.id=o.sitter_id
    where b.id=chosen_booking and b.status in ('pending','accepted')
      and (b.owner_id=(select auth.uid()) or a.user_id=(select auth.uid()))
  );
$$;

revoke all on function public.petcity_can_read_booking_messages(uuid) from public;
revoke all on function public.petcity_can_send_booking_message(uuid) from public;
grant execute on function public.petcity_can_read_booking_messages(uuid) to authenticated;
grant execute on function public.petcity_can_send_booking_message(uuid) to authenticated;

create table public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index idx_petcity_messages_booking on public.booking_messages(booking_id,created_at desc,id desc);
alter table public.booking_messages enable row level security;
revoke all on public.booking_messages from anon, authenticated;
grant select on public.booking_messages to authenticated;
grant insert (booking_id,sender_id,body) on public.booking_messages to authenticated;

create policy booking_messages_read on public.booking_messages for select to authenticated
using (public.petcity_can_read_booking_messages(public.booking_messages.booking_id));

create policy booking_messages_send on public.booking_messages for insert to authenticated
with check (sender_id=(select auth.uid())
  and public.petcity_can_send_booking_message(public.booking_messages.booking_id));

commit;
