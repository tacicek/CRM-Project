-- =============================================================================
-- ROLLBACK für 20260730110000_portal_lesen.sql — NICHT als Migration ausführen.
--
-- ⚠️ Das Portal zeigt danach nichts mehr: /portal läuft in "function does not
--    exist". Sitzungen und Links bleiben gültig, führen aber ins Leere.
--    Wer das Portal wirklich abschalten will, nimmt zusätzlich
--    ROLLBACK_20260730100000 — sonst bleiben Zugänge offen, die niemand sieht.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.portal_overview(TEXT);

COMMIT;
