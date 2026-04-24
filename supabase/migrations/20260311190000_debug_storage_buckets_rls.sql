-- Check storage.buckets RLS and also test with a direct insert simulation
CREATE OR REPLACE FUNCTION public.debug_storage_full()
RETURNS TABLE(info_type text, info_name text, info_detail text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- storage.buckets policies
  SELECT 'bucket_policy'::text, p.policyname::text, 
    (p.cmd || ' | ' || p.permissive || ' | roles: ' || p.roles::text || ' | qual: ' || COALESCE(p.qual, 'null') || ' | check: ' || COALESCE(p.with_check, 'null'))::text
  FROM pg_policies p
  WHERE p.tablename = 'buckets' AND p.schemaname = 'storage'
  
  UNION ALL

  -- RLS enabled status
  SELECT 'rls_enabled'::text, c.relname::text, 
    CASE WHEN c.relrowsecurity THEN 'RLS ON' ELSE 'RLS OFF' END::text
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'storage' AND c.relname IN ('objects', 'buckets')
  
  UNION ALL

  -- Force enabled status  
  SELECT 'rls_forced'::text, c.relname::text,
    CASE WHEN c.relforcerowsecurity THEN 'FORCE ON' ELSE 'FORCE OFF' END::text
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'storage' AND c.relname IN ('objects', 'buckets')

  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.debug_storage_full TO anon;
