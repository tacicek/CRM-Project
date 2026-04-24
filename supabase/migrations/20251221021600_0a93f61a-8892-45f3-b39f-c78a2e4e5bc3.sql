-- Company-specific service catalog
CREATE TABLE company_service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_type VARCHAR NOT NULL, -- 'umzug', 'reinigung', 'raeumung', etc.
  category VARCHAR NOT NULL, -- 'transport', 'personal', 'verpackung', 'entsorgung', 'reinigung', 'versicherung', 'lagerung', 'spezial'
  name VARCHAR NOT NULL,
  description TEXT,
  unit VARCHAR DEFAULT 'Pauschal', -- 'Pauschal', 'Stunde', 'm3', 'm2', 'Zimmer', 'Stück', 'kg', 'km', 'Tag'
  default_price DECIMAL(10,2) DEFAULT 0,
  is_default_included BOOLEAN DEFAULT false, -- Auto-include in new offers
  is_optional BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leistungsübersicht templates for quick reuse
CREATE TABLE leistungsuebersicht_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL, -- "Standard Umzug 3.5 Zimmer", "Premium Reinigung", etc.
  service_type VARCHAR NOT NULL,
  description TEXT,
  included_service_ids UUID[], -- Array of company_service_items IDs
  excluded_services TEXT[], -- Free text array of what's NOT included
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leistungsübersicht for specific offers
CREATE TABLE offer_leistungsuebersicht (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  included_services JSONB NOT NULL DEFAULT '[]', -- Detailed service items with prices
  excluded_services TEXT[] DEFAULT '{}',
  special_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(offer_id)
);

-- Add leistungsuebersicht_url to offers table
ALTER TABLE offers ADD COLUMN IF NOT EXISTS leistungsuebersicht_url TEXT;

-- Create indexes
CREATE INDEX idx_company_service_items_company ON company_service_items(company_id);
CREATE INDEX idx_company_service_items_type ON company_service_items(service_type);
CREATE INDEX idx_company_service_items_category ON company_service_items(category);
CREATE INDEX idx_leistung_templates_company ON leistungsuebersicht_templates(company_id);
CREATE INDEX idx_offer_leistung ON offer_leistungsuebersicht(offer_id);

-- Enable RLS
ALTER TABLE company_service_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE leistungsuebersicht_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_leistungsuebersicht ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_service_items
CREATE POLICY "Companies can manage their service items"
ON company_service_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = company_service_items.company_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all service items"
ON company_service_items FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- RLS policies for leistungsuebersicht_templates
CREATE POLICY "Companies can manage their templates"
ON leistungsuebersicht_templates FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = leistungsuebersicht_templates.company_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all leistung templates"
ON leistungsuebersicht_templates FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- RLS policies for offer_leistungsuebersicht
CREATE POLICY "Companies can manage their offer leistungsuebersicht"
ON offer_leistungsuebersicht FOR ALL
USING (EXISTS (
  SELECT 1 FROM offers
  JOIN companies ON companies.id = offers.company_id
  WHERE offers.id = offer_leistungsuebersicht.offer_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Admins can view all offer leistungsuebersicht"
ON offer_leistungsuebersicht FOR SELECT
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_company_service_items_updated_at
BEFORE UPDATE ON company_service_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_leistungsuebersicht_templates_updated_at
BEFORE UPDATE ON leistungsuebersicht_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_offer_leistungsuebersicht_updated_at
BEFORE UPDATE ON offer_leistungsuebersicht
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();