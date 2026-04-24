-- =============================================================================
-- A3: pending_verification timeout
-- 48 saatten fazla bekleyen düşük-spam-score'lu leadler otomatik "expired_unverified"
-- statüsüne alınır. Yüksek spam-score'lu leadler (>=4) admin kararına bırakılır.
-- Cron job: Her gün sabah 06:00 UTC çalışır.
-- =============================================================================

-- Fonksiyon: expired_unverified statüsüne al
CREATE OR REPLACE FUNCTION public.expire_unverified_leads(
  p_hours_threshold INTEGER DEFAULT 48,
  p_spam_score_max  INTEGER DEFAULT 3
)
RETURNS TABLE (expired_count INTEGER, lead_ids UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
  v_count INTEGER;
BEGIN
  UPDATE public.leads
  SET
    status     = 'expired_unverified',
    updated_at = NOW()
  WHERE status    = 'pending_verification'
    AND created_at < NOW() - (p_hours_threshold || ' hours')::INTERVAL
    AND COALESCE(spam_score, 0) <= p_spam_score_max
  RETURNING id INTO v_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count, v_ids;
END;
$$;

COMMENT ON FUNCTION public.expire_unverified_leads(INTEGER, INTEGER) IS
  'p_hours_threshold saati geçen ve spam_score <= p_spam_score_max olan '
  'pending_verification leadleri expired_unverified statüsüne alır. '
  'Yüksek spam-score leadler admin değerlendirmesinde kalır.';

-- =============================================================================
-- Cron job kaydı (pg_cron + pg_net)
-- Her gün sabah 06:00 UTC çalışır
-- =============================================================================
DO $$
BEGIN
  -- pg_cron extension varlığını kontrol et
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Varsa eski job'u kaldır, yenisini ekle
    PERFORM cron.unschedule('daily-expire-unverified-leads');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron yoksa veya job bulunamazsa sessizce devam et
  NULL;
END;
$$;

-- Not: Bu cron job'u Supabase SQL Editor'da manuel çalıştır (pg_cron gerektirir):
--
-- SELECT cron.schedule(
--   'daily-expire-unverified-leads',
--   '0 6 * * *',
--   $$SELECT public.expire_unverified_leads(48, 3);$$
-- );
--
-- Çalışan job'ları görmek için: SELECT * FROM cron.job;
-- İptal için: SELECT cron.unschedule('daily-expire-unverified-leads');

-- leads.status sütununa mevcut status listesini güncelle
COMMENT ON COLUMN public.leads.status IS
  'pending_verification: Admin onayı bekliyor | '
  'verified: Onaylandı | '
  'distributed: Firmalara dağıtıldı | '
  'fallback_distributed: Coğrafi fallback ile dağıtıldı | '
  'no_matches: Uygun firma bulunamadı | '
  'unknown_plz: PLZ veritabanında yok | '
  'rejected: Admin tarafından reddedildi | '
  'expired_unverified: 48 saat içinde admin onaylanmadı | '
  'job_confirmed: Müşteri teklifi kabul etti, iş teyitlendi | '
  'completed: İş tamamlandı';
