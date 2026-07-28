-- In-database identity marker for the CRM wiki screenshot stack.
--
-- Two jobs, and the second one is the important one:
--
--  1. Like crm_test_guard, it is a port-independent proof that a database really is this
--     stack before scripts/wiki-db.sh runs `DROP SCHEMA public CASCADE`. It lives in its
--     own schema so the disposable rebuild does not delete it.
--
--  2. It is READABLE THROUGH POSTGREST, and that is what closes the one hole a
--     port/URL check cannot.
--
--     vite.config.ts rewrites the browser-visible VITE_SUPABASE_URL to
--     `window.location.origin` in dev, so the page always thinks it is talking to
--     localhost — even when the dev server is proxying to the production Supabase in
--     .env.local. A guard that asks "is the base URL loopback?" therefore PASSES against
--     production. Asking the database behind the proxy to identify itself is the only
--     check that cannot be fooled: production has no crm_wiki_guard schema.
--
-- Written ONLY by `npm run wiki:db:bootstrap`, after the container-identity checks pass.
CREATE SCHEMA IF NOT EXISTS crm_wiki_guard;

CREATE TABLE IF NOT EXISTS crm_wiki_guard.identity (
  singleton      boolean PRIMARY KEY DEFAULT true,
  project_id     text    NOT NULL,
  marker_version integer NOT NULL,
  note           text    NOT NULL,
  CONSTRAINT crm_wiki_guard_identity_singleton CHECK (singleton)
);

-- Idempotent: bootstrap re-runs. The guard compares project_id + marker_version to the
-- values the script expects; a mismatch (wrong project, stale marker) → refuse.
INSERT INTO crm_wiki_guard.identity (singleton, project_id, marker_version, note)
VALUES (true, 'crm-wiki', 1, 'CRM wiki screenshot stack. Synthetic data only. Safe to DROP SCHEMA public.')
ON CONFLICT (singleton) DO UPDATE
  SET project_id = EXCLUDED.project_id,
      marker_version = EXCLUDED.marker_version,
      note = EXCLUDED.note;

GRANT USAGE ON SCHEMA crm_wiki_guard TO anon, authenticated, service_role;
GRANT SELECT ON crm_wiki_guard.identity TO anon, authenticated, service_role;

-- The REST-reachable face of the marker.
--
-- crm_wiki_guard is deliberately NOT in [api] schemas: listing a schema there that does
-- not exist yet deadlocks the first `supabase start`, because PostgREST will not build a
-- schema cache for a missing schema and the schema cannot be created before the stack is
-- up. Exposing one SECURITY DEFINER function in `public` avoids that and keeps the
-- exposed surface to a single constant row.
--
-- This function lives in `public`, so `DROP SCHEMA public CASCADE` removes it — which is
-- correct: the bootstrap recreates it on every rebuild, so it can never survive as a
-- stale claim about a database that has since been repurposed.
CREATE OR REPLACE FUNCTION public.crm_wiki_identity()
  RETURNS TABLE (project_id text, marker_version integer)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = crm_wiki_guard, pg_temp
  AS $$
    SELECT identity.project_id, identity.marker_version FROM crm_wiki_guard.identity;
  $$;

GRANT EXECUTE ON FUNCTION public.crm_wiki_identity() TO anon, authenticated, service_role;

-- PostgREST caches the schema; tell it to reload so the function is callable immediately
-- after the bootstrap instead of after its next poll.
NOTIFY pgrst, 'reload schema';
