-- Week-level daily targets: one row per (week_id, plan_date) holding the planned
-- total drilling metres and total blast volume (bcm) for that single day across
-- the whole week (not split per pit/pattern).

CREATE TABLE IF NOT EXISTS public.tdl_daily_targets (
  id            BIGSERIAL     PRIMARY KEY,
  week_id       INTEGER       NOT NULL
                REFERENCES public.tdl_weeks(week_id) ON UPDATE CASCADE ON DELETE CASCADE,
  plan_date     DATE          NOT NULL,
  drilling_m    NUMERIC(12,2) NOT NULL DEFAULT 0,
  blast_vol_bcm NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT tdl_daily_targets_uk UNIQUE (week_id, plan_date),
  CONSTRAINT tdl_daily_targets_metres_chk CHECK (drilling_m >= 0 AND blast_vol_bcm >= 0)
);

CREATE INDEX IF NOT EXISTS tdl_daily_targets_week_idx
  ON public.tdl_daily_targets (week_id);

COMMENT ON TABLE public.tdl_daily_targets IS
  'Per-day planned totals for a week: total drilling metres and total blast volume (bcm).';

-- No-auth policies: the Vue app uses the anon key with no Supabase Auth session.
ALTER TABLE public.tdl_daily_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tdl_daily_targets_select ON public.tdl_daily_targets;
DROP POLICY IF EXISTS tdl_daily_targets_write  ON public.tdl_daily_targets;

CREATE POLICY tdl_daily_targets_select ON public.tdl_daily_targets
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY tdl_daily_targets_write ON public.tdl_daily_targets
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_daily_targets TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_daily_targets_id_seq TO anon, authenticated;
