-- PetCity: private profiles, service updates, and moderated community.
-- Run once after migrations 001 and 002.
begin;

alter table public.profiles
  add column phone text not null default '' check (length(phone) <= 40),
  add column address text not null default '' check (length(address) <= 200),
  add column city text not null default '' check (length(city) <= 100);
grant update (phone, address, city) on public.profiles to authenticated;

alter table public.pets
  add column breed text not null default '' check (length(breed) <= 100),
  add column weight_kg numeric(6,2) check (weight_kg > 0 and weight_kg <= 300),
  add column size text check (size in ('pequeño','mediano','grande')),
  add column photo_path text;
alter table public.pets add constraint petcity_pet_photo_owner
  check (photo_path is null or split_part(photo_path,'/',1)=owner_id::text);
create policy pets_sitter_during_booking on public.pets for select to authenticated
using (exists (
  select 1 from public.bookings b join public.sitter_offers o on o.id=b.offer_id
  join public.sitter_applications a on a.id=o.sitter_id
  where b.pet_id=public.pets.id and b.status='accepted' and a.user_id=(select auth.uid())
));

create table public.care_updates (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sitter_id uuid not null default auth.uid() references public.profiles(id),
  message text not null check (length(message) between 1 and 1000),
  photo_path text check (photo_path is null or split_part(photo_path,'/',1)=sitter_id::text),
  created_at timestamptz not null default now()
);
create index idx_petcity_care_updates_booking on public.care_updates(booking_id,created_at);
alter table public.care_updates enable row level security;
revoke all on public.care_updates from anon, authenticated;
grant select on public.care_updates to authenticated;
grant insert (booking_id, sitter_id, message, photo_path) on public.care_updates to authenticated;
create policy care_updates_participants on public.care_updates for select to authenticated
using (exists (
  select 1 from public.bookings b join public.sitter_offers o on o.id=b.offer_id
  join public.sitter_applications a on a.id=o.sitter_id
  where b.id=public.care_updates.booking_id and (b.owner_id=(select auth.uid()) or a.user_id=(select auth.uid()))
));
create policy care_updates_by_sitter on public.care_updates for insert to authenticated
with check (sitter_id=(select auth.uid()) and exists (
  select 1 from public.bookings b join public.sitter_offers o on o.id=b.offer_id
  join public.sitter_applications a on a.id=o.sitter_id
  where b.id=public.care_updates.booking_id and b.status='accepted' and a.user_id=(select auth.uid())
));

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  caption text not null check (length(caption) between 1 and 1500),
  photo_path text check (photo_path is null or split_part(photo_path,'/',1)=author_id::text),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index idx_petcity_posts_feed on public.community_posts(status,created_at desc);
alter table public.community_posts enable row level security;
revoke all on public.community_posts from anon, authenticated;
grant select on public.community_posts to anon, authenticated;
grant insert (author_id, caption, photo_path) on public.community_posts to authenticated;
create policy community_posts_read on public.community_posts for select to anon, authenticated
using (status='approved' or author_id=(select auth.uid()) or (select public.petcity_is_admin()));
create policy community_posts_create on public.community_posts for insert to authenticated
with check (author_id=(select auth.uid()) and status='pending');

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index idx_petcity_comments_post on public.community_comments(post_id,created_at);
alter table public.community_comments enable row level security;
revoke all on public.community_comments from anon, authenticated;
grant select on public.community_comments to anon, authenticated;
grant insert (post_id, author_id, body) on public.community_comments to authenticated;
create policy community_comments_read on public.community_comments for select to anon, authenticated
using (status='approved' or author_id=(select auth.uid()) or (select public.petcity_is_admin()));
create policy community_comments_create on public.community_comments for insert to authenticated
with check (author_id=(select auth.uid()) and status='pending' and exists (
  select 1 from public.community_posts p where p.id=public.community_comments.post_id and p.status='approved'
));

create table public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  primary key (post_id,user_id)
);
alter table public.community_likes enable row level security;
revoke all on public.community_likes from anon, authenticated;
grant select on public.community_likes to anon, authenticated;
grant insert (post_id,user_id) on public.community_likes to authenticated;
grant delete on public.community_likes to authenticated;
create policy community_likes_read on public.community_likes for select to anon, authenticated
using (exists (select 1 from public.community_posts p where p.id=public.community_likes.post_id and p.status='approved'));
create policy community_likes_add on public.community_likes for insert to authenticated
with check (user_id=(select auth.uid()) and exists (
  select 1 from public.community_posts p where p.id=public.community_likes.post_id and p.status='approved'
));
create policy community_likes_remove on public.community_likes for delete to authenticated
using (user_id=(select auth.uid()));

create or replace function public.petcity_review_content(kind text, content_id uuid, decision text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.petcity_is_admin()) then raise exception 'Acceso denegado'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decisión inválida'; end if;
  if kind='post' then
    update public.community_posts set status=decision where id=content_id and status='pending';
  elsif kind='comment' then
    update public.community_comments set status=decision where id=content_id and status='pending';
  else raise exception 'Tipo inválido'; end if;
  if not found then raise exception 'Contenido pendiente no encontrado'; end if;
end;
$$;
revoke all on function public.petcity_review_content(text,uuid,text) from public;
grant execute on function public.petcity_review_content(text,uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('petcity-media','petcity-media',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy petcity_media_upload on storage.objects for insert to authenticated
with check (bucket_id='petcity-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and storage.extension(name) in ('jpg','jpeg','png','webp'));
create policy petcity_media_read on storage.objects for select to anon, authenticated
using (bucket_id='petcity-media' and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or (select public.petcity_is_admin())
  or exists (select 1 from public.community_posts p where p.photo_path=storage.objects.name and p.status='approved')
  or exists (
    select 1 from public.care_updates u join public.bookings b on b.id=u.booking_id
    where u.photo_path=storage.objects.name and b.owner_id=(select auth.uid())
  )
));

commit;
