-- =====================================================
-- ENHANCED OFFERS SYSTEM
-- Adds professional offer features for all service types
-- =====================================================

-- Add offer number sequence per company
CREATE SEQUENCE IF NOT EXISTS offer_number_seq START 10000;

-- Add new columns to offers table
ALTER TABLE public.offers

-- Offer identification
ADD COLUMN IF NOT EXISTS offer_number INTEGER,
ADD COLUMN IF NOT EXISTS company_reference TEXT, -- Employee/contact name

-- Customer formality
ADD COLUMN IF NOT EXISTS customer_salutation VARCHAR(10), -- 'Frau', 'Herr', 'Firma'

-- Service timing
ADD COLUMN IF NOT EXISTS service_start_time TIME,
ADD COLUMN IF NOT EXISTS service_end_time TIME,
ADD COLUMN IF NOT EXISTS secondary_service_date DATE, -- e.g., cleaning date after moving
ADD COLUMN IF NOT EXISTS secondary_service_type VARCHAR(100), -- e.g., 'reinigung'

-- Service-specific details (flexible JSONB)
ADD COLUMN IF NOT EXISTS service_details JSONB DEFAULT '{}',
-- Example structure:
-- {
--   "property_type": "4-Zimmer-Wohnung",
--   "living_space_m2": 79,
--   "volume_m3": 25,
--   "distance_km": 15,
--   "floors": { "from": 2, "to": 1 },
--   "lifts": { "from": false, "to": false }
-- }

-- Resources used
ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '{}',
-- Example structure:
-- {
--   "vehicles": [{ "type": "Möbelwagen", "size_m3": 25, "count": 1 }],
--   "personnel": { "count": 3, "roles": ["Teamleiter", "Umzugshelfer", "Umzugshelfer"] },
--   "equipment": ["Möbellift", "Stretchfolie", "Decken"]
-- }

-- Highlighted sections (for yellow background items)
ADD COLUMN IF NOT EXISTS highlighted_items TEXT[],

-- Payment and terms
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100), -- 'bar', 'rechnung', 'twint', etc.
ADD COLUMN IF NOT EXISTS payment_due_days INTEGER DEFAULT 30,

-- Internal tracking
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS assigned_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL;

-- Create function to auto-generate offer numbers per company
CREATE OR REPLACE FUNCTION generate_offer_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- Get next number for this company
  SELECT COALESCE(MAX(offer_number), 10000) + 1 INTO next_number
  FROM offers
  WHERE company_id = NEW.company_id;
  
  NEW.offer_number := next_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating offer numbers
DROP TRIGGER IF EXISTS trigger_generate_offer_number ON offers;
CREATE TRIGGER trigger_generate_offer_number
  BEFORE INSERT ON offers
  FOR EACH ROW
  WHEN (NEW.offer_number IS NULL)
  EXECUTE FUNCTION generate_offer_number();

-- Add index for offer number lookups
CREATE INDEX IF NOT EXISTS idx_offers_company_number ON offers(company_id, offer_number);

-- =====================================================
-- SERVICE-SPECIFIC TEMPLATES
-- Pre-defined detail templates for each service type
-- =====================================================

CREATE TABLE IF NOT EXISTS service_detail_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type VARCHAR(100) NOT NULL,
  template_key VARCHAR(100) NOT NULL, -- e.g., 'standard_umzug', 'premium_reinigung'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Default values for this service type
  default_details JSONB DEFAULT '{}',
  default_resources JSONB DEFAULT '{}',
  default_highlighted_items TEXT[],
  
  -- Display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(service_type, template_key)
);

-- Insert default templates for each service type
INSERT INTO service_detail_templates (service_type, template_key, name, description, default_details, default_resources, default_highlighted_items) VALUES

-- UMZUG
('umzug', 'standard_umzug', 'Standard Umzug', 'Grundlegendes Umzugspaket', 
 '{"property_type": "", "living_space_m2": null, "volume_m3": 25}',
 '{"vehicles": [{"type": "Möbelwagen", "size_m3": 25, "count": 1}], "personnel": {"count": 3, "description": "3 erfahrene Umzugsmitarbeiter"}}',
 ARRAY['Möbel einwickeln mit Stretchfolie und Decken', 'De- und Remontage der Möbel']),

('umzug', 'premium_umzug', 'Premium Umzug', 'Komplettpaket mit allen Extras',
 '{"property_type": "", "living_space_m2": null, "volume_m3": 35}',
 '{"vehicles": [{"type": "Möbelwagen", "size_m3": 35, "count": 1}], "personnel": {"count": 4, "description": "4 erfahrene Umzugsmitarbeiter inkl. Teamleiter"}}',
 ARRAY['Möbel einwickeln mit Stretchfolie und Decken', 'De- und Remontage der Möbel', 'Kartonverpackung inklusive', 'Transportversicherung bis CHF 200''000']),

-- REINIGUNG
('reinigung', 'endreinigung', 'Endreinigung mit Abnahmegarantie', 'Reinigung für Wohnungsübergabe',
 '{"cleaning_type": "Endreinigung", "guarantee": true}',
 '{"personnel": {"count": 2, "description": "2 professionelle Reinigungskräfte"}}',
 ARRAY['Mit Abnahmegarantie', 'Fensterreinigung inklusive']),

('reinigung', 'grundreinigung', 'Grundreinigung', 'Tiefenreinigung',
 '{"cleaning_type": "Grundreinigung", "guarantee": false}',
 '{"personnel": {"count": 2, "description": "2 professionelle Reinigungskräfte"}}',
 ARRAY['Tiefenreinigung aller Räume']),

-- RÄUMUNG
('raeumung', 'wohnungsraeumung', 'Wohnungsräumung', 'Komplette Entrümpelung',
 '{"clearing_type": "Wohnung", "disposal_included": true}',
 '{"vehicles": [{"type": "Mulde", "size_m3": 7, "count": 1}], "personnel": {"count": 2, "description": "2 Räumungsmitarbeiter"}}',
 ARRAY['Fachgerechte Entsorgung inklusive']),

-- ENTSORGUNG
('entsorgung', 'standard_entsorgung', 'Standard Entsorgung', 'Umweltgerechte Entsorgung',
 '{"disposal_type": "Möbel", "recycling": true}',
 '{"vehicles": [{"type": "Transporter", "size_m3": 12, "count": 1}], "personnel": {"count": 2, "description": "2 Entsorgungsmitarbeiter"}}',
 ARRAY['Umweltgerechte Entsorgung', 'Recycling wo möglich']),

-- LAGERUNG
('lagerung', 'standard_lagerung', 'Standard Lagerung', 'Sichere Möbellagerung',
 '{"storage_type": "Möbel", "climate_controlled": false}',
 '{"storage": {"unit_size_m3": 10, "access": "Mo-Fr 8-17 Uhr"}}',
 ARRAY['Trockene und sichere Lagerung', 'Versicherung inklusive']),

-- KLAVIERTRANSPORT
('klaviertransport', 'klavier_standard', 'Klaviertransport', 'Sicherer Klaviertransport',
 '{"piano_type": "", "weight_kg": null}',
 '{"vehicles": [{"type": "Klaviertransporter", "count": 1}], "personnel": {"count": 2, "description": "2 spezialisierte Klaviertransporteure"}, "equipment": ["Klaviergurt", "Klavierdecke", "Transportwagen"]}',
 ARRAY['Spezialtransport mit Fachpersonal', 'Instrumentenversicherung inklusive']),

-- MÖBELLIFT
('moebellift', 'moebellift_standard', 'Möbellift-Einsatz', 'Aussenlift für Möbeltransport',
 '{"max_floor": null, "item_description": ""}',
 '{"equipment": ["Möbellift bis 400kg", "Tragegurte"]}',
 ARRAY['Bis 400kg Tragkraft', 'Inklusive Auf- und Abbau']),

-- MALERARBEIT
('malerarbeit', 'malerarbeit_standard', 'Malerarbeiten', 'Professionelle Malerarbeiten',
 '{"work_type": "Streichen", "surface_m2": null}',
 '{"personnel": {"count": 2, "description": "2 ausgebildete Maler"}, "materials": ["Farbe", "Grundierung", "Abdeckmaterial"]}',
 ARRAY['Professionelle Ausführung', 'Material inklusive']),

-- USM TRANSPORT
('usm_transport', 'usm_standard', 'USM Möbeltransport', 'Fachgerechter USM Transport',
 '{"item_description": "", "disassembly_required": true}',
 '{"vehicles": [{"type": "Transporter", "size_m3": 12, "count": 1}], "personnel": {"count": 2, "description": "2 USM-erfahrene Transporteure"}}',
 ARRAY['Fachgerechte De- und Remontage', 'Spezialverpackung']),

-- WASSERBETT TRANSPORT
('wasserbett_transport', 'wasserbett_standard', 'Wasserbett Transport', 'Sicherer Wasserbett-Transport',
 '{"bed_size": "", "includes_draining": true}',
 '{"personnel": {"count": 2, "description": "2 spezialisierte Transporteure"}, "equipment": ["Wasserbett-Pumpe", "Spezialfolie"]}',
 ARRAY['Entleeren und Befüllen inklusive', 'Transportsichere Verpackung'])

ON CONFLICT (service_type, template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_details = EXCLUDED.default_details,
  default_resources = EXCLUDED.default_resources,
  default_highlighted_items = EXCLUDED.default_highlighted_items,
  updated_at = NOW();

-- RLS for service_detail_templates (read-only for authenticated users)
ALTER TABLE service_detail_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can read service templates" ON service_detail_templates;
DROP POLICY IF EXISTS "Admins can manage service templates" ON service_detail_templates;

CREATE POLICY "Anyone can read service templates"
ON service_detail_templates FOR SELECT
USING (true);

CREATE POLICY "Admins can manage service templates"
ON service_detail_templates FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- =====================================================
-- COMPANY OFFER SETTINGS
-- Per-company customization for offers
-- =====================================================

CREATE TABLE IF NOT EXISTS company_offer_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Numbering
  offer_number_prefix VARCHAR(20) DEFAULT '', -- e.g., 'OFF-', 'A24-'
  offer_number_start INTEGER DEFAULT 10000,
  
  -- Default values
  default_vat_rate NUMERIC DEFAULT 8.1,
  default_payment_method VARCHAR(100) DEFAULT 'bar',
  default_payment_due_days INTEGER DEFAULT 30,
  default_validity_days INTEGER DEFAULT 14,
  
  -- Company reference options (team members to show in dropdown)
  show_company_reference BOOLEAN DEFAULT true,
  
  -- Display preferences
  show_mwst_separately BOOLEAN DEFAULT true,
  show_item_numbers BOOLEAN DEFAULT true,
  highlight_inclusions BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE company_offer_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Companies can manage their offer settings" ON company_offer_settings;
DROP POLICY IF EXISTS "Admins can manage all offer settings" ON company_offer_settings;

CREATE POLICY "Companies can manage their offer settings"
ON company_offer_settings FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = company_offer_settings.company_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all offer settings"
ON company_offer_settings FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Create index
CREATE INDEX IF NOT EXISTS idx_offer_settings_company ON company_offer_settings(company_id);

-- =====================================================
-- VIEW FOR OFFER DETAILS
-- Convenient view with all offer information
-- =====================================================

CREATE OR REPLACE VIEW public.offer_details AS
SELECT 
  o.*,
  c.company_name,
  c.street AS company_street,
  c.house_number AS company_house_number,
  c.plz AS company_plz,
  c.city AS company_city,
  c.phone AS company_phone,
  c.email AS company_email,
  c.mwst_number AS company_mwst_number,
  c.logo_url AS company_logo_url,
  l.service_type,
  l.from_street,
  l.from_house_number,
  l.from_plz,
  l.from_city,
  l.from_floor,
  l.from_has_lift,
  l.from_rooms,
  l.from_living_space_m2,
  l.to_street,
  l.to_house_number,
  l.to_plz,
  l.to_city,
  l.to_floor,
  l.to_has_lift,
  l.preferred_date,
  l.description AS lead_description,
  tm.first_name AS reference_first_name,
  tm.last_name AS reference_last_name,
  tm.email AS reference_email,
  tm.phone AS reference_phone
FROM offers o
LEFT JOIN companies c ON o.company_id = c.id
LEFT JOIN leads l ON o.lead_id = l.id
LEFT JOIN team_members tm ON o.assigned_team_member_id = tm.id;

-- Grant access to view
GRANT SELECT ON public.offer_details TO authenticated;

COMMENT ON VIEW public.offer_details IS 'Complete offer information with company, lead and team member details';

