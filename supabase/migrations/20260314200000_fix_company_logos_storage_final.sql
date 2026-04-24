-- FINAL FIX: company-logos storage RLS
-- Error: "new row violates row-level security policy" on INSERT
-- Despite INSERT policy existing with WITH CHECK (bucket_id = 'company-logos').
-- Fix: Use an ALL policy to cover INSERT, UPDATE, DELETE in one go.

-- 1. Drop ALL existing company-logos policies on storage.objects
DROP POLICY IF EXISTS "Users can upload their company logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their company logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company logo" ON storage.objects;
DROP POLICY IF EXISTS "Company logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Company logos: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Company logos: public read" ON storage.objects;
DROP POLICY IF EXISTS "Company logos: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Company logos: owner delete" ON storage.objects;

-- 2. Single ALL policy for authenticated users (covers INSERT, SELECT, UPDATE, DELETE)
CREATE POLICY "Authenticated users manage company logos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'company-logos')
WITH CHECK (bucket_id = 'company-logos');

-- 3. Public SELECT for viewing logos (bucket is public anyway)
CREATE POLICY "Public can view company logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');
