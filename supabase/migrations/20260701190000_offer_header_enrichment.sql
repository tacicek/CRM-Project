-- ============================================================
-- Offerte Redesign — Katman 3a: Kundennummer + Aufnahme checklist dondurma + Zwischenlager
-- ============================================================
-- offers'a header zenginleştirme kolonları:
--   * customer_number: Kundennummer (manuel giriş, emsal yoktu — yeni kavram).
--   * frozen_has_*: Aufnahme checklist 6 boolean (Keller/Estrich/Garage/Lagerung/Schwer-Colli/Klavier).
--     Katman 2 dondurma deseni — kaynak leads (has_basement/has_attic/has_garage/storage_needed/
--     has_heavy_items + piano varlığı). Lead silinince (FK SET NULL) kaybolmasın diye teklife donar.
--   * frozen_zwischenlager_*: opsiyonel 3. adres. leads'te KAYNAK YOK → backfill YOK, sadece yeni
--     tekliflerde formdan dolar.
--
-- Klavier: leads'te Ja/Nein flag yok; piano_type/piano_weight_kg varlığından türetilir.
--
-- ⚠ RLS/policy değişmez. Mevcut kolonlara/total generated'a dokunulmaz. offer_items/fiyatlandırma yok.
-- Not: timestamp 20260701190000 — 20260701180000 (Katman 2b RPC) ile çakışmayı önlemek için.
-- ============================================================

-- 1. Header kolonları (hepsi nullable, additive)
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS customer_number                  text,
  ADD COLUMN IF NOT EXISTS frozen_has_keller                boolean,
  ADD COLUMN IF NOT EXISTS frozen_has_estrich               boolean,
  ADD COLUMN IF NOT EXISTS frozen_has_garage                boolean,
  ADD COLUMN IF NOT EXISTS frozen_has_lagerung              boolean,
  ADD COLUMN IF NOT EXISTS frozen_has_schwer_colli          boolean,
  ADD COLUMN IF NOT EXISTS frozen_has_klavier               boolean,
  ADD COLUMN IF NOT EXISTS frozen_checklist_at              timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_zwischenlager_street       text,
  ADD COLUMN IF NOT EXISTS frozen_zwischenlager_house_number text,
  ADD COLUMN IF NOT EXISTS frozen_zwischenlager_plz          text,
  ADD COLUMN IF NOT EXISTS frozen_zwischenlager_city         text;

COMMENT ON COLUMN public.offers.customer_number IS
  'Kundennummer (manuel giriş). Emsal yoktu — yeni kavram.';
COMMENT ON COLUMN public.offers.frozen_checklist_at IS
  'Aufnahme checklist''in teklife dondurulduğu an. NULL = henüz dondurulmadı.';

-- 2. Backfill: sadece checklist (leads''ten, idempotent, salt okuma kaynak).
--    customer_number/Zwischenlager backfill YOK (yeni kavram, geçmiş veri yok).
UPDATE public.offers o SET
  frozen_has_keller       = l.has_basement,
  frozen_has_estrich      = l.has_attic,
  frozen_has_garage       = l.has_garage,
  frozen_has_lagerung     = l.storage_needed,
  frozen_has_schwer_colli = l.has_heavy_items,
  frozen_has_klavier      = (l.piano_type IS NOT NULL OR l.piano_weight_kg IS NOT NULL),
  frozen_checklist_at     = COALESCE(o.frozen_checklist_at, now())
FROM public.leads l
WHERE l.id = o.lead_id
  AND o.lead_id IS NOT NULL
  AND o.frozen_checklist_at IS NULL;  -- idempotent guard
