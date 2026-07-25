-- =============================================================================
-- ROLLBACK für 20260725130000_inbound_email_lead_txn.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Der ANWENDUNGSCODE (inbound-email-lead) ruft create_lead_from_inbound_email()
--    auf. Ohne die Funktion schlägt jede Lead-Erstellung aus einer E-Mail fehl —
--    die Mail landet auf 'failed' und bleibt wiederholbar, es gehen also keine
--    Daten verloren, aber die automatische Übernahme steht still.
--    Zuerst INBOUND_EMAIL_ENABLED=false setzen.
--
-- Bestehende Leads und Verknüpfungen bleiben unberührt.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('reap-stuck-inbound-emails');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.reap_stuck_inbound_emails(INTEGER);
DROP FUNCTION IF EXISTS public.create_lead_from_inbound_email(UUID, UUID, JSONB, JSONB);

COMMIT;
