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

-- auth.uid() / auth.role() / auth.email(): dieses Image kennt sie, liest aber NUR die alte
-- Einzahl-GUC `request.jwt.claim.sub`. Die Produktion (dasselbe Image-Tag, aber mit
-- gotrue-Migrationen) liest beide Formen, und Fixtures wie Zusicherungen setzen die
-- Mehrzahl-Form `request.jwt.claims`. Ohne diese Ergaenzung liefert auth.uid() im Test
-- NULL, jede firmenbezogene Policy ist damit falsch und die Testaussage waere wertlos.
-- Die Rumpfe sind woertlich aus der Produktion uebernommen.
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

GRANT EXECUTE ON FUNCTION auth.uid()   TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role()  TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.email() TO postgres, anon, authenticated, service_role;

-- With gotrue disabled, this db image's auth.users predates a couple of columns the
-- synthetic fixtures set (they exist on the real, gotrue-migrated auth.users). Add them —
-- standard Supabase auth.users columns, transcribed from the fixtures' own INSERT, not
-- invented. IF NOT EXISTS keeps it idempotent and harmless if the image already has them.
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_sso_user  boolean NOT NULL DEFAULT false;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
