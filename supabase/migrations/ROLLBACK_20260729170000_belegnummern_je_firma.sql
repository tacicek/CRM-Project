-- =============================================================================
-- ROLLBACK für 20260729170000_belegnummern_je_firma.sql — NICHT als Migration.
--
-- ⚠️ Stellt die weltweite Eindeutigkeit wieder her. Das GEHT NUR, solange keine
--    zwei Firmen dieselbe Belegnummer tragen — sobald die zweite Firma ihre
--    erste Rechnung gestellt hat, scheitert dieser Rückbau am Duplikat, und
--    zwar zu Recht.
--
--    Vorher prüfen:
--      SELECT rechnung_nr, count(*) FROM public.rechnungen
--      GROUP BY 1 HAVING count(*) > 1;
--
--    Danach kann die zweite Firma keine Belege mehr anlegen.
-- =============================================================================

BEGIN;

ALTER TABLE public.credit_notes
  DROP CONSTRAINT IF EXISTS credit_notes_gutschrift_nr_je_firma,
  ADD  CONSTRAINT credit_notes_gutschrift_nr_key UNIQUE (gutschrift_nr);

ALTER TABLE public.quittungen
  DROP CONSTRAINT IF EXISTS quittungen_quittung_nr_je_firma,
  ADD  CONSTRAINT quittungen_quittung_nr_key UNIQUE (quittung_nr);

ALTER TABLE public.rechnungen
  DROP CONSTRAINT IF EXISTS rechnungen_rechnung_nr_je_firma,
  ADD  CONSTRAINT rechnungen_rechnung_nr_key UNIQUE (rechnung_nr);

COMMIT;
