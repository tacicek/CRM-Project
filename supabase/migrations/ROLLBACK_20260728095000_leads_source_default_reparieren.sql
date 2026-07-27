-- =============================================================================
-- ROLLBACK für 20260728095000_leads_source_default_reparieren.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach scheitert wieder jedes INSERT in `leads`, das `source` nicht selbst
--    setzt — der Standardwert 'website' verletzt leads_source_check. Es gibt
--    keinen Grund, das zurückzunehmen; die Datei existiert nur der
--    Vollständigkeit halber.
-- =============================================================================

BEGIN;

ALTER TABLE public.leads ALTER COLUMN source SET DEFAULT 'website';

COMMIT;
