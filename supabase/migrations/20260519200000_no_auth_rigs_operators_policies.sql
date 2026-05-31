-- Allows the Vue app (anon key, no Supabase Auth session) to read/write
-- tdl_rigs and tdl_operators directly.
-- Apply alongside 20260519000000_no_auth_tdl_profiles_policies.sql

-- ── tdl_rigs ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tdl_rigs_select ON public.tdl_rigs;
DROP POLICY IF EXISTS tdl_rigs_write  ON public.tdl_rigs;

CREATE POLICY tdl_rigs_select ON public.tdl_rigs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY tdl_rigs_write ON public.tdl_rigs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_rigs TO anon, authenticated;

-- ── tdl_operators ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tdl_operators_select ON public.tdl_operators;
DROP POLICY IF EXISTS tdl_operators_write  ON public.tdl_operators;

CREATE POLICY tdl_operators_select ON public.tdl_operators
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY tdl_operators_write ON public.tdl_operators
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_operators           TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_operators_operator_id_seq   TO anon, authenticated;
