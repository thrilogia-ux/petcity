-- PetCity: primera etapa de cuentas, mascotas y postulaciones.
-- Ejecutar una sola vez desde el SQL Editor del proyecto PetCity.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 100),
  created_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.petcity_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;

revoke all on function public.petcity_is_admin() from public;
grant execute on function public.petcity_is_admin() to anon, authenticated;

create or replace function public.petcity_new_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100));
  return new;
end;
$$;

create trigger on_petcity_user_created
after insert on auth.users for each row execute function public.petcity_new_profile();

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  species text not null check (species in ('perro', 'gato', 'otro')),
  care_notes text not null default '' check (length(care_notes) <= 3000),
  created_at timestamptz not null default now()
);

create table public.sitter_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references public.profiles(id) on delete cascade,
  city text not null check (length(city) between 2 and 100),
  bio text not null check (length(bio) between 30 and 2000),
  experience text not null check (length(experience) between 20 and 2000),
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'changes_requested', 'rejected')),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.sitter_offers (
  id uuid primary key default gen_random_uuid(),
  sitter_id uuid not null references public.sitter_applications(id) on delete cascade,
  service text not null check (service in ('paseo', 'cuidado_en_casa', 'alojamiento', 'vacaciones')),
  price_ars integer not null check (price_ars > 0 and price_ars <= 100000000),
  unit text not null check (unit in ('paseo', 'dia', 'noche')),
  unique (sitter_id, service)
);

create index idx_petcity_pets_owner on public.pets(owner_id);
create index idx_petcity_applications_status on public.sitter_applications(status);

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.pets enable row level security;
alter table public.sitter_applications enable row level security;
alter table public.sitter_offers enable row level security;

revoke all on public.profiles, public.admin_users, public.pets,
  public.sitter_applications, public.sitter_offers from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.pets to authenticated;
grant select on public.sitter_applications to anon, authenticated;
grant insert (user_id, city, bio, experience) on public.sitter_applications to authenticated;
grant update (city, bio, experience) on public.sitter_applications to authenticated;
grant select on public.sitter_offers to anon, authenticated;
grant insert (sitter_id, service, price_ars, unit) on public.sitter_offers to authenticated;
grant update (service, price_ars, unit) on public.sitter_offers to authenticated;
grant delete on public.sitter_offers to authenticated;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.petcity_is_admin()));
create policy profiles_edit on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy admins_read_self on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));
create policy pets_owner on public.pets for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy applications_read on public.sitter_applications for select to anon, authenticated
using (status = 'approved' or user_id = (select auth.uid()) or (select public.petcity_is_admin()));
create policy applications_create on public.sitter_applications for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'draft');
create policy applications_edit_draft on public.sitter_applications for update to authenticated
using (user_id = (select auth.uid()) and status in ('draft', 'changes_requested'))
with check (user_id = (select auth.uid()) and status in ('draft', 'changes_requested'));

create policy offers_read on public.sitter_offers for select to anon, authenticated
using (exists (
  select 1 from public.sitter_applications a where a.id = sitter_id
  and (a.status = 'approved' or a.user_id = (select auth.uid()) or (select public.petcity_is_admin()))
));
create policy offers_create on public.sitter_offers for insert to authenticated
with check (exists (
  select 1 from public.sitter_applications a where a.id = sitter_id
  and a.user_id = (select auth.uid()) and a.status in ('draft', 'changes_requested')
));
create policy offers_edit on public.sitter_offers for update to authenticated
using (exists (
  select 1 from public.sitter_applications a where a.id = sitter_id
  and a.user_id = (select auth.uid()) and a.status in ('draft', 'changes_requested')
)) with check (exists (
  select 1 from public.sitter_applications a where a.id = sitter_id
  and a.user_id = (select auth.uid()) and a.status in ('draft', 'changes_requested')
));
create policy offers_delete on public.sitter_offers for delete to authenticated
using (exists (
  select 1 from public.sitter_applications a where a.id = sitter_id
  and a.user_id = (select auth.uid()) and a.status in ('draft', 'changes_requested')
));

create or replace function public.petcity_submit_application()
returns void language plpgsql security definer set search_path = '' as $$
declare candidate public.sitter_applications%rowtype;
begin
  select * into candidate from public.sitter_applications
  where user_id = (select auth.uid()) for update;
  if not found or candidate.status not in ('draft', 'changes_requested') then
    raise exception 'No hay un borrador disponible para enviar';
  end if;
  if not exists (select 1 from public.sitter_offers where sitter_id = candidate.id) then
    raise exception 'Agregá al menos un servicio con precio';
  end if;
  update public.sitter_applications set status = 'pending', review_note = null
  where id = candidate.id;
end;
$$;
revoke all on function public.petcity_submit_application() from public;
grant execute on function public.petcity_submit_application() to authenticated;

create or replace function public.petcity_review_application(
  application_id uuid, decision text, note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.petcity_is_admin()) then
    raise exception 'Acceso denegado';
  end if;
  if decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Decisión inválida';
  end if;
  update public.sitter_applications
  set status = decision, review_note = left(note, 1000), reviewed_at = now()
  where id = application_id and status = 'pending';
  if not found then raise exception 'Postulación pendiente no encontrada'; end if;
end;
$$;
revoke all on function public.petcity_review_application(uuid, text, text) from public;
grant execute on function public.petcity_review_application(uuid, text, text) to authenticated;

commit;
