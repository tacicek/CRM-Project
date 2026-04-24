-- =============================================================================
-- RPC wrappers for besichtigung AI analysis (read + write)
-- =============================================================================

-- Save AI analysis result for a session
CREATE OR REPLACE FUNCTION public.save_besichtigung_analysis(
  p_session_id UUID,
  p_estimated_volume_m3 DECIMAL DEFAULT NULL,
  p_estimated_time_hours DECIMAL DEFAULT NULL,
  p_recommended_workers INTEGER DEFAULT NULL,
  p_recommended_truck TEXT DEFAULT NULL,
  p_room_breakdown JSONB DEFAULT '[]'::jsonb,
  p_detected_items JSONB DEFAULT '[]'::jsonb,
  p_special_items TEXT[] DEFAULT '{}',
  p_special_requirements TEXT[] DEFAULT '{}',
  p_from_access_difficulty TEXT DEFAULT NULL,
  p_from_floor INTEGER DEFAULT NULL,
  p_from_has_lift BOOLEAN DEFAULT NULL,
  p_from_parking_distance TEXT DEFAULT NULL,
  p_confidence DECIMAL DEFAULT NULL,
  p_raw_response JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Delete previous analysis for this session (re-analyze)
  DELETE FROM besichtigung.ai_analysis WHERE session_id = p_session_id;

  INSERT INTO besichtigung.ai_analysis (
    session_id,
    estimated_volume_m3,
    estimated_time_hours,
    recommended_workers,
    recommended_truck,
    room_breakdown,
    detected_items,
    special_items,
    special_requirements,
    from_access_difficulty,
    from_floor,
    from_has_lift,
    from_parking_distance,
    confidence,
    raw_response
  ) VALUES (
    p_session_id,
    p_estimated_volume_m3,
    p_estimated_time_hours,
    p_recommended_workers,
    p_recommended_truck,
    p_room_breakdown,
    p_detected_items,
    p_special_items,
    p_special_requirements,
    p_from_access_difficulty,
    p_from_floor,
    p_from_has_lift,
    p_from_parking_distance,
    p_confidence,
    p_raw_response
  )
  RETURNING json_build_object(
    'id', id,
    'session_id', session_id,
    'analyzed_at', analyzed_at
  ) INTO v_result;

  -- Update session status to 'analyzed'
  UPDATE besichtigung.sessions
  SET status = 'analyzed', analyzed_at = NOW()
  WHERE id = p_session_id;

  RETURN v_result;
END;
$$;

-- Get AI analysis for a session
CREATE OR REPLACE FUNCTION public.get_besichtigung_analysis(
  p_session_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id', a.id,
    'session_id', a.session_id,
    'estimated_volume_m3', a.estimated_volume_m3,
    'estimated_time_hours', a.estimated_time_hours,
    'recommended_workers', a.recommended_workers,
    'recommended_truck', a.recommended_truck,
    'room_breakdown', a.room_breakdown,
    'detected_items', a.detected_items,
    'special_items', a.special_items,
    'special_requirements', a.special_requirements,
    'from_access_difficulty', a.from_access_difficulty,
    'from_floor', a.from_floor,
    'from_has_lift', a.from_has_lift,
    'from_parking_distance', a.from_parking_distance,
    'confidence', a.confidence,
    'analyzed_at', a.analyzed_at
  )
  INTO v_result
  FROM besichtigung.ai_analysis a
  WHERE a.session_id = p_session_id
  ORDER BY a.analyzed_at DESC
  LIMIT 1;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_besichtigung_analysis TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_besichtigung_analysis(UUID) TO authenticated, service_role;
