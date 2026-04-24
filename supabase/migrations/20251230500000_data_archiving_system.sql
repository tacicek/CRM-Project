-- =============================================================================
-- DATA ARCHIVING SYSTEM
-- Automatische Archivierung von alten Daten zur Kostenoptimierung
-- =============================================================================

-- Archive Settings Table
CREATE TABLE IF NOT EXISTS public.archive_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- General settings
  is_enabled BOOLEAN DEFAULT true,
  auto_archive_day INTEGER DEFAULT 1 CHECK (auto_archive_day BETWEEN 1 AND 28),
  
  -- Retention periods (in days)
  leads_retention_days INTEGER DEFAULT 90,
  offers_retention_days INTEGER DEFAULT 90,
  email_logs_retention_days INTEGER DEFAULT 90,
  notifications_retention_days INTEGER DEFAULT 30,
  analytics_retention_days INTEGER DEFAULT 180,
  appointments_retention_days INTEGER DEFAULT 90,
  
  -- Export settings
  default_export_format TEXT DEFAULT 'json' CHECK (default_export_format IN ('json', 'csv')),
  compress_archives BOOLEAN DEFAULT true,
  
  -- Cloud storage settings
  google_drive_enabled BOOLEAN DEFAULT false,
  google_drive_folder_id TEXT,
  dropbox_enabled BOOLEAN DEFAULT false,
  dropbox_folder_path TEXT,
  s3_enabled BOOLEAN DEFAULT false,
  s3_bucket_name TEXT,
  s3_region TEXT,
  
  -- Notification settings
  notify_on_archive BOOLEAN DEFAULT true,
  notify_email TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Archive Logs Table
CREATE TABLE IF NOT EXISTS public.archive_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Archive info
  archive_name TEXT NOT NULL,
  archive_type TEXT NOT NULL CHECK (archive_type IN ('leads', 'offers', 'email_logs', 'notifications', 'analytics', 'appointments', 'full_backup', 'custom')),
  
  -- Statistics
  records_archived INTEGER DEFAULT 0,
  file_size_bytes BIGINT DEFAULT 0,
  compression_ratio DECIMAL(5,2),
  
  -- Date range
  data_from_date TIMESTAMPTZ,
  data_to_date TIMESTAMPTZ,
  
  -- Storage location
  storage_type TEXT NOT NULL CHECK (storage_type IN ('local', 'google_drive', 'dropbox', 's3', 'supabase_storage')),
  storage_path TEXT,
  storage_url TEXT,
  
  -- Export format
  export_format TEXT DEFAULT 'json' CHECK (export_format IN ('json', 'csv', 'parquet')),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'restored')),
  error_message TEXT,
  
  -- Trigger info
  triggered_by TEXT DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'auto', 'scheduled')),
  triggered_by_user_id UUID REFERENCES auth.users(id),
  
  -- Data deleted from DB?
  source_data_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  
  -- Restore info
  is_restorable BOOLEAN DEFAULT true,
  restored_at TIMESTAMPTZ,
  restored_by_user_id UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Archive Data Snapshots (for storing actual archived data in Supabase if needed)
CREATE TABLE IF NOT EXISTS public.archive_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_log_id UUID REFERENCES public.archive_logs(id) ON DELETE CASCADE,
  
  -- Data chunk info (for large datasets)
  chunk_number INTEGER DEFAULT 1,
  total_chunks INTEGER DEFAULT 1,
  
  -- Archived data (JSONB for flexibility)
  data JSONB NOT NULL,
  record_count INTEGER DEFAULT 0,
  
  -- Checksum for integrity
  checksum TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_archive_logs_type ON public.archive_logs(archive_type);
CREATE INDEX IF NOT EXISTS idx_archive_logs_status ON public.archive_logs(status);
CREATE INDEX IF NOT EXISTS idx_archive_logs_created ON public.archive_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_snapshots_log ON public.archive_snapshots(archive_log_id);

-- Insert default settings
INSERT INTO public.archive_settings (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get archivable leads
CREATE OR REPLACE FUNCTION get_archivable_leads(retention_days INTEGER DEFAULT 90)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  status TEXT,
  service_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.created_at, l.status, l.service_type
  FROM public.leads l
  WHERE l.created_at < (now() - (retention_days || ' days')::INTERVAL)
    AND l.status IN ('completed', 'cancelled', 'expired', 'rejected')
  ORDER BY l.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get archivable offers
CREATE OR REPLACE FUNCTION get_archivable_offers(retention_days INTEGER DEFAULT 90)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.created_at, o.status
  FROM public.offers o
  WHERE o.created_at < (now() - (retention_days || ' days')::INTERVAL)
    AND o.status IN ('sent', 'accepted', 'rejected', 'expired')
  ORDER BY o.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get archive statistics
CREATE OR REPLACE FUNCTION get_archive_statistics()
RETURNS TABLE (
  table_name TEXT,
  total_records BIGINT,
  archivable_records BIGINT,
  oldest_record_date TIMESTAMPTZ,
  estimated_size_mb DECIMAL
) AS $$
BEGIN
  -- Leads
  RETURN QUERY
  SELECT 
    'leads'::TEXT,
    (SELECT COUNT(*) FROM public.leads)::BIGINT,
    (SELECT COUNT(*) FROM public.leads WHERE created_at < (now() - '90 days'::INTERVAL) AND status IN ('completed', 'cancelled', 'expired', 'rejected'))::BIGINT,
    (SELECT MIN(created_at) FROM public.leads),
    (SELECT pg_total_relation_size('public.leads') / 1024.0 / 1024.0);
    
  -- Offers
  RETURN QUERY
  SELECT 
    'offers'::TEXT,
    (SELECT COUNT(*) FROM public.offers)::BIGINT,
    (SELECT COUNT(*) FROM public.offers WHERE created_at < (now() - '90 days'::INTERVAL) AND status IN ('sent', 'accepted', 'rejected', 'expired'))::BIGINT,
    (SELECT MIN(created_at) FROM public.offers),
    (SELECT pg_total_relation_size('public.offers') / 1024.0 / 1024.0);
    
  -- Email Logs
  RETURN QUERY
  SELECT 
    'email_logs'::TEXT,
    (SELECT COUNT(*) FROM public.email_logs)::BIGINT,
    (SELECT COUNT(*) FROM public.email_logs WHERE created_at < (now() - '90 days'::INTERVAL))::BIGINT,
    (SELECT MIN(created_at) FROM public.email_logs),
    (SELECT pg_total_relation_size('public.email_logs') / 1024.0 / 1024.0);
    
  -- Notifications
  RETURN QUERY
  SELECT 
    'notifications'::TEXT,
    (SELECT COUNT(*) FROM public.notifications)::BIGINT,
    (SELECT COUNT(*) FROM public.notifications WHERE created_at < (now() - '30 days'::INTERVAL) AND read = true)::BIGINT,
    (SELECT MIN(created_at) FROM public.notifications),
    (SELECT pg_total_relation_size('public.notifications') / 1024.0 / 1024.0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create archive log entry
CREATE OR REPLACE FUNCTION create_archive_log(
  p_archive_name TEXT,
  p_archive_type TEXT,
  p_records_count INTEGER,
  p_storage_type TEXT,
  p_storage_path TEXT,
  p_export_format TEXT DEFAULT 'json',
  p_triggered_by TEXT DEFAULT 'manual',
  p_user_id UUID DEFAULT NULL,
  p_data_from TIMESTAMPTZ DEFAULT NULL,
  p_data_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.archive_logs (
    archive_name,
    archive_type,
    records_archived,
    storage_type,
    storage_path,
    export_format,
    triggered_by,
    triggered_by_user_id,
    data_from_date,
    data_to_date,
    status
  ) VALUES (
    p_archive_name,
    p_archive_type,
    p_records_count,
    p_storage_type,
    p_storage_path,
    p_export_format,
    p_triggered_by,
    p_user_id,
    p_data_from,
    p_data_to,
    'completed'
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.archive_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_snapshots ENABLE ROW LEVEL SECURITY;

-- Only admins can manage archives
CREATE POLICY "Admins can manage archive settings"
  ON public.archive_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Admins can view archive logs"
  ON public.archive_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Admins can create archive logs"
  ON public.archive_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Admins can update archive logs"
  ON public.archive_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Admins can manage archive snapshots"
  ON public.archive_snapshots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_archivable_leads TO authenticated;
GRANT EXECUTE ON FUNCTION get_archivable_offers TO authenticated;
GRANT EXECUTE ON FUNCTION get_archive_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION create_archive_log TO authenticated;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_archive_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_archive_settings_timestamp
  BEFORE UPDATE ON public.archive_settings
  FOR EACH ROW EXECUTE FUNCTION update_archive_timestamp();

CREATE TRIGGER update_archive_logs_timestamp
  BEFORE UPDATE ON public.archive_logs
  FOR EACH ROW EXECUTE FUNCTION update_archive_timestamp();

