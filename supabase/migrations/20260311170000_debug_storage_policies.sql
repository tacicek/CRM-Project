-- Debug: show ALL policy details including permissive/restrictive flag
DROP FUNCTION IF EXISTS public.check_storage_policies();

CREATE OR REPLACE FUNCTION public.check_storage_policies()
RETURNS TABLE(
  policyname text,
  cmd text, 
  permissive text,
  roles text[],
  qual text, 
  with_check text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.policyname::text,
    p.cmd::text,
    p.permissive::text,
    p.roles::text[],
    p.qual::text,
    p.with_check::text
  FROM pg_policies p
  WHERE p.tablename = 'objects' AND p.schemaname = 'storage'
  ORDER BY p.policyname;
$$;

GRANT EXECUTE ON FUNCTION public.check_storage_policies TO anon;
GRANT EXECUTE ON FUNCTION public.check_storage_policies TO authenticated;
