-- Daily plan distribution per pattern.
-- One row per (pattern_id, week_id, plan_date) holding the planned drilling metres
-- for that single day. Independent from tdl_patterns.plan_total_drilling_m — the
-- daily values are entered separately and do not roll up into the total.

CREATE TABLE IF NOT EXISTS public.tdl_pattern_daily_plan (
  id          BIGSERIAL     PRIMARY KEY,
  pattern_id  TEXT          NOT NULL,
  week_id     INTEGER       NOT NULL,
  plan_date   DATE          NOT NULL,
  plan_m      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT tdl_pattern_daily_plan_uk UNIQUE (pattern_id, week_id, plan_date),
  CONSTRAINT tdl_pattern_daily_plan_metres_chk CHECK (plan_m >= 0),
  CONSTRAINT tdl_pattern_daily_plan_pattern_fk
    FOREIGN KEY (pattern_id, week_id)
    REFERENCES public.tdl_patterns (pattern_id, week_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tdl_pattern_daily_plan_week_idx
  ON public.tdl_pattern_daily_plan (week_id);

COMMENT ON TABLE public.tdl_pattern_daily_plan IS
  'Per-day planned drilling metres for a pattern within its week. Independent of plan_total_drilling_m.';

-- No-auth policies: the Vue app uses the anon key with no Supabase Auth session.
ALTER TABLE public.tdl_pattern_daily_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tdl_pattern_daily_plan_select ON public.tdl_pattern_daily_plan;
DROP POLICY IF EXISTS tdl_pattern_daily_plan_write  ON public.tdl_pattern_daily_plan;

CREATE POLICY tdl_pattern_daily_plan_select ON public.tdl_pattern_daily_plan
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY tdl_pattern_daily_plan_write ON public.tdl_pattern_daily_plan
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_pattern_daily_plan TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_pattern_daily_plan_id_seq TO anon, authenticated;
