-- =============================================================================
-- ROLLBACK für 20260728190000_offerte_versionierung.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach lässt sich eine versendete Offerte wieder inhaltlich ändern —
--    während der Kunde den Link in der Hand hält, und ohne dass irgendwo steht,
--    was er vorher gesehen hat. Genau der Zustand, den diese Migration beendet.
--
--    Die Versionsspalten bleiben absichtlich STEHEN: sie tragen die Geschichte
--    bereits angelegter Revisionen. Sie zu löschen wäre der eigentliche Verlust.
--    Erst 20260728200000 zurückbauen (die Revisions-Funktion), dann diese Datei.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_offers_guard_content ON public.offers;
DROP TRIGGER IF EXISTS trigger_offers_set_series    ON public.offers;
DROP FUNCTION IF EXISTS public.guard_offer_content_after_send();
DROP FUNCTION IF EXISTS public.offers_set_series();

-- Der NOT-NULL-Zwang muss weichen, sonst scheitert jedes INSERT ohne Trigger.
ALTER TABLE public.offers ALTER COLUMN offer_series_id DROP NOT NULL;

-- Spalten und Daten bleiben, siehe Kopf.
COMMIT;
