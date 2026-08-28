-- =============================================================================
-- ROLLBACK zu 20260828110000_oeffentliche_rpc_rechte_verengen.sql
-- =============================================================================
--
-- Gibt PUBLIC das EXECUTE auf den vier Funktionen zurueck.
--
-- AUSDRUECKLICH: der wiederhergestellte Zustand ist der WEITERE. Diese Datei
-- existiert, damit der Eingriff umkehrbar ist, nicht weil der alte Zustand
-- richtig waere.
--
-- Sie stellt NICHT wieder her, dass `update_amendment_by_token` vorher KEIN
-- PUBLIC-Recht hatte — sie setzt alle vier gleich. Wer den exakten Vorzustand
-- braucht, nimmt ops/production-truth/2026-08-28/function-authz.json.
-- =============================================================================

BEGIN;

DO $rollback$
DECLARE
  f text;
  sig text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'portal_redeem_magic_link',
    'portal_request_change',
    'update_amendment_by_token',
    'update_offer_by_token'
  ] LOOP
    FOR sig IN
      SELECT p.oid::regprocedure::text
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = f
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', sig);
      RAISE NOTICE 'zurueckgegeben: %', sig;
    END LOOP;
  END LOOP;
END
$rollback$;

COMMIT;
