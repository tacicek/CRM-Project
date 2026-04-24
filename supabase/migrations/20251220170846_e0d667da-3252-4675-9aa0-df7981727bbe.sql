-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to call match-lead edge function
CREATE OR REPLACE FUNCTION public.trigger_match_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  -- Get the Supabase URL from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, use the project URL directly
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://yrehijkkurxywwhrxriu.supabase.co';
  END IF;

  -- Call the match-lead edge function asynchronously
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/match-lead',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, current_setting('request.jwt.claim.sub', true))
    ),
    body := jsonb_build_object('lead_id', NEW.id)
  ) INTO request_id;

  RAISE LOG '[trigger_match_lead] Triggered match-lead for lead %, request_id: %', NEW.id, request_id;

  RETURN NEW;
END;
$$;

-- Create trigger on leads table for new inserts
DROP TRIGGER IF EXISTS on_lead_created_match ON public.leads;

CREATE TRIGGER on_lead_created_match
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_match_lead();