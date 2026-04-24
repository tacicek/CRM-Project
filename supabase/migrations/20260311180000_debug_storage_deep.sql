-- Deep debug: check triggers, constraints and columns on storage.objects
CREATE OR REPLACE FUNCTION public.debug_storage_objects()
RETURNS TABLE(info_type text, info_name text, info_detail text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Triggers
  SELECT 'trigger'::text, tgname::text, 
    pg_get_triggerdef(t.oid)::text
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'storage' AND c.relname = 'objects'
  
  UNION ALL
  
  -- Check constraints
  SELECT 'constraint'::text, conname::text, 
    pg_get_constraintdef(c.oid)::text
  FROM pg_constraint c
  JOIN pg_class cl ON c.conrelid = cl.oid
  JOIN pg_namespace n ON cl.relnamespace = n.oid
  WHERE n.nspname = 'storage' AND cl.relname = 'objects'
  AND c.contype = 'c'
  
  UNION ALL
  
  -- Columns
  SELECT 'column'::text, column_name::text, 
    (data_type || ' ' || COALESCE(column_default, 'no default'))::text
  FROM information_schema.columns
  WHERE table_schema = 'storage' AND table_name = 'objects'
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.debug_storage_objects TO anon;
