-- Simplify pricing logic: token = CPC × multiplier (max 4x)
-- Admin can manually set CPC values

-- 1. Update service_acquisition_costs with realistic CPC values
UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 45,
  notes = 'Basis für Token-Berechnung: CPC × 1-4x'
WHERE service_type = 'umzug';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 45
WHERE service_type = 'privatumzug';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 55
WHERE service_type = 'firmenumzug';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 22
WHERE service_type = 'reinigung';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 25
WHERE service_type = 'endreinigung';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 18
WHERE service_type = 'grundreinigung';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 35
WHERE service_type = 'raeumung';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 15
WHERE service_type = 'entsorgung';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 10
WHERE service_type = 'lagerung';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 25
WHERE service_type = 'klaviertransport';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 18
WHERE service_type = 'moebellift';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 30
WHERE service_type = 'moebeltransport';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 40
WHERE service_type = 'renovation';

UPDATE public.service_acquisition_costs SET
  google_ads_cpc_chf = 30
WHERE service_type = 'malerarbeiten';

-- 2. Add multiplier columns to make formula transparent
ALTER TABLE public.service_acquisition_costs
ADD COLUMN IF NOT EXISTS exclusivity_1_mult NUMERIC DEFAULT 2.5,
ADD COLUMN IF NOT EXISTS exclusivity_3_mult NUMERIC DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS exclusivity_5_mult NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS max_size_mult NUMERIC DEFAULT 1.6;

-- 3. Update pricing_settings with simpler min/max
UPDATE public.pricing_settings SET
  min_lead_price_tokens = 15,
  max_lead_price_tokens = 250,
  updated_at = NOW();

-- 4. Add helper columns for clarity
COMMENT ON COLUMN public.service_acquisition_costs.google_ads_cpc_chf IS 'Google Ads Cost Per Click - Basis für Token-Preis';
COMMENT ON COLUMN public.service_acquisition_costs.exclusivity_1_mult IS 'Multiplikator für Exklusiv (1 Firma)';
COMMENT ON COLUMN public.service_acquisition_costs.exclusivity_3_mult IS 'Multiplikator für Standard (3 Firmen)';
COMMENT ON COLUMN public.service_acquisition_costs.exclusivity_5_mult IS 'Multiplikator für Shared (5 Firmen)';
COMMENT ON COLUMN public.service_acquisition_costs.max_size_mult IS 'Maximaler Größen-Multiplikator für große Jobs';

