-- Migration: Create moebellift_anfragen table
-- Purpose: Detailed Möbellift (Furniture Lift) rental form data

-- Create moebellift_anfragen table
CREATE TABLE IF NOT EXISTS public.moebellift_anfragen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anfrage_nummer TEXT UNIQUE,
  
  -- Service Type
  service_type TEXT NOT NULL DEFAULT 'with_operator',
  zweck TEXT NOT NULL DEFAULT 'umzug',
  richtung TEXT DEFAULT 'both',
  
  -- Location
  einsatzort_adresse JSONB DEFAULT '{}',
  stockwerk TEXT,
  geschaetzte_hoehe_m DECIMAL(4,1),
  zugang TEXT,
  oeffnung_breite_cm INTEGER,
  oeffnung_hoehe_cm INTEGER,
  
  -- Site Conditions
  stellflaeche TEXT,
  hindernisse JSONB DEFAULT '{}',
  parkplatz TEXT,
  strom TEXT,
  
  -- Transport Items
  transport_details JSONB DEFAULT '{}',
  
  -- Schedule
  wunschdatum DATE,
  wunschzeit TEXT,
  dauer TEXT,
  flexibilitaet TEXT,
  
  -- Additional Services
  zusatzleistungen JSONB DEFAULT '{}',
  
  -- Contact
  kunde_anrede TEXT,
  kunde_vorname TEXT,
  kunde_nachname TEXT,
  kunde_firma TEXT,
  kunde_email TEXT,
  kunde_telefon TEXT,
  kunde_kontakt_art TEXT,
  kontakt_vor_ort JSONB,
  
  -- Photos
  fotos TEXT[],
  
  -- Remarks
  bemerkungen TEXT,
  
  -- Agreements
  agb_akzeptiert BOOLEAN DEFAULT false,
  stellflaeche_bestaetigt BOOLEAN DEFAULT false,
  berechtigung_bestaetigt BOOLEAN DEFAULT false,
  
  -- Calculated
  geschaetzter_preis_chf DECIMAL(10,2),
  empfohlener_lift_typ TEXT,
  
  -- Meta
  status TEXT DEFAULT 'neu',
  form_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_moebellift_service ON public.moebellift_anfragen(service_type);
CREATE INDEX IF NOT EXISTS idx_moebellift_zweck ON public.moebellift_anfragen(zweck);
CREATE INDEX IF NOT EXISTS idx_moebellift_status ON public.moebellift_anfragen(status);
CREATE INDEX IF NOT EXISTS idx_moebellift_datum ON public.moebellift_anfragen(wunschdatum);
CREATE INDEX IF NOT EXISTS idx_moebellift_created ON public.moebellift_anfragen(created_at DESC);

-- Auto-generate anfrage_nummer
CREATE SEQUENCE IF NOT EXISTS moebellift_seq START 1;

CREATE OR REPLACE FUNCTION generate_moebellift_nummer()
RETURNS TRIGGER AS $$
BEGIN
  NEW.anfrage_nummer := 'MLF-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('moebellift_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_moebellift_nummer ON public.moebellift_anfragen;
CREATE TRIGGER set_moebellift_nummer
  BEFORE INSERT ON public.moebellift_anfragen
  FOR EACH ROW
  EXECUTE FUNCTION generate_moebellift_nummer();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_moebellift_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_moebellift_updated_at ON public.moebellift_anfragen;
CREATE TRIGGER set_moebellift_updated_at
  BEFORE UPDATE ON public.moebellift_anfragen
  FOR EACH ROW
  EXECUTE FUNCTION update_moebellift_updated_at();

-- RLS policies
ALTER TABLE public.moebellift_anfragen ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form)
DROP POLICY IF EXISTS "Allow public insert on moebellift_anfragen" ON public.moebellift_anfragen;
CREATE POLICY "Allow public insert on moebellift_anfragen"
  ON public.moebellift_anfragen FOR INSERT
  WITH CHECK (true);

-- Allow authenticated users to view their company's anfragen
DROP POLICY IF EXISTS "Allow authenticated read on moebellift_anfragen" ON public.moebellift_anfragen;
CREATE POLICY "Allow authenticated read on moebellift_anfragen"
  ON public.moebellift_anfragen FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage all
DROP POLICY IF EXISTS "Allow admin full access on moebellift_anfragen" ON public.moebellift_anfragen;
CREATE POLICY "Allow admin full access on moebellift_anfragen"
  ON public.moebellift_anfragen FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Comment on table
COMMENT ON TABLE public.moebellift_anfragen IS 'Möbellift (furniture lift) rental requests with detailed form data';


