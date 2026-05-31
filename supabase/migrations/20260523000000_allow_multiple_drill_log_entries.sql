-- Allow multiple drill log entries for the same pattern/date/shift/rig
-- Previously one row per (pattern, date, shift, rig); now allows many rows (e.g. multiple operators)
ALTER TABLE public.tdl_drill_log
  DROP CONSTRAINT IF EXISTS tdl_drill_log_unique;

COMMENT ON TABLE public.tdl_drill_log IS
  'Multiple rows allowed per (pattern, date, shift, rig). Each save creates a new entry.';
