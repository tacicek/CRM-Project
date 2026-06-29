-- ============================================================
-- rechnungen: PDF-Redesign Textfelder (rechnungsbezogen, editierbar).
-- Alle NULLABLE, kein Default → rückwärtskompatibel (Bestandsrechnungen unverändert).
--   anrede              — Briefanrede (Herr/Frau) für "Sehr geehrte(r) ..."
--   einleitung          — Einleitungssatz über der Positionstabelle
--   schlusstext         — Schluss-/Danktext unter der Tabelle
--   zahlungskonditionen — Zahlungskonditionen-Text (z. B. "5 Tage netto")
-- RLS: rechnungen nutzt zeilenbasierte Policies (company_id), neue Spalten sind
-- automatisch abgedeckt → keine neue Policy nötig.
-- ============================================================

ALTER TABLE rechnungen
  ADD COLUMN IF NOT EXISTS anrede               text,
  ADD COLUMN IF NOT EXISTS einleitung           text,
  ADD COLUMN IF NOT EXISTS schlusstext          text,
  ADD COLUMN IF NOT EXISTS zahlungskonditionen  text;

-- anrede nur 'Herr' | 'Frau' | NULL. ADD CONSTRAINT IF NOT EXISTS gibt es nicht
-- → idempotenter Guard, damit ein erneutes Ausführen nicht fehlschlägt.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rechnungen_anrede_check') THEN
    ALTER TABLE rechnungen ADD CONSTRAINT rechnungen_anrede_check
      CHECK (anrede IS NULL OR anrede IN ('Herr', 'Frau'));
  END IF;
END $$;
