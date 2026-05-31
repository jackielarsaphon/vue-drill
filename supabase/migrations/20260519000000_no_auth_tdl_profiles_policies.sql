-- Allows the Vue app to use tdl_profiles directly without Supabase Auth.
-- Apply this only if this deployment intentionally does not use Supabase Auth
-- for login/session checks.

ALTER TABLE public.tdl_profiles
  DROP CONSTRAINT IF EXISTS tdl_profiles_id_fkey;

DROP POLICY IF EXISTS tdl_profiles_select ON public.tdl_profiles;
DROP POLICY IF EXISTS tdl_profiles_update ON public.tdl_profiles;
DROP POLICY IF EXISTS tdl_profiles_anon_select ON public.tdl_profiles;
DROP POLICY IF EXISTS tdl_profiles_anon_insert ON public.tdl_profiles;
DROP POLICY IF EXISTS tdl_profiles_anon_update ON public.tdl_profiles;
DROP POLICY IF EXISTS tdl_profiles_anon_delete ON public.tdl_profiles;

CREATE POLICY tdl_profiles_anon_select ON public.tdl_profiles
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY tdl_profiles_anon_insert ON public.tdl_profiles
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY tdl_profiles_anon_update ON public.tdl_profiles
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY tdl_profiles_anon_delete ON public.tdl_profiles
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_profiles TO anon, authenticated;
