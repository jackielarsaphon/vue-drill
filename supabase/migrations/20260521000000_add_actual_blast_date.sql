ALTER TABLE public.tdl_patterns
  ADD COLUMN IF NOT EXISTS actual_blast_date DATE;

COMMENT ON COLUMN public.tdl_patterns.actual_blast_date IS
  'Actual blast date recorded when TD volume is confirmed (Blast Date TD).';
