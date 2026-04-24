-- Add brief_layout column to offers table
-- Enables SN 010 130 Swiss letter standard PDF layout per offer

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS brief_layout boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.offers.brief_layout IS
  'When true, PDF is generated in SN 010 130 Swiss letter standard format (Briefversand)';
