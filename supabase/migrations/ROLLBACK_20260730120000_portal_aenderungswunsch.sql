-- =============================================================================
-- ROLLBACK für 20260730120000_portal_aenderungswunsch.sql — NICHT als Migration.
--
-- ⚠️ Löscht alle Änderungswünsche, auch die noch offenen. Was ein Kunde
--    gemeldet und noch niemand entschieden hat, ist danach verloren — und der
--    Kunde erfährt nicht, dass sein Wunsch nie ankam. Vorher sichern:
--      \copy (SELECT * FROM public.customer_change_requests WHERE status='offen')
--        TO 'offene_wuensche.csv' CSV HEADER
--
--    Bereits übernommene Werte bleiben in `customers` stehen — die Annahme hat
--    dort geschrieben, nicht hier.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.decide_change_request(UUID, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.portal_request_change(TEXT, TEXT, TEXT, TEXT);

DROP TABLE IF EXISTS public.customer_change_requests;

COMMIT;
