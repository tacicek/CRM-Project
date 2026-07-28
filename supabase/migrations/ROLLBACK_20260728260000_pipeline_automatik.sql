-- =============================================================================
-- ROLLBACK für 20260728260000_pipeline_automatik.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach füllt sich die Wiedervorlage nicht mehr von selbst. Eine versendete
--    Offerte, auf die niemand antwortet, fällt dann wieder niemandem auf —
--    genau der Zustand, den diese Migration beendet hat.
--
--    Bereits angelegte Aufgaben und der Lieferschein bleiben unberührt.
-- =============================================================================

BEGIN;

SELECT cron.unschedule('pipeline-automations')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pipeline-automations');

DROP FUNCTION IF EXISTS public.run_pipeline_automations();

COMMIT;
