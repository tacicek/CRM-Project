-- =============================================
-- FIX SECURITY DEFINER VIEWS
-- These views were flagged by the Supabase linter as security risks
-- because they bypass RLS. We change them to SECURITY INVOKER.
-- =============================================

-- 1. Fix pending_box_pickups view
ALTER VIEW IF EXISTS public.pending_box_pickups SET (security_invoker = on);

-- 2. Fix appointment_summary view
ALTER VIEW IF EXISTS public.appointment_summary SET (security_invoker = on);

-- 3. Fix pending_team_reminders view
ALTER VIEW IF EXISTS public.pending_team_reminders SET (security_invoker = on);

-- 4. Fix offer_moving_details view
ALTER VIEW IF EXISTS public.offer_moving_details SET (security_invoker = on);

-- 5. Fix offer_details view
ALTER VIEW IF EXISTS public.offer_details SET (security_invoker = on);

-- Comments explaining the fix
COMMENT ON VIEW public.pending_box_pickups IS 'Pending box pickups view with SECURITY INVOKER - respects RLS policies';
COMMENT ON VIEW public.appointment_summary IS 'Appointment summary view with SECURITY INVOKER - respects RLS policies';
COMMENT ON VIEW public.pending_team_reminders IS 'Pending team reminders view with SECURITY INVOKER - respects RLS policies';
COMMENT ON VIEW public.offer_moving_details IS 'Offer moving details view with SECURITY INVOKER - respects RLS policies';
COMMENT ON VIEW public.offer_details IS 'Offer details view with SECURITY INVOKER - respects RLS policies';
