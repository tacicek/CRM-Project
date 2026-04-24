-- Add time_estimate JSONB column to offers for Blind Offerte time-range pricing.
-- Shape when set: { "minHours": 7, "maxHours": 9, "hourlyRate": 95.00 }
-- Only populated when offerte_type = 'blind'. NULL for normal offers.
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS time_estimate JSONB DEFAULT NULL;
