-- =====================================================
-- TEAM MEMBER REMINDER SYSTEM
-- Sends email reminders to team members 12 hours before appointments
-- =====================================================

-- Add reminder_sent_team column to appointments if not exists
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS reminder_sent_team BOOLEAN DEFAULT false;

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_appointments_team_reminder 
ON appointments(appointment_date, status, reminder_sent_team) 
WHERE reminder_sent_team = false;

-- Function to invoke the team reminder Edge Function
CREATE OR REPLACE FUNCTION public.invoke_team_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  service_key text;
  supabase_url text := 'https://qzmyqkolzrckgaxaypxc.supabase.co';
BEGIN
  -- Get service role key from vault if available
  BEGIN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key';
  EXCEPTION WHEN OTHERS THEN
    service_key := NULL;
  END;
  
  -- Fallback to hardcoded key if vault not available
  IF service_key IS NULL THEN
    service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bXlxa29senJja2dheGF5cHhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjY5MDIwMywiZXhwIjoyMDgyMjY2MjAzfQ.oJHxz9Iha0Pyum1OmFVh9Qc-DHthxYHSPFEawG_LQms';
  END IF;

  -- Call the team reminder Edge Function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-team-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  ) INTO request_id;
  
  RAISE LOG '[team_reminder_cron] Triggered team reminder check, request_id: %', request_id;
END;
$$;

-- Schedule the cron job to run every hour
-- This checks for appointments 11-13 hours away (catches 12 hour window)
-- Note: pg_cron uses UTC timezone
SELECT cron.unschedule('team-reminder-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'team-reminder-check'
);

SELECT cron.schedule(
  'team-reminder-check',
  '0 * * * *',  -- Every hour at minute 0
  $$SELECT public.invoke_team_reminder()$$
);

-- =====================================================
-- COMPANY REMINDER SETTINGS TABLE
-- Allows companies to customize reminder timing
-- =====================================================

CREATE TABLE IF NOT EXISTS company_reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Reminder timing (hours before)
  team_reminder_hours INTEGER DEFAULT 12,
  customer_reminder_hours INTEGER DEFAULT 24,
  
  -- Enable/disable
  team_reminders_enabled BOOLEAN DEFAULT true,
  customer_reminders_enabled BOOLEAN DEFAULT true,
  
  -- Email preferences
  include_customer_phone BOOLEAN DEFAULT true,
  include_customer_email BOOLEAN DEFAULT true,
  include_lead_details BOOLEAN DEFAULT true,
  include_offer_details BOOLEAN DEFAULT true,
  
  -- Custom message
  custom_footer_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE company_reminder_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first if exist)
DROP POLICY IF EXISTS "Admins can manage all reminder settings" ON company_reminder_settings;
DROP POLICY IF EXISTS "Companies can manage their reminder settings" ON company_reminder_settings;

CREATE POLICY "Admins can manage all reminder settings"
ON company_reminder_settings FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Companies can manage their reminder settings"
ON company_reminder_settings FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = company_reminder_settings.company_id
  AND companies.user_id = auth.uid()
));

-- Create index
CREATE INDEX IF NOT EXISTS idx_reminder_settings_company ON company_reminder_settings(company_id);

-- =====================================================
-- VIEW FOR UPCOMING TEAM REMINDERS
-- Shows which reminders are pending
-- =====================================================

CREATE OR REPLACE VIEW public.pending_team_reminders AS
SELECT 
  a.id AS appointment_id,
  a.company_id,
  a.appointment_date,
  a.start_time,
  a.end_time,
  a.title,
  a.appointment_type,
  a.status,
  a.customer_first_name,
  a.customer_last_name,
  a.location_address,
  a.location_plz,
  a.location_city,
  a.assigned_team_member_ids,
  ARRAY_AGG(DISTINCT tm.email) FILTER (WHERE tm.email IS NOT NULL) AS team_emails,
  ARRAY_AGG(DISTINCT CONCAT(tm.first_name, ' ', tm.last_name)) AS team_names,
  (a.appointment_date + a.start_time::interval) AS appointment_datetime,
  (a.appointment_date + a.start_time::interval) - INTERVAL '12 hours' AS reminder_time
FROM appointments a
LEFT JOIN LATERAL unnest(a.assigned_team_member_ids) AS tm_id ON true
LEFT JOIN team_members tm ON tm.id = tm_id::uuid AND tm.is_active = true
WHERE 
  a.status IN ('confirmed', 'pending')
  AND a.appointment_date >= CURRENT_DATE
  AND (a.reminder_sent_team IS NULL OR a.reminder_sent_team = false)
  AND a.assigned_team_member_ids IS NOT NULL
  AND array_length(a.assigned_team_member_ids, 1) > 0
GROUP BY 
  a.id, a.company_id, a.appointment_date, a.start_time, a.end_time,
  a.title, a.appointment_type, a.status, a.customer_first_name,
  a.customer_last_name, a.location_address, a.location_plz, a.location_city,
  a.assigned_team_member_ids
ORDER BY appointment_datetime ASC;

COMMENT ON VIEW public.pending_team_reminders IS 'Shows appointments that have team members assigned but reminders not yet sent';

-- Grant access
GRANT SELECT ON public.pending_team_reminders TO authenticated;

-- =====================================================
-- MANUAL TRIGGER FUNCTION
-- Allows companies to manually trigger reminders
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_team_reminder_for_appointment(
  p_appointment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment RECORD;
  request_id bigint;
  service_key text;
  supabase_url text := 'https://qzmyqkolzrckgaxaypxc.supabase.co';
BEGIN
  -- Check if appointment exists and has team members
  SELECT * INTO v_appointment
  FROM appointments
  WHERE id = p_appointment_id
    AND assigned_team_member_ids IS NOT NULL
    AND array_length(assigned_team_member_ids, 1) > 0;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or has no team members assigned';
  END IF;
  
  -- Get service role key
  BEGIN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key';
  EXCEPTION WHEN OTHERS THEN
    service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bXlxa29senJja2dheGF5cHhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjY5MDIwMywiZXhwIjoyMDgyMjY2MjAzfQ.oJHxz9Iha0Pyum1OmFVh9Qc-DHthxYHSPFEawG_LQms';
  END;

  -- Call the reminder function with specific appointment
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-team-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('appointment_id', p_appointment_id)
  ) INTO request_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_team_reminder_for_appointment TO authenticated;

COMMENT ON FUNCTION public.trigger_team_reminder_for_appointment IS 'Manually trigger a team reminder for a specific appointment';

