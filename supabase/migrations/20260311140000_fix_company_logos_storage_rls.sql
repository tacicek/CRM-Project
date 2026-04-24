-- Fix: company-logos storage bucket RLS policies
-- Bucket exists but INSERT policy may not be applied in production

-- Ensure bucket is public
UPDATE storage.buckets SET public = true WHERE id = 'company-logos';

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their company logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their company logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company logo" ON storage.objects;
DROP POLICY IF EXISTS "Company logos are publicly accessible" ON storage.objects;

-- INSERT: authenticated users can upload to their own folder (auth.uid() = first folder)
CREATE POLICY "Users can upload their company logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: authenticated users can update their own logo
CREATE POLICY "Users can update their company logo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: authenticated users can delete their own logo
CREATE POLICY "Users can delete their company logo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: public read access
CREATE POLICY "Company logos are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');
