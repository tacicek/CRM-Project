-- Fix: Update trigger_match_verified_lead to use correct Supabase URL
-- The old URL (yrehijkkurxywwhrxriu) was from the previous project
-- New URL (qzmyqkolzrckgaxaypxc) is the current production project

CREATE OR REPLACE FUNCTION public.trigger_match_verified_lead()
RETURNS TRIGGER AS $$
DECLARE
  service_key text;
  request_id bigint;
BEGIN
  -- Only trigger when status changes to 'verified'
  IF NEW.status = 'verified' AND (OLD.status IS NULL OR OLD.status != 'verified') THEN
    
    -- Get service role key from vault
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key';
    
    -- Fallback to hardcoded key if vault is not available
    IF service_key IS NULL THEN
      service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bXlxa29senJja2dheGF5cHhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjY5MDIwMywiZXhwIjoyMDgyMjY2MjAzfQ.oJHxz9Iha0Pyum1OmFVh9Qc-DHthxYHSPFEawG_LQms';
    END IF;

    -- Call match-lead edge function with CORRECT URL
    SELECT net.http_post(
      url := 'https://qzmyqkolzrckgaxaypxc.supabase.co/functions/v1/match-lead',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('lead_id', NEW.id)
    ) INTO request_id;

    RAISE LOG '[trigger_match_verified_lead] Triggered match-lead for verified lead %, request_id: %', NEW.id, request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_lead_verified ON public.leads;
CREATE TRIGGER on_lead_verified
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_match_verified_lead();

-- Also fix notify_admin_new_company function
CREATE OR REPLACE FUNCTION public.notify_admin_new_company()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
  service_key text;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';
  
  -- Fallback to hardcoded key if vault is not available
  IF service_key IS NULL THEN
    service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bXlxa29senJja2dheGF5cHhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjY5MDIwMywiZXhwIjoyMDgyMjY2MjAzfQ.oJHxz9Iha0Pyum1OmFVh9Qc-DHthxYHSPFEawG_LQms';
  END IF;

  -- Call edge function to notify admin with CORRECT URL
  SELECT net.http_post(
    url := 'https://qzmyqkolzrckgaxaypxc.supabase.co/functions/v1/notify-admin-new-company',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'company_id', NEW.id,
      'company_name', NEW.company_name,
      'email', NEW.email,
      'plz', NEW.plz,
      'city', NEW.city
    )
  ) INTO request_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

