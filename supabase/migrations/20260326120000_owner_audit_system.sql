-- ============================================================
-- Owner Audit System
-- Provides login history + admin activity tracking
-- Only the system owner (tuncaycicek@gmail.com) can read data
-- ============================================================

-- 1. Admin activity log table (tracks admin panel actions)
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at 
  ON admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_user_id 
  ON admin_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action 
  ON admin_activity_log(action);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read all activity logs"
  ON admin_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'tuncaycicek@gmail.com'
    )
  );

CREATE POLICY "Staff can insert activity logs"
  ON admin_activity_log FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));


-- 2. RPC: Get auth audit log (Supabase login/signup/token events)
CREATE OR REPLACE FUNCTION get_auth_audit_log(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  payload jsonb,
  ip_address text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() 
    AND u.email = 'tuncaycicek@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Owner access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id, 
    a.payload::jsonb, 
    a.ip_address::text, 
    a.created_at
  FROM auth.audit_log_entries a
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


-- 3. RPC: Get all users overview with last login (owner only)
CREATE OR REPLACE FUNCTION get_user_overview()
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  user_type text,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() 
    AND u.email = 'tuncaycicek@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Owner access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email::text,
    p.first_name,
    p.last_name,
    COALESCE(ur.role::text, 'user') as role,
    CASE 
      WHEN ur.role IS NOT NULL THEN 'staff'
      WHEN c.id IS NOT NULL THEN 'company'
      ELSE 'unknown'
    END as user_type,
    u.last_sign_in_at,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.companies c ON c.user_id = u.id
  WHERE u.email != 'tuncaycicek@gmail.com'
  ORDER BY u.last_sign_in_at DESC NULLS LAST;
END;
$$;


-- 4. RPC: Get admin activity log entries (owner only)
CREATE OR REPLACE FUNCTION get_admin_activity_log(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  action text,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() 
    AND u.email = 'tuncaycicek@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Owner access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    a.user_email,
    a.action,
    a.entity_type,
    a.entity_id,
    a.details,
    a.created_at
  FROM admin_activity_log a
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
