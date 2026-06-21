-- ============================================================
-- Rechnungen (Invoices) System — Swiss QR-Bill (Faz 2 / S2)
-- Şablon: quittungen (20260414600000 + per-company fix 20260415100000).
-- Farklar: auftrag_id UNIQUE (mükerrer fatura engeli), faellig_am,
--          qr_referenz/qr_iban, status enum (entwurf→versendet→bezahlt/ueberfaellig).
-- Numara baştan per-company (global SEQUENCE hatası tekrarlanmaz).
-- companies (iban, bank_name, street/house_number/plz/city) zaten mevcut → ALTER yok.
-- ============================================================

-- 1. Ana rechnungen tablosu
CREATE TABLE IF NOT EXISTS rechnungen (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Kaynak zincir: Auftrag (tek fatura → UNIQUE), Offer (kalem snapshot kaynağı)
  auftrag_id                uuid UNIQUE REFERENCES auftraege(id) ON DELETE SET NULL,
  offer_id                  uuid REFERENCES offers(id) ON DELETE SET NULL,

  -- Auto-generated invoice number: RE-2026-0001 (per-company, per-year)
  rechnung_nr               text UNIQUE,

  datum                     date NOT NULL DEFAULT CURRENT_DATE,
  -- Fälligkeit: trigger'da datum + 30 gün olarak doldurulur (verilmezse)
  faellig_am                date NOT NULL,

  -- Customer info (offer'dan snapshot ya da manuel)
  customer_name             text NOT NULL DEFAULT '',
  customer_address          text,
  customer_destination      text,
  customer_email            text,
  customer_phone            text,

  -- Line items as JSONB array (offer_items'tan kopya; faturada düzenlenebilir)
  -- Each item: { id, beschreibung, satz, betrag, menge, einheit, is_custom }
  positionen                jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Totals (quittungen ile parite; MwSt 8.1%)
  zwischensumme             numeric(10,2) NOT NULL DEFAULT 0,
  mwst_satz                 numeric(4,2)  NOT NULL DEFAULT 8.1,
  mwst_betrag               numeric(10,2) NOT NULL DEFAULT 0,
  total                     numeric(10,2) NOT NULL DEFAULT 0,
  rabatt                    numeric(10,2) NOT NULL DEFAULT 0,
  gesamttotal               numeric(10,2) NOT NULL DEFAULT 0,

  -- Swiss QR-Bill: referans (QRR 27 hane veya SCOR RF…) + üretim anı IBAN snapshot
  qr_referenz               text,
  qr_iban                   text,

  -- Status
  status                    text NOT NULL DEFAULT 'entwurf'
                            CHECK (status IN ('entwurf','versendet','bezahlt','ueberfaellig')),

  -- PDF
  pdf_url                   text,

  -- Notes
  notiz                     text,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- 2. Auto-generate rechnung_nr: RE-YYYY-NNNN (per-company) + faellig_am = datum + 30
CREATE OR REPLACE FUNCTION generate_rechnung_nr()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_nr  INTEGER;
  year_str TEXT;
BEGIN
  IF NEW.rechnung_nr IS NULL THEN
    year_str := to_char(NOW(), 'YYYY');

    -- Bu firmanın bu yıldaki en yüksek numarasını bul, +1 al (per-company sayaç)
    SELECT COALESCE(
      MAX(
        CASE
          WHEN rechnung_nr ~ ('^RE-' || year_str || '-[0-9]+$')
          THEN CAST(SPLIT_PART(rechnung_nr, '-', 3) AS INTEGER)
          ELSE 0
        END
      ), 0
    ) + 1
    INTO next_nr
    FROM rechnungen
    WHERE company_id = NEW.company_id;

    NEW.rechnung_nr := 'RE-' || year_str || '-' || LPAD(next_nr::text, 4, '0');
  END IF;

  -- Fälligkeit: standardmäßig datum + 30 Tage
  IF NEW.faellig_am IS NULL THEN
    NEW.faellig_am := NEW.datum + 30;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. BEFORE INSERT trigger → rechnung_nr + faellig_am
CREATE TRIGGER rechnungen_set_nr
  BEFORE INSERT ON rechnungen
  FOR EACH ROW EXECUTE FUNCTION generate_rechnung_nr();

-- 4. updated_at trigger (quittungen ile aynı desen)
CREATE OR REPLACE FUNCTION update_rechnungen_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER rechnungen_updated_at
  BEFORE UPDATE ON rechnungen
  FOR EACH ROW EXECUTE FUNCTION update_rechnungen_updated_at();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_rechnungen_company_id ON rechnungen(company_id);
CREATE INDEX IF NOT EXISTS idx_rechnungen_offer_id   ON rechnungen(offer_id);
CREATE INDEX IF NOT EXISTS idx_rechnungen_auftrag_id ON rechnungen(auftrag_id);
CREATE INDEX IF NOT EXISTS idx_rechnungen_status     ON rechnungen(status);

-- 6. RLS
ALTER TABLE rechnungen ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies (firma izolasyonu — quittungen pattern)
CREATE POLICY "rechnungen_company_select" ON rechnungen
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "rechnungen_company_insert" ON rechnungen
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "rechnungen_company_update" ON rechnungen
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "rechnungen_company_delete" ON rechnungen
  FOR DELETE USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- 8. Grant to authenticated users (per-company sayaç → sequence yok)
GRANT ALL ON TABLE rechnungen TO authenticated;

-- 9. Table comment
COMMENT ON TABLE rechnungen IS
  'Swiss QR-Bill faturaları. abgeschlossen Auftrag''tan üretilir (auftrag_id UNIQUE = mükerrer engel). '
  'Kalemler offer_items''tan snapshot. quittungen (makbuz) sisteminden bağımsız.';
