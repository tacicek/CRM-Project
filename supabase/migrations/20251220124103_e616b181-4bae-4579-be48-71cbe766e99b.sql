-- =====================================================
-- ENABLE REQUIRED EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- =====================================================
-- SERVICE CATALOG
-- =====================================================
CREATE TABLE public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type VARCHAR(100) UNIQUE NOT NULL,
  name_de VARCHAR(255) NOT NULL,
  name_fr VARCHAR(255),
  name_en VARCHAR(255),
  description_de TEXT,
  category VARCHAR(100),
  base_token_cost DECIMAL(10,2) NOT NULL DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.service_catalog (service_type, name_de, category, base_token_cost, sort_order) VALUES
('umzug_privat', 'Privatumzug', 'umzug', 12.00, 1),
('umzug_firma', 'Firmenumzug', 'umzug', 15.00, 2),
('umzug_international', 'Internationaler Umzug', 'umzug', 20.00, 3),
('reinigung_end', 'Endreinigung', 'reinigung', 8.00, 4),
('reinigung_grund', 'Grundreinigung', 'reinigung', 10.00, 5),
('reinigung_fenster', 'Fensterreinigung', 'reinigung', 6.00, 6),
('raeumung_wohnung', 'Wohnungsräumung', 'raeumung', 10.00, 7),
('raeumung_haus', 'Hausräumung', 'raeumung', 15.00, 8),
('transport_moebel', 'Möbeltransport', 'transport', 8.00, 9),
('transport_klavier', 'Klaviertransport', 'transport', 12.00, 10),
('lagerung', 'Lagerung', 'lagerung', 6.00, 11),
('entsorgung', 'Entsorgung', 'entsorgung', 8.00, 12);

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service catalog is publicly readable" ON public.service_catalog FOR SELECT USING (true);

-- =====================================================
-- COMPANIES
-- =====================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slug VARCHAR(100) UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  logo_url TEXT,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  website VARCHAR(255),
  street VARCHAR(255),
  house_number VARCHAR(20),
  plz VARCHAR(10) NOT NULL,
  city VARCHAR(100) NOT NULL,
  canton VARCHAR(50),
  uid_number VARCHAR(50),
  mwst_number VARCHAR(50),
  iban VARCHAR(50),
  token_balance DECIMAL(10,2) DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  notification_email VARCHAR(255),
  notification_phone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can view their own data" ON public.companies 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Companies can update their own data" ON public.companies 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own company" ON public.companies 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- COMPANY SERVICE PREFERENCES
-- =====================================================
CREATE TABLE public.company_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, service_type)
);

ALTER TABLE public.company_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company owners can manage their services" ON public.company_services 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

-- =====================================================
-- COMPANY PLZ COVERAGE
-- =====================================================
CREATE TABLE public.company_plz_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  plz VARCHAR(10) NOT NULL,
  radius_km INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, plz)
);

ALTER TABLE public.company_plz_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company owners can manage their PLZ coverage" ON public.company_plz_coverage 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

-- =====================================================
-- LEADS
-- =====================================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE,
  customer_first_name VARCHAR(100) NOT NULL,
  customer_last_name VARCHAR(100) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  from_street VARCHAR(255),
  from_house_number VARCHAR(20),
  from_plz VARCHAR(10) NOT NULL,
  from_city VARCHAR(100) NOT NULL,
  from_floor INTEGER,
  from_has_lift BOOLEAN DEFAULT false,
  from_rooms DECIMAL(3,1),
  from_living_space_m2 INTEGER,
  to_street VARCHAR(255),
  to_house_number VARCHAR(20),
  to_plz VARCHAR(10),
  to_city VARCHAR(100),
  to_floor INTEGER,
  to_has_lift BOOLEAN DEFAULT false,
  preferred_date DATE,
  preferred_time_slot VARCHAR(50),
  is_flexible_date BOOLEAN DEFAULT true,
  description TEXT,
  special_items TEXT[],
  packing_service_needed BOOLEAN DEFAULT false,
  cleaning_service_needed BOOLEAN DEFAULT false,
  storage_needed BOOLEAN DEFAULT false,
  max_companies INTEGER NOT NULL DEFAULT 3,
  accepted_count INTEGER DEFAULT 0,
  token_cost DECIMAL(10,2) DEFAULT 10,
  status VARCHAR(50) DEFAULT 'pending',
  source VARCHAR(100) DEFAULT 'website',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours')
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead" ON public.leads 
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- LEAD DISTRIBUTIONS
-- =====================================================
CREATE TABLE public.lead_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(50) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  token_cost DECIMAL(10,2),
  token_charged BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  UNIQUE(lead_id, company_id)
);

ALTER TABLE public.lead_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can view their lead distributions" ON public.lead_distributions 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

CREATE POLICY "Companies can update their lead distributions" ON public.lead_distributions 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

-- Now add the leads SELECT policy that references lead_distributions
CREATE POLICY "Companies can view leads distributed to them" ON public.leads 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lead_distributions ld
      JOIN public.companies c ON c.id = ld.company_id
      WHERE ld.lead_id = leads.id AND c.user_id = auth.uid()
    )
  );

-- =====================================================
-- TOKEN TRANSACTIONS
-- =====================================================
CREATE TABLE public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2),
  balance_after DECIMAL(10,2),
  reference_type VARCHAR(50),
  reference_id UUID,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can view their token transactions" ON public.token_transactions 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

-- =====================================================
-- TOKEN PACKAGES
-- =====================================================
CREATE TABLE public.token_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  price_chf DECIMAL(10,2) NOT NULL,
  tokens_included INTEGER NOT NULL,
  bonus_tokens INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  badge_text VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.token_packages (name, price_chf, tokens_included, bonus_tokens, is_featured, badge_text, sort_order) VALUES
('Starter', 50, 50, 0, false, NULL, 1),
('Standard', 100, 100, 10, false, NULL, 2),
('Professional', 250, 250, 25, true, 'BELIEBT', 3),
('Business', 500, 500, 50, false, 'BEST VALUE', 4),
('Enterprise', 1000, 1000, 100, false, NULL, 5);

ALTER TABLE public.token_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Token packages are publicly readable" ON public.token_packages FOR SELECT USING (true);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_plz ON public.leads(from_plz);
CREATE INDEX idx_leads_service ON public.leads(service_type);
CREATE INDEX idx_leads_created ON public.leads(created_at DESC);
CREATE INDEX idx_distributions_status ON public.lead_distributions(status);
CREATE INDEX idx_distributions_company ON public.lead_distributions(company_id);
CREATE INDEX idx_company_plz ON public.company_plz_coverage(plz);
CREATE INDEX idx_tokens_company ON public.token_transactions(company_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_unique_slug(prefix TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_lead_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_unique_slug('ANF');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_lead_slug
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_slug();

CREATE OR REPLACE FUNCTION public.set_company_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := LOWER(REGEXP_REPLACE(NEW.company_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_company_slug
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_slug();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();