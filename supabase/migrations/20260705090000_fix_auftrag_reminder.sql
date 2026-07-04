-- M4 (Kalender analysis): notify-auftrag-reminder (iş-günü-öncesi ekip+müşteri, PDF'li)
-- was doubly dead — no cron triggered it AND get_auftraege_needing_reminders returned
-- HTTP 500 ("structure of query does not match function result type") the moment it ran.
--
-- Root cause: team_members.email is TEXT but the RPC declared team_leader_email as
-- character varying → PostgreSQL rejects the RETURNS TABLE shape. Cast to varchar.
-- (company_email is already varchar; team_leader_name is CONCAT()::VARCHAR — both fine.)

CREATE OR REPLACE FUNCTION public.get_auftraege_needing_reminders()
 RETURNS TABLE(auftrag_id uuid, company_id uuid, company_name character varying, company_email character varying, auftrag_nummer character varying, title character varying, customer_name character varying, customer_email character varying, customer_phone character varying, from_address text, to_address text, scheduled_date date, scheduled_time time without time zone, estimated_duration_minutes integer, description text, special_instructions text, team_leader_id uuid, team_leader_name character varying, team_leader_email character varying, assigned_team_members uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    tm.email::character varying AS team_leader_email,   -- was TEXT → varchar mismatch
    a.assigned_team_members
  FROM public.auftraege a
  JOIN public.companies c ON c.id = a.company_id
  LEFT JOIN public.team_members tm ON tm.id = a.team_leader_id
  WHERE a.status IN ('geplant', 'bestaetigt')
    AND a.deleted_at IS NULL
    AND a.team_leader_id IS NOT NULL
    AND a.team_reminder_sent = FALSE
    AND a.scheduled_date = CURRENT_DATE + INTERVAL '1 day' * a.reminder_days_before;
END;
$function$;

-- Cron: every morning at 06:00, using the shared invoke_edge_function helper (K1) that
-- carries the vault service_role key — same auth as the appointment/team reminders.
-- No-op while no auftrag has a team_leader_id (RPC filters those out) — activates
-- automatically once a team leader is assigned.
SELECT cron.schedule(
  'auftrag-reminder-check',
  '0 6 * * *',
  $$SELECT public.invoke_edge_function('notify-auftrag-reminder')$$
);
