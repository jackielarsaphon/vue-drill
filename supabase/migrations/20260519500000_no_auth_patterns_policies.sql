-- Allows the Vue app (anon key, no Supabase Auth session) to read/write tdl_patterns.

DROP POLICY IF EXISTS tdl_patterns_select ON public.tdl_patterns;
DROP POLICY IF EXISTS tdl_patterns_write  ON public.tdl_patterns;

CREATE POLICY tdl_patterns_select ON public.tdl_patterns
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY tdl_patterns_write ON public.tdl_patterns
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_patterns TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_patterns_id_seq TO anon, authenticated;
