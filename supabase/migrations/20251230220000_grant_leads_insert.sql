-- Grant INSERT permission on leads table to anon role
-- This is required in addition to the RLS policy

-- Grant INSERT permission to anon and authenticated roles
GRANT INSERT ON public.leads TO anon;
GRANT INSERT ON public.leads TO authenticated;

-- Also grant usage on sequences if any
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;


