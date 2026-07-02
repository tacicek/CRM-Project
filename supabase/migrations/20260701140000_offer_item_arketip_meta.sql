-- ============================================================
-- Offerte Redesign — Katman 1a: Arketip meta tabloları
-- ============================================================
-- Amaç: her offer_items pozisyonunu "zengin bir birim" yapmak. Pozisyonun
-- hizmet arketipine göre ek yapılandırılmış alanlar 3 ayrı meta tablosunda tutulur.
-- Bağlama: her meta tablosu offer_item_id (PK=FK) ile offer_items(id)'ye 1:1 asılıdır.
--
-- Şablon: create_rechnungen (20260621000000) header-yorum stili.
-- RLS deseni: offer_items'ı taklit eder (kendi company_id'si YOK; scope offer_items→offers
--   join'i + is_company_member ile türetilir). 2 policy: manage_member (ALL) + admin_select.
-- offer_item_id PK olduğu için ayrı index gerekmez (PK zaten unique index'tir).
--
-- ⚠ offer_items'a ve total generated kolonuna DOKUNULMAZ (Rabatt = Katman 1c).
-- ============================================================

-- ------------------------------------------------------------
-- 1. offer_item_effort_meta
--    Arketip: EFFORT (aufwand/saatlik). Hizmetler: umzug, transport,
--    moebellift, klaviertransport. Crew/araç/saatlik ücret + aufwand aralığı.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offer_item_effort_meta (
  offer_item_id   uuid PRIMARY KEY REFERENCES offer_items(id) ON DELETE CASCADE,
  crew            integer,
  vehicles        integer,
  vehicle_type    text,
  hourly_rate     numeric(10,2),
  aufwand_min_h   numeric(5,2),
  aufwand_max_h   numeric(5,2),
  CONSTRAINT effort_aufwand_range CHECK (
    aufwand_min_h IS NULL OR aufwand_max_h IS NULL OR aufwand_min_h <= aufwand_max_h
  )
);

ALTER TABLE offer_item_effort_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offer_item_effort_meta_manage_member" ON offer_item_effort_meta
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM offer_items oi
    JOIN offers o ON o.id = oi.offer_id
    WHERE oi.id = offer_item_effort_meta.offer_item_id
      AND is_company_member(o.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM offer_items oi
    JOIN offers o ON o.id = oi.offer_id
    WHERE oi.id = offer_item_effort_meta.offer_item_id
      AND is_company_member(o.company_id)
  ));

CREATE POLICY "offer_item_effort_meta_admin_select" ON offer_item_effort_meta
  FOR SELECT USING (is_admin(auth.uid()));

GRANT ALL ON TABLE offer_item_effort_meta TO authenticated;

COMMENT ON TABLE offer_item_effort_meta IS
  'Arketip EFFORT: umzug/transport/moebellift/klaviertransport pozisyonları için '
  'crew/araç/saatlik ücret + aufwand aralığı. offer_item_id (PK=FK) ile offer_items''e 1:1.';

-- ------------------------------------------------------------
-- 2. offer_item_volume_meta
--    Arketip: VOLUME (hacim/m³). Hizmetler: lagerung, entsorgung, raeumung.
--    Hacim (nokta/aralık) + rate (aylık/tek sefer) + konum.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offer_item_volume_meta (
  offer_item_id   uuid PRIMARY KEY REFERENCES offer_items(id) ON DELETE CASCADE,
  volume_m3       numeric(10,2),
  volume_min_m3   numeric(10,2),
  volume_max_m3   numeric(10,2),
  rate            numeric(10,2),
  rate_unit       text,
  location        text,
  CONSTRAINT volume_rate_unit CHECK (rate_unit IS NULL OR rate_unit IN ('monthly','once')),
  CONSTRAINT volume_range CHECK (
    volume_min_m3 IS NULL OR volume_max_m3 IS NULL OR volume_min_m3 <= volume_max_m3
  )
);

ALTER TABLE offer_item_volume_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offer_item_volume_meta_manage_member" ON offer_item_volume_meta
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM offer_items oi
    JOIN offers o ON o.id = oi.offer_id
    WHERE oi.id = offer_item_volume_meta.offer_item_id
      AND is_company_member(o.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM offer_items oi
    JOIN offers o ON o.id = oi.offer_id
    WHERE oi.id = offer_item_volume_meta.offer_item_id
      AND is_company_member(o.company_id)
  ));

CREATE POLICY "offer_item_volume_meta_admin_select" ON offer_item_volume_meta
  FOR SELECT USING (is_admin(auth.uid()));

GRANT ALL ON TABLE offer_item_volume_meta TO authenticated;

COMMENT ON TABLE offer_item_volume_meta IS
  'Arketip VOLUME: lagerung/entsorgung/raeumung pozisyonları için hacim (nokta/aralık) + '
  'rate (monthly/once) + konum. offer_item_id (PK=FK) ile offer_items''e 1:1.';

-- ------------------------------------------------------------
-- 3. offer_item_area_meta
--    Arketip: AREA (yüzey/m²). Hizmet: reinigung.
--    Obje tipi + alan + abgabe (teslim durumu) + abnahmegarantie.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offer_item_area_meta (
  offer_item_id     uuid PRIMARY KEY REFERENCES offer_items(id) ON DELETE CASCADE,
  object_type       text,
  area_m2           numeric(10,2),
  abgabe            text,
  abnahmegarantie   boolean NOT NULL DEFAULT false
);

ALTER TABLE offer_item_area_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offer_item_area_meta_manage_member" ON offer_item_area_meta
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM offer_items oi
    JOIN offers o ON o.id = oi.offer_id
    WHERE oi.id = offer_item_area_meta.offer_item_id
      AND is_company_member(o.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM offer_items oi
    JOIN offers o ON o.id = oi.offer_id
    WHERE oi.id = offer_item_area_meta.offer_item_id
      AND is_company_member(o.company_id)
  ));

CREATE POLICY "offer_item_area_meta_admin_select" ON offer_item_area_meta
  FOR SELECT USING (is_admin(auth.uid()));

GRANT ALL ON TABLE offer_item_area_meta TO authenticated;

COMMENT ON TABLE offer_item_area_meta IS
  'Arketip AREA: reinigung pozisyonları için obje tipi + alan (m²) + abgabe + '
  'abnahmegarantie. offer_item_id (PK=FK) ile offer_items''e 1:1.';
