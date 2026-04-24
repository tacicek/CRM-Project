-- Cleanup: remove temporary diagnostic functions used during debugging
DROP FUNCTION IF EXISTS public.test_storage_upload_policy();
DROP FUNCTION IF EXISTS public.diagnose_storage_upload();
DROP FUNCTION IF EXISTS public.check_storage_policies();
DROP FUNCTION IF EXISTS public.check_buckets_rls();
