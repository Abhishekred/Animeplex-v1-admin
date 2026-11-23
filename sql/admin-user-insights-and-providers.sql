
-- AnimePlex admin-only user insights. No secret keys, passwords, PIN hashes,
-- tokens, IPs or auth.sessions are returned.
CREATE TABLE IF NOT EXISTS public.animeplex_admin_access_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('user_list','user_detail')),
  target_id uuid,
  accessed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.animeplex_admin_access_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.animeplex_admin_access_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.animeplex_admin_access_log_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.animeplex_admin_user_page(
 p_search text DEFAULT '', p_limit integer DEFAULT 25, p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $func$
DECLARE
 v_actor uuid := auth.uid();
 v_limit integer := least(greatest(coalesce(p_limit,25),1),50);
 v_offset integer := least(greatest(coalesce(p_offset,0),0),10000);
 v_search text := left(trim(coalesce(p_search,'')),120);
 v_rows jsonb;
 v_total bigint;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.admin_members
   WHERE user_id=v_actor AND is_active AND role IN ('owner','admin')
 ) THEN
   RAISE EXCEPTION 'Not authorized to inspect user data' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.animeplex_admin_access_log(actor_id,action)
 VALUES(v_actor,'user_list');
 SELECT count(*) INTO v_total FROM auth.users u
 LEFT JOIN public.profiles p ON p.id=u.id
 WHERE u.deleted_at IS NULL AND
   (v_search='' OR u.email ILIKE '%'||v_search||'%' OR
    coalesce(p.display_name,'') ILIKE '%'||v_search||'%');
 SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows FROM (
   SELECT u.id, u.email, coalesce(p.display_name,'') AS display_name,
     u.created_at,u.last_sign_in_at,
     (u.banned_until IS NOT NULL AND u.banned_until>now()) AS is_banned,
     (SELECT count(*) FROM public.mylist m WHERE m.user_key=u.id::text) AS mylist_count,
     (SELECT count(*) FROM public.history h WHERE h.user_key=u.id::text) AS watch_count,
     (SELECT count(*) FROM public.reading_history r WHERE r.user_key=u.id::text) AS reading_count,
     (SELECT count(*) FROM public.viewer_profiles vp WHERE vp.user_key=u.id::text) AS profile_count
   FROM auth.users u
   LEFT JOIN public.profiles p ON p.id=u.id
   WHERE u.deleted_at IS NULL AND
    (v_search='' OR u.email ILIKE '%'||v_search||'%' OR
     coalesce(p.display_name,'') ILIKE '%'||v_search||'%')
   ORDER BY u.created_at DESC
   LIMIT v_limit OFFSET v_offset
 ) t;
 RETURN jsonb_build_object('users',v_rows,'total',v_total,'limit',v_limit,'offset',v_offset);
END
$func$;

CREATE OR REPLACE FUNCTION public.animeplex_admin_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $func$
DECLARE
 v_actor uuid := auth.uid();
 v_result jsonb;
 v_user jsonb;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.admin_members
   WHERE user_id=v_actor AND is_active AND role IN ('owner','admin')
 ) THEN
   RAISE EXCEPTION 'Not authorized to inspect user data' USING ERRCODE='42501';
 END IF;
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'Missing user id' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object('id',u.id,'email',u.email,
   'display_name',coalesce(p.display_name,''),'created_at',u.created_at,
   'last_sign_in_at',u.last_sign_in_at,
   'email_verified',u.email_confirmed_at IS NOT NULL,
   'account_status', CASE WHEN u.banned_until>now() THEN 'banned' ELSE 'active' END)
 INTO v_user FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
 WHERE u.id=p_user_id AND u.deleted_at IS NULL;
 IF v_user IS NULL THEN RAISE EXCEPTION 'Account not found' USING ERRCODE='P0002'; END IF;
 INSERT INTO public.animeplex_admin_access_log(actor_id,action,target_id)
 VALUES(v_actor,'user_detail',p_user_id);
 SELECT jsonb_build_object(
  'user',v_user,
  'mylist',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT title,type,status,source_id,item_id,added_at
    FROM public.mylist WHERE user_key=p_user_id::text
    ORDER BY added_at DESC LIMIT 100
  ) t),'[]'::jsonb),
  'watch_history',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT show_title,category,episode_number,position_ms,duration_ms,updated_at
    FROM public.history WHERE user_key=p_user_id::text
    ORDER BY updated_at DESC LIMIT 100
  ) t),'[]'::jsonb),
  'reading_history',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT title,type,chapter_number,pos,total,updated_ms
    FROM public.reading_history WHERE user_key=p_user_id::text
    ORDER BY updated_ms DESC LIMIT 100
  ) t),'[]'::jsonb),
  'viewer_profiles',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT profile_id,name,is_kids,created_at,accent_color
    FROM public.viewer_profiles WHERE user_key=p_user_id::text
    ORDER BY created_at DESC LIMIT 100
  ) t),'[]'::jsonb),
  'categories',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT source_id,item_id,category_id FROM public.mylist_categories
    WHERE user_key=p_user_id::text LIMIT 100
  ) t),'[]'::jsonb)
 ) INTO v_result;
 RETURN v_result;
END
$func$;
REVOKE ALL ON FUNCTION public.animeplex_admin_user_page(text,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.animeplex_admin_user_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.animeplex_admin_user_page(text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.animeplex_admin_user_detail(uuid) TO authenticated;

-- Public-read configuration with authenticated admin-only writes.
-- A release manager cannot inspect users or change extension code.
CREATE TABLE IF NOT EXISTS public.animeplex_managed_providers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL DEFAULT 'cloudstream' CHECK (kind='cloudstream'),
 repo_url text NOT NULL CHECK (
  length(repo_url)<=500 AND
  repo_url ~ '^https://raw[.]githubusercontent[.]com/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+/[A-Za-z0-9_./-]+/repo[.]json$'
 ),
 plugin_id text NOT NULL CHECK(plugin_id ~ '^[A-Za-z0-9_.-]{1,120}$'),
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 120),
 enabled boolean NOT NULL DEFAULT true,
 auto_install boolean NOT NULL DEFAULT true,
 is_default boolean NOT NULL DEFAULT false,
 priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 9999),
 created_by uuid DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(kind,repo_url,plugin_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS animeplex_one_managed_default
 ON public.animeplex_managed_providers((true)) WHERE is_default;
CREATE INDEX IF NOT EXISTS animeplex_managed_providers_order
 ON public.animeplex_managed_providers(priority,id) WHERE enabled;
ALTER TABLE public.animeplex_managed_providers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.animeplex_managed_providers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.animeplex_managed_providers TO authenticated;
DROP POLICY IF EXISTS animeplex_managed_providers_public ON public.animeplex_managed_providers;
CREATE POLICY animeplex_managed_providers_public ON public.animeplex_managed_providers
 FOR SELECT TO anon,authenticated USING (enabled);
DROP POLICY IF EXISTS animeplex_managed_providers_admin_read ON public.animeplex_managed_providers;
CREATE POLICY animeplex_managed_providers_admin_read ON public.animeplex_managed_providers
 FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.admin_members
   WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')));
DROP POLICY IF EXISTS animeplex_managed_providers_admin_insert ON public.animeplex_managed_providers;
CREATE POLICY animeplex_managed_providers_admin_insert ON public.animeplex_managed_providers
 FOR INSERT TO authenticated
 WITH CHECK (EXISTS (SELECT 1 FROM public.admin_members
   WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')));
DROP POLICY IF EXISTS animeplex_managed_providers_admin_update ON public.animeplex_managed_providers;
CREATE POLICY animeplex_managed_providers_admin_update ON public.animeplex_managed_providers
 FOR UPDATE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.admin_members
   WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')))
 WITH CHECK (EXISTS (SELECT 1 FROM public.admin_members
   WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')));
DROP POLICY IF EXISTS animeplex_managed_providers_admin_delete ON public.animeplex_managed_providers;
CREATE POLICY animeplex_managed_providers_admin_delete ON public.animeplex_managed_providers
 FOR DELETE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.admin_members
   WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')));
