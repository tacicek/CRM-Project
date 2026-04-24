-- Add per-item time estimate for Blind Offerte time-range pricing.
-- Shape when set: { "minHours": 7, "maxHours": 9, "hourlyRate": 95.00 }
-- NULL for normal items or items without a time estimate.
ALTER TABLE public.offer_items
  ADD COLUMN IF NOT EXISTS time_estimate JSONB DEFAULT NULL;
