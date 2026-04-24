-- Funktion zum Auslösen der Admin-Benachrichtigung bei hohem Spam-Score
CREATE OR REPLACE FUNCTION public.trigger_notify_admin_high_spam()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  -- Nur bei neuen Leads mit hohem Spam-Score (≥6) und status pending_verification
  IF NEW.spam_score >= 6 AND NEW.status = 'pending_verification' THEN
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    IF supabase_url IS NULL OR supabase_url = '' THEN
      supabase_url := 'https://yrehijkkurxywwhrxriu.supabase.co';
    END IF;

    -- Edge Function aufrufen
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/notify-admin-new-lead',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_role_key, current_setting('request.jwt.claim.sub', true))
      ),
      body := jsonb_build_object('leadId', NEW.id)
    ) INTO request_id;

    RAISE LOG '[trigger_notify_admin_high_spam] Notified admins for high-spam lead %, spam_score: %, request_id: %', NEW.id, NEW.spam_score, request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger erstellen (nach spam_score Berechnung)
DROP TRIGGER IF EXISTS on_lead_high_spam_notify ON public.leads;
CREATE TRIGGER on_lead_high_spam_notify
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_admin_high_spam();