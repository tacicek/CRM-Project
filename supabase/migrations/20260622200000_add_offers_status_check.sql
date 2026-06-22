-- ============================================================
-- offers.status CHECK constraint (spec §4 lifecycle). Enum değil — leads deseni + geri-dönüşü trivial.
-- Doğrulandı: yazan tüm yollar {draft, sent, viewed, accepted, rejected} üretir
--   (frontend insert=draft, send-offer=sent, update_offer_by_token=viewed/accepted/rejected).
-- expired/job_confirmed/completed şu an yazılmıyor (expired computed, job_confirmed LEAD'de)
--   ama spec lifecycle'ında → ileri-uyumluluk için set'e dahil. Mevcut veri (draft/viewed) uyuyor.
-- ============================================================

ALTER TABLE offers
  ADD CONSTRAINT chk_offers_status
  CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'job_confirmed', 'completed'));

COMMENT ON COLUMN offers.status IS
  'Offer lifecycle: draft → sent → viewed → accepted/rejected. '
  'expired (vade geçti, şu an computed is_expired), job_confirmed (auftrag oluştu), completed (iş bitti).';
