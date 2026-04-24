-- =============================================================================
-- FIX SUPPORT TICKETS RLS POLICIES
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Companies can view their tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Companies can create tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Companies can view ticket messages" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "Companies can create ticket messages" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "Admins can manage all ticket messages" ON public.support_ticket_messages;

-- Recreate policies for support_tickets

-- Companies can view their own tickets
CREATE POLICY "Companies can view their tickets" ON public.support_tickets
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = auth.uid() 
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Companies can insert tickets for their company
CREATE POLICY "Companies can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = auth.uid() 
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Companies can update their own tickets (for status changes by replies)
CREATE POLICY "Companies can update their tickets" ON public.support_tickets
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = auth.uid() 
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Admins can do everything with tickets
CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Recreate policies for support_ticket_messages

-- Companies can view messages on their tickets (excluding internal notes)
CREATE POLICY "Companies can view ticket messages" ON public.support_ticket_messages
  FOR SELECT USING (
    is_internal = FALSE
    AND ticket_id IN (
      SELECT id FROM public.support_tickets 
      WHERE company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = auth.uid() 
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Companies can create messages on their tickets
CREATE POLICY "Companies can create ticket messages" ON public.support_ticket_messages
  FOR INSERT WITH CHECK (
    sender_type = 'company'
    AND ticket_id IN (
      SELECT id FROM public.support_tickets 
      WHERE company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = auth.uid() 
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- Admins can do everything with messages
CREATE POLICY "Admins can manage all ticket messages" ON public.support_ticket_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

