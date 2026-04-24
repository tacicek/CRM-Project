-- =====================================================
-- FIX: Role Hierarchy and Protection - Part 2
-- Functions, policies, and migration
-- =====================================================

-- 2. Clean up duplicate roles and migrate first admin to super_admin
-- First, find the first admin user
DO $$
DECLARE
  first_admin_user UUID;
BEGIN
  -- Find the first admin user
  SELECT user_id INTO first_admin_user
  FROM public.user_roles 
  WHERE role = 'admin' 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  IF first_admin_user IS NOT NULL THEN
    -- Delete all roles for this user
    DELETE FROM public.user_roles WHERE user_id = first_admin_user;
    
    -- Insert only super_admin role
    INSERT INTO public.user_roles (user_id, role) VALUES (first_admin_user, 'super_admin');
  END IF;
END $$;

-- 3. Create a function to check role hierarchy
CREATE OR REPLACE FUNCTION public.get_role_level(role_name text)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE role_name
    WHEN 'super_admin' THEN 100
    WHEN 'admin' THEN 50
    WHEN 'moderator' THEN 10
    WHEN 'user' THEN 1
    ELSE 0
  END
$$;

-- 4. Create function to check if user can modify target user's role
CREATE OR REPLACE FUNCTION public.can_modify_role(modifier_id UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  modifier_role TEXT;
  modifier_level INTEGER;
  target_role TEXT;
  target_level INTEGER;
BEGIN
  -- Get modifier's role and level
  SELECT role::text INTO modifier_role
  FROM user_roles
  WHERE user_id = modifier_id
  ORDER BY get_role_level(role::text) DESC
  LIMIT 1;
  
  IF modifier_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  modifier_level := get_role_level(modifier_role);
  
  -- Only super_admin can modify roles
  IF modifier_level < 100 THEN
    RETURN FALSE;
  END IF;
  
  -- Get target's role and level
  SELECT role::text INTO target_role
  FROM user_roles
  WHERE user_id = target_user_id
  ORDER BY get_role_level(role::text) DESC
  LIMIT 1;
  
  -- If target has no role, allow (new user)
  IF target_role IS NULL THEN
    RETURN TRUE;
  END IF;
  
  target_level := get_role_level(target_role);
  
  -- Cannot modify users at same or higher level (except yourself)
  IF target_level >= modifier_level AND modifier_id != target_user_id THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 5. Update is_super_admin function to check for super_admin role specifically
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'super_admin'
  )
$$;

-- 6. Update is_staff to include super_admin
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('super_admin', 'admin', 'moderator')
  )
$$;

-- 7. Update is_admin to include super_admin and admin (but not moderator for some operations)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('super_admin', 'admin', 'moderator')
  )
$$;

-- 8. Drop existing user_roles policies and create new ones with hierarchy protection
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Staff can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can update roles with hierarchy" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can delete roles with hierarchy" ON public.user_roles;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Staff can view all roles (for admin panel)
CREATE POLICY "Staff can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_staff(auth.uid()));

-- Only super_admin can insert new roles
CREATE POLICY "Super admin can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

-- Only super_admin can update roles, with hierarchy check
CREATE POLICY "Super admin can update roles with hierarchy"
ON public.user_roles FOR UPDATE
USING (
  public.is_super_admin(auth.uid()) 
  AND public.can_modify_role(auth.uid(), user_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid()) 
  AND public.can_modify_role(auth.uid(), user_id)
);

-- Only super_admin can delete roles, with hierarchy check
CREATE POLICY "Super admin can delete roles with hierarchy"
ON public.user_roles FOR DELETE
USING (
  public.is_super_admin(auth.uid()) 
  AND public.can_modify_role(auth.uid(), user_id)
);

-- 9. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_role_level(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_modify_role(UUID, UUID) TO authenticated;

-- =====================================================
-- ROLE HIERARCHY:
-- super_admin (100) - Full access, can manage all roles
-- admin (50) - Most access, cannot manage roles
-- moderator (10) - Limited access
-- user (1) - Company users (not in this enum)
-- =====================================================
