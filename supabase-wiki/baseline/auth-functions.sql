-- Auth helper functions for the wiki screenshot stack — MUST run as the auth-schema
-- owner (supabase_admin), not as the unprivileged postgres role.
--
-- This is the FUNCTION HALF of supabase-test/baseline/auth-supplement.sql, and only the
-- function half. The other half of that file does:
--
--     ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_sso_user  ...
--     ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_anonymous ...
--
-- which is correct THERE, where gotrue is disabled and nothing else maintains the table.
-- Here gotrue is running and owns auth.users, applying its own migrations at container
-- start. Re-adding its columns is at best a no-op and at worst interferes with its
-- migration bookkeeping, so it is deliberately omitted.
--
-- Why the functions are still needed with gotrue running: gotrue does not define them.
-- The postgres image does, at initdb — and this image's auth.uid() reads ONLY the old
-- singular GUC `request.jwt.claim.sub`, while PostgREST sets the plural
-- `request.jwt.claims`. Left alone, every company-scoped RLS policy would return zero
-- rows for a real logged-in request, and every screenshot would be a plausible-looking
-- empty page. auth.jwt() is missing from the image entirely, so policies that call it
-- fail to create at all.
--
-- The bodies are transcribed verbatim from production (via supabase-test's supplement),
-- not invented.

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
  LANGUAGE sql STABLE
  AS $$
    select coalesce(
      nullif(current_setting('request.jwt.claim', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
  $$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE
  AS $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    )::text
  $$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
  LANGUAGE sql STABLE
  AS $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.email', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
    )::text
  $$;

GRANT EXECUTE ON FUNCTION auth.jwt()   TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid()   TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role()  TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.email() TO postgres, anon, authenticated, service_role;
