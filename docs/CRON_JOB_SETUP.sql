-- =============================================================================
-- SUPABASE CRON JOB - Otomatik Abonelik Yoenetimi
-- Bu sorguyu Supabase Dashboard → SQL Editor'de calistirin
-- =============================================================================

-- 1. Mevcut cron job'lari kontrol et
SELECT * FROM cron.job;

-- 2. Guenluek hatirlatma cron job'u olustur (Her guen 08:00 UTC = 09:00 CET)
SELECT cron.schedule(
  'daily-subscription-manager',           -- Job adi
  '0 8 * * *',                            -- Cron expression: Her guen 08:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://qzmyqkolzrckgaxaypxc.supabase.co/functions/v1/subscription-manager',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bXlxa29senJja2dheGF5cHhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTQyMTI5MCwiZXhwIjoyMDUwOTk3MjkwfQ.SERVICE_ROLE_KEY_BURAYA',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =============================================================================
-- NOTLAR:
-- - SERVICE_ROLE_KEY_BURAYA yerine gercek service_role key'inizi yazin
-- - Key'i bulmak icin: Supabase Dashboard → Settings → API → service_role
-- - Job'u durdurmak icin: SELECT cron.unschedule('daily-subscription-manager');
-- - Job durumunu goermek icin: SELECT * FROM cron.job;
-- - Job loglarini goermek icin: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- =============================================================================

