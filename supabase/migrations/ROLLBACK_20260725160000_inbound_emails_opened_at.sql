-- =============================================================================
-- ROLLBACK für 20260725160000_inbound_emails_opened_at.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Mit der Spalte geht der Gelesen-Stand des Teams verloren: nach dem Rückbau
--    gilt jede Mail wieder als ungelesen. Keine Anfrage und keine E-Mail selbst
--    ist betroffen — nur die Markierung "hat schon jemand angeschaut".
--
--    Die Review-Oberfläche liest opened_at. Ohne die Spalte schlägt das Laden
--    der Liste fehl, also zuerst den Frontend-Stand zurückrollen.
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_inbound_emails_unopened;

ALTER TABLE public.inbound_emails
  DROP COLUMN IF EXISTS opened_at;

COMMIT;
