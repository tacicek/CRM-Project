-- =============================================
-- ENHANCE: Add pricing and service data to auftraege
-- This allows auftraege to store complete offer information
-- =============================================

-- Add pricing columns
ALTER TABLE public.auftraege 
  ADD COLUMN IF NOT EXISTS service_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 8.1,
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extra_services JSONB DEFAULT '[]'::jsonb;

-- Add service-specific data columns (from Lead)
ALTER TABLE public.auftraege
  ADD COLUMN IF NOT EXISTS service_details JSONB DEFAULT '{}'::jsonb;

-- Comments
COMMENT ON COLUMN public.auftraege.service_type IS 'Service type from the lead (umzug, reinigung, klaviertransport, etc.)';
COMMENT ON COLUMN public.auftraege.subtotal IS 'Subtotal from the offer (before VAT)';
COMMENT ON COLUMN public.auftraege.vat_rate IS 'VAT rate percentage';
COMMENT ON COLUMN public.auftraege.vat_amount IS 'VAT amount';
COMMENT ON COLUMN public.auftraege.total IS 'Total price including VAT';
COMMENT ON COLUMN public.auftraege.items IS 'Line items from the offer as JSON array';
COMMENT ON COLUMN public.auftraege.extra_services IS 'Additional services added to the auftrag';
COMMENT ON COLUMN public.auftraege.service_details IS 'Service-specific details from the lead (rooms, floor, lift, piano_type, etc.)';
