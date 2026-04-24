-- Temporary helper function to inspect storage policies
CREATE OR REPLACE FUNCTION public.check_storage_policies()
RETURNS TABLE(policyname text, cmd text, qual text, with_check text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT policyname::text, cmd::text, qual::text, with_check::text
  FROM pg_policies 
  WHERE tablename = 'objects' AND schemaname = 'storage'
  ORDER BY policyname;
$$;
GRANT EXECUTE ON FUNCTION public.check_storage_policies TO anon;
GRANT EXECUTE ON FUNCTION public.check_storage_policies TO authenticated;
