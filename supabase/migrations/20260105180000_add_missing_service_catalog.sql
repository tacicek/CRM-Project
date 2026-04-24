-- Migration: Add missing services to service_catalog
-- Ensures service_catalog matches available wizard forms

-- Add missing services (IF NOT EXISTS equivalent using ON CONFLICT)
INSERT INTO public.service_catalog (service_type, name_de, category, base_token_cost, sort_order, is_active) VALUES
-- Möbellift
('moebellift', 'Möbellift', 'transport', 12.00, 13, true),
('moebellift_mieten', 'Möbellift mieten', 'transport', 10.00, 14, true),
-- Klaviertransport (if not already added with correct type)
('klaviertransport', 'Klaviertransport', 'transport', 15.00, 15, true),
-- More cleaning types
('reinigung_bau', 'Baureinigung', 'reinigung', 10.00, 16, true),
-- Renovation
('renovation', 'Renovation', 'sonstige', 12.00, 17, true),
('malerarbeiten', 'Malerarbeiten', 'sonstige', 10.00, 18, true)
ON CONFLICT (service_type) DO NOTHING;

-- Delete transport_klavier entries where klaviertransport already exists for the same company
DELETE FROM public.company_services 
WHERE service_type = 'transport_klavier' 
AND company_id IN (
  SELECT company_id FROM public.company_services WHERE service_type = 'klaviertransport'
);

-- Update remaining transport_klavier to klaviertransport
UPDATE public.company_services 
SET service_type = 'klaviertransport' 
WHERE service_type = 'transport_klavier';

-- Also keep transport_klavier as active in catalog for backward compatibility
UPDATE public.service_catalog 
SET name_de = 'Klaviertransport', is_active = true 
WHERE service_type = 'transport_klavier';

-- Make sure all services are visible
UPDATE public.service_catalog SET is_active = true WHERE is_active IS NULL;

COMMENT ON TABLE public.service_catalog IS 'Centralized service catalog - used for both company settings and lead matching';

