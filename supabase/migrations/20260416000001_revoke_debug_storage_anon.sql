-- Security fix: revoke anon execution rights from debug functions.
-- debug_storage_full() exposes internal RLS policy details, bucket configs,
-- and pg_policies contents to unauthenticated users — reconnaissance risk.

REVOKE EXECUTE ON FUNCTION public.debug_storage_full FROM anon;
REVOKE EXECUTE ON FUNCTION public.debug_storage_full FROM PUBLIC;

-- Also drop the function entirely — it was created for a one-time debug session
-- and has no ongoing operational purpose.
DROP FUNCTION IF EXISTS public.debug_storage_full();
