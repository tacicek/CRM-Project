-- =============================================================================
-- BESICHTIGUNG DATA RETENTION POLICY
-- =============================================================================
-- Photos/videos are deleted 3 days after the linked offer is sent.
-- Sessions without an offer are deleted after 30 days (default expiry).
-- This prevents storage bloat from accumulated photo uploads.
-- =============================================================================

-- 1) Add data_expires_at column (defaults to 30 days from creation)
ALTER TABLE besichtigung.sessions
  ADD COLUMN IF NOT EXISTS data_expires_at TIMESTAMPTZ;

-- Set default for existing rows
UPDATE besichtigung.sessions
SET data_expires_at = COALESCE(expires_at, created_at + INTERVAL '30 days')
WHERE data_expires_at IS NULL;

-- Set default for new rows
ALTER TABLE besichtigung.sessions
  ALTER COLUMN data_expires_at SET DEFAULT (NOW() + INTERVAL '30 days');

-- 2) Index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_besichtigung_sessions_data_expires
  ON besichtigung.sessions(data_expires_at)
  WHERE data_expires_at IS NOT NULL;

-- =============================================================================
-- RPC: Schedule cleanup when an offer is sent
-- =============================================================================
-- Called from send-offer Edge Function after email is sent successfully.
-- Sets data_expires_at = NOW() + 3 days for all besichtigung sessions
-- matching the company + lead combination.

CREATE OR REPLACE FUNCTION public.schedule_besichtigung_cleanup(
  p_company_id UUID,
  p_lead_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 3
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_cleanup_at TIMESTAMPTZ := NOW() + (p_days || ' days')::INTERVAL;
BEGIN
  -- Update sessions that match company + lead
  IF p_lead_id IS NOT NULL THEN
    UPDATE besichtigung.sessions
    SET data_expires_at = v_cleanup_at
    WHERE company_id = p_company_id
      AND lead_id = p_lead_id
      AND (data_expires_at IS NULL OR data_expires_at > v_cleanup_at);
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  -- Also update sessions matching company without lead_id (general cleanup)
  IF v_count = 0 THEN
    UPDATE besichtigung.sessions
    SET data_expires_at = v_cleanup_at
    WHERE company_id = p_company_id
      AND lead_id IS NULL
      AND status IN ('analyzed', 'completed', 'uploaded')
      AND (data_expires_at IS NULL OR data_expires_at > v_cleanup_at);
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN json_build_object(
    'updated', v_count,
    'cleanup_at', v_cleanup_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_besichtigung_cleanup TO authenticated, service_role;

-- =============================================================================
-- RPC: Perform actual cleanup (called by Edge Function cron)
-- =============================================================================
-- Returns list of storage paths to delete, then removes DB records.

CREATE OR REPLACE FUNCTION public.cleanup_expired_besichtigung_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_ids UUID[];
  v_storage_paths TEXT[];
  v_deleted_sessions INTEGER := 0;
  v_deleted_photos INTEGER := 0;
BEGIN
  -- Find expired sessions
  SELECT ARRAY_AGG(id) INTO v_expired_ids
  FROM besichtigung.sessions
  WHERE data_expires_at < NOW();

  IF v_expired_ids IS NULL OR array_length(v_expired_ids, 1) IS NULL THEN
    RETURN json_build_object(
      'deleted_sessions', 0,
      'deleted_photos', 0,
      'storage_paths', '[]'::json
    );
  END IF;

  -- Collect all storage paths BEFORE deleting (needed for storage cleanup)
  SELECT ARRAY_AGG(p.storage_path) INTO v_storage_paths
  FROM besichtigung.photos p
  WHERE p.session_id = ANY(v_expired_ids);

  -- Count photos
  SELECT COUNT(*) INTO v_deleted_photos
  FROM besichtigung.photos
  WHERE session_id = ANY(v_expired_ids);

  -- Delete sessions (CASCADE will handle photos, videos, ai_analysis)
  DELETE FROM besichtigung.sessions
  WHERE id = ANY(v_expired_ids);
  GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

  RETURN json_build_object(
    'deleted_sessions', v_deleted_sessions,
    'deleted_photos', v_deleted_photos,
    'storage_paths', COALESCE(to_json(v_storage_paths), '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_besichtigung_data() TO service_role;
