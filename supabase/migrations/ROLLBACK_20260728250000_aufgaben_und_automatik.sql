-- =============================================================================
-- ROLLBACK für 20260728250000_aufgaben_und_automatik.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Dieser Rückbau LÖSCHT alle offenen Aufgaben — auch die von Hand angelegten.
--    Was jemand sich als nächsten Schritt notiert hat, ist danach weg.
--
--    Zuerst 20260728260000 zurückbauen (die Regeln, die hierher schreiben).
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS public.automation_deliveries;
DROP TRIGGER IF EXISTS trigger_crm_tasks_updated_at ON public.crm_tasks;
DROP TABLE IF EXISTS public.crm_tasks;

COMMIT;
