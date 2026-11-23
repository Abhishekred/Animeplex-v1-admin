-- Purge only a non-admin AnimePlex account's app data before Auth deletion.
-- Callable by service_role through the admin-users Edge Function, never by browsers.
CREATE OR REPLACE FUNCTION public.animeplex_admin_purge_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_user_key text := p_user_id::text;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_members WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Admin accounts cannot be deleted here' USING ERRCODE = '42501';
  END IF;
  -- These private records have no foreign-key cascade from auth.users.
  DELETE FROM sync_private.profile_pin_devices WHERE user_key = v_user_key;
  DELETE FROM sync_private.profile_pin_grants WHERE user_key = v_user_key;
  DELETE FROM sync_private.profile_pins WHERE user_key = v_user_key;
  DELETE FROM sync_private.stremio_configurations WHERE user_key = v_user_key;
  -- Existing service-role-only routine purges library/history, profiles,
  -- watch rooms, sync cursors, and disconnects paired devices.
  PERFORM public.admin_purge_user_data(v_user_key, p_user_id);
END
$$;
REVOKE ALL ON FUNCTION public.animeplex_admin_purge_account(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.animeplex_admin_purge_account(uuid)
  TO service_role;
