-- =============================================================================
-- FIX SUPPORT TICKETS RLS FOR ADMINS
-- Use security definer functions for better performance
-- =============================================================================

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_support_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'moderator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create helper function to get user's company IDs
CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT id FROM public.companies 
  WHERE user_id = auth.uid() 
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_support_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_ids() TO authenticated;

-- Drop existing policies
DROP POLICY IF EXISTS "Companies can view their tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Companies can create tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Companies can update their tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Companies can view ticket messages" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "Companies can create ticket messages" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "Admins can manage all ticket messages" ON public.support_ticket_messages;

-- Recreate policies for support_tickets using helper functions

-- Companies can view their own tickets
CREATE POLICY "Companies can view their tickets" ON public.support_tickets
  FOR SELECT USING (
    company_id IN (SELECT public.get_user_company_ids())
    OR public.is_support_admin()
  );

-- Companies can insert tickets for their company
CREATE POLICY "Companies can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (
    company_id IN (SELECT public.get_user_company_ids())
    OR public.is_support_admin()
  );

-- Companies/Admins can update tickets
CREATE POLICY "Can update tickets" ON public.support_tickets
  FOR UPDATE USING (
    company_id IN (SELECT public.get_user_company_ids())
    OR public.is_support_admin()
  );

-- Admins can delete tickets
CREATE POLICY "Admins can delete tickets" ON public.support_tickets
  FOR DELETE USING (
    public.is_support_admin()
  );

-- Recreate policies for support_ticket_messages

-- View messages (companies see non-internal, admins see all)
CREATE POLICY "Can view ticket messages" ON public.support_ticket_messages
  FOR SELECT USING (
    (
      -- Companies can see non-internal messages on their tickets
      is_internal = FALSE
      AND ticket_id IN (
        SELECT id FROM public.support_tickets 
        WHERE company_id IN (SELECT public.get_user_company_ids())
      )
    )
    OR public.is_support_admin()
  );

-- Create messages
CREATE POLICY "Can create ticket messages" ON public.support_ticket_messages
  FOR INSERT WITH CHECK (
    (
      -- Companies can create messages on their tickets
      sender_type = 'company'
      AND ticket_id IN (
        SELECT id FROM public.support_tickets 
        WHERE company_id IN (SELECT public.get_user_company_ids())
      )
    )
    OR public.is_support_admin()
  );

-- Update messages (admins only)
CREATE POLICY "Admins can update messages" ON public.support_ticket_messages
  FOR UPDATE USING (
    public.is_support_admin()
  );

-- Delete messages (admins only)
CREATE POLICY "Admins can delete messages" ON public.support_ticket_messages
  FOR DELETE USING (
    public.is_support_admin()
  );

