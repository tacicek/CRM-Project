-- =============================================================================
-- ROLLBACK für 20260728230000_nachtrag_rpc.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach gibt es keinen Weg mehr, den vereinbarten Umfang zu ergänzen:
--    `create_offer_revision` weist angenommene Offerten ab (zu Recht), und der
--    Ersatz fällt weg. Bereits versendete Nachträge kann der Kunde ausserdem
--    nicht mehr öffnen oder ihnen zustimmen — der Link läuft ins Leere.
--
--    Bestehende Nachträge und ihre Positionen bleiben unberührt.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.update_amendment_by_token(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_amendment_by_token(TEXT);
DROP FUNCTION IF EXISTS public.create_offer_amendment(UUID, TEXT, TEXT);

COMMIT;
