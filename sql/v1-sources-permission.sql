-- V1.2 Sources permission: default deny; user reads only own record.
-- Applied to AnimePlex Supabase as migration v1_sources_permission_per_user.
CREATE TABLE IF NOT EXISTS public.animeplex_user_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sources_access boolean NOT NULL DEFAULT false,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.animeplex_user_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.animeplex_user_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.animeplex_user_permissions TO authenticated;
DROP POLICY IF EXISTS animeplex_permissions_self_or_admin_read ON public.animeplex_user_permissions;
CREATE POLICY animeplex_permissions_self_or_admin_read
ON public.animeplex_user_permissions FOR SELECT TO authenticated USING (
 user_id=(select auth.uid()) OR EXISTS (
  SELECT 1 FROM public.admin_members
  WHERE user_id=(select auth.uid()) AND is_active AND role IN ('owner','admin')
 )
);
CREATE TABLE IF NOT EXISTS public.animeplex_permission_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL, target_user_id uuid NOT NULL,
 sources_access boolean NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.animeplex_permission_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.animeplex_permission_audit FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.animeplex_admin_set_sources_permission(
 p_user_id uuid, p_allowed boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE v_actor uuid := auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.admin_members WHERE user_id=v_actor AND is_active
    AND role IN ('owner','admin')
 ) THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NULL OR p_allowed IS NULL OR NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id=p_user_id AND deleted_at IS NULL
 ) THEN RAISE EXCEPTION 'Invalid target user or permission' USING ERRCODE='22023'; END IF;
 INSERT INTO public.animeplex_user_permissions(user_id,sources_access,changed_by,changed_at)
 VALUES(p_user_id,p_allowed,v_actor,now())
 ON CONFLICT(user_id) DO UPDATE SET sources_access=EXCLUDED.sources_access,
   changed_by=v_actor,changed_at=now();
 INSERT INTO public.animeplex_permission_audit(actor_id,target_user_id,sources_access)
 VALUES(v_actor,p_user_id,p_allowed);
 RETURN p_allowed;
END $body$;
REVOKE ALL ON FUNCTION public.animeplex_admin_set_sources_permission(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.animeplex_admin_set_sources_permission(uuid,boolean) TO authenticated;
