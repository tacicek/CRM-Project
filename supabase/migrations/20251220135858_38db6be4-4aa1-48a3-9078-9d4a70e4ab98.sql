-- Add admin policies for token_packages management
CREATE POLICY "Admins can insert token packages"
ON public.token_packages
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update token packages"
ON public.token_packages
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete token packages"
ON public.token_packages
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create pricing_rules table for lead pricing configuration
CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL DEFAULT 'default',
  base_price NUMERIC NOT NULL DEFAULT 20,
  service_multipliers JSONB DEFAULT '{}',
  urgency_multipliers JSONB DEFAULT '{"normal": 1.0, "urgent": 1.5}',
  size_tiers JSONB DEFAULT '{}',
  location_multipliers JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for pricing_rules
CREATE POLICY "Pricing rules are publicly readable"
ON public.pricing_rules
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert pricing rules"
ON public.pricing_rules
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update pricing rules"
ON public.pricing_rules
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete pricing rules"
ON public.pricing_rules
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Insert default pricing rule
INSERT INTO public.pricing_rules (name, base_price, service_multipliers, urgency_multipliers)
VALUES (
  'default',
  20,
  '{"umzug": 1.2, "reinigung": 0.8, "renovation": 1.5, "entsorgung": 1.0, "malerarbeiten": 1.3}',
  '{"normal": 1.0, "urgent": 1.5}'
);