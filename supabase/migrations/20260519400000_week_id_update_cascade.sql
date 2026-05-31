-- Allow week_id (PK) to be updated — cascade to all child tables.
-- Required for the Week header "Week ID" field to be user-editable.

-- tdl_patterns
ALTER TABLE public.tdl_patterns
  DROP CONSTRAINT IF EXISTS tdl_patterns_week_id_fkey;
ALTER TABLE public.tdl_patterns
  ADD CONSTRAINT tdl_patterns_week_id_fkey
  FOREIGN KEY (week_id) REFERENCES public.tdl_weeks(week_id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- tdl_drill_log
ALTER TABLE public.tdl_drill_log
  DROP CONSTRAINT IF EXISTS tdl_drill_log_week_id_fkey;
ALTER TABLE public.tdl_drill_log
  ADD CONSTRAINT tdl_drill_log_week_id_fkey
  FOREIGN KEY (week_id) REFERENCES public.tdl_weeks(week_id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- tdl_plan_import_batches
ALTER TABLE public.tdl_plan_import_batches
  DROP CONSTRAINT IF EXISTS tdl_plan_import_batches_week_id_fkey;
ALTER TABLE public.tdl_plan_import_batches
  ADD CONSTRAINT tdl_plan_import_batches_week_id_fkey
  FOREIGN KEY (week_id) REFERENCES public.tdl_weeks(week_id)
  ON DELETE CASCADE ON UPDATE CASCADE;
