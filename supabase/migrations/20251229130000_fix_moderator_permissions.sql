-- =====================================================
-- FIX: Moderator Permissions
-- =====================================================
-- Problem: is_admin() only checks for 'admin' role, blocking moderators
-- from accessing leads, blog, verification, and other admin features.
-- 
-- Solution: Create is_staff() function that checks for both admin AND moderator,
-- then update is_admin() to use is_staff() for backward compatibility.
-- =====================================================

-- 1. Create is_staff() function
-- This function checks if a user has either 'admin' or 'moderator' role
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
    AND role IN ('admin', 'moderator')
  )
$$;

-- 2. Update is_admin() to include moderators
-- This ensures all existing RLS policies automatically work for moderators
-- without needing to update each policy individually
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff(_user_id)
$$;

-- 3. Create is_super_admin() for cases where ONLY admin should have access
-- Use this for sensitive operations like user management
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
    AND role = 'admin'
  )
$$;

-- 4. Update blog policies to use is_staff() instead of has_role('admin')
-- Drop existing policies first
DROP POLICY IF EXISTS "Admins have full access to blog_posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins have full access to blog_categories" ON public.blog_categories;
DROP POLICY IF EXISTS "Admins have full access to blog_seo_performance" ON public.blog_seo_performance;

-- Recreate with is_staff()
CREATE POLICY "Staff have full access to blog_posts" ON public.blog_posts
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff have full access to blog_categories" ON public.blog_categories
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff have full access to blog_seo_performance" ON public.blog_seo_performance
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;

-- =====================================================
-- SUMMARY OF CHANGES:
-- =====================================================
-- ✅ is_staff(_user_id) - Returns true for admin OR moderator
-- ✅ is_admin(_user_id) - Now returns is_staff() (includes moderators)
-- ✅ is_super_admin(_user_id) - Returns true ONLY for admin role
-- ✅ Blog policies updated to use is_staff()
-- 
-- All 78+ existing RLS policies using is_admin() will now
-- automatically work for moderators!
-- =====================================================

