-- ROOT CAUSE FIX (final): Besichtigung storage policies reference
-- besichtigung.sessions in a subquery. Even after granting SELECT on the
-- table, RLS on besichtigung.sessions blocks row visibility for the
-- authenticated role, causing the subquery to throw a permission error
-- that propagates and fails ALL storage.objects INSERT operations.
--
-- Fix: Wrap the access check in a SECURITY DEFINER function so the
-- subquery always executes with superuser-level access, bypassing
-- both GRANT checks and RLS on besichtigung.sessions.
-- The function still respects auth.uid() to ensure user-level security.

CREATE OR REPLACE FUNCTION public.check_besichtigung_storage_access(folder_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, besichtigung
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM besichtigung.sessions s
    WHERE s.token = folder_token
      AND s.company_id IN (
        SELECT c.id
        FROM public.companies c
        WHERE c.user_id = auth.uid()
        UNION
        SELECT tm.company_id
        FROM public.team_members tm
        WHERE tm.user_id = auth.uid()
          AND s.status = 'active'
      )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_besichtigung_storage_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_besichtigung_storage_access TO anon;

-- Recreate all besichtigung storage policies to use the function
DROP POLICY IF EXISTS "Company users can upload to besichtigung" ON storage.objects;
DROP POLICY IF EXISTS "Company users can read besichtigung uploads" ON storage.objects;
DROP POLICY IF EXISTS "Company users can delete besichtigung uploads" ON storage.objects;

CREATE POLICY "Company users can upload to besichtigung"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'besichtigung-uploads'
  AND public.check_besichtigung_storage_access((storage.foldername(name))[1])
);

CREATE POLICY "Company users can read besichtigung uploads"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'besichtigung-uploads'
  AND public.check_besichtigung_storage_access((storage.foldername(name))[1])
);

CREATE POLICY "Company users can delete besichtigung uploads"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'besichtigung-uploads'
  AND public.check_besichtigung_storage_access((storage.foldername(name))[1])
);
