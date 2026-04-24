-- Migration: Create raeumung_anfragen table for detailed clearance/disposal form
-- This table stores structured data from the multi-step Räumung wizard

-- Create enum types for Räumung
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'raeumungs_art') THEN
    CREATE TYPE raeumungs_art AS ENUM (
      'household_dissolution',
      'apartment_clearance',
      'house_clearance',
      'decluttering',
      'death_clearance',
      'estate_clearance',
      'hoarder_clearance',
      'forced_eviction',
      'cellar_clearance',
      'attic_clearance',
      'garage_clearance',
      'office_clearance',
      'company_dissolution',
      'storage_clearance'
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'condition_level') THEN
    CREATE TYPE condition_level AS ENUM ('normal', 'dirty', 'very_dirty', 'extreme');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'urgency_level') THEN
    CREATE TYPE urgency_level AS ENUM ('normal', 'urgent', 'very_urgent', 'emergency');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clearance_scope') THEN
    CREATE TYPE clearance_scope AS ENUM ('complete', 'partial');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'requester_role') THEN
    CREATE TYPE requester_role AS ENUM ('owner', 'tenant', 'property_manager', 'heir', 'landlord', 'authority', 'other');
  END IF;
END $$;

-- Create the raeumung_anfragen table
CREATE TABLE IF NOT EXISTS raeumung_anfragen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anfrage_nummer TEXT UNIQUE,
  
  -- Service Type
  raeumungs_art TEXT NOT NULL DEFAULT 'apartment_clearance',
  
  -- Property Details
  property_type TEXT,
  zimmer_anzahl INTEGER,
  flaeche_m2 INTEGER,
  stockwerke INTEGER,
  fuellgrad INTEGER, -- Percentage 0-100
  
  -- Address
  adresse_land TEXT DEFAULT 'CH',
  adresse_strasse TEXT,
  adresse_hausnummer TEXT,
  adresse_plz TEXT,
  adresse_ort TEXT,
  adresse_kanton TEXT,
  
  -- Access Details
  zugang_stockwerk TEXT,
  zugang_lift_vorhanden BOOLEAN DEFAULT false,
  zugang_lift_typ TEXT,
  zugang_parkplatz_distanz_m INTEGER,
  zugang_stufen TEXT,
  zugang_hindernisse JSONB DEFAULT '{}',
  
  -- Scope Details
  umfang_scope TEXT DEFAULT 'complete',
  umfang_bereiche JSONB DEFAULT '[]',
  umfang_inventar JSONB DEFAULT '{}',
  umfang_kartons_anzahl INTEGER DEFAULT 0,
  umfang_volumen_m3 INTEGER DEFAULT 10,
  
  -- Condition Assessment (for sensitive services)
  zustand_allgemein TEXT,
  zustand_besonderheiten JSONB DEFAULT '{}',
  zustand_fuellgrad_prozent INTEGER,
  zustand_schutzausruestung TEXT,
  
  -- Additional Services
  zusatzleistungen JSONB DEFAULT '{}',
  
  -- Timing
  termin_dringlichkeit TEXT DEFAULT 'normal',
  termin_wunschdatum DATE,
  termin_flexibilitaet TEXT DEFAULT 'flex_1_week',
  termin_besichtigung_gewuenscht BOOLEAN DEFAULT true,
  termin_besichtigung_termine JSONB DEFAULT '[]',
  
  -- Contact
  anfragender_rolle TEXT DEFAULT 'owner',
  anfragender_anrede TEXT,
  anfragender_vorname TEXT,
  anfragender_nachname TEXT,
  anfragender_firma TEXT,
  anfragender_email TEXT,
  anfragender_telefon TEXT,
  anfragender_kontaktzeit TEXT,
  
  -- Legal
  bemerkungen TEXT,
  agb_akzeptiert BOOLEAN DEFAULT false,
  berechtigung_bestaetigt BOOLEAN DEFAULT false,
  gerichtsbefehl_vorhanden BOOLEAN, -- For forced eviction
  
  -- Meta
  status TEXT DEFAULT 'neu',
  form_version INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_raeumung_status ON raeumung_anfragen(status);
CREATE INDEX IF NOT EXISTS idx_raeumung_art ON raeumung_anfragen(raeumungs_art);
CREATE INDEX IF NOT EXISTS idx_raeumung_created ON raeumung_anfragen(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raeumung_plz ON raeumung_anfragen(adresse_plz);

-- Create sequence for anfrage_nummer
CREATE SEQUENCE IF NOT EXISTS raeumung_seq START 1;

-- Function to generate anfrage_nummer
CREATE OR REPLACE FUNCTION generate_raeumung_nummer()
RETURNS TRIGGER AS $$
BEGIN
  NEW.anfrage_nummer := 'RAE-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('raeumung_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-generating anfrage_nummer
DROP TRIGGER IF EXISTS set_raeumung_nummer ON raeumung_anfragen;
CREATE TRIGGER set_raeumung_nummer
  BEFORE INSERT ON raeumung_anfragen
  FOR EACH ROW
  EXECUTE FUNCTION generate_raeumung_nummer();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_raeumung_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS raeumung_updated_at ON raeumung_anfragen;
CREATE TRIGGER raeumung_updated_at
  BEFORE UPDATE ON raeumung_anfragen
  FOR EACH ROW
  EXECUTE FUNCTION update_raeumung_updated_at();

-- Enable RLS
ALTER TABLE raeumung_anfragen ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can insert raeumung requests" ON raeumung_anfragen;
CREATE POLICY "Anyone can insert raeumung requests" ON raeumung_anfragen
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all raeumung requests" ON raeumung_anfragen;
CREATE POLICY "Admins can view all raeumung requests" ON raeumung_anfragen
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can update raeumung requests" ON raeumung_anfragen;
CREATE POLICY "Admins can update raeumung requests" ON raeumung_anfragen
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Also add raeumung-specific columns to leads table for integration
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS raeumungs_art TEXT,
  ADD COLUMN IF NOT EXISTS zustand_allgemein TEXT,
  ADD COLUMN IF NOT EXISTS zustand_besonderheiten JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS umfang_scope TEXT,
  ADD COLUMN IF NOT EXISTS umfang_bereiche JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS umfang_inventar JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS zugang_hindernisse JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS anfragender_rolle TEXT,
  ADD COLUMN IF NOT EXISTS berechtigung_bestaetigt BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gerichtsbefehl_vorhanden BOOLEAN;

-- Add comment to table
COMMENT ON TABLE raeumung_anfragen IS 'Detailed clearance/disposal requests from the multi-step wizard form';


