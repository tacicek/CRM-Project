-- =============================================================================
-- AI-tabanlı Lead Quality Validation + Double Opt-in Akışı
-- 2026-04-16
--
-- 1) leads tablosuna AI validation sütunları
-- 2) status CHECK constraint'i iki yeni değerle güncelle:
--      - awaiting_customer_confirmation  (çifte onay e-postası gönderildi)
--      - unconfirmed_risky               (48h içinde onay gelmedi)
-- 3) lead_confirmations tablosu (token, expires_at)
-- 4) expire_unconfirmed_risky_leads() fonksiyonu + pg_cron job
-- =============================================================================

BEGIN;

-- 1) leads tablosuna AI validation sütunları ------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ai_quality_score        INTEGER,
  ADD COLUMN IF NOT EXISTS ai_validation_signals   JSONB,
  ADD COLUMN IF NOT EXISTS ai_validated_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_rejected_reason      TEXT;

COMMENT ON COLUMN public.leads.ai_quality_score IS
  '0-100 arası AI + deterministik doğrulama skoru. <25 = sahte, 25-39 = şüpheli (double opt-in), >=40 = geçerli.';

COMMENT ON COLUMN public.leads.ai_validation_signals IS
  'AI veya deterministik validator tarafından bulunan şüphe sinyallerinin dizisi (string[]).';

COMMENT ON COLUMN public.leads.ai_validated_at IS
  'AI doğrulamasının tamamlandığı zaman. NULL ise henüz doğrulanmamış.';

COMMENT ON COLUMN public.leads.ai_rejected_reason IS
  'AI veya deterministik kurallar reddettiyse nedeni (Almanca kısa metin).';

CREATE INDEX IF NOT EXISTS idx_leads_ai_quality_score
  ON public.leads(ai_quality_score)
  WHERE ai_quality_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_ai_validated_at
  ON public.leads(ai_validated_at DESC)
  WHERE ai_validated_at IS NOT NULL;


-- 2) status CHECK constraint'i güncelle -----------------------------------------
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS chk_leads_status;

ALTER TABLE public.leads
  ADD CONSTRAINT chk_leads_status
  CHECK (status IN (
    'pending',
    'pending_verification',
    'awaiting_customer_confirmation',
    'unconfirmed_risky',
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
  'İzin verilen lead durum değerleri. Double opt-in için: awaiting_customer_confirmation, unconfirmed_risky.';


-- 3) lead_confirmations tablosu -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_confirmations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  token          UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sent_to_email  TEXT        NOT NULL,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  confirmed_at   TIMESTAMPTZ
);

COMMENT ON TABLE public.lead_confirmations IS
  'Çifte onay (double opt-in) tokenları. Şüpheli leadler için kullanıcıya giden e-posta linkini doğrular.';

CREATE INDEX IF NOT EXISTS idx_lead_confirmations_lead_id
  ON public.lead_confirmations(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_confirmations_expires_at
  ON public.lead_confirmations(expires_at)
  WHERE confirmed_at IS NULL;

-- RLS: sadece service_role (edge functions) yazabilir; public okuma yok
ALTER TABLE public.lead_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_confirmations_admin_select" ON public.lead_confirmations;
CREATE POLICY "lead_confirmations_admin_select"
  ON public.lead_confirmations
  FOR SELECT
  USING (public.is_admin(auth.uid()));

COMMENT ON POLICY "lead_confirmations_admin_select" ON public.lead_confirmations IS
  'Sadece admin kullanıcılar confirmation kayıtlarını görebilir. Token doğrulama edge function üzerinden SECURITY DEFINER ile yapılır.';


-- 4) Cron: 48h geçmiş awaiting_customer_confirmation → unconfirmed_risky --------
CREATE OR REPLACE FUNCTION public.expire_unconfirmed_risky_leads()
RETURNS TABLE(expired_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE public.leads
       SET status       = 'unconfirmed_risky',
           updated_at   = NOW()
     WHERE status = 'awaiting_customer_confirmation'
       AND ai_validated_at IS NOT NULL
       AND ai_validated_at < (NOW() - INTERVAL '48 hours')
     RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM expired;

  RAISE LOG '[expire_unconfirmed_risky_leads] % leads moved to unconfirmed_risky', v_count;

  RETURN QUERY SELECT v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_unconfirmed_risky_leads() IS
  '48 saat icinde cifte onay e-postasina yanit vermeyen leadleri unconfirmed_risky statusune tasir. pg_cron tarafindan her 30 dakikada bir tetiklenir.';

-- pg_cron job: her 30 dakikada bir çalıştır
DO $cronblock$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-unconfirmed-risky-leads') THEN
      PERFORM cron.unschedule('expire-unconfirmed-risky-leads');
    END IF;

    PERFORM cron.schedule(
      'expire-unconfirmed-risky-leads',
      '*/30 * * * *',
      'SELECT public.expire_unconfirmed_risky_leads();'
    );
  ELSE
    RAISE NOTICE '[migration] pg_cron extension not installed - skipping cron job registration';
  END IF;
END
$cronblock$;

COMMIT;
