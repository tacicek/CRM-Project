-- =============================================
-- AUFTRÄGE (Work Orders/Jobs) System
-- =============================================

-- Status enum for Aufträge
CREATE TYPE auftrag_status AS ENUM (
  'geplant',           -- Scheduled, waiting for execution
  'bestaetigt',        -- Confirmed by team
  'in_bearbeitung',    -- In progress
  'abgeschlossen',     -- Completed
  'storniert'          -- Cancelled
);

-- Main Aufträge table
CREATE TABLE IF NOT EXISTS public.auftraege (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  
  -- Auftrag number (auto-generated)
  auftrag_nummer VARCHAR(50) NOT NULL,
  
  -- Team assignment (optional - can be set later)
  team_leader_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  assigned_team_members UUID[] DEFAULT '{}',
  
  -- Schedule
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  estimated_duration_minutes INTEGER DEFAULT 120,
  
  -- Customer info (copied from offer for quick access)
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  
  -- Addresses
  from_address TEXT,
  to_address TEXT,
  
  -- Details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  internal_notes TEXT,
  special_instructions TEXT,
  
  -- Status
  status auftrag_status DEFAULT 'geplant',
  
  -- Reminder settings
  reminder_days_before INTEGER DEFAULT 1,
  reminder_sent_at TIMESTAMPTZ,
  team_reminder_sent BOOLEAN DEFAULT FALSE,
  
  -- Completion
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(company_id, auftrag_nummer)
);

-- Indexes for common queries
CREATE INDEX idx_auftraege_company_id ON public.auftraege(company_id);
CREATE INDEX idx_auftraege_offer_id ON public.auftraege(offer_id);
CREATE INDEX idx_auftraege_status ON public.auftraege(status);
CREATE INDEX idx_auftraege_scheduled_date ON public.auftraege(scheduled_date);
CREATE INDEX idx_auftraege_team_leader ON public.auftraege(team_leader_id);
CREATE INDEX idx_auftraege_company_status_date ON public.auftraege(company_id, status, scheduled_date);
CREATE INDEX idx_auftraege_reminder ON public.auftraege(scheduled_date, team_reminder_sent) 
  WHERE status = 'geplant' AND team_leader_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.auftraege ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all auftraege"
ON public.auftraege FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin', 'moderator')
  )
);

CREATE POLICY "Companies can manage their auftraege"
ON public.auftraege FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = auftraege.company_id
    AND companies.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = auftraege.company_id
    AND companies.user_id = auth.uid()
  )
);

-- Auto-generate auftrag_nummer
CREATE OR REPLACE FUNCTION public.generate_auftrag_nummer()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_number INTEGER;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(auftrag_nummer FROM 6) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.auftraege
  WHERE company_id = NEW.company_id
  AND auftrag_nummer LIKE year_prefix || '-%';
  
  NEW.auftrag_nummer := year_prefix || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_auftrag_nummer
  BEFORE INSERT ON public.auftraege
  FOR EACH ROW
  WHEN (NEW.auftrag_nummer IS NULL OR NEW.auftrag_nummer = '')
  EXECUTE FUNCTION public.generate_auftrag_nummer();

-- Create handle_updated_at function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at
CREATE TRIGGER update_auftraege_updated_at
  BEFORE UPDATE ON public.auftraege
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to get auftraege needing reminders (for tomorrow)
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
    tm.name AS team_leader_name,
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

-- Grant permissions
GRANT ALL ON public.auftraege TO authenticated;

-- Comments
COMMENT ON TABLE public.auftraege IS 'Work orders/jobs created from accepted offers';
COMMENT ON COLUMN public.auftraege.team_leader_id IS 'Optional - can be assigned later before the job date';
COMMENT ON COLUMN public.auftraege.reminder_days_before IS 'How many days before scheduled_date to send team reminder (default: 1)';

