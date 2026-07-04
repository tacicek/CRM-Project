-- K1 (Kalender analysis 2026-07-04): the pg_cron invoker functions and the
-- besichtigung-cleanup job POSTed to the RETIRED Offerio Supabase-Cloud project
-- (https://qzmyqkolzrckgaxaypxc.supabase.co) with a hardcoded service_role JWT for
-- that project as fallback. On this self-hosted install the appointment/team
-- reminders therefore NEVER fired, and a foreign credential sat in the DB.
--
-- Fix:
--  * one shared invoker that targets the LOCAL Kong (http://supabase-kong:8000 —
--    the DB container reaches it on the compose network) and takes the key ONLY
--    from vault ('service_role_key', stored out-of-band — never in this file).
--    No key -> WARNING + skip (never a hardcoded fallback again).
--  * the two cron-referenced functions become thin wrappers (job commands unchanged).
--  * daily-besichtigung-cleanup is rescheduled onto the same helper.

CREATE OR REPLACE FUNCTION public.invoke_edge_function(p_fn text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_id  bigint;
  service_key text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key';
  EXCEPTION WHEN OTHERS THEN
    service_key := NULL;
  END;

  IF service_key IS NULL THEN
    RAISE WARNING '[invoke_edge_function] vault secret service_role_key missing — % not called', p_fn;
    RETURN;
  END IF;

  SELECT net.http_post(
    url := 'http://supabase-kong:8000/functions/v1/' || p_fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RAISE LOG '[invoke_edge_function] % triggered, request_id: %', p_fn, request_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.invoke_appointment_reminder()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.invoke_edge_function('notify-appointment-reminder'); $$;

CREATE OR REPLACE FUNCTION public.invoke_team_reminder()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.invoke_edge_function('notify-team-reminder'); $$;

-- Reschedule the cleanup job onto the helper (idempotent: unschedule if present).
DO $do$
BEGIN
  PERFORM cron.unschedule('daily-besichtigung-cleanup');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job may not exist
END;
$do$;
SELECT cron.schedule(
  'daily-besichtigung-cleanup',
  '0 3 * * *',
  $$SELECT public.invoke_edge_function('cleanup-besichtigung')$$
);
