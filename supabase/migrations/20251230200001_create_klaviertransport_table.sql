-- Migration: Create klaviertransport_anfragen table
-- This table stores detailed piano transport requests

-- Create the klaviertransport_anfragen table
CREATE TABLE IF NOT EXISTS public.klaviertransport_anfragen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anfrage_nummer TEXT UNIQUE,
  
  -- Service Type
  service_type TEXT NOT NULL DEFAULT 'transport',
  
  -- Instrument
  instrument_type TEXT NOT NULL,
  instrument_brand TEXT,
  instrument_model TEXT,
  instrument_age TEXT,
  instrument_value TEXT,
  instrument_notes TEXT,
  instrument_photos TEXT[],
  
  -- Pickup Location
  abholort_adresse JSONB DEFAULT '{}',
  abholort_stockwerk TEXT,
  abholort_lift JSONB DEFAULT '{}',
  abholort_treppenhaus TEXT,
  abholort_hindernisse JSONB DEFAULT '{}',
  
  -- Delivery Location
  lieferort_adresse JSONB,
  lieferort_stockwerk TEXT,
  lieferort_lift JSONB,
  lieferort_treppenhaus TEXT,
  lieferort_hindernisse JSONB,
  
  -- Special Requirements
  equipment_required TEXT,
  demontage TEXT,
  
  -- Additional Services
  zusatzleistungen JSONB DEFAULT '{}',
  
  -- Schedule
  wunschdatum DATE,
  flexibilitaet TEXT,
  uhrzeit TEXT,
  
  -- Contact
  kunde_anrede TEXT,
  kunde_vorname TEXT,
  kunde_nachname TEXT,
  kunde_email TEXT,
  kunde_telefon TEXT,
  kunde_kontaktzeit TEXT,
  kontakt_vor_ort JSONB,
  
  -- Agreements
  agb_akzeptiert BOOLEAN DEFAULT false,
  transportfaehig_bestaetigt BOOLEAN DEFAULT false,
  berechtigung_bestaetigt BOOLEAN DEFAULT false,
  
  -- Remarks
  bemerkungen TEXT,
  
  -- Calculated
  geschaetzte_distanz_km DECIMAL(6,1),
  geschaetzter_preis_chf DECIMAL(10,2),
  
  -- Meta
  status TEXT DEFAULT 'neu',
  form_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_klavier_service ON public.klaviertransport_anfragen(service_type);
CREATE INDEX IF NOT EXISTS idx_klavier_instrument ON public.klaviertransport_anfragen(instrument_type);
CREATE INDEX IF NOT EXISTS idx_klavier_status ON public.klaviertransport_anfragen(status);
CREATE INDEX IF NOT EXISTS idx_klavier_created ON public.klaviertransport_anfragen(created_at DESC);

-- Create sequence for anfrage_nummer
CREATE SEQUENCE IF NOT EXISTS klavier_seq START 1;

-- Function to generate anfrage_nummer
CREATE OR REPLACE FUNCTION public.generate_klavier_nummer()
RETURNS TRIGGER AS $$
BEGIN
  NEW.anfrage_nummer := 'KLV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('klavier_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS set_klavier_nummer ON public.klaviertransport_anfragen;
CREATE TRIGGER set_klavier_nummer
  BEFORE INSERT ON public.klaviertransport_anfragen
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_klavier_nummer();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_klaviertransport_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS update_klaviertransport_timestamp ON public.klaviertransport_anfragen;
CREATE TRIGGER update_klaviertransport_timestamp
  BEFORE UPDATE ON public.klaviertransport_anfragen
  FOR EACH ROW
  EXECUTE FUNCTION public.update_klaviertransport_updated_at();

-- Enable RLS
ALTER TABLE public.klaviertransport_anfragen ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can insert (public form)
DROP POLICY IF EXISTS "Anyone can insert klaviertransport anfragen" ON public.klaviertransport_anfragen;
CREATE POLICY "Anyone can insert klaviertransport anfragen"
  ON public.klaviertransport_anfragen
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Admin users can view all
DROP POLICY IF EXISTS "Admins can view all klaviertransport anfragen" ON public.klaviertransport_anfragen;
CREATE POLICY "Admins can view all klaviertransport anfragen"
  ON public.klaviertransport_anfragen
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- Admin users can update all
DROP POLICY IF EXISTS "Admins can update all klaviertransport anfragen" ON public.klaviertransport_anfragen;
CREATE POLICY "Admins can update all klaviertransport anfragen"
  ON public.klaviertransport_anfragen
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- Grant permissions
GRANT ALL ON public.klaviertransport_anfragen TO authenticated;
GRANT INSERT ON public.klaviertransport_anfragen TO anon;
GRANT USAGE ON SEQUENCE klavier_seq TO anon;
GRANT USAGE ON SEQUENCE klavier_seq TO authenticated;

COMMENT ON TABLE public.klaviertransport_anfragen IS 'Piano transport requests with detailed instrument and location information';

