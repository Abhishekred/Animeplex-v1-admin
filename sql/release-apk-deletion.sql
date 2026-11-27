-- Release deletion is resumable; never remove files from a live release.
alter table public.animeplex_update_releases drop constraint animeplex_update_releases_status_check;
alter table public.animeplex_update_releases add constraint animeplex_update_releases_status_check check (status in ('draft','published','paused','deleting'));
create or replace function public.guard_animeplex_release_deletion() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.status = 'deleting' or (new.status = 'deleting' and old.status not in ('draft','paused')) then
    raise exception 'Release must be paused or drafted before deletion; pending deletions cannot be edited or published';
  end if;
  return new;
end;
$$;
create trigger guard_animeplex_release_deletion before update on public.animeplex_update_releases for each row execute function public.guard_animeplex_release_deletion();
alter policy animeplex_releases_admin_delete on public.animeplex_update_releases using (
  status = 'deleting' and exists (select 1 from public.admin_members m where m.user_id=(select auth.uid()) and m.is_active and m.role in ('owner','admin','release_manager'))
);
alter policy animeplex_release_chunks_admin_delete on storage.objects using (
  bucket_id = 'animeplex-releases' and name like 'releases/%'
  and exists (select 1 from public.admin_members m where m.user_id=(select auth.uid()) and m.is_active and m.role in ('owner','admin','release_manager'))
  and not exists (select 1 from public.animeplex_update_releases r where r.status <> 'deleting' and r.apk_parts @> jsonb_build_array(jsonb_build_object('path',objects.name)))
);
