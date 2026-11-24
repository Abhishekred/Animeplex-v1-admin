-- Supabase default table grants may include authenticated DML.
-- Account restrictions must remain writable ONLY by service_role and
-- tightly scoped, caller-checked SECURITY DEFINER RPCs.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.animeplex_user_runtime_controls
  FROM authenticated, anon, PUBLIC;
GRANT SELECT ON TABLE public.animeplex_user_runtime_controls TO authenticated;
