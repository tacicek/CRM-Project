-- =============================================================================
-- SUBSCRIPTION MANAGER CRON JOB
-- Runs daily at 8:00 AM UTC (9:00 AM CET) to send reminders and deactivate expired subs
-- =============================================================================

-- Note: pg_cron extension is managed by Supabase and already enabled

-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION public.trigger_subscription_manager()
RETURNS void AS $$
DECLARE
  v_result text;
BEGIN
  -- Call the Edge Function using net extension
  -- Note: This requires the pg_net extension to be enabled
  SELECT content INTO v_result
  FROM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/subscription-manager',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  
  RAISE NOTICE 'Subscription manager result: %', v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger subscription manager: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To set up the cron job, run the following in the Supabase SQL Editor:
-- 
-- SELECT cron.schedule(
--   'daily-subscription-manager',
--   '0 8 * * *',  -- Every day at 8:00 AM UTC
--   $$SELECT net.http_post(
--     url := 'https://qzmyqkolzrckgaxaypxc.supabase.co/functions/v1/subscription-manager',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   );$$
-- );
--
-- To check scheduled jobs:
-- SELECT * FROM cron.job;
--
-- To remove a job:
-- SELECT cron.unschedule('daily-subscription-manager');

COMMENT ON FUNCTION public.trigger_subscription_manager IS 'Triggers the subscription-manager Edge Function to send reminders and deactivate expired subscriptions';

