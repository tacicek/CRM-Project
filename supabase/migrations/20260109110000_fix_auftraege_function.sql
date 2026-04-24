-- =============================================
-- FIX: get_auftraege_needing_reminders function
-- Fix column reference: team_members has first_name/last_name, not name
-- =============================================

-- Drop and recreate the function with correct column names
CREATE OR REPLACE FUNCTION public.get_auftraege_needing_reminders()
RETURNS TABLE (
  auftrag_id UUID,
  company_id UUID,
  company_name VARCHAR,
  company_email VARCHAR,
  auftrag_nummer VARCHAR,
  title VARCHAR,
  customer_name VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,
  from_address TEXT,
  to_address TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  estimated_duration_minutes INTEGER,
  description TEXT,
  special_instructions TEXT,
  team_leader_id UUID,
  team_leader_name VARCHAR,
  team_leader_email VARCHAR,
  assigned_team_members UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS auftrag_id,
    a.company_id,
    c.company_name,
    c.email AS company_email,
    a.auftrag_nummer,
    a.title,
    a.customer_name,
    a.customer_email,
    a.customer_phone,
    a.from_address,
    a.to_address,
    a.scheduled_date,
    a.scheduled_time,
    a.estimated_duration_minutes,
    a.description,
    a.special_instructions,
    a.team_leader_id,
    CONCAT(tm.first_name, ' ', tm.last_name)::VARCHAR AS team_leader_name,
    tm.email AS team_leader_email,
    a.assigned_team_members
  FROM public.auftraege a
  JOIN public.companies c ON c.id = a.company_id
  LEFT JOIN public.team_members tm ON tm.id = a.team_leader_id
  WHERE a.status = 'geplant'
    AND a.team_leader_id IS NOT NULL
    AND a.team_reminder_sent = FALSE
    AND a.scheduled_date = CURRENT_DATE + INTERVAL '1 day' * a.reminder_days_before;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
