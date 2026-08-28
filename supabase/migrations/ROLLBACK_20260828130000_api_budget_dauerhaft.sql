-- =============================================================================
-- ROLLBACK zu 20260828130000_api_budget_dauerhaft.sql
-- =============================================================================
--
-- Entfernt Zaehlerfunktion und Zaehlertabelle.
--
-- AUSDRUECKLICH: danach gibt es KEINE wirksame Drossel mehr auf den bezahlten
-- Google-APIs. Vor dieser Ruecknahme gehoeren die aufrufenden Edge Functions auf
-- ihre vorige Fassung zurueckgesetzt — sonst rufen sie eine Funktion auf, die es
-- nicht mehr gibt, und antworten (fail closed) mit 503.
--
-- Reihenfolge der Ruecknahme:
--   1. Edge Functions zurueck auf die Fassung ohne Budgetpruefung
--   2. diese Datei
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.consume_api_budget(text, uuid, uuid);
DROP TABLE    IF EXISTS public.api_rate_budget;

COMMIT;
