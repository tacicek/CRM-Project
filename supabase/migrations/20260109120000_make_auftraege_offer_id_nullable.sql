-- =============================================
-- FIX: Make offer_id nullable in auftraege table
-- This allows creating aufträge without linking to an offer
-- =============================================

-- Make offer_id nullable
ALTER TABLE public.auftraege 
  ALTER COLUMN offer_id DROP NOT NULL;

-- Update the comment
COMMENT ON COLUMN public.auftraege.offer_id IS 'Optional reference to the offer this auftrag was created from';
