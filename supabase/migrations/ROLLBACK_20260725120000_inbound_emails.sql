-- =============================================================================
-- ROLLBACK für 20260725120000_inbound_emails.sql
--
-- NICHT als reguläre Migration ausführen — Notbremse.
--
-- ⚠️ Vorher lesen:
--   1. Diese Datei DROPPT public.inbound_emails. Damit gehen die Review-Queue
--      (Status 'needs_review') und der Audit-Trail verloren. Die daraus bereits
--      erzeugten LEADS bleiben unberührt — sie stehen in public.leads.
--   2. Der Rückbau von leads_source_check schlägt fehl, solange Leads mit
--      source = 'email' existieren. Das ist Absicht: erst entscheiden, was mit
--      diesen Leads geschehen soll (umschreiben oder behalten), dann rückbauen.
--      Schritt 3 ist deshalb standardmässig auskommentiert.
--   3. Der ANWENDUNGSCODE (Edge Function inbound-email-lead, Review-UI) setzt
--      die Tabelle voraus. DB-Rollback ohne Code-Rollback erzeugt Laufzeitfehler
--      in der Review-Seite. Zuerst INBOUND_EMAIL_ENABLED=false setzen und den
--      Resend-Webhook deaktivieren.
-- =============================================================================

BEGIN;

-- 1. Aufbewahrungs-Job entfernen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('daily-inbound-email-cleanup');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.cleanup_inbound_emails(INTEGER, INTEGER, INTEGER);

-- 2. Tabelle (Trigger, Indizes und Policies fallen mit)
DROP TABLE IF EXISTS public.inbound_emails;

-- 3. leads.source zurückbauen — NUR aktivieren, wenn keine Zeile source='email' hat.
--
--    Prüfen mit:  SELECT COUNT(*) FROM public.leads WHERE source = 'email';
--
-- ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
-- ALTER TABLE public.leads ADD CONSTRAINT leads_source_check
--   CHECK (source IN ('web_form', 'ai_voice', 'manual', 'import', 'widget', 'api'));
--
-- COMMENT ON COLUMN public.leads.source IS
--   'Origin of the lead: web_form, ai_voice, manual, import, widget, api';

COMMIT;
