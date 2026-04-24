-- Fix VARCHAR limits for blog_posts table to allow longer content

-- Increase seo_description limit from 160 to TEXT
ALTER TABLE public.blog_posts 
ALTER COLUMN seo_description TYPE TEXT;

-- Increase seo_title limit from 60 to 255
ALTER TABLE public.blog_posts 
ALTER COLUMN seo_title TYPE VARCHAR(255);

-- Increase meta_description to TEXT (was limited before)
ALTER TABLE public.blog_posts 
ALTER COLUMN meta_description TYPE TEXT;

-- Increase focus_keyword limit
ALTER TABLE public.blog_posts 
ALTER COLUMN focus_keyword TYPE VARCHAR(255);

