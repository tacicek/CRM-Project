-- =============================================================================
-- RPC: Get all virtual besichtigung sessions for a company, with photos
-- =============================================================================
-- Called from the Besichtigungen page to list sessions & attached photos

CREATE OR REPLACE FUNCTION public.get_company_besichtigung_sessions(
  p_company_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_to_json(s_row) ORDER BY s_row.created_at DESC)
  INTO v_result
  FROM (
    SELECT
      s.id,
      s.token,
      s.status,
      s.customer_name,
      s.customer_email,
      s.customer_phone,
      s.from_address,
      s.from_plz,
      s.from_city,
      s.expires_at,
      s.created_at,
      s.uploaded_at,
      s.customer_notes,
      (SELECT COUNT(*)::int FROM besichtigung.photos p WHERE p.session_id = s.id) AS photo_count,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', p.id,
              'room_type', p.room_type,
              'filename', p.filename,
              'storage_path', p.storage_path,
              'uploaded_at', p.uploaded_at
            )
            ORDER BY p.uploaded_at ASC
          )
          FROM besichtigung.photos p
          WHERE p.session_id = s.id
        ),
        '[]'::json
      ) AS photos
    FROM besichtigung.sessions s
    WHERE s.company_id = p_company_id
  ) s_row;

  -- Return empty array instead of null
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_besichtigung_sessions(UUID) TO authenticated, service_role;
