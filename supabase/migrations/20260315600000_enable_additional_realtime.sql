-- =============================================================================
-- Enable Realtime for additional tables used by FirmaLayout subscriptions
-- =============================================================================
-- Without this, postgres_changes subscriptions on these tables return HTTP 400.
-- Uses DO block to safely skip tables already in the publication.

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['companies', 'lead_distributions', 'notifications', 'appointments'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END;
$$;

-- REPLICA IDENTITY FULL: required for filter-based subscriptions (id=eq.X)
-- and so that UPDATE/DELETE events carry old row data.
ALTER TABLE public.companies REPLICA IDENTITY FULL;
ALTER TABLE public.lead_distributions REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
