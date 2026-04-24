-- Erweitere calculate_lead_spam_score um Auto-Verifizierung bei spam_score=0
CREATE OR REPLACE FUNCTION public.calculate_lead_spam_score()
RETURNS TRIGGER AS $$
DECLARE
  ip_count_24h INTEGER := 0;
  email_count_24h INTEGER := 0;
  phone_count_24h INTEGER := 0;
  calculated_score INTEGER := 0;
  is_blacklisted BOOLEAN := false;
  blacklist_reason TEXT := NULL;
BEGIN
  -- Check if IP is blacklisted
  IF NEW.ip_address IS NOT NULL AND NEW.ip_address != '' THEN
    SELECT true, reason INTO is_blacklisted, blacklist_reason
    FROM public.ip_blacklist
    WHERE ip_address = NEW.ip_address
    LIMIT 1;
    
    IF is_blacklisted THEN
      -- Auto-reject blacklisted IPs
      NEW.status := 'rejected';
      NEW.rejection_reason := 'IP-Adresse auf Blacklist: ' || COALESCE(blacklist_reason, 'Spam');
      NEW.spam_score := 100;
      
      -- Increment blocked count
      UPDATE public.ip_blacklist 
      SET blocked_count = blocked_count + 1, updated_at = now()
      WHERE ip_address = NEW.ip_address;
      
      RETURN NEW;
    END IF;
    
    -- Count leads from same IP in last 24 hours
    SELECT COUNT(*) INTO ip_count_24h
    FROM public.leads
    WHERE ip_address = NEW.ip_address
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND id != NEW.id;
    
    calculated_score := calculated_score + (ip_count_24h * 2);
  END IF;
  
  -- Count leads from same email in last 24 hours
  IF NEW.customer_email IS NOT NULL THEN
    SELECT COUNT(*) INTO email_count_24h
    FROM public.leads
    WHERE LOWER(customer_email) = LOWER(NEW.customer_email)
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND id != NEW.id;
    
    calculated_score := calculated_score + (email_count_24h * 3);
  END IF;
  
  -- Count leads from same phone in last 24 hours
  IF NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '' THEN
    SELECT COUNT(*) INTO phone_count_24h
    FROM public.leads
    WHERE customer_phone = NEW.customer_phone
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND id != NEW.id;
    
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
  
  NEW.spam_score := calculated_score;
  
  -- AUTO-VERIFIZIERUNG: Bei spam_score=0 automatisch verifizieren
  -- Dies triggert dann den on_lead_verified Trigger für Lead-Matching
  IF calculated_score = 0 THEN
    NEW.status := 'verified';
    NEW.verified_at := NOW();
    -- verified_by bleibt NULL um anzuzeigen, dass es automatisch war
    RAISE LOG '[calculate_lead_spam_score] Auto-verified lead with spam_score=0';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;