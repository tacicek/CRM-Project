-- Add offerten (exclusivity) multipliers to pricing_settings
-- Fewer companies = more exclusive = higher price

ALTER TABLE public.pricing_settings
ADD COLUMN IF NOT EXISTS offerten_multipliers JSONB NOT NULL DEFAULT '{"3": 1.3, "4": 1.15, "5": 1.0}'::jsonb;

COMMENT ON COLUMN public.pricing_settings.offerten_multipliers IS 'Multiplier based on number of companies receiving the lead. Fewer = higher price.';
