create or replace function public.animeplex_valid_catalogue_providers(ids text[])
returns boolean language sql immutable set search_path = '' as $$
  select array_ndims(ids) = 1 and cardinality(ids) >= 1
    and cardinality(ids) = (select count(distinct p) from unnest(ids) p)
    and not exists (select from unnest(ids) p where length(p) not between 1 and 220 or p <> btrim(p));
$$;
