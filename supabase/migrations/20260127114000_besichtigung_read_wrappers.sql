-- =============================================================================
-- PUBLIC WRAPPERS FOR READING BESICHTIGUNG DATA
-- =============================================================================
-- PostgREST only exposes 'public' schema.
-- These wrapper functions allow Edge Functions to read besichtigung data via RPC.
-- =============================================================================

-- Get session by token (for public customer access)
CREATE OR REPLACE FUNCTION public.get_besichtigung_session_by_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id', s.id,
    'status', s.status,
    'customer_name', s.customer_name,
    'from_address', s.from_address,
    'from_plz', s.from_plz,
    'from_city', s.from_city,
    'expires_at', s.expires_at,
    'company_id', s.company_id,
    'customer_notes', s.customer_notes
  ) INTO v_result
  FROM besichtigung.sessions s
  WHERE s.token = p_token;

  RETURN v_result;
END;
$$;

-- Get photos for a session
CREATE OR REPLACE FUNCTION public.get_besichtigung_photos(p_session_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', p.id,
      'room_type', p.room_type,
      'filename', p.filename,
      'storage_path', p.storage_path,
      'uploaded_at', p.uploaded_at
    ) ORDER BY p.uploaded_at ASC
  ), '[]'::json) INTO v_result
  FROM besichtigung.photos p
  WHERE p.session_id = p_session_id;

  RETURN v_result;
END;
$$;

-- Get videos for a session
CREATE OR REPLACE FUNCTION public.get_besichtigung_videos(p_session_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', v.id,
      'filename', v.filename,
      'storage_path', v.storage_path,
      'uploaded_at', v.uploaded_at
    ) ORDER BY v.uploaded_at ASC
  ), '[]'::json) INTO v_result
  FROM besichtigung.videos v
  WHERE v.session_id = p_session_id;

  RETURN v_result;
END;
$$;

-- Update session status
CREATE OR REPLACE FUNCTION public.update_besichtigung_session_status(
  p_session_id UUID,
  p_status TEXT,
  p_customer_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  UPDATE besichtigung.sessions
  SET 
    status = p_status,
    customer_notes = COALESCE(p_customer_notes, customer_notes),
    uploaded_at = CASE WHEN p_status = 'uploaded' THEN NOW() ELSE uploaded_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END
  WHERE id = p_session_id
  RETURNING json_build_object('id', id, 'status', status) INTO v_result;

  RETURN v_result;
END;
$$;

-- Insert a photo record
CREATE OR REPLACE FUNCTION public.insert_besichtigung_photo(
  p_session_id UUID,
  p_storage_path TEXT,
  p_filename TEXT,
  p_file_size BIGINT DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_room_type TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  INSERT INTO besichtigung.photos (
    session_id, storage_path, filename, file_size, mime_type, room_type
  ) VALUES (
    p_session_id, p_storage_path, p_filename, p_file_size, p_mime_type, p_room_type
  )
  RETURNING json_build_object(
    'id', id,
    'session_id', session_id,
    'storage_path', storage_path,
    'filename', filename,
    'room_type', room_type,
    'uploaded_at', uploaded_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Delete a photo record
CREATE OR REPLACE FUNCTION public.delete_besichtigung_photo(p_photo_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  DELETE FROM besichtigung.photos
  WHERE id = p_photo_id
  RETURNING json_build_object(
    'id', id,
    'storage_path', storage_path
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_besichtigung_session_by_token TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_besichtigung_photos TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_besichtigung_videos TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_besichtigung_session_status TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_besichtigung_photo TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_besichtigung_photo TO anon, authenticated, service_role;
