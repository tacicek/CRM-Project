-- =============================================
-- DATABASE OPTIMIZATIONS
-- =============================================

-- 1. UNIQUE Constraint für company_plz_coverage (verhindert doppelte PLZ pro Firma)
ALTER TABLE public.company_plz_coverage 
ADD CONSTRAINT unique_company_plz UNIQUE (company_id, plz);

-- 2. UNIQUE Constraint für company_services (verhindert doppelte Services pro Firma)
ALTER TABLE public.company_services 
ADD CONSTRAINT unique_company_service UNIQUE (company_id, service_type);

-- 3. UNIQUE Constraint für lead_distributions (verhindert doppelte Verteilung)
ALTER TABLE public.lead_distributions 
ADD CONSTRAINT unique_lead_company UNIQUE (lead_id, company_id);

-- 4. Generated Column für offer_items.total (automatische Berechnung)
-- Erst alte Spalte droppen, dann als generated column neu erstellen
ALTER TABLE public.offer_items DROP COLUMN IF EXISTS total;
ALTER TABLE public.offer_items 
ADD COLUMN total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED;

-- 5. Typ-Konsistenz: from_rooms von numeric zu integer ändern
-- (bathroom_count ist bereits integer, from_rooms sollte auch integer sein)
ALTER TABLE public.leads 
ALTER COLUMN from_rooms TYPE integer USING from_rooms::integer;

-- 6. color_code Länge erhöhen für team_members (7 chars für #FFFFFF)
ALTER TABLE public.team_members 
ALTER COLUMN color_code TYPE varchar(7);

-- 7. Index für häufige Abfragen
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_service_type ON public.leads(service_type);
CREATE INDEX IF NOT EXISTS idx_offers_status ON public.offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_company_id ON public.offers(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_company_status ON public.appointments(company_id, status);