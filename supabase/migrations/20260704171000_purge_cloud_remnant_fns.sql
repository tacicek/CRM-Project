-- K1b (follow-up to 20260704170000): the residue scan found four more DB functions
-- still POSTing to the retired Offerio cloud project with the same hardcoded JWT.
--
--  * trigger_match_verified_lead (trigger on_lead_verified ON leads) and
--    notify_admin_new_company (trigger ON companies): their target edge functions
--    (match-lead, notify-admin-new-company) exist NEITHER in the repo NOR on the
--    server — marketplace/admin remnants of the multi-tenant fork that can never
--    succeed; every firing only produced a failed pg_net request. Dropped.
--  * trigger_besichtigung_cleanup(): orphan helper (no trigger attached); the cleanup
--    cron now goes through invoke_edge_function. Dropped.
--  * trigger_team_reminder_for_appointment(uuid): legitimate manual-reminder RPC —
--    rewritten onto the local Kong + vault-only key (payload preserved).

DROP TRIGGER IF EXISTS on_lead_verified ON public.leads;
DROP FUNCTION IF EXISTS public.trigger_match_verified_lead();

DROP TRIGGER IF EXISTS trigger_notify_admin_new_company ON public.companies;
DROP FUNCTION IF EXISTS public.notify_admin_new_company();

DROP FUNCTION IF EXISTS public.trigger_besichtigung_cleanup();

CREATE OR REPLACE FUNCTION public.trigger_team_reminder_for_appointment(p_appointment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_exists    boolean;
  request_id  bigint;
  service_key text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE id = p_appointment_id
      AND assigned_team_member_ids IS NOT NULL
      AND array_length(assigned_team_member_ids, 1) > 0
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Appointment not found or has no team members assigned';
  END IF;

  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  IF service_key IS NULL THEN
    RAISE EXCEPTION 'vault secret service_role_key missing';
  END IF;

  SELECT net.http_post(
    url := 'http://supabase-kong:8000/functions/v1/notify-team-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('appointment_id', p_appointment_id)
  ) INTO request_id;

  RETURN TRUE;
END;
$function$;
