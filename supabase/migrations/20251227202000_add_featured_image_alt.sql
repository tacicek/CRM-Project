-- Add featured_image_alt column to blog_posts table
ALTER TABLE public.blog_posts 
ADD COLUMN IF NOT EXISTS featured_image_alt TEXT;

-- Also ensure gallery_images column exists as JSONB
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'blog_posts' 
        AND column_name = 'gallery_images'
    ) THEN
        ALTER TABLE public.blog_posts ADD COLUMN gallery_images JSONB DEFAULT '[]';
    END IF;
END $$;

-- Ensure faq_schema column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'blog_posts' 
        AND column_name = 'faq_schema'
    ) THEN
        ALTER TABLE public.blog_posts ADD COLUMN faq_schema JSONB;
    END IF;
END $$;

