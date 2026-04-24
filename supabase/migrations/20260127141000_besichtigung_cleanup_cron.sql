-- =============================================================================
-- BESICHTIGUNG CLEANUP CRON JOB
-- Runs daily at 3:00 AM UTC to delete expired besichtigung data
-- (photos, videos, sessions where data_expires_at < NOW())
-- =============================================================================

-- Helper function (can be called manually too)
CREATE OR REPLACE FUNCTION public.trigger_besichtigung_cleanup()
RETURNS void AS $$
BEGIN
  -- Call the Edge Function using pg_net extension
  PERFORM net.http_post(
    url := 'https://qzmyqkolzrckgaxaypxc.supabase.co/functions/v1/cleanup-besichtigung',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  
  RAISE NOTICE 'Besichtigung cleanup triggered';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger besichtigung cleanup: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.trigger_besichtigung_cleanup IS 
  'Triggers the cleanup-besichtigung Edge Function to remove expired photos/sessions. Runs daily via pg_cron.';

-- =============================================================================
-- CRON SCHEDULE
-- =============================================================================
-- Runs at 3:00 AM UTC daily (4:00 AM CET)
-- Using direct net.http_post for reliability

SELECT cron.schedule(
  'daily-besichtigung-cleanup',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://qzmyqkolzrckgaxaypxc.supabase.co/functions/v1/cleanup-besichtigung',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );$$
);
