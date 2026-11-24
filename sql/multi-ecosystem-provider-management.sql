-- AnimePlex: per-ecosystem repository management and selected extensions.
-- Preserve the existing public CloudStream selections and legacy app sync.
CREATE TABLE IF NOT EXISTS public.animeplex_managed_repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('cloudstream','mangayomi','zangetsu','stremio','aniyomi','mihon','lnreader')),
  repo_url text NOT NULL CHECK (length(repo_url) BETWEEN 12 AND 700 AND repo_url ~ '^https://[^[:space:]]+$'),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kind,repo_url)
);
ALTER TABLE public.animeplex_managed_repositories ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.animeplex_managed_repositories TO authenticated;
REVOKE ALL ON public.animeplex_managed_repositories FROM anon;
DROP POLICY IF EXISTS animeplex_repos_admin_select ON public.animeplex_managed_repositories;
CREATE POLICY animeplex_repos_admin_select ON public.animeplex_managed_repositories FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.admin_members WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')));
DROP POLICY IF EXISTS animeplex_repos_admin_insert ON public.animeplex_managed_repositories;
CREATE POLICY animeplex_repos_admin_insert ON public.animeplex_managed_repositories FOR INSERT TO authenticated
 WITH CHECK (EXISTS (SELECT 1 FROM public.admin_members WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')));
DROP POLICY IF EXISTS animeplex_repos_admin_update ON public.animeplex_managed_repositories;
CREATE POLICY animeplex_repos_admin_update ON public.animeplex_managed_repositories FOR UPDATE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.admin_members WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')))
 WITH CHECK (EXISTS (SELECT 1 FROM public.admin_members WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')));
DROP POLICY IF EXISTS animeplex_repos_admin_delete ON public.animeplex_managed_repositories;
CREATE POLICY animeplex_repos_admin_delete ON public.animeplex_managed_repositories FOR DELETE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.admin_members WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')));
ALTER TABLE public.animeplex_managed_providers DROP CONSTRAINT animeplex_managed_providers_kind_check;
ALTER TABLE public.animeplex_managed_providers
 ADD CONSTRAINT animeplex_managed_providers_kind_check
 CHECK (kind IN ('cloudstream','mangayomi','zangetsu','stremio','aniyomi','mihon','lnreader'));
ALTER TABLE public.animeplex_managed_providers DROP CONSTRAINT animeplex_managed_providers_repo_url_check;
ALTER TABLE public.animeplex_managed_providers ADD CONSTRAINT animeplex_managed_providers_repo_url_check
 CHECK (length(repo_url) BETWEEN 12 AND 700 AND repo_url ~ '^https://[^[:space:]]+$');
ALTER TABLE public.animeplex_managed_providers DROP CONSTRAINT animeplex_managed_providers_plugin_id_check;
ALTER TABLE public.animeplex_managed_providers ADD CONSTRAINT animeplex_managed_providers_plugin_id_check
 CHECK (plugin_id ~ '^[A-Za-z0-9_./:-]{1,220}$');
ALTER TABLE public.animeplex_managed_providers ADD COLUMN IF NOT EXISTS repository_id uuid
 REFERENCES public.animeplex_managed_repositories(id) ON DELETE CASCADE;
ALTER TABLE public.animeplex_managed_providers ADD COLUMN IF NOT EXISTS catalog_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS animeplex_managed_providers_repository_idx
 ON public.animeplex_managed_providers(repository_id) WHERE repository_id IS NOT NULL;
-- Existing selections are zero in the current project, but backfill for compatibility.
INSERT INTO public.animeplex_managed_repositories(kind,repo_url,label)
SELECT DISTINCT kind,repo_url,left(kind || ' repository',120)
FROM public.animeplex_managed_providers
ON CONFLICT(kind,repo_url) DO NOTHING;
UPDATE public.animeplex_managed_providers p
SET repository_id=r.id FROM public.animeplex_managed_repositories r
WHERE p.repository_id IS NULL AND p.kind=r.kind AND p.repo_url=r.repo_url;

-- One transaction for the checkboxes: replacing a repository's selection only.
CREATE OR REPLACE FUNCTION public.animeplex_admin_set_repo_sources(
  p_repo_id uuid, p_items jsonb
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $func$
DECLARE
 v_actor uuid:=auth.uid(); v_kind text; v_url text; v_entry jsonb;
 v_id text; v_label text; v_ids text[]:=ARRAY[]::text[];
 v_count integer; v_priority integer;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.admin_members
   WHERE user_id=v_actor AND is_active AND role IN ('owner','admin')
 ) THEN
   RAISE EXCEPTION 'Owner/admin permission required' USING ERRCODE='42501';
 END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
 THEN RAISE EXCEPTION 'Expected an array of selected sources' USING ERRCODE='22023'; END IF;
 v_count:=jsonb_array_length(p_items);
 IF v_count>150 THEN RAISE EXCEPTION 'Select up to 150 sources per save' USING ERRCODE='22023'; END IF;
 SELECT kind,repo_url INTO v_kind,v_url
 FROM public.animeplex_managed_repositories WHERE id=p_repo_id FOR UPDATE;
 IF v_kind IS NULL THEN RAISE EXCEPTION 'Repository not found' USING ERRCODE='P0002'; END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_items)
 LOOP
   IF jsonb_typeof(v_entry)<>'object' THEN RAISE EXCEPTION 'Invalid source' USING ERRCODE='22023'; END IF;
   v_id:=v_entry->>'id';v_label:=left(trim(coalesce(v_entry->>'name','')),120);
   IF v_id IS NULL OR v_id !~ '^[A-Za-z0-9_./:-]{1,220}$'
      OR v_label='' THEN RAISE EXCEPTION 'Invalid source ID or name' USING ERRCODE='22023'; END IF;
   IF v_id=ANY(v_ids) THEN RAISE EXCEPTION 'Duplicate source' USING ERRCODE='22023'; END IF;
   v_ids:=array_append(v_ids,v_id);
   v_priority:=coalesce((SELECT priority FROM public.animeplex_managed_providers
     WHERE kind=v_kind AND repo_url=v_url AND plugin_id=v_id),100);
   INSERT INTO public.animeplex_managed_providers(
     kind,repo_url,plugin_id,label,enabled,auto_install,is_default,priority,repository_id,catalog_meta,updated_at
   ) VALUES(
     v_kind,v_url,v_id,v_label,true,true,false,v_priority,p_repo_id,
     jsonb_build_object('type',left(coalesce(v_entry->>'type',''),30),
       'lang',left(coalesce(v_entry->>'lang',''),15),
       'version',left(coalesce(v_entry->>'version',''),60)),now()
   )
   ON CONFLICT(kind,repo_url,plugin_id)
   DO UPDATE SET label=EXCLUDED.label,enabled=true,auto_install=true,
     repository_id=p_repo_id,catalog_meta=EXCLUDED.catalog_meta,updated_at=now();
 END LOOP;
 DELETE FROM public.animeplex_managed_providers
 WHERE repository_id=p_repo_id AND NOT(plugin_id=ANY(v_ids));
 RETURN v_count;
END
$func$;
REVOKE ALL ON FUNCTION public.animeplex_admin_set_repo_sources(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.animeplex_admin_set_repo_sources(uuid,jsonb) TO authenticated;
