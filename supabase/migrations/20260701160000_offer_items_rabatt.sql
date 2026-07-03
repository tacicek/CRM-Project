-- ============================================================
-- Offerte Redesign — Katman 1c: Rabatt (indirim) sunum kolonları
-- ============================================================
-- offer_items'a 3 YENİ kolon: list_price, discount_percent, discount_amount.
--
-- ⚠⚠ ÖNEMLİ — YANLIŞ ANLAŞILMASIN:
--   * Bu 3 kolon SADECE SUNUM/GÖSTERİM metadata'sıdır (üstü çizili liste fiyatı + indirim rozeti).
--     Hiçbir hesaplamaya (subtotal/VAT/total) girmezler.
--   * unit_price'ın anlamı DEĞİŞMEZ: her zaman NET (indirim uygulanmış) fiyattır. Tüm hesaplama
--     zinciri (offerPricing.computeItemsSubtotal, mapOfferData, ServiceTable) unit_price'ı okumaya
--     devam eder — bu migration onları etkilemez.
--   * total kolonu GENERATED ALWAYS AS (quantity * unit_price) STORED — DEĞİŞTİRİLMEZ, DROP/RECREATE
--     EDİLMEZ. Bu migration total'a DOKUNMAZ.
--   * RLS/policy DEĞİŞMEZ — offer_items zaten kendi RLS'ine sahip; kolon eklemek policy gerektirmez.
--
-- list_price:        indirim ÖNCESİ liste fiyatı (nullable). >= unit_price (net'ten küçük olamaz).
-- discount_percent:  yüzde indirim (nullable, 0-100). Yalnız gösterim.
-- discount_amount:   tutar indirim (nullable). Yalnız gösterim. percent ile aynı anda dolu olamaz.
-- ============================================================

ALTER TABLE public.offer_items
  ADD COLUMN IF NOT EXISTS list_price       numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS discount_amount  numeric(10,2);

ALTER TABLE public.offer_items
  ADD CONSTRAINT offer_items_list_price_check
    CHECK (list_price IS NULL OR list_price >= unit_price),
  ADD CONSTRAINT offer_items_discount_exclusive_check
    CHECK (discount_percent IS NULL OR discount_amount IS NULL),
  ADD CONSTRAINT offer_items_discount_percent_range
    CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100));

COMMENT ON COLUMN public.offer_items.list_price IS
  'Sunum: indirim öncesi liste fiyatı (üstü çizili gösterim). Hesaplamaya girmez. >= unit_price.';
COMMENT ON COLUMN public.offer_items.discount_percent IS
  'Sunum: yüzde indirim rozeti (0-100). Hesaplamaya girmez. discount_amount ile aynı anda dolamaz.';
COMMENT ON COLUMN public.offer_items.discount_amount IS
  'Sunum: tutar indirim rozeti. Hesaplamaya girmez. discount_percent ile aynı anda dolamaz.';
