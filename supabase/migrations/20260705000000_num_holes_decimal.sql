-- Number of Holes in the LXML plan is a computed value that carries decimals
-- (e.g. 21.73, 340.64). Store it as NUMERIC(10,2) instead of INTEGER so the
-- imported value is preserved instead of being rounded to a whole number.
ALTER TABLE public.tdl_patterns
  ALTER COLUMN num_holes TYPE NUMERIC(10,2);
