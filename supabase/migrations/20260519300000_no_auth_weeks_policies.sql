-- Allows the Vue app (anon key, no Supabase Auth session) to read/write tdl_weeks.
-- Apply alongside 20260519000000_no_auth_tdl_profiles_policies.sql

DROP POLICY IF EXISTS tdl_weeks_select ON public.tdl_weeks;
DROP POLICY IF EXISTS tdl_weeks_write  ON public.tdl_weeks;

CREATE POLICY tdl_weeks_select ON public.tdl_weeks
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY tdl_weeks_write ON public.tdl_weeks
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_weeks TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_weeks_week_id_seq TO anon, authenticated;
