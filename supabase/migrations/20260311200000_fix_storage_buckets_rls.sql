-- ROOT CAUSE FIX: storage.buckets has RLS ON but ZERO policies
-- Supabase storage API needs to read bucket config before upload
-- Without SELECT access to buckets, all uploads fail

-- Allow all users to see public bucket metadata
CREATE POLICY "Public buckets are visible to everyone"
ON storage.buckets
FOR SELECT
TO public
USING (public = true);

-- Allow authenticated users to see all buckets they might upload to
CREATE POLICY "Authenticated users can view all buckets"
ON storage.buckets
FOR SELECT
TO authenticated
USING (true);
