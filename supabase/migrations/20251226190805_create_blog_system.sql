-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Blog categories table
CREATE TABLE public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog posts table
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  meta_description TEXT,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image_url TEXT,
  
  -- SEO fields
  focus_keyword VARCHAR(100),
  seo_title VARCHAR(60),
  seo_description VARCHAR(160),
  canonical_url TEXT,
  
  -- Category & Tags
  category_id UUID REFERENCES public.blog_categories(id),
  category_name VARCHAR(100), -- for easier display or if category_id is null
  tags TEXT[] DEFAULT '{}', -- Swiss cities, services, tips, etc.
  
  -- Targeting
  target_city VARCHAR(100), -- Zürich, Bern, Basel, etc.
  target_canton VARCHAR(50), -- ZH, BE, BS, etc.
  target_service VARCHAR(100), -- moving, cleaning, etc.
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, published, scheduled
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  
  -- Author
  author_id UUID REFERENCES auth.users(id),
  author_name VARCHAR(100) DEFAULT 'Offerio Team',
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  
  -- AI Generation metadata
  generated_by_ai BOOLEAN DEFAULT false,
  ai_model_used VARCHAR(50),
  generation_prompt TEXT,
  faq_schema JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO metadata tracking
CREATE TABLE public.blog_seo_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  average_position DECIMAL(5,2),
  ctr DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, date)
);

-- Enable RLS
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_seo_performance ENABLE ROW LEVEL SECURITY;

-- Policies for public access (view only published posts)
CREATE POLICY "Public can view published blog posts" ON public.blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public can view blog categories" ON public.blog_categories
  FOR SELECT USING (true);

-- Policies for admin access (full access using has_role function)
CREATE POLICY "Admins have full access to blog_posts" ON public.blog_posts
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins have full access to blog_categories" ON public.blog_categories
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins have full access to blog_seo_performance" ON public.blog_seo_performance
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Function to increment view count
CREATE OR REPLACE FUNCTION public.increment_blog_view_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.blog_posts
  SET view_count = view_count + 1,
      last_viewed_at = NOW()
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert initial categories
INSERT INTO public.blog_categories (name, slug, description, icon, color) VALUES
('Umzug', 'umzug', 'Tipps und Guides für Ihren Umzug in der Schweiz', 'Truck', 'blue'),
('Reinigung', 'reinigung', 'Alles rund um die Umzugs- und Endreinigung', 'Sparkles', 'green'),
('Entrümpelung', 'entruempelung', 'Wohnungsräumung und fachgerechte Entsorgung', 'Trash2', 'orange'),
('Tipps & Tricks', 'tipps-tricks', 'Nützliche Informationen für Mieter ve Vermieter', 'Lightbulb', 'yellow');
