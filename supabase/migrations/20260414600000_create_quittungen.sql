-- ============================================================
-- Quittungen (Receipts) System
-- ============================================================

-- 1. Add missing company fields for receipts
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS bank_name        text,
  ADD COLUMN IF NOT EXISTS bewertungs_url   text;

-- 2. Main quittungen table
CREATE TABLE IF NOT EXISTS quittungen (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  offer_id                  uuid REFERENCES offers(id) ON DELETE SET NULL,

  -- Auto-generated receipt number: QU-2026-0001
  quittung_nr               text UNIQUE,

  datum                     date NOT NULL DEFAULT CURRENT_DATE,

  -- Customer info (pre-filled from offer or entered manually)
  customer_name             text NOT NULL DEFAULT '',
  customer_address          text,
  customer_destination      text,
  customer_email            text,
  customer_phone            text,

  -- Line items as JSONB array
  -- Each item: { id, beschreibung, satz, betrag, checked, menge, einheit, is_custom }
  positionen                jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Totals
  zwischensumme             numeric(10,2) NOT NULL DEFAULT 0,
  mwst_satz                 numeric(4,2)  NOT NULL DEFAULT 8.1,
  mwst_betrag               numeric(10,2) NOT NULL DEFAULT 0,
  total                     numeric(10,2) NOT NULL DEFAULT 0,
  rabatt                    numeric(10,2) NOT NULL DEFAULT 0,
  gesamttotal               numeric(10,2) NOT NULL DEFAULT 0,

  -- Digital signatures (base64 PNG data URLs)
  kunde_unterschrift        text,
  teamchef_unterschrift     text,
  kunde_signed_at           timestamptz,
  teamchef_signed_at        timestamptz,

  -- Status
  status                    text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','signed','sent','paid')),
  betrag_noch_offen         boolean NOT NULL DEFAULT false,

  -- PDF
  pdf_url                   text,

  -- Notes
  notiz                     text,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- 3. Auto-generate quittung_nr: QU-YYYY-NNNN
CREATE SEQUENCE IF NOT EXISTS quittung_nr_seq START 1;

CREATE OR REPLACE FUNCTION generate_quittung_nr()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quittung_nr IS NULL THEN
    NEW.quittung_nr := 'QU-' || to_char(NOW(), 'YYYY') || '-' ||
                       LPAD(nextval('quittung_nr_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER quittungen_set_nr
  BEFORE INSERT ON quittungen
  FOR EACH ROW EXECUTE FUNCTION generate_quittung_nr();

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_quittungen_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER quittungen_updated_at
  BEFORE UPDATE ON quittungen
  FOR EACH ROW EXECUTE FUNCTION update_quittungen_updated_at();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_quittungen_company_id ON quittungen(company_id);
CREATE INDEX IF NOT EXISTS idx_quittungen_offer_id   ON quittungen(offer_id);
CREATE INDEX IF NOT EXISTS idx_quittungen_status     ON quittungen(status);
CREATE INDEX IF NOT EXISTS idx_quittungen_datum      ON quittungen(datum DESC);

-- 6. RLS
ALTER TABLE quittungen ENABLE ROW LEVEL SECURITY;

-- Companies can only access their own receipts
CREATE POLICY "quittungen_company_select" ON quittungen
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "quittungen_company_insert" ON quittungen
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "quittungen_company_update" ON quittungen
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "quittungen_company_delete" ON quittungen
  FOR DELETE USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- 7. Grant to authenticated users
GRANT ALL ON quittungen TO authenticated;
GRANT USAGE ON SEQUENCE quittung_nr_seq TO authenticated;
