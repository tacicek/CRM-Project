-- =====================================================
-- FIX: Role Hierarchy and Protection - Part 1
-- Add super_admin to enum
-- =====================================================

-- 1. Add super_admin to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'admin';

-- Note: Due to PostgreSQL limitations, we cannot use the new enum value
-- in the same transaction. The actual migration of users will be done
-- in the next migration file (20251229140001).
