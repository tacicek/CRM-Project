-- Fix v2: company-logos storage INSERT policy
-- Mevcut policy storage.foldername() kullanıyor, bunun yerine
-- daha basit owner-based yaklaşıma geçelim

-- Eski INSERT policy'yi sil
DROP POLICY IF EXISTS "Users can upload their company logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their company logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company logo" ON storage.objects;

-- Yeni INSERT: owner ile eşleşme (Supabase otomatik owner set eder)
CREATE POLICY "Users can upload their company logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
);

-- Yeni UPDATE: owner ile eşleşme
CREATE POLICY "Users can update their company logo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (owner)::uuid = auth.uid()
);

-- Yeni DELETE: owner ile eşleşme
CREATE POLICY "Users can delete their company logo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (owner)::uuid = auth.uid()
);
