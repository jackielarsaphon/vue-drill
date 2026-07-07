-- Split the daily plan per pit (บ่อ): the Plan Daily screen now stores one row
-- per (week_id, plan_date, pit_name) instead of one aggregate row per day.
-- Legacy rows (no pit) keep pit_name = '' so their data is preserved.

ALTER TABLE public.tdl_daily_targets
  ADD COLUMN IF NOT EXISTS pit_name TEXT NOT NULL DEFAULT '';

-- Replace the old (week_id, plan_date) uniqueness with a pit-aware one so the
-- app's upsert onConflict = 'week_id,plan_date,pit_name' has a matching key.
ALTER TABLE public.tdl_daily_targets
  DROP CONSTRAINT IF EXISTS tdl_daily_targets_uk;

ALTER TABLE public.tdl_daily_targets
  ADD CONSTRAINT tdl_daily_targets_uk UNIQUE (week_id, plan_date, pit_name);

COMMENT ON COLUMN public.tdl_daily_targets.pit_name IS
  'Pit (บ่อ) this daily plan row belongs to. Empty string = legacy/unassigned.';
