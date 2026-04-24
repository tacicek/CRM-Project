-- Simplify token pricing: base_token_cost × size_multiplier
-- Remove dependency on service_acquisition_costs for pricing
-- Add admin-editable size multipliers to pricing_settings

-- 1. Add size_multipliers column to pricing_settings
ALTER TABLE public.pricing_settings
ADD COLUMN IF NOT EXISTS size_multipliers JSONB NOT NULL DEFAULT '{"1-2": 1.0, "3": 1.2, "4-5": 1.4, "6+": 1.6}'::jsonb;

COMMENT ON COLUMN public.pricing_settings.size_multipliers IS 'Room-based size multipliers for token pricing. Keys: room ranges, Values: multiplier';

-- 2. Update pricing_settings min/max
UPDATE public.pricing_settings SET
  min_lead_price_tokens = 10,
  max_lead_price_tokens = 200,
  updated_at = NOW();

-- 3. Update service_catalog base_token_cost values (these are now THE source of truth for pricing)
UPDATE public.service_catalog SET base_token_cost = 25.00 WHERE service_type = 'umzug_privat';
UPDATE public.service_catalog SET base_token_cost = 35.00 WHERE service_type = 'umzug_firma';
UPDATE public.service_catalog SET base_token_cost = 40.00 WHERE service_type = 'umzug_international';
UPDATE public.service_catalog SET base_token_cost = 15.00 WHERE service_type IN ('reinigung', 'reinigung_end', 'reinigung_grund', 'reinigung_fenster', 'reinigung_bau');
UPDATE public.service_catalog SET base_token_cost = 20.00 WHERE service_type IN ('raeumung', 'raeumung_wohnung', 'raeumung_haus');
UPDATE public.service_catalog SET base_token_cost = 15.00 WHERE service_type IN ('entsorgung');
UPDATE public.service_catalog SET base_token_cost = 18.00 WHERE service_type IN ('klaviertransport', 'transport_klavier');
UPDATE public.service_catalog SET base_token_cost = 12.00 WHERE service_type IN ('moebellift', 'moebellift_mieten');
UPDATE public.service_catalog SET base_token_cost = 10.00 WHERE service_type = 'lagerung';
UPDATE public.service_catalog SET base_token_cost = 20.00 WHERE service_type = 'spezialtransport';
UPDATE public.service_catalog SET base_token_cost = 15.00 WHERE service_type IN ('transport_moebel', 'renovation', 'malerarbeiten');

COMMENT ON COLUMN public.service_catalog.base_token_cost IS 'Base token cost for this service type. Final price = base × size_multiplier, clamped to min/max.';
