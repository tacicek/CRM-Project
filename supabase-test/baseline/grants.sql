-- Standard Supabase privilege layer for the test baseline.
--
-- The schema dump was taken with --no-privileges (deliberate: to avoid pulling
-- environment-specific owners/role grants). RLS enforces ROW visibility, but a role
-- still needs TABLE privileges to reach RLS at all — without a GRANT, anon/authenticated
-- get "permission denied", which would make an "anon is denied" test pass for the WRONG
-- reason. This restores Supabase's documented default grant model so the RLS assertions
-- test RLS, not missing privileges. RLS is NOT disabled or loosened here.
--
-- This is a DELIBERATE, documented test/prod difference (see parity-manifest.json).

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables    in schema public to authenticated, service_role;
grant all privileges on all sequences in schema public to authenticated, service_role, anon;
grant execute on all functions        in schema public to anon, authenticated, service_role;

-- anon: read + the writes public token flows perform (offers accept/update happen via
-- SECURITY DEFINER RPCs, but table-level SELECT is what the token SELECT policy gates).
grant select on all tables in schema public to anon;
