-- Persistent rate limiting for edge functions

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_window_ms INTEGER,
  p_max_requests INTEGER
)
RETURNS TABLE(is_limited BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window_interval INTERVAL := make_interval(secs => p_window_ms / 1000.0);
  v_record public.edge_rate_limits%ROWTYPE;
  v_count INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 OR p_window_ms <= 0 OR p_max_requests <= 0 THEN
    RETURN QUERY SELECT FALSE, p_max_requests, v_now;
    RETURN;
  END IF;

  INSERT INTO public.edge_rate_limits (key, window_started_at, request_count, updated_at)
  VALUES (p_key, v_now, 1, v_now)
  ON CONFLICT (key) DO NOTHING;

  SELECT * INTO v_record
  FROM public.edge_rate_limits
  WHERE key = p_key
  FOR UPDATE;

  IF v_record.window_started_at + v_window_interval <= v_now THEN
    v_count := 1;
    v_reset_at := v_now + v_window_interval;
    UPDATE public.edge_rate_limits
    SET window_started_at = v_now,
        request_count = v_count,
        updated_at = v_now
    WHERE key = p_key;
  ELSE
    v_count := v_record.request_count + 1;
    v_reset_at := v_record.window_started_at + v_window_interval;
    UPDATE public.edge_rate_limits
    SET request_count = v_count,
        updated_at = v_now
    WHERE key = p_key;
  END IF;

  RETURN QUERY
  SELECT
    (v_count > p_max_requests) AS is_limited,
    GREATEST(p_max_requests - LEAST(v_count, p_max_requests), 0) AS remaining,
    v_reset_at;
END;
$$;

REVOKE ALL ON TABLE public.edge_rate_limits FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.edge_rate_limits TO service_role;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
