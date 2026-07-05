-- Number of Holes in the LXML plan is a computed value that carries decimals
-- (e.g. 21.73, 340.64). Store it as NUMERIC(10,2) instead of INTEGER so the
-- imported value is preserved instead of being rounded to a whole number.
--
-- Idempotent: only alters the column when it is not already numeric, so this is
-- safe to run again (e.g. pasted into the Supabase SQL editor).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'tdl_patterns'
      AND column_name  = 'num_holes'
      AND data_type    <> 'numeric'
  ) THEN
    ALTER TABLE public.tdl_patterns
      ALTER COLUMN num_holes TYPE NUMERIC(10,2) USING num_holes::numeric(10,2);
  END IF;
END $$;
