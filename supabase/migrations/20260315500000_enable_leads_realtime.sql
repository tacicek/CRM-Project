-- =============================================================================
-- Enable Realtime for leads table
-- =============================================================================
-- Without this, Supabase postgres_changes subscriptions on the leads table
-- will not fire and the admin LeadVerification page will not update live.

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- Also enable REPLICA IDENTITY FULL so that UPDATE and DELETE events
-- include the old row values (needed for correct diffing).
ALTER TABLE public.leads REPLICA IDENTITY FULL;
