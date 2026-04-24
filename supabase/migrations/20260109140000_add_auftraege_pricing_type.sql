-- =============================================
-- ADD: Pricing type to auftraege
-- Allows distinguishing between hourly and fixed price jobs
-- =============================================

-- Add pricing_type column
ALTER TABLE public.auftraege 
  ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) DEFAULT 'fixed' 
    CHECK (pricing_type IN ('fixed', 'hourly', 'estimate'));

-- Add hourly rate for hourly jobs
ALTER TABLE public.auftraege
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2);

-- Comments
COMMENT ON COLUMN public.auftraege.pricing_type IS 'Pricing type: fixed (fixed price), hourly (per hour), estimate (approximate)';
COMMENT ON COLUMN public.auftraege.hourly_rate IS 'Hourly rate for hourly-priced jobs (CHF/hour)';
