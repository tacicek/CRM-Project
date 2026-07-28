-- =============================================================================
-- ROLLBACK für 20260801110000_kennzahlen.sql — NICHT als Migration ausführen.
--
-- ⚠️ /firma/kennzahlen läuft danach in "function does not exist". Es gehen
--    KEINE Daten verloren — die Funktion rechnet nur, sie speichert nichts.
--
--    Achtung beim Wiederaufbau: wer die Zahlen anderswo neu berechnet, muss
--    `offer_series_id` zählen und nicht Offertenzeilen. Sonst senkt jede
--    Überarbeitung einer Offerte die Annahmequote.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.lifecycle_kpis(UUID, DATE, DATE);

COMMIT;
