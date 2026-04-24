-- =====================================================
-- APPOINTMENT REMINDER CRON JOB
-- Runs every 15 minutes to send appointment reminders
-- =====================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create function to invoke the reminder Edge Function
CREATE OR REPLACE FUNCTION public.invoke_appointment_reminder()
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

  -- Call the reminder Edge Function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-appointment-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  ) INTO request_id;
  
  RAISE LOG '[appointment_reminder_cron] Triggered reminder check, request_id: %', request_id;
END;
$$;

-- Schedule the cron job to run every 15 minutes
-- Note: pg_cron uses UTC timezone
SELECT cron.schedule(
  'appointment-reminder-check',
  '*/15 * * * *',  -- Every 15 minutes
  $$SELECT public.invoke_appointment_reminder()$$
);

-- =====================================================
-- CREATE APPOINTMENT FROM LEAD FUNCTION
-- When a lead is accepted, allow creating an appointment
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_appointment_from_lead(
  p_lead_id UUID,
  p_company_id UUID,
  p_appointment_type VARCHAR DEFAULT 'besichtigung',
  p_appointment_date DATE DEFAULT NULL,
  p_start_time TIME DEFAULT '09:00',
  p_end_time TIME DEFAULT '10:00',
  p_title VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_appointment_id UUID;
  v_default_date DATE;
  v_final_title VARCHAR;
BEGIN
  -- Get lead data
  SELECT 
    id,
    customer_first_name,
    customer_last_name,
    customer_email,
    customer_phone,
    from_street,
    from_house_number,
    from_plz,
    from_city,
    service_type,
    preferred_date
  INTO v_lead
  FROM leads
  WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  
  -- Use preferred_date if no date provided
  IF p_appointment_date IS NULL THEN
    v_default_date := COALESCE(v_lead.preferred_date::date, CURRENT_DATE + INTERVAL '3 days');
  ELSE
    v_default_date := p_appointment_date;
  END IF;
  
  -- Generate title if not provided
  IF p_title IS NULL THEN
    v_final_title := CASE p_appointment_type
      WHEN 'besichtigung' THEN 'Besichtigung'
      WHEN 'service' THEN 'Umzug'
      ELSE 'Termin'
    END || ' - ' || COALESCE(v_lead.customer_first_name, '') || ' ' || COALESCE(v_lead.customer_last_name, '');
  ELSE
    v_final_title := p_title;
  END IF;
  
  -- Create the appointment
  INSERT INTO appointments (
    company_id,
    lead_id,
    appointment_type,
    status,
    appointment_date,
    start_time,
    end_time,
    title,
    location_address,
    location_plz,
    location_city,
    customer_first_name,
    customer_last_name,
    customer_email,
    customer_phone
  ) VALUES (
    p_company_id,
    p_lead_id,
    p_appointment_type,
    'pending',
    v_default_date,
    p_start_time,
    p_end_time,
    v_final_title,
    TRIM(COALESCE(v_lead.from_street, '') || ' ' || COALESCE(v_lead.from_house_number, '')),
    v_lead.from_plz,
    v_lead.from_city,
    v_lead.customer_first_name,
    v_lead.customer_last_name,
    v_lead.customer_email,
    v_lead.customer_phone
  ) RETURNING id INTO v_appointment_id;
  
  RETURN v_appointment_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_appointment_from_lead TO authenticated;

-- =====================================================
-- ADD RECURRING APPOINTMENT SUPPORT
-- =====================================================

-- Add recurring columns to appointments table if not exists
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_pattern VARCHAR(50); -- daily, weekly, biweekly, monthly
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS parent_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;

-- Create index for recurring appointments
CREATE INDEX IF NOT EXISTS idx_appointments_parent ON appointments(parent_appointment_id) WHERE parent_appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_recurring ON appointments(is_recurring) WHERE is_recurring = true;

-- Function to generate recurring appointments
CREATE OR REPLACE FUNCTION public.generate_recurring_appointments(
  p_parent_id UUID,
  p_end_date DATE DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent RECORD;
  v_next_date DATE;
  v_count INTEGER := 0;
  v_end_date DATE;
  v_interval INTERVAL;
BEGIN
  -- Get parent appointment
  SELECT * INTO v_parent
  FROM appointments
  WHERE id = p_parent_id AND is_recurring = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent appointment not found or not recurring';
  END IF;
  
  -- Determine end date (max 1 year ahead)
  v_end_date := COALESCE(p_end_date, v_parent.recurrence_end_date, v_parent.appointment_date + INTERVAL '1 year');
  
  -- Determine interval based on pattern
  v_interval := CASE v_parent.recurrence_pattern
    WHEN 'daily' THEN INTERVAL '1 day'
    WHEN 'weekly' THEN INTERVAL '1 week'
    WHEN 'biweekly' THEN INTERVAL '2 weeks'
    WHEN 'monthly' THEN INTERVAL '1 month'
    ELSE INTERVAL '1 week'
  END;
  
  v_next_date := v_parent.appointment_date + v_interval;
  
  -- Generate recurring appointments
  WHILE v_next_date <= v_end_date LOOP
    -- Check if appointment already exists for this date
    IF NOT EXISTS (
      SELECT 1 FROM appointments
      WHERE parent_appointment_id = p_parent_id
        AND appointment_date = v_next_date
    ) THEN
      INSERT INTO appointments (
        company_id,
        lead_id,
        offer_id,
        appointment_type,
        status,
        appointment_date,
        start_time,
        end_time,
        title,
        description,
        location_address,
        location_plz,
        location_city,
        location_notes,
        customer_first_name,
        customer_last_name,
        customer_email,
        customer_phone,
        assigned_team_member_ids,
        required_vehicles,
        required_equipment,
        is_recurring,
        recurrence_pattern,
        parent_appointment_id
      )
      SELECT
        company_id,
        lead_id,
        offer_id,
        appointment_type,
        'pending', -- New appointments start as pending
        v_next_date,
        start_time,
        end_time,
        title,
        description,
        location_address,
        location_plz,
        location_city,
        location_notes,
        customer_first_name,
        customer_last_name,
        customer_email,
        customer_phone,
        assigned_team_member_ids,
        required_vehicles,
        required_equipment,
        false, -- Child appointments are not recurring themselves
        recurrence_pattern,
        p_parent_id
      FROM appointments
      WHERE id = p_parent_id;
      
      v_count := v_count + 1;
    END IF;
    
    v_next_date := v_next_date + v_interval;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.generate_recurring_appointments TO authenticated;

-- =====================================================
-- QUICK APPOINTMENT SUMMARY VIEW
-- =====================================================

CREATE OR REPLACE VIEW public.appointment_summary AS
SELECT 
  a.company_id,
  a.appointment_date,
  a.appointment_type,
  COUNT(*) as total_appointments,
  COUNT(*) FILTER (WHERE a.status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE a.status = 'confirmed') as confirmed_count,
  COUNT(*) FILTER (WHERE a.status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE a.status = 'cancelled') as cancelled_count,
  ARRAY_AGG(DISTINCT tm.id) FILTER (WHERE tm.id IS NOT NULL) as team_member_ids
FROM appointments a
LEFT JOIN LATERAL unnest(a.assigned_team_member_ids) AS tm_id ON true
LEFT JOIN team_members tm ON tm.id = tm_id::uuid
WHERE a.appointment_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY a.company_id, a.appointment_date, a.appointment_type;

-- RLS for the view (inherit from appointments)
ALTER VIEW public.appointment_summary OWNER TO postgres;

