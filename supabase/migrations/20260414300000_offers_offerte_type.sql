-- Add offerte_type column to offers table
-- 'normal' = after on-site visit (default)
-- 'blind'  = without on-site visit (based on customer info only)

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS offerte_type text NOT NULL DEFAULT 'normal'
  CHECK (offerte_type IN ('normal', 'blind'));

COMMENT ON COLUMN public.offers.offerte_type IS
  'Type of offer: normal = created after on-site visit | blind = created without visit based on customer info only';

-- Backfill all existing records to normal (correct assumption)
UPDATE public.offers
SET offerte_type = 'normal'
WHERE offerte_type IS NULL;
