-- Test-only auth supplement — MUST run as supabase_admin (the auth-schema owner); the
-- unprivileged postgres role cannot write to the auth schema.
--
-- The live DB (source of the sanitized baseline) has auth.jwt(); this local db image ships
-- auth.uid() and auth.role() but NOT auth.jwt(), so baseline RLS policies that call it fail
-- to create on a clean stack. Supplement the canonical Supabase definition (reads the JWT
-- claims GUC set by `set local request.jwt.claims`). Standard Supabase function — not app
-- schema. Same "supplement the --no-privileges dump" philosophy as grants.sql.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
  LANGUAGE sql STABLE
  AS $$
    select coalesce(
      nullif(current_setting('request.jwt.claim', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
  $$;

GRANT EXECUTE ON FUNCTION auth.jwt() TO postgres, anon, authenticated, service_role;

-- With gotrue disabled, this db image's auth.users predates a couple of columns the
-- synthetic fixtures set (they exist on the real, gotrue-migrated auth.users). Add them —
-- standard Supabase auth.users columns, transcribed from the fixtures' own INSERT, not
-- invented. IF NOT EXISTS keeps it idempotent and harmless if the image already has them.
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_sso_user  boolean NOT NULL DEFAULT false;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
