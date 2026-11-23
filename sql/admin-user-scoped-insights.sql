
CREATE OR REPLACE FUNCTION public.animeplex_admin_user_scoped_detail(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $func$
DECLARE v_actor uuid := auth.uid(); v_result jsonb;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.admin_members
   WHERE user_id=v_actor AND is_active AND role IN ('owner','admin')
 ) THEN RAISE EXCEPTION 'Not authorized to inspect user data' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user_id AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'Account not found' USING ERRCODE='P0002'; END IF;
 INSERT INTO public.animeplex_admin_access_log(actor_id,action,target_id)
 VALUES(v_actor,'user_detail',p_user_id);
 SELECT jsonb_build_object(
  'profile_mylist',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
   SELECT profile_id,title,type,status,source_id,added_at FROM public.profile_mylist
   WHERE user_key=p_user_id::text ORDER BY added_at DESC LIMIT 100
  ) t),'[]'::jsonb),
  'profile_watch_history',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
   SELECT profile_id,show_title,episode_number,position_ms,duration_ms,updated_at
   FROM public.profile_history WHERE user_key=p_user_id::text
   ORDER BY updated_at DESC LIMIT 100
  ) t),'[]'::jsonb),
  'profile_reading_history',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
   SELECT profile_id,title,type,chapter_number,pos,total,updated_ms
   FROM public.profile_reading_history WHERE user_key=p_user_id::text
   ORDER BY updated_ms DESC LIMIT 100
  ) t),'[]'::jsonb),
  'list_categories',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
   SELECT id,name,position,created_at FROM public.list_categories
   WHERE user_key=p_user_id::text ORDER BY position LIMIT 100
  ) t),'[]'::jsonb),
  'profile_list_categories',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
   SELECT profile_id,id,name,position FROM public.profile_list_categories
   WHERE user_key=p_user_id::text ORDER BY profile_id,position LIMIT 100
  ) t),'[]'::jsonb)
 ) INTO v_result;
 RETURN v_result;
END
$func$;
REVOKE ALL ON FUNCTION public.animeplex_admin_user_scoped_detail(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.animeplex_admin_user_scoped_detail(uuid) TO authenticated;
