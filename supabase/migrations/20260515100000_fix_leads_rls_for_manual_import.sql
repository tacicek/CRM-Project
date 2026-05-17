-- =============================================================================
-- Manuel import edilen leads için company_id kolonu + RLS politikaları
--
-- Sorun 1: leads tablosunda company_id kolonu yoktu.
-- Sorun 2: leads_select_own_distributions yalnızca lead_distributions
--   üzerinden gelen leads'e izin veriyordu. Manuel import edilen leads
--   doğrudan company_id ile leads tablosuna yazılıyor, lead_distributions
--   kaydı oluşmuyor. Bu yüzden firma kendi import leadlerini göremiyordu.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. leads tablosuna company_id kolonu ekle
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SELECT: dağıtılmış VEYA manuel import edilen leads görülebilir
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "leads_select_own_distributions" ON public.leads;

CREATE POLICY "leads_select_company_or_distribution"
ON public.leads
FOR SELECT
TO authenticated
USING (
  -- Admin her şeyi görür
  public.is_admin(auth.uid())
  OR
  -- Firma yalnızca kendine dağıtılmış leadleri görür (marketplace flow)
  EXISTS (
    SELECT 1
    FROM public.lead_distributions ld
    JOIN public.companies c ON c.id = ld.company_id
    WHERE ld.lead_id = leads.id
      AND c.user_id = auth.uid()
  )
  OR
  -- Firma kendi manuel import ettiği leadleri görür (company_id üzerinden)
  public.is_company_member(leads.company_id, auth.uid())
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. UPDATE: firma kendi manuel import leadlerini güncelleyebilir
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "leads_update_admin_only" ON public.leads;

CREATE POLICY "leads_update_company_or_admin"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_company_member(leads.company_id, auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_company_member(leads.company_id, auth.uid())
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. DELETE: firma kendi manuel import leadlerini silebilir
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "leads_delete_company_or_admin" ON public.leads;

CREATE POLICY "leads_delete_company_or_admin"
ON public.leads
FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_company_member(leads.company_id, auth.uid())
);
