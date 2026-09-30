-- PetCity: community stories are visible for 30 days after posting.
-- Run once after migration 003. This changes visibility; it does not delete files.
begin;

alter table public.community_posts
  add column author_name text not null default 'Miembro PetCity',
  add column author_role text not null default 'Miembro';

update public.community_posts p set
  author_name=coalesce((
    select nullif(trim(a.public_name),'') from public.sitter_applications a
    where a.user_id=p.author_id and a.status='approved'
  ),nullif(trim(pr.display_name),''),'Miembro PetCity'),
  author_role=case when exists (
    select 1 from public.sitter_applications a
    where a.user_id=p.author_id and a.status='approved'
  ) then 'Cuidador' else 'Miembro' end
from public.profiles pr where pr.id=p.author_id;

create or replace function public.petcity_post_author_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select coalesce((
    select nullif(trim(a.public_name),'') from public.sitter_applications a
    where a.user_id=new.author_id and a.status='approved'
  ),nullif(trim(p.display_name),''),'Miembro PetCity')
    into new.author_name from public.profiles p where p.id=new.author_id;
  new.author_role := case when exists (
    select 1 from public.sitter_applications a
    where a.user_id=new.author_id and a.status='approved'
  ) then 'Cuidador' else 'Miembro' end;
  return new;
end;
$$;
create trigger on_petcity_post_created before insert on public.community_posts
for each row execute function public.petcity_post_author_snapshot();

drop policy community_posts_read on public.community_posts;
create policy community_posts_read on public.community_posts for select to anon, authenticated
using (created_at >= now() - interval '30 days'
  and (status='approved' or author_id=(select auth.uid()) or (select public.petcity_is_admin())));

drop policy community_comments_read on public.community_comments;
create policy community_comments_read on public.community_comments for select to anon, authenticated
using (exists (
  select 1 from public.community_posts p
  where p.id=public.community_comments.post_id
    and p.created_at >= now() - interval '30 days'
    and (p.status='approved' or (select public.petcity_is_admin()))
) and (status='approved' or author_id=(select auth.uid()) or (select public.petcity_is_admin())));

drop policy petcity_media_read on storage.objects;
create policy petcity_media_read on storage.objects for select to anon, authenticated
using (bucket_id='petcity-media' and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or (select public.petcity_is_admin())
  or exists (
    select 1 from public.community_posts p
    where p.photo_path=storage.objects.name and p.status='approved'
      and p.created_at >= now() - interval '30 days'
  )
  or exists (
    select 1 from public.care_updates u join public.bookings b on b.id=u.booking_id
    where u.photo_path=storage.objects.name and b.owner_id=(select auth.uid())
  )
));

commit;
