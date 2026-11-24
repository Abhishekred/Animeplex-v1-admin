-- User-specific provider state and account enforcement for AnimePlex.
CREATE TABLE IF NOT EXISTS public.animeplex_user_runtime_controls (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_provider_id text,
  available_providers jsonb NOT NULL DEFAULT '[]'::jsonb,
  forced_provider_id text,
  provider_locked boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  ban_reason text,
  banned_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  CONSTRAINT animeplex_current_provider_format CHECK (
    current_provider_id IS NULL OR
    (length(current_provider_id) BETWEEN 1 AND 220 AND current_provider_id ~ '^[A-Za-z0-9_./:-]+$')
  ),
  CONSTRAINT animeplex_forced_provider_format CHECK (
    forced_provider_id IS NULL OR
    (length(forced_provider_id) BETWEEN 1 AND 220 AND forced_provider_id ~ '^[A-Za-z0-9_./:-]+$')
  ),
  CONSTRAINT animeplex_provider_lock_target CHECK (NOT provider_locked OR forced_provider_id IS NOT NULL),
  CONSTRAINT animeplex_ban_reason_required CHECK (
    NOT is_banned OR length(trim(coalesce(ban_reason,''))) BETWEEN 3 AND 500
  ),
  CONSTRAINT animeplex_provider_catalog_array CHECK (
    jsonb_typeof(available_providers)='array' AND
    jsonb_array_length(available_providers) <= 150
  )
);
ALTER TABLE public.animeplex_user_runtime_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.animeplex_user_runtime_controls FROM PUBLIC,anon;
GRANT SELECT ON public.animeplex_user_runtime_controls TO authenticated;
CREATE POLICY animeplex_runtime_user_read ON public.animeplex_user_runtime_controls
  FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY animeplex_runtime_admin_read ON public.animeplex_user_runtime_controls
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.admin_members a
      WHERE a.user_id=(SELECT auth.uid()) AND a.is_active
      AND a.role IN ('owner','admin'))
  );
-- No direct INSERT, UPDATE, DELETE grants to browser clients.
-- Only authenticated self-service RPCs may write current source and reported installed sources.
CREATE OR REPLACE FUNCTION public.animeplex_user_choose_source(p_source_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$
DECLARE
  v_id uuid:=auth.uid();
  v_control public.animeplex_user_runtime_controls%ROWTYPE;
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
  IF p_source_id IS NULL OR length(p_source_id) NOT BETWEEN 1 AND 220 OR
      p_source_id !~ '^[A-Za-z0-9_./:-]+$'
    THEN RAISE EXCEPTION 'Invalid provider identifier' USING ERRCODE='22023'; END IF;
  INSERT INTO public.animeplex_user_runtime_controls (user_id) VALUES(v_id)
    ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_control FROM public.animeplex_user_runtime_controls
    WHERE user_id=v_id FOR UPDATE;
  IF v_control.is_banned THEN RAISE EXCEPTION 'Account banned' USING ERRCODE='42501'; END IF;
  IF v_control.provider_locked AND v_control.forced_provider_id<>p_source_id
    THEN RAISE EXCEPTION 'Provider selection is locked by the administrator' USING ERRCODE='42501'; END IF;
  IF v_control.available_providers<> '[]'::jsonb AND
     NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_control.available_providers) x
       WHERE x->>'id'=p_source_id)
    THEN RAISE EXCEPTION 'Provider is not reported as installed' USING ERRCODE='22023'; END IF;
  UPDATE public.animeplex_user_runtime_controls
    SET current_provider_id=p_source_id, updated_at=now(),last_seen_at=now()
    WHERE user_id=v_id;
  RETURN jsonb_build_object('current_provider_id',p_source_id,'provider_locked',v_control.provider_locked);
END
$$;

CREATE OR REPLACE FUNCTION public.animeplex_user_report_sources(
  p_current_provider_id text, p_sources jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$
DECLARE
  v_id uuid:=auth.uid();
  v_s jsonb;
  v_seen text[] := ARRAY[]::text[];
  v_id_text text;
  v_name text;
  v_safe jsonb := '[]'::jsonb;
  v_control public.animeplex_user_runtime_controls%ROWTYPE;
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
  IF p_sources IS NULL OR jsonb_typeof(p_sources)<>'array' OR jsonb_array_length(p_sources)>150
    THEN RAISE EXCEPTION 'Expected up to 150 sources' USING ERRCODE='22023'; END IF;
  FOR v_s IN SELECT value FROM jsonb_array_elements(p_sources) LOOP
    IF jsonb_typeof(v_s)<> 'object' THEN RAISE EXCEPTION 'Invalid source entry' USING ERRCODE='22023'; END IF;
    v_id_text:=v_s->>'id';v_name:=trim(coalesce(v_s->>'name',''));
    IF v_id_text IS NULL OR length(v_id_text) NOT BETWEEN 1 AND 220 OR
       v_id_text !~ '^[A-Za-z0-9_./:-]+$' OR length(v_name) NOT BETWEEN 1 AND 120
       THEN RAISE EXCEPTION 'Invalid installed source' USING ERRCODE='22023'; END IF;
    IF v_id_text=ANY(v_seen) THEN CONTINUE; END IF;
    v_seen:=array_append(v_seen,v_id_text);
    v_safe:=v_safe || jsonb_build_array(jsonb_build_object('id',v_id_text,'name',v_name));
  END LOOP;
  INSERT INTO public.animeplex_user_runtime_controls(user_id) VALUES(v_id)
    ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_control FROM public.animeplex_user_runtime_controls
    WHERE user_id=v_id FOR UPDATE;
  IF v_control.is_banned THEN RAISE EXCEPTION 'Account banned' USING ERRCODE='42501'; END IF;
  -- A newly installed extension can arrive between scans; report the last
  -- active ID only if it belongs to this device's installed+enabled list.
  IF p_current_provider_id IS NOT NULL AND
      EXISTS(SELECT 1 FROM jsonb_array_elements(v_safe) x
        WHERE x->>'id'=p_current_provider_id) AND
      (NOT v_control.provider_locked OR v_control.forced_provider_id=p_current_provider_id)
  THEN
    v_control.current_provider_id:=p_current_provider_id;
  END IF;
  UPDATE public.animeplex_user_runtime_controls SET
      available_providers=v_safe,
      current_provider_id=v_control.current_provider_id,
      last_seen_at=now(),
      updated_at=now()
    WHERE user_id=v_id;
  RETURN jsonb_build_object('current_provider_id',v_control.current_provider_id,
    'provider_locked',v_control.provider_locked,'forced_provider_id',v_control.forced_provider_id,
    'is_banned',v_control.is_banned);
END
$$;
REVOKE ALL ON FUNCTION public.animeplex_user_choose_source(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.animeplex_user_report_sources(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.animeplex_user_choose_source(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.animeplex_user_report_sources(text,jsonb) TO authenticated;
