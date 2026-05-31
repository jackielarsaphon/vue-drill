-- Add contractor field to tdl_rigs
ALTER TABLE public.tdl_rigs ADD COLUMN IF NOT EXISTS contractor TEXT NOT NULL DEFAULT '';
