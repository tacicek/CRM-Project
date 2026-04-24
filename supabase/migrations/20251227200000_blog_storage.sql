-- Create storage bucket for blog content
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-content', 'blog-content', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated admins to manage blog content
CREATE POLICY "Admins can manage blog content"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'blog-content' AND
  public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'blog-content' AND
  public.has_role(auth.uid(), 'admin')
);

-- Allow public read access to blog content
CREATE POLICY "Blog content is publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'blog-content');

