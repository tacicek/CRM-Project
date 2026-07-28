-- =============================================================================
-- ROLLBACK für 20260801100000_kommunikation.sql — NICHT als Migration ausführen.
--
-- ⚠️ Der Posteingang verschwindet. Die QUELLEN bleiben unberührt:
--    `inbound_emails` und `email_logs` sind von dieser Migration nie verändert
--    worden, sie wurden nur gelesen. Nach einem erneuten Anwenden stellt
--    `run_communication_backfill()` denselben Stand wieder her.
--
--    Was NICHT zurückkommt: `read_at`, der Fadenstatus (erledigt/offen) und die
--    Zuweisung — die entstehen erst in dieser Schicht. Vorher sichern:
--      \copy (SELECT * FROM public.communication_threads)  TO 'faeden.csv' CSV HEADER
--      \copy (SELECT * FROM public.communication_messages) TO 'nachrichten.csv' CSV HEADER
-- =============================================================================

BEGIN;

SELECT cron.unschedule('communication-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'communication-retention');

DROP TRIGGER IF EXISTS trigger_email_log_faden ON public.email_logs;
DROP TRIGGER IF EXISTS trigger_inbound_email_faden ON public.inbound_emails;

DROP FUNCTION IF EXISTS public.communication_retention();
DROP FUNCTION IF EXISTS public.run_communication_backfill(UUID);
DROP FUNCTION IF EXISTS public.email_log_in_faden();
DROP FUNCTION IF EXISTS public.inbound_email_in_faden();
DROP FUNCTION IF EXISTS public.resolve_or_create_thread(UUID, UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.communication_thread_fortschreiben();

DROP TABLE IF EXISTS public.communication_messages;
DROP TABLE IF EXISTS public.communication_threads;

COMMIT;
