-- Bandeja de solicitudes abiertas para cuidador (sin depender solo de RLS).
begin;

create or replace function public.petcity_sitter_open_request_inbox()
returns table (
  id uuid,
  service text,
  city text,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.service, r.city, r.start_date, r.end_date, r.notes, r.created_at
  from public.open_care_requests r
  join public.sitter_applications a
    on a.user_id = (select auth.uid()) and a.status = 'approved'
  join public.sitter_offers o
    on o.sitter_id = a.id and o.service = r.service
  where r.status = 'open'
    and r.owner_id <> (select auth.uid())
    and public.petcity_zone_matches(r.city, a.city)
  order by r.created_at desc
  limit 20;
$$;

revoke all on function public.petcity_sitter_open_request_inbox() from public;
grant execute on function public.petcity_sitter_open_request_inbox() to authenticated;

commit;
