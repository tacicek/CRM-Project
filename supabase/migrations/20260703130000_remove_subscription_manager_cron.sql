-- H10: the subscription-manager edge function was removed (Offerio subscription remnant,
-- banned by the CRM fork). Drop its DB trigger + any manually-scheduled pg_cron job so nothing
-- keeps POSTing to the now-deleted /functions/v1/subscription-manager endpoint.

-- The original migration (20260108140000) only documented the cron in comments ("set it up in
-- the SQL Editor"), so a job named 'daily-subscription-manager' may or may not exist. Guard on
-- both the pg_cron extension and the job's presence; wrap in an exception handler so this is a
-- no-op when either is absent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-subscription-manager') THEN
    PERFORM cron.unschedule('daily-subscription-manager');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'subscription cron unschedule skipped: %', SQLERRM;
END $$;

DROP FUNCTION IF EXISTS public.trigger_subscription_manager();
