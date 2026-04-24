-- =============================================================================
-- DBG-016 Schema Audit Fixes
-- SCH-3: offers.lead_id ON DELETE CASCADE → SET NULL
-- SCH-4: companies.token_balance >= 0 CHECK
-- SCH-5: leads.status CHECK + 'new' → 'pending' normalizasyonu
-- SCH-6: lead_distributions.status CHECK
-- SCH-7: offer_items.price_type CHECK + quantity/unit_price CHECK (SCH-10)
-- SCH-9: leads(status, service_type) composite index
-- =============================================================================

-- =============================================================================
-- SCH-3: Lead silinince offers cascade — SET NULL'a çevir
-- Admin spam lead sildiğinde firma teklifleri/iş emirleri korunur
-- =============================================================================

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_lead_id_fkey;

ALTER TABLE public.offers
  ADD CONSTRAINT offers_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

-- lead_id NOT NULL iken SET NULL çakışır — nullable yapıyoruz
-- (lead silindiğinde offer geçmişi kalmalı, lead_id sadece referans)
ALTER TABLE public.offers
  ALTER COLUMN lead_id DROP NOT NULL;

COMMENT ON COLUMN public.offers.lead_id IS
  'Reference to source lead. SET NULL on lead delete — offer/auftrag history preserved.';

-- =============================================================================
-- SCH-4: companies.token_balance negatif olamaz
-- =============================================================================

ALTER TABLE public.companies
  ADD CONSTRAINT chk_token_balance_non_negative
  CHECK (token_balance >= 0);

COMMENT ON CONSTRAINT chk_token_balance_non_negative ON public.companies IS
  'Token bakiyesi negatife düşemez. atomic_accept_lead RPC bunu zaten kontrol eder; bu DB seviyesi güvencesidir.';

-- =============================================================================
-- SCH-5: leads.status normalizasyonu + CHECK constraint
-- 'new' → 'pending' (submit_lead_json default'u ile tutarlı)
-- =============================================================================

UPDATE public.leads
  SET status = 'pending'
  WHERE status = 'new';

ALTER TABLE public.leads
  ADD CONSTRAINT chk_leads_status
  CHECK (status IN (
    'pending',
    'pending_verification',
    'verified',
    'in_progress',
    'distributed',
    'no_matches',
    'unknown_plz',
    'completed',
    'rejected',
    'expired_unverified',
    'job_confirmed'
  ));

COMMENT ON CONSTRAINT chk_leads_status ON public.leads IS
  'İzin verilen lead durum değerleri. Yeni değer eklendiğinde bu constraint güncellenmeli.';

-- =============================================================================
-- SCH-6: lead_distributions.status CHECK constraint
-- =============================================================================

ALTER TABLE public.lead_distributions
  ADD CONSTRAINT chk_lead_distributions_status
  CHECK (status IN (
    'sent',
    'accepted',
    'quota_full',
    'rejected',
    'expired',
    'job_confirmed'
  ));

COMMENT ON CONSTRAINT chk_lead_distributions_status ON public.lead_distributions IS
  'İzin verilen lead_distributions durum değerleri.';

-- =============================================================================
-- SCH-7: offer_items.price_type CHECK
-- =============================================================================

ALTER TABLE public.offer_items
  ADD CONSTRAINT chk_price_type
  CHECK (price_type IS NULL OR price_type IN (
    'pauschale', 'per_unit', 'per_hour', 'inkl', 'optional'
  ));

COMMENT ON CONSTRAINT chk_price_type ON public.offer_items IS
  'Geçerli fiyat tipi değerleri. types.ts ile senkronize tutulmalı.';

-- =============================================================================
-- SCH-10: offer_items quantity > 0 ve unit_price >= 0
-- Önce mevcut geçersiz satırları düzelt, sonra constraint ekle
-- =============================================================================

-- 'inkl' veya 'optional' tipinde quantity=0 satırlar mevcuttur — 1'e çek
UPDATE public.offer_items
  SET quantity = 1
  WHERE quantity <= 0;

UPDATE public.offer_items
  SET unit_price = 0
  WHERE unit_price < 0;

ALTER TABLE public.offer_items
  ADD CONSTRAINT chk_offer_items_quantity
  CHECK (quantity > 0);

ALTER TABLE public.offer_items
  ADD CONSTRAINT chk_offer_items_unit_price
  CHECK (unit_price >= 0);

-- =============================================================================
-- SCH-9: leads(status, service_type) composite index
-- Admin dashboard çift filtreli sorgu için
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_status_service_type
  ON public.leads(status, service_type);

COMMENT ON INDEX idx_leads_status_service_type IS
  'Admin dashboard: WHERE status = X AND service_type = Y sorgularını optimize eder.';
