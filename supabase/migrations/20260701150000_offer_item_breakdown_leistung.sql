-- ============================================================
-- Offerte Redesign — Katman 1b: Pozisyon satır tabloları (breakdown + leistung)
-- ============================================================
-- Amaç: her offer_items pozisyonuna 1:N bağlı serbest satır listeleri.
--   - breakdown: maliyet dökümü satırları (label/value çiftleri)
--   - leistung:  Leistungsumfang / kapsam maddeleri (tek metin)
-- 7 hizmetin HEPSİNDE geçerli (arketipe özgü DEĞİL — meta tablolarından farkı bu).
--
-- 1a'dan fark: burada id ayrı PK, offer_item_id 1:N FK → PK unique-index FK'yi kapsamaz,
--   bu yüzden offer_item_id için AYRI index eklenir.
--
-- RLS deseni 1a ile birebir aynı: kendi company_id'si YOK; scope offer_items→offers join'i +
--   is_company_member. 2 policy: manage_member (ALL) + admin_select.
--
-- ⚠ offer_items'a ve total generated kolonuna DOKUNULMAZ (Rabatt = Katman 1c).
-- ============================================================

-- ------------------------------------------------------------
-- 1. offer_item_breakdown — maliyet dökümü satırları (pozisyon başına 1:N)
--    Örn: label="Anfahrt", value="CHF 120"; label="Etage 3. OG", value="+15%".
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offer_item_breakdown (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_item_id   uuid NOT NULL REFERENCES offer_items(id) ON DELETE CASCADE,
  position        integer NOT NULL DEFAULT 1,
  label           text NOT NULL,
  value           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_item_breakdown_offer_item_id
  ON offer_item_breakdown(offer_item_id);

ALTER TABLE offer_item_breakdown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offer_item_breakdown_manage_member" ON offer_item_breakdown
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM offer_items oi
    JOIN offers o ON o.id = oi.offer_id
    WHERE oi.id = offer_item_breakdown.offer_item_id
      AND is_company_member(o.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM offer_items oi
    JOIN offers o ON o.id = oi.offer_id
    WHERE oi.id = offer_item_breakdown.offer_item_id
      AND is_company_member(o.company_id)
  ));

CREATE POLICY "offer_item_breakdown_admin_select" ON offer_item_breakdown
  FOR SELECT USING (is_admin(auth.uid()));

GRANT ALL ON TABLE offer_item_breakdown TO authenticated;

COMMENT ON TABLE offer_item_breakdown IS
  'Pozisyon başına maliyet dökümü satırları (label/value, 1:N). 7 hizmetin hepsinde geçerli. '
  'offer_item_id FK ON DELETE CASCADE; position ile sıralanır.';

-- ------------------------------------------------------------
-- 2. offer_item_leistung — Leistungsumfang / kapsam maddeleri (pozisyon başına 1:N)
--    Örn: text="Möbel demontieren und montieren"; text="Transportversicherung inkl.".
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offer_item_leistung (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_item_id   uuid NOT NULL REFERENCES offer_items(id) ON DELETE CASCADE,
  position        integer NOT NULL DEFAULT 1,
  text            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_item_leistung_offer_item_id
  ON offer_item_leistung(offer_item_id);

ALTER TABLE offer_item_leistung ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offer_item_leistung_manage_member" ON offer_item_leistung
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM offer_items oi
    JOIN offers o ON o.id = oi.offer_id
    WHERE oi.id = offer_item_leistung.offer_item_id
      AND is_company_member(o.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM offer_items oi
    JOIN offers o ON o.id = oi.offer_id
    WHERE oi.id = offer_item_leistung.offer_item_id
      AND is_company_member(o.company_id)
  ));

CREATE POLICY "offer_item_leistung_admin_select" ON offer_item_leistung
  FOR SELECT USING (is_admin(auth.uid()));

GRANT ALL ON TABLE offer_item_leistung TO authenticated;

COMMENT ON TABLE offer_item_leistung IS
  'Pozisyon başına Leistungsumfang/kapsam maddeleri (tek metin, 1:N). 7 hizmetin hepsinde geçerli. '
  'offer_item_id FK ON DELETE CASCADE; position ile sıralanır.';
