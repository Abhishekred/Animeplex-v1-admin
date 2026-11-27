-- The mobile catalogue reads the effective playback order directly from each title.
create table public.animeplex_catalogue_defaults (
  singleton boolean primary key default true check (singleton),
  provider_ids text[] not null check (public.animeplex_valid_catalogue_providers(provider_ids))
);
alter table public.animeplex_catalogue_defaults enable row level security;
revoke all on public.animeplex_catalogue_defaults from public, anon, authenticated;
grant select, update(provider_ids) on public.animeplex_catalogue_defaults to authenticated;
create policy catalogue_defaults_admin on public.animeplex_catalogue_defaults
  for all to authenticated
  using (exists (select 1 from public.admin_members where user_id=(select auth.uid())
    and is_active and role in ('owner','admin')))
  with check (exists (select 1 from public.admin_members where user_id=(select auth.uid())
    and is_active and role in ('owner','admin')));

insert into public.animeplex_catalogue_defaults(provider_ids)
values (array['cs:AniVortex','cs:MovieBox']);

alter table public.animeplex_curated_titles alter column language_badge set default 'Hindi';
update public.animeplex_curated_titles set language_badge='Hindi'
where language_badge is distinct from 'Hindi';

create function public.animeplex_fill_catalogue_providers()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  select d.provider_ids into strict new.provider_ids
    from public.animeplex_catalogue_defaults d where d.singleton for share;
  return new;
end;
$$;
create trigger fill_catalogue_providers before insert or update of provider_ids
on public.animeplex_curated_titles for each row when (new.provider_ids is null)
execute function public.animeplex_fill_catalogue_providers();

create function public.animeplex_apply_catalogue_providers()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  update public.animeplex_curated_titles set provider_ids=new.provider_ids
    where provider_ids is distinct from new.provider_ids;
  return new;
end;
$$;
create trigger apply_catalogue_providers after update of provider_ids
on public.animeplex_catalogue_defaults for each row
execute function public.animeplex_apply_catalogue_providers();
revoke all on function public.animeplex_fill_catalogue_providers() from public, anon, authenticated;
revoke all on function public.animeplex_apply_catalogue_providers() from public, anon, authenticated;
