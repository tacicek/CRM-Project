-- =============================================================================
-- SUPPORT TICKET SYSTEM
-- Allows companies to send messages to admin support
-- =============================================================================

-- Create ticket status enum
DO $$ BEGIN
  CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'answered', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create ticket priority enum
DO $$ BEGIN
  CREATE TYPE support_ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create ticket category enum
DO $$ BEGIN
  CREATE TYPE support_ticket_category AS ENUM ('technical', 'billing', 'feature_request', 'bug_report', 'general', 'account');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create support tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Ticket info
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  category support_ticket_category DEFAULT 'general',
  priority support_ticket_priority DEFAULT 'medium',
  status support_ticket_status DEFAULT 'open',
  
  -- Contact info (from company)
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  
  -- Metadata
  browser_info TEXT,
  page_url TEXT
);

-- Create ticket messages table (for thread/replies)
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('company', 'admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_internal BOOLEAN DEFAULT FALSE -- For admin-only notes
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_company_id ON public.support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets

-- Companies can view and create their own tickets
CREATE POLICY "Companies can view their tickets" ON public.support_tickets
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Companies can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Admins can manage all tickets
CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- RLS Policies for support_ticket_messages

-- Companies can view messages on their tickets
CREATE POLICY "Companies can view ticket messages" ON public.support_ticket_messages
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM public.support_tickets 
      WHERE company_id IN (
        SELECT id FROM public.companies WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
    AND is_internal = FALSE
  );

-- Companies can create messages on their tickets
CREATE POLICY "Companies can create ticket messages" ON public.support_ticket_messages
  FOR INSERT WITH CHECK (
    ticket_id IN (
      SELECT id FROM public.support_tickets 
      WHERE company_id IN (
        SELECT id FROM public.companies WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
    AND sender_type = 'company'
  );

-- Admins can manage all messages
CREATE POLICY "Admins can manage all ticket messages" ON public.support_ticket_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Function to update ticket timestamp
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.support_tickets
  SET updated_at = NOW()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update ticket on new message
DROP TRIGGER IF EXISTS update_ticket_on_message ON public.support_ticket_messages;
CREATE TRIGGER update_ticket_on_message
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_timestamp();

-- Comments
COMMENT ON TABLE public.support_tickets IS 'Support tickets from companies to admin';
COMMENT ON TABLE public.support_ticket_messages IS 'Messages/replies in support tickets';

