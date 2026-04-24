-- Create function to calculate spam score based on IP duplicates
CREATE OR REPLACE FUNCTION public.calculate_lead_spam_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ip_count_24h INTEGER := 0;
  email_count_24h INTEGER := 0;
  phone_count_24h INTEGER := 0;
  calculated_score INTEGER := 0;
BEGIN
  -- Count leads from same IP in last 24 hours (excluding current lead)
  IF NEW.ip_address IS NOT NULL AND NEW.ip_address != '' THEN
    SELECT COUNT(*) INTO ip_count_24h
    FROM public.leads
    WHERE ip_address = NEW.ip_address
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND id != NEW.id;
    
    -- Add to score: 2 points per duplicate IP request
    calculated_score := calculated_score + (ip_count_24h * 2);
  END IF;
  
  -- Count leads from same email in last 24 hours
  IF NEW.customer_email IS NOT NULL THEN
    SELECT COUNT(*) INTO email_count_24h
    FROM public.leads
    WHERE LOWER(customer_email) = LOWER(NEW.customer_email)
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND id != NEW.id;
    
    -- Add to score: 3 points per duplicate email
    calculated_score := calculated_score + (email_count_24h * 3);
  END IF;
  
  -- Count leads from same phone in last 24 hours
  IF NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '' THEN
    SELECT COUNT(*) INTO phone_count_24h
    FROM public.leads
    WHERE customer_phone = NEW.customer_phone
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND id != NEW.id;
    
    -- Add to score: 2 points per duplicate phone
    calculated_score := calculated_score + (phone_count_24h * 2);
  END IF;
  
  -- Check for very short description
  IF NEW.description IS NOT NULL AND LENGTH(NEW.description) < 10 THEN
    calculated_score := calculated_score + 1;
  END IF;
  
  -- Check for missing preferred date
  IF NEW.preferred_date IS NULL THEN
    calculated_score := calculated_score + 1;
  END IF;
  
  -- Update the spam score
  NEW.spam_score := calculated_score;
  
  RETURN NEW;
END;
$$;

-- Create trigger to calculate spam score on insert
DROP TRIGGER IF EXISTS calculate_spam_score_trigger ON public.leads;
CREATE TRIGGER calculate_spam_score_trigger
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_lead_spam_score();

-- Add index on ip_address for faster spam detection queries
CREATE INDEX IF NOT EXISTS idx_leads_ip_address ON public.leads(ip_address);

-- Add index on customer_email for faster duplicate detection
CREATE INDEX IF NOT EXISTS idx_leads_customer_email ON public.leads(LOWER(customer_email));

COMMENT ON FUNCTION public.calculate_lead_spam_score() IS 'Calculates spam score based on: IP duplicates (2 pts each), email duplicates (3 pts each), phone duplicates (2 pts each), short description (1 pt), no date (1 pt)';