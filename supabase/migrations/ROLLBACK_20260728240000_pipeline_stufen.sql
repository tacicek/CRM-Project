-- =============================================================================
-- ROLLBACK für 20260728240000_pipeline_stufen.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach bewegt sich keine Verkaufsstufe mehr, und der Verlauf der bisherigen
--    Stufenwechsel ist weg. Die Spalten auf `leads` bleiben absichtlich STEHEN:
--    dort steht, woran gearbeitet wurde, wer zuständig war und warum ein
--    Geschäft verloren ging — das lässt sich nicht wiederherstellen.
--
--    Erst 20260728260000 und 250000 zurückbauen (Regeln und Aufgaben), dann
--    diese Datei.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_offers_advance_stage ON public.offers;
DROP TRIGGER IF EXISTS trigger_leads_stage_history  ON public.leads;
DROP FUNCTION IF EXISTS public.offers_advance_lead_stage();
DROP FUNCTION IF EXISTS public.leads_record_stage_change();

DROP TRIGGER IF EXISTS trigger_stage_history_append_only ON public.sales_stage_history;
DROP FUNCTION IF EXISTS public.guard_stage_history_append_only();
DROP TABLE IF EXISTS public.sales_stage_history;

-- Spalten und Daten auf `leads` bleiben, siehe Kopf.
COMMIT;
