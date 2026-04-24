-- =============================================================================
-- DBG-018: Security & RLS Audit Fixes
--
-- SEC-1 CRITICAL: leads_select_authenticated USING(true) →
--   herhangi bir firma tüm leadleri (PII dahil) okuyabiliyordu.
--
-- SEC-2 CRITICAL: leads_update_authenticated USING(true) →
--   herhangi bir firma herhangi bir leadi güncelleyebiliyordu.
--
-- SEC-3 HIGH: companies SELECT politikası sütun filtresi yapmıyor →
--   anon/authenticated kullanıcı IBAN, token_balance, mwst_number okuyabiliyordu.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- LEADS: SELECT ve UPDATE politikalarını düzelt
-- ─────────────────────────────────────────────────────────────────────────────

-- Aşırı geniş SELECT politikasını kaldır
DROP POLICY IF EXISTS "leads_select_authenticated" ON public.leads;

-- Firma yalnızca kendi lead_distributions'ına ait leadleri okuyabilir
CREATE POLICY "leads_select_own_distributions"
ON public.leads
FOR SELECT
TO authenticated
USING (
  -- Admin her şeyi görür
  public.is_admin(auth.uid())
  OR
  -- Firma yalnızca kendine dağıtılmış leadleri görür
  EXISTS (
    SELECT 1
    FROM public.lead_distributions ld
    JOIN public.companies c ON c.id = ld.company_id
    WHERE ld.lead_id = leads.id
      AND c.user_id = auth.uid()
  )
);

-- Aşırı geniş UPDATE politikasını kaldır
DROP POLICY IF EXISTS "leads_update_authenticated" ON public.leads;

-- Leadleri yalnızca admin güncelleyebilir (firma hiçbir zaman lead güncellememeli)
CREATE POLICY "leads_update_admin_only"
ON public.leads
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPANIES: Public SELECT politikasını kısıtla
-- ─────────────────────────────────────────────────────────────────────────────

-- Mevcut public politikayı kaldır (sütun filtresi yapılmıyor — IBAN açık)
DROP POLICY IF EXISTS "Public can view limited company info via offers" ON public.companies;
DROP POLICY IF EXISTS "Public can view companies via offer access token" ON public.companies;
DROP POLICY IF EXISTS "Public can view company via valid offer token" ON public.companies;
DROP POLICY IF EXISTS "Public can view company with offers" ON public.companies;

-- Firma sahibi ve admin tam erişim
-- (20251220124103 migration'ındaki "Companies can view their own data" zaten var;
--  bu satır idempotent şekilde yeniden oluşturur)
DROP POLICY IF EXISTS "companies_owner_full_access" ON public.companies;
CREATE POLICY "companies_owner_full_access"
ON public.companies
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
);

-- Public/anon: doğrudan tablo SELECT'e izin verme
-- OfferView, get_offer_by_token ve get_public_company_info SECURITY DEFINER
-- RPC'leri üzerinden şirket bilgisine erişir — bu yeterli.
-- (Anon SELECT tamamen kaldırıldı; tablo RLS'i artık sadece owner+admin)

COMMENT ON POLICY "companies_owner_full_access" ON public.companies IS
  'DBG-018 SEC-3: public SELECT kaldırıldı. Müşteri görünümü SECURITY DEFINER '
  'RPC fonksiyonları (get_public_company_info, get_offer_by_token) üzerinden '
  'yürütülür — IBAN, token_balance, mwst_number artık dışarıya sızmaz.';
