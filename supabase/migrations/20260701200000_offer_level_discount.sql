-- ============================================================
-- Offerte Redesign — Katman 4: Teklif-seviyesi Rabatt (offers.discount_percent)
-- ============================================================
-- offers'a tek nullable kolon: teklif-seviyesi indirim yüzdesi.
--   * new_offer.png Zwischensumme-üstü Rabatt deseni için VERİ DEPOSU hazırlığı.
--   * Pozisyon-seviyesi Rabatt (Katman 1c: offer_items.list_price/discount_percent) ile
--     BAĞIMSIZ/paralel — ikisi aynı anda var olabilir.
--
-- ⚠ Bu adım SADECE kolonu ekler. computeOfferTotals'a DOKUNULMAZ — totals entegrasyonu
--   (Zwischensumme sonrası tek çarpan) form fazında (F3) yapılacak.
-- ⚠ RLS/policy değişmez. offer_items/total generated'a dokunulmaz.
-- ============================================================

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2);

ALTER TABLE public.offers
  ADD CONSTRAINT offers_discount_percent_range
    CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100));

COMMENT ON COLUMN public.offers.discount_percent IS
  'Teklif-seviyesi indirim yüzdesi (nullable, sunum/hesap katmanı — new_offer.png Zwischensumme '
  'üstü Rabatt deseni). computeOfferTotals bunu Zwischensumme sonrası TEK ÇARPAN olarak uygular, '
  'pozisyon-seviyesi list_price/discount_percent (offer_items, Katman 1c) ile bağımsız/paralel.';
