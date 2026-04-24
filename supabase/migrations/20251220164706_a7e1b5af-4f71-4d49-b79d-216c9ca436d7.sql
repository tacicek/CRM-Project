-- pricing_rules tablosunu daha kapsamlı fiyatlandırma için güncelle
ALTER TABLE public.pricing_rules 
ADD COLUMN IF NOT EXISTS room_tiers jsonb DEFAULT '{"1": 0.6, "2": 0.8, "3": 1.0, "4": 1.2, "5": 1.4, "6": 1.6}'::jsonb,
ADD COLUMN IF NOT EXISTS distance_tiers jsonb DEFAULT '{"0-10": 1.0, "10-25": 1.2, "25-50": 1.4, "50-100": 1.6, "100+": 2.0}'::jsonb,
ADD COLUMN IF NOT EXISTS extra_services jsonb DEFAULT '{"packing": 0.3, "cleaning": 0.2, "storage": 0.25}'::jsonb,
ADD COLUMN IF NOT EXISTS living_space_tiers jsonb DEFAULT '{"0-50": 0.8, "50-80": 1.0, "80-120": 1.2, "120-180": 1.5, "180+": 2.0}'::jsonb,
ADD COLUMN IF NOT EXISTS token_to_chf_rate numeric DEFAULT 1.0;

-- Token-CHF kuru için ayarlar tablosu
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_value_chf numeric NOT NULL DEFAULT 1.0,
  min_lead_price_tokens numeric DEFAULT 5,
  max_lead_price_tokens numeric DEFAULT 200,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- pricing_settings için RLS
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- Admin erişimi
CREATE POLICY "Admins can manage pricing settings" ON public.pricing_settings
FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Herkes okuyabilir
CREATE POLICY "Pricing settings are publicly readable" ON public.pricing_settings
FOR SELECT USING (true);

-- Varsayılan ayar ekle
INSERT INTO public.pricing_settings (token_value_chf, min_lead_price_tokens, max_lead_price_tokens)
VALUES (1.0, 5, 200)
ON CONFLICT DO NOTHING;