alter table public.animeplex_curated_titles
  add column platform text not null default '' check (length(platform) <= 60),
  add column language_badge text not null default '' check (length(language_badge) <= 24),
  add column trending boolean not null default false,
  add column backdrop_url text not null default '' check (backdrop_url = '' or (backdrop_url like 'https://%' and length(backdrop_url) <= 2048)),
  add column rating numeric(3,1) check (rating between 0 and 10);

create function public.animeplex_catalogue_platforms()
returns table(platform text) language sql stable security invoker set search_path = '' as $$
  select distinct t.platform from public.animeplex_curated_titles t where t.platform <> '' order by t.platform
$$;
revoke all on function public.animeplex_catalogue_platforms() from public;
grant execute on function public.animeplex_catalogue_platforms() to anon, authenticated;
