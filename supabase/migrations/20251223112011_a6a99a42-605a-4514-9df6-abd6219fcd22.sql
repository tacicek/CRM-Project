-- Entferne den INSERT-Trigger, der bei neuen Leads sofort match-lead aufruft
-- Leads sollen zuerst manuell verifiziert werden, bevor sie an Firmen verteilt werden
DROP TRIGGER IF EXISTS on_lead_created_match ON public.leads;

-- Optional: Lösche auch die nicht mehr benötigte Funktion
DROP FUNCTION IF EXISTS public.trigger_match_lead();

-- Stelle sicher, dass der verified-Trigger existiert und korrekt konfiguriert ist
-- (Er sollte bereits existieren, aber zur Sicherheit)
CREATE OR REPLACE FUNCTION public.trigger_match_verified_lead()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  -- Only trigger when status changes to 'verified'
  IF NEW.status = 'verified' AND (OLD.status IS NULL OR OLD.status != 'verified') THEN
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    IF supabase_url IS NULL OR supabase_url = '' THEN
      supabase_url := 'https://yrehijkkurxywwhrxriu.supabase.co';
    END IF;

    SELECT net.http_post(
      url := supabase_url || '/functions/v1/match-lead',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_role_key, current_setting('request.jwt.claim.sub', true))
      ),
      body := jsonb_build_object('lead_id', NEW.id)
    ) INTO request_id;

    RAISE LOG '[trigger_match_verified_lead] Triggered match-lead for verified lead %, request_id: %', NEW.id, request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Stelle sicher, dass der Trigger existiert
DROP TRIGGER IF EXISTS on_lead_verified ON public.leads;
CREATE TRIGGER on_lead_verified
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_match_verified_lead();