-- Add Google Ads acquisition costs and exclusivity pricing
-- This ensures profitable lead pricing based on real acquisition costs

-- 1. Create service acquisition costs table
CREATE TABLE IF NOT EXISTS public.service_acquisition_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL UNIQUE,
  service_label TEXT NOT NULL,
  google_ads_cpc_chf NUMERIC NOT NULL DEFAULT 20,  -- Cost per click in CHF
  conversion_rate NUMERIC NOT NULL DEFAULT 0.05,   -- Click to lead conversion (5% default)
  organic_lead_ratio NUMERIC NOT NULL DEFAULT 0.3, -- 30% of leads are organic (free)
  min_profit_margin NUMERIC NOT NULL DEFAULT 1.3,  -- 30% minimum profit margin
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insert Swiss market acquisition costs
-- Based on real Google Ads data for Swiss moving/cleaning industry
INSERT INTO public.service_acquisition_costs (service_type, service_label, google_ads_cpc_chf, conversion_rate, organic_lead_ratio, min_profit_margin, notes)
VALUES
  -- High competition keywords
  ('umzug', 'Umzug', 50.00, 0.05, 0.25, 1.4, 'Sehr hohe Konkurrenz, teuer'),
  ('privatumzug', 'Privatumzug', 45.00, 0.05, 0.25, 1.4, 'Ähnlich wie Umzug'),
  ('firmenumzug', 'Firmenumzug', 60.00, 0.04, 0.20, 1.5, 'B2B, höhere Werte'),
  
  -- Medium competition
  ('reinigung', 'Reinigung', 18.00, 0.08, 0.35, 1.3, 'Mittlere Konkurrenz'),
  ('endreinigung', 'Endreinigung', 22.00, 0.07, 0.30, 1.3, 'Saisonal variabel'),
  ('grundreinigung', 'Grundreinigung', 15.00, 0.08, 0.35, 1.3, 'Weniger gesucht'),
  
  -- Specialty services
  ('raeumung', 'Räumung', 30.00, 0.06, 0.30, 1.35, 'Nischenmarkt'),
  ('entsorgung', 'Entsorgung', 12.00, 0.10, 0.40, 1.25, 'Breite Nachfrage'),
  ('lagerung', 'Lagerung', 8.00, 0.12, 0.45, 1.2, 'Geringe CPC'),
  
  -- Transport services  
  ('klaviertransport', 'Klaviertransport', 20.00, 0.10, 0.35, 1.3, 'Spezialisiert'),
  ('moebellift', 'Möbellift', 15.00, 0.08, 0.30, 1.3, 'Nischenmarkt'),
  ('moebeltransport', 'Möbeltransport', 25.00, 0.07, 0.30, 1.3, 'Mittlere Konkurrenz'),
  
  -- Renovation services
  ('renovation', 'Renovation', 35.00, 0.05, 0.25, 1.4, 'Hohe Konkurrenz'),
  ('malerarbeiten', 'Malerarbeiten', 28.00, 0.06, 0.30, 1.35, 'Saisonal')
ON CONFLICT (service_type) DO UPDATE SET
  google_ads_cpc_chf = EXCLUDED.google_ads_cpc_chf,
  conversion_rate = EXCLUDED.conversion_rate,
  organic_lead_ratio = EXCLUDED.organic_lead_ratio,
  min_profit_margin = EXCLUDED.min_profit_margin,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- 3. Add exclusivity multipliers to pricing_rules
ALTER TABLE public.pricing_rules 
ADD COLUMN IF NOT EXISTS exclusivity_multipliers JSONB DEFAULT '{
  "1": 2.5,
  "3": 1.5,
  "5": 1.0
}'::jsonb;

-- 4. Add job_value_factor settings
ALTER TABLE public.pricing_rules
ADD COLUMN IF NOT EXISTS job_value_factor_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS job_value_min_factor NUMERIC DEFAULT 0.8,
ADD COLUMN IF NOT EXISTS job_value_max_factor NUMERIC DEFAULT 2.5,
ADD COLUMN IF NOT EXISTS job_value_base_chf NUMERIC DEFAULT 1000;

-- 5. Update existing pricing rule with new settings
UPDATE public.pricing_rules 
SET 
  exclusivity_multipliers = '{
    "1": 2.5,
    "3": 1.5,
    "5": 1.0
  }'::jsonb,
  job_value_factor_enabled = true,
  job_value_min_factor = 0.8,
  job_value_max_factor = 2.5,
  job_value_base_chf = 1000,
  updated_at = NOW()
WHERE is_active = true;

-- 6. Update pricing_settings with new min/max based on acquisition costs
UPDATE public.pricing_settings
SET 
  min_lead_price_tokens = 25,   -- Minimum: ~25 CHF (covers small organic leads)
  max_lead_price_tokens = 400,  -- Maximum: ~400 CHF (large exklusiv umzug)
  updated_at = NOW();

-- 7. Create function to calculate minimum profitable token price
CREATE OR REPLACE FUNCTION public.calculate_min_token_price(
  p_service_type TEXT,
  p_max_companies INTEGER DEFAULT 3
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_acquisition RECORD;
  v_lead_cost NUMERIC;
  v_exclusivity_mult NUMERIC;
  v_min_tokens INTEGER;
BEGIN
  -- Get acquisition costs for this service
  SELECT * INTO v_acquisition
  FROM public.service_acquisition_costs
  WHERE service_type = p_service_type AND is_active = true;
  
  IF v_acquisition IS NULL THEN
    -- Default fallback
    RETURN 30;
  END IF;
  
  -- Calculate blended lead acquisition cost
  -- (organic leads are free, paid leads cost CPC/conversion_rate)
  v_lead_cost := (1 - v_acquisition.organic_lead_ratio) * 
                 (v_acquisition.google_ads_cpc_chf / v_acquisition.conversion_rate);
  
  -- Apply exclusivity multiplier
  v_exclusivity_mult := CASE p_max_companies
    WHEN 1 THEN 2.5  -- Exklusiv: 2.5x
    WHEN 3 THEN 1.5  -- Standard: 1.5x
    ELSE 1.0         -- Shared: 1.0x
  END;
  
  -- Calculate minimum profitable price
  v_min_tokens := CEIL(v_lead_cost * v_acquisition.min_profit_margin * v_exclusivity_mult);
  
  -- Ensure minimum of 25 tokens
  RETURN GREATEST(v_min_tokens, 25);
END;
$$;

-- 8. RLS policies
ALTER TABLE public.service_acquisition_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read acquisition costs" ON public.service_acquisition_costs;
CREATE POLICY "Authenticated can read acquisition costs" ON public.service_acquisition_costs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage acquisition costs" ON public.service_acquisition_costs;
CREATE POLICY "Admins can manage acquisition costs" ON public.service_acquisition_costs
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- 9. Add comment
COMMENT ON TABLE public.service_acquisition_costs IS 'Google Ads CPC and conversion data for calculating profitable lead prices';
COMMENT ON FUNCTION public.calculate_min_token_price IS 'Calculates minimum profitable token price based on acquisition costs and exclusivity';

