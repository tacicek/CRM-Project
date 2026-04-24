-- =============================================================================
-- VIRTUAL BESICHTIGUNG FEATURE
-- =============================================================================
-- Allows customers to upload photos/videos of their apartments for AI analysis
-- Uses SEPARATE SCHEMA to avoid any impact on existing tables
-- =============================================================================

-- Create separate schema for isolation
CREATE SCHEMA IF NOT EXISTS besichtigung;

-- =============================================================================
-- SESSIONS TABLE
-- =============================================================================
-- Tracks each virtual inspection session (one per customer request)

CREATE TABLE besichtigung.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Unique access token for customer portal
  token TEXT UNIQUE NOT NULL,
  
  -- Multi-tenant references (soft FK - no cascade, references public schema)
  company_id UUID NOT NULL,
  lead_id UUID,
  offer_id UUID,
  
  -- Customer info (denormalized for public access without joins)
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Address info
  from_address TEXT,
  from_plz TEXT,
  from_city TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Link created, waiting for customer
    'uploading',    -- Customer started uploading
    'uploaded',     -- All uploads complete
    'analyzing',    -- AI analysis in progress
    'analyzed',     -- AI analysis complete
    'completed',    -- Reviewed by company
    'expired'       -- Link expired without completion
  )),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ,
  analyzed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Customer notes
  customer_notes TEXT,
  
  -- Metadata
  created_by UUID -- user who created the link
);

-- =============================================================================
-- PHOTOS TABLE
-- =============================================================================

CREATE TABLE besichtigung.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES besichtigung.sessions(id) ON DELETE CASCADE,
  
  -- Storage info
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  
  -- Room classification
  room_type TEXT CHECK (room_type IN (
    'wohnzimmer',
    'schlafzimmer', 
    'kueche',
    'badezimmer',
    'kinderzimmer',
    'buero',
    'keller',
    'estrich',
    'garage',
    'balkon',
    'flur',
    'abstellraum',
    'sonstiges'
  )),
  
  -- AI analysis results (per photo)
  ai_labels JSONB DEFAULT '[]'::jsonb,
  ai_items JSONB DEFAULT '[]'::jsonb, -- detected furniture/items
  ai_processed BOOLEAN DEFAULT false,
  ai_processed_at TIMESTAMPTZ,
  
  -- Timestamps
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- VIDEOS TABLE
-- =============================================================================

CREATE TABLE besichtigung.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES besichtigung.sessions(id) ON DELETE CASCADE,
  
  -- Storage info
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT,
  duration_seconds INTEGER,
  thumbnail_path TEXT,
  
  -- Timestamps
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- AI ANALYSIS TABLE
-- =============================================================================
-- Stores the consolidated AI analysis for a session

CREATE TABLE besichtigung.ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES besichtigung.sessions(id) ON DELETE CASCADE,
  
  -- Volume estimation
  estimated_volume_m3 DECIMAL(10,2),
  estimated_time_hours DECIMAL(10,2),
  recommended_workers INTEGER,
  recommended_truck TEXT, -- 'transporter', '3.5t', '7.5t', '18t'
  
  -- Room-by-room breakdown
  room_breakdown JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"room": "wohnzimmer", "volume_m3": 8.5, "items": ["Sofa 3-Sitzer", "Couchtisch", "TV-Möbel"]}]
  
  -- Detected items summary
  detected_items JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"name": "Sofa 3-Sitzer", "count": 1, "volume_m3": 2.5, "special": false}]
  
  -- Special items requiring extra care
  special_items TEXT[] DEFAULT '{}',
  -- Example: ['Klavier', 'Aquarium', 'Tresor']
  
  -- Special requirements
  special_requirements TEXT[] DEFAULT '{}',
  -- Example: ['Möbellift erforderlich', 'Demontage notwendig']
  
  -- Access difficulty assessment
  from_access_difficulty TEXT CHECK (from_access_difficulty IN ('einfach', 'mittel', 'schwierig')),
  from_floor INTEGER,
  from_has_lift BOOLEAN,
  from_parking_distance TEXT, -- 'direkt', 'nah', 'weit'
  
  -- AI confidence score (0.00 to 1.00)
  confidence DECIMAL(3,2),
  
  -- Raw AI response (for debugging)
  raw_response JSONB,
  
  -- Timestamps
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_besichtigung_sessions_company ON besichtigung.sessions(company_id);
CREATE INDEX idx_besichtigung_sessions_token ON besichtigung.sessions(token);
CREATE INDEX idx_besichtigung_sessions_status ON besichtigung.sessions(status);
CREATE INDEX idx_besichtigung_sessions_lead ON besichtigung.sessions(lead_id);
CREATE INDEX idx_besichtigung_sessions_offer ON besichtigung.sessions(offer_id);
CREATE INDEX idx_besichtigung_photos_session ON besichtigung.photos(session_id);
CREATE INDEX idx_besichtigung_videos_session ON besichtigung.videos(session_id);
CREATE INDEX idx_besichtigung_analysis_session ON besichtigung.ai_analysis(session_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE besichtigung.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE besichtigung.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE besichtigung.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE besichtigung.ai_analysis ENABLE ROW LEVEL SECURITY;

-- Sessions: Company users can access their sessions
CREATE POLICY "Company users can access own sessions"
ON besichtigung.sessions
FOR ALL
USING (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid() 
    OR id IN (
      SELECT company_id FROM public.team_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

-- Photos: Access through session relationship
CREATE POLICY "Access photos through session"
ON besichtigung.photos
FOR ALL
USING (
  session_id IN (
    SELECT id FROM besichtigung.sessions
    WHERE company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = auth.uid() 
      OR id IN (
        SELECT company_id FROM public.team_members 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);

-- Videos: Access through session relationship
CREATE POLICY "Access videos through session"
ON besichtigung.videos
FOR ALL
USING (
  session_id IN (
    SELECT id FROM besichtigung.sessions
    WHERE company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = auth.uid() 
      OR id IN (
        SELECT company_id FROM public.team_members 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);

-- Analysis: Access through session relationship
CREATE POLICY "Access analysis through session"
ON besichtigung.ai_analysis
FOR ALL
USING (
  session_id IN (
    SELECT id FROM besichtigung.sessions
    WHERE company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = auth.uid() 
      OR id IN (
        SELECT company_id FROM public.team_members 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);

-- =============================================================================
-- SERVICE ROLE POLICIES (for Edge Functions)
-- =============================================================================

-- Allow service role full access (for token-based public uploads)
CREATE POLICY "Service role full access sessions"
ON besichtigung.sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access photos"
ON besichtigung.photos
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access videos"
ON besichtigung.videos
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access analysis"
ON besichtigung.ai_analysis
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'besichtigung-uploads',
  'besichtigung-uploads',
  false,
  52428800, -- 50MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: Company users can manage their uploads
CREATE POLICY "Company users can upload to besichtigung"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'besichtigung-uploads'
  AND (storage.foldername(name))[1] IN (
    SELECT token FROM besichtigung.sessions
    WHERE company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = auth.uid() 
      OR id IN (
        SELECT company_id FROM public.team_members 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);

CREATE POLICY "Company users can read besichtigung uploads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'besichtigung-uploads'
  AND (storage.foldername(name))[1] IN (
    SELECT token FROM besichtigung.sessions
    WHERE company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = auth.uid() 
      OR id IN (
        SELECT company_id FROM public.team_members 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);

CREATE POLICY "Company users can delete besichtigung uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'besichtigung-uploads'
  AND (storage.foldername(name))[1] IN (
    SELECT token FROM besichtigung.sessions
    WHERE company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = auth.uid() 
      OR id IN (
        SELECT company_id FROM public.team_members 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);

-- Service role storage access (for public uploads via Edge Functions)
CREATE POLICY "Service role besichtigung storage access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'besichtigung-uploads')
WITH CHECK (bucket_id = 'besichtigung-uploads');

-- =============================================================================
-- HELPER FUNCTION: Generate secure token
-- =============================================================================

CREATE OR REPLACE FUNCTION besichtigung.generate_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = besichtigung, public
AS $$
BEGIN
  -- Generate a URL-safe random token (32 characters)
  RETURN encode(gen_random_bytes(24), 'base64')
    -- Make URL-safe
    ||> replace('+', '-')
    ||> replace('/', '_')
    ||> replace('=', '');
END;
$$;

-- =============================================================================
-- HELPER FUNCTION: Create new session
-- =============================================================================

CREATE OR REPLACE FUNCTION besichtigung.create_session(
  p_company_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL,
  p_offer_id UUID DEFAULT NULL,
  p_from_address TEXT DEFAULT NULL,
  p_from_plz TEXT DEFAULT NULL,
  p_from_city TEXT DEFAULT NULL,
  p_expires_days INTEGER DEFAULT 30,
  p_created_by UUID DEFAULT NULL
)
RETURNS besichtigung.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = besichtigung, public
AS $$
DECLARE
  v_token TEXT;
  v_session besichtigung.sessions;
BEGIN
  -- Generate unique token
  v_token := besichtigung.generate_token();
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM besichtigung.sessions WHERE token = v_token) LOOP
    v_token := besichtigung.generate_token();
  END LOOP;
  
  -- Create session
  INSERT INTO besichtigung.sessions (
    token,
    company_id,
    lead_id,
    offer_id,
    customer_name,
    customer_email,
    customer_phone,
    from_address,
    from_plz,
    from_city,
    expires_at,
    created_by
  ) VALUES (
    v_token,
    p_company_id,
    p_lead_id,
    p_offer_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_from_address,
    p_from_plz,
    p_from_city,
    NOW() + (p_expires_days || ' days')::INTERVAL,
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING * INTO v_session;
  
  RETURN v_session;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION besichtigung.create_session TO authenticated;
GRANT EXECUTE ON FUNCTION besichtigung.generate_token TO authenticated;

-- =============================================================================
-- DONE
-- =============================================================================
-- This migration creates:
-- 1. besichtigung schema (isolated from public)
-- 2. sessions table (tracks each virtual inspection)
-- 3. photos table (uploaded images)
-- 4. videos table (uploaded videos)
-- 5. ai_analysis table (AI results)
-- 6. RLS policies for multi-tenant security
-- 7. Storage bucket for uploads
-- 8. Helper functions for token generation
-- =============================================================================
