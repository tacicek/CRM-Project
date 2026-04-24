-- Swiss Market-Based Pricing System
-- Based on real Swiss moving/cleaning industry prices

-- First, ensure the pricing_rules table exists with proper structure
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Swiss Market Standard',
  is_active BOOLEAN NOT NULL DEFAULT true,
  base_price NUMERIC NOT NULL DEFAULT 20,
  service_multipliers JSONB NOT NULL DEFAULT '{}',
  urgency_multipliers JSONB NOT NULL DEFAULT '{}',
  room_tiers JSONB NOT NULL DEFAULT '{}',
  distance_tiers JSONB NOT NULL DEFAULT '{}',
  extra_services JSONB NOT NULL DEFAULT '{}',
  living_space_tiers JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure pricing_settings table exists
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_value_chf NUMERIC NOT NULL DEFAULT 1.0,
  min_lead_price_tokens INTEGER NOT NULL DEFAULT 8,
  max_lead_price_tokens INTEGER NOT NULL DEFAULT 150,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deactivate any existing rules
UPDATE public.pricing_rules SET is_active = false;

-- Insert new Swiss market-based pricing rule
-- Token pricing is based on ~2.5% of average job value
-- This ensures fair pricing for companies while being profitable for the platform
INSERT INTO public.pricing_rules (
  name,
  is_active,
  base_price,
  service_multipliers,
  urgency_multipliers,
  room_tiers,
  distance_tiers,
  extra_services,
  living_space_tiers
) VALUES (
  'Swiss Market Standard 2025',
  true,
  
  -- Base price: 15 tokens (~15 CHF)
  -- This is the starting point before multipliers
  15,
  
  -- Service multipliers based on average job values:
  -- Umzug: 720-1680 CHF → ~1200 CHF avg → 1.0x
  -- Reinigung: 450-1650 CHF → ~1000 CHF avg → 0.85x
  -- Möbellift: 350-850 CHF → ~600 CHF avg → 0.6x
  -- Klaviertransport: 380-760 CHF → ~500 CHF avg → 0.7x
  -- Entsorgung: Similar to moving → 0.8x
  -- Räumung: Higher complexity → 1.1x
  -- Lagerung: Monthly service, lower lead value → 0.5x
  '{
    "umzug": 1.0,
    "privatumzug": 1.0,
    "firmenumzug": 1.3,
    "reinigung": 0.85,
    "endreinigung": 0.85,
    "grundreinigung": 0.7,
    "entsorgung": 0.8,
    "raeumung": 1.1,
    "wohnungsraeumung": 1.1,
    "lagerung": 0.5,
    "klaviertransport": 0.7,
    "moebellift": 0.6,
    "moebeltransport": 0.65,
    "usm_transport": 0.5,
    "wasserbett_transport": 0.55,
    "malerarbeit": 1.2
  }'::jsonb,
  
  -- Urgency multipliers
  -- Normal: standard pricing
  -- Urgent (<=7 days): +30% - companies need to prioritize
  -- Very urgent (<=3 days): +60% - weekend/rush jobs
  '{
    "normal": 1.0,
    "urgent": 1.3,
    "very_urgent": 1.6
  }'::jsonb,
  
  -- Room tiers based on Swiss cleaning/moving prices:
  -- 1 room: 450-590 CHF → small job → 0.7x
  -- 2 rooms: 640-690 CHF → 0.85x
  -- 3 rooms: 790-850 CHF → standard → 1.0x
  -- 4 rooms: 880-1090 CHF → 1.2x
  -- 5 rooms: 1250-1400 CHF → 1.5x
  -- 6+ rooms: 1490-1650 CHF → large job → 1.8x
  '{
    "1": 0.7,
    "1.5": 0.75,
    "2": 0.85,
    "2.5": 0.9,
    "3": 1.0,
    "3.5": 1.1,
    "4": 1.2,
    "4.5": 1.35,
    "5": 1.5,
    "5.5": 1.65,
    "6": 1.8
  }'::jsonb,
  
  -- Distance tiers (for moving services)
  -- Local moves (<10km): standard pricing
  -- Short distance (10-25km): +15%
  -- Medium distance (25-50km): +30%
  -- Long distance (50-100km): +50%
  -- Very long (100km+): +80%
  '{
    "0-10": 1.0,
    "10-25": 1.15,
    "25-50": 1.3,
    "50-100": 1.5,
    "100+": 1.8
  }'::jsonb,
  
  -- Extra services (additive, based on base_price)
  -- Packing service: +5 tokens (significant extra work)
  -- Cleaning: +3 tokens (often combined with moving)
  -- Storage: +4 tokens (ongoing revenue potential)
  -- Heavy items (100kg+): +3 tokens (special equipment needed)
  -- Piano included: +5 tokens (specialist skills)
  '{
    "packing": 0.35,
    "cleaning": 0.25,
    "storage": 0.3,
    "heavy_items": 0.25,
    "piano": 0.35,
    "antiques": 0.2
  }'::jsonb,
  
  -- Living space tiers (m²)
  -- Used as secondary multiplier for accuracy
  -- <50m²: small apartment → 0.8x
  -- 50-80m²: standard → 1.0x
  -- 80-120m²: larger apartment → 1.15x
  -- 120-180m²: large/house → 1.35x
  -- 180m²+: villa/large house → 1.6x
  '{
    "0-50": 0.8,
    "50-80": 1.0,
    "80-120": 1.15,
    "120-180": 1.35,
    "180+": 1.6
  }'::jsonb
);

-- Update or insert pricing settings
-- Delete existing settings first
DELETE FROM public.pricing_settings;

INSERT INTO public.pricing_settings (
  token_value_chf,
  min_lead_price_tokens,
  max_lead_price_tokens
) VALUES (
  1.0,  -- 1 Token = 1 CHF
  8,    -- Minimum lead price: 8 tokens (small cleaning job)
  150   -- Maximum lead price: 150 tokens (large complex move)
);

-- Create a table for job price estimates (if not exists)
-- This helps companies see potential ROI
CREATE TABLE IF NOT EXISTS public.job_price_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL,
  room_count TEXT NOT NULL,
  min_price_chf INTEGER NOT NULL,
  max_price_chf INTEGER NOT NULL,
  avg_price_chf INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clear existing estimates and insert Swiss market prices
DELETE FROM public.job_price_estimates;

-- Moving (Umzug) prices based on room count and 4-hour minimum
INSERT INTO public.job_price_estimates (service_type, room_count, min_price_chf, max_price_chf, avg_price_chf, notes) VALUES
-- Package 1: 1 Truck + 1 Worker = 120 CHF/hour × 4h = 480 CHF base
-- Package 2: 1 Truck + 2 Workers = 180 CHF/hour × 4h = 720 CHF base
-- Package 3: 1 Truck + 3 Workers = 230 CHF/hour × 4h = 920 CHF base
('umzug', '1', 480, 600, 540, 'Studio/1 Zimmer: 1 Kamyon + 1 İşçi, 4 saat'),
('umzug', '1.5', 550, 700, 625, '1.5 Zimmer: 1 Kamyon + 1-2 İşçi'),
('umzug', '2', 720, 900, 810, '2 Zimmer: 1 Kamyon + 2 İşçi, 4-5 saat'),
('umzug', '2.5', 800, 1000, 900, '2.5 Zimmer: 1 Kamyon + 2 İşçi, 5 saat'),
('umzug', '3', 920, 1100, 1010, '3 Zimmer: 1 Kamyon + 3 İşçi, 4 saat'),
('umzug', '3.5', 1000, 1200, 1100, '3.5 Zimmer: 1 Kamyon + 3 İşçi, 5 saat'),
('umzug', '4', 1160, 1400, 1280, '4 Zimmer: 2 Kamyon + 4 İşçi, 4-5 saat'),
('umzug', '4.5', 1300, 1550, 1425, '4.5 Zimmer: 2 Kamyon + 4-5 İşçi'),
('umzug', '5', 1400, 1700, 1550, '5 Zimmer: 2 Kamyon + 5 İşçi, 4-5 saat'),
('umzug', '5.5', 1550, 1850, 1700, '5.5 Zimmer: 2 Kamyon + 5-6 İşçi'),
('umzug', '6', 1680, 2100, 1890, '6+ Zimmer: 2 Kamyon + 6 İşçi, 5+ saat');

-- Cleaning (Reinigung) prices - direct from Swiss market data
INSERT INTO public.job_price_estimates (service_type, room_count, min_price_chf, max_price_chf, avg_price_chf, notes) VALUES
('reinigung', '1', 450, 590, 520, 'Studio/1 Oda - Temel temizlik'),
('reinigung', '1.5', 590, 640, 615, '1.5 Oda'),
('reinigung', '2', 640, 690, 665, '2 Oda - Standart daire'),
('reinigung', '2.5', 690, 790, 740, '2.5 Oda'),
('reinigung', '3', 790, 850, 820, '3 Oda - Orta daire'),
('reinigung', '3.5', 850, 880, 865, '3.5 Oda'),
('reinigung', '4', 880, 1090, 985, '4 Oda - Büyük daire'),
('reinigung', '4.5', 1090, 1250, 1170, '4.5 Oda'),
('reinigung', '5', 1250, 1400, 1325, '5 Oda - Büyük aile evi'),
('reinigung', '5.5', 1400, 1490, 1445, '5.5 Oda'),
('reinigung', '6', 1490, 1650, 1570, '6+ Oda - Villa/Büyük ev');

-- Möbellift prices
INSERT INTO public.job_price_estimates (service_type, room_count, min_price_chf, max_price_chf, avg_price_chf, notes) VALUES
('moebellift', 'kurz', 350, 400, 375, 'Kısa iş: max 5 parça / 1 saat'),
('moebellift', 'halbtag', 480, 550, 515, 'Yarım gün: 4 saat'),
('moebellift', 'ganztag', 850, 950, 900, 'Tam gün: 8 saat'),
('moebellift', 'standard', 250, 420, 335, 'Tek adres: 250 CHF / İki adres: 420 CHF');

-- Piano transport prices
INSERT INTO public.job_price_estimates (service_type, room_count, min_price_chf, max_price_chf, avg_price_chf, notes) VALUES
('klaviertransport', 'eg', 380, 420, 400, 'Zemin kat yükleme'),
('klaviertransport', '1', 420, 500, 460, '1. kat yükleme + indirme'),
('klaviertransport', '2', 460, 540, 500, '2. kat yükleme + indirme'),
('klaviertransport', '3', 500, 620, 560, '3. kat yükleme + indirme'),
('klaviertransport', '4', 540, 700, 620, '4. kat yükleme + indirme'),
('klaviertransport', '5', 560, 760, 660, '5. kat yükleme + indirme'),
('klaviertransport', 'fluegel', 550, 750, 650, 'Kuyruklu piyano ek ücreti');

-- Extra fees reference
INSERT INTO public.job_price_estimates (service_type, room_count, min_price_chf, max_price_chf, avg_price_chf, notes) VALUES
('extras', 'schwer', 80, 120, 100, 'Ağır eşya (100kg+)'),
('extras', 'klavier', 250, 350, 300, 'Piyano ek ücreti'),
('extras', 'fluegel', 550, 650, 600, 'Kuyruklu piyano ek ücreti'),
('extras', 'moebellift_single', 250, 300, 275, 'Möbellift tek adres'),
('extras', 'moebellift_double', 420, 480, 450, 'Möbellift iki adres');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_price_estimates_service ON public.job_price_estimates(service_type);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON public.pricing_rules(is_active);

-- Grant necessary permissions
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_price_estimates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read pricing (for display purposes)
DROP POLICY IF EXISTS "Authenticated users can read pricing rules" ON public.pricing_rules;
CREATE POLICY "Authenticated users can read pricing rules" ON public.pricing_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read pricing settings" ON public.pricing_settings;
CREATE POLICY "Authenticated users can read pricing settings" ON public.pricing_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read job price estimates" ON public.job_price_estimates;
CREATE POLICY "Authenticated users can read job price estimates" ON public.job_price_estimates
  FOR SELECT TO authenticated USING (true);

-- Only admins can modify pricing
DROP POLICY IF EXISTS "Admins can manage pricing rules" ON public.pricing_rules;
CREATE POLICY "Admins can manage pricing rules" ON public.pricing_rules
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage pricing settings" ON public.pricing_settings;
CREATE POLICY "Admins can manage pricing settings" ON public.pricing_settings
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage job price estimates" ON public.job_price_estimates;
CREATE POLICY "Admins can manage job price estimates" ON public.job_price_estimates
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Add comment for documentation
COMMENT ON TABLE public.pricing_rules IS 'Dynamic pricing rules for lead token costs based on Swiss market data';
COMMENT ON TABLE public.pricing_settings IS 'Global pricing configuration settings';
COMMENT ON TABLE public.job_price_estimates IS 'Swiss market job price estimates for ROI display to companies';

