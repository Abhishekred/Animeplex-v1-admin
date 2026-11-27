create function public.animeplex_valid_catalogue_providers(ids text[])
returns boolean language sql immutable set search_path = '' as $$
  select array_ndims(ids) = 1 and cardinality(ids) between 1 and 4
    and cardinality(ids) = (select count(distinct p) from unnest(ids) p)
    and not exists (select from unnest(ids) p where length(p) not between 1 and 220 or p <> btrim(p));
$$;

create table public.animeplex_curated_titles (
  kind text not null check (kind in ('movie','series')),
  tmdb_id integer not null check (tmdb_id > 0),
  title text not null check (length(btrim(title)) between 1 and 350),
  poster_url text not null check (poster_url ~ '^https://' and length(poster_url) <= 2048),
  release_year text not null default '' check (release_year ~ '^([0-9]{4})?$'),
  provider_ids text[] not null check (public.animeplex_valid_catalogue_providers(provider_ids)),
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (kind, tmdb_id)
);
alter table public.animeplex_curated_titles enable row level security;
revoke all on public.animeplex_curated_titles from public, anon, authenticated;
grant select on public.animeplex_curated_titles to anon, authenticated;
grant insert,update,delete on public.animeplex_curated_titles to authenticated;
create policy catalogue_read on public.animeplex_curated_titles for select to anon,authenticated using (true);
create policy catalogue_edit on public.animeplex_curated_titles for all to authenticated
 using (exists (select from public.admin_members where user_id=(select auth.uid()) and is_active and role in ('owner','admin')))
 with check (exists (select from public.admin_members where user_id=(select auth.uid()) and is_active and role in ('owner','admin')));

create function public.animeplex_catalogue_provider_options()
returns table(id text, name text) language sql stable security invoker set search_path = '' as $$
  select item->>'id', min(item->>'name')
  from public.animeplex_user_runtime_controls u
  cross join lateral jsonb_array_elements(u.available_providers) item
  where exists (select from public.admin_members where user_id=(select auth.uid()) and is_active and role in ('owner','admin'))
    and coalesce(item->>'id','') <> ''
    and item->>'id' !~ '^(mihon:|lnr:)'
  group by item->>'id' order by 2, 1;
$$;
revoke all on function public.animeplex_catalogue_provider_options() from public, anon;
grant execute on function public.animeplex_catalogue_provider_options() to authenticated;
