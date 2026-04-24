-- Create IP blacklist table
CREATE TABLE public.ip_blacklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  added_by UUID REFERENCES auth.users(id),
  blocked_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;

-- Only admins can manage the blacklist
CREATE POLICY "Admins can manage IP blacklist"
ON public.ip_blacklist
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Create index for fast lookups
CREATE INDEX idx_ip_blacklist_ip ON public.ip_blacklist(ip_address);

-- Update the spam score function to check blacklist and auto-reject
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
  
  RETURN NEW;
END;
$$;

-- Add trigger for updated_at on blacklist
CREATE TRIGGER update_ip_blacklist_updated_at
  BEFORE UPDATE ON public.ip_blacklist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.ip_blacklist IS 'Stores blocked IP addresses for spam prevention. Leads from these IPs are automatically rejected.';