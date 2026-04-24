-- =============================================================================
-- PUBLIC VIEW: virtual_besichtigung_sessions
-- =============================================================================
-- PostgREST exposes only the 'public' schema.
-- This view makes besichtigung.sessions accessible via the Supabase client
-- (e.g. supabase.from('virtual_besichtigung_sessions').select(...))
-- =============================================================================

CREATE OR REPLACE VIEW public.virtual_besichtigung_sessions AS
SELECT
  id,
  token,
  company_id,
  lead_id,
  offer_id,
  customer_name,
  customer_email,
  customer_phone,
  from_address,
  from_plz,
  from_city,
  status,
  created_at,
  uploaded_at,
  analyzed_at,
  completed_at,
  expires_at,
  customer_notes,
  created_by,
  data_expires_at
FROM besichtigung.sessions;

-- Grant SELECT to authenticated users (RLS is handled by besichtigung schema)
GRANT SELECT ON public.virtual_besichtigung_sessions TO authenticated;
GRANT SELECT ON public.virtual_besichtigung_sessions TO service_role;
