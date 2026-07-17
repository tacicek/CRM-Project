-- Test-only prerequisite schema, applied BEFORE baseline/schema.sql.
--
-- The sanitized baseline was dumped with `--schema=public`, but one public object eagerly
-- depends on a NON-public schema: the view `public.virtual_besichtigung_sessions` does
-- `SELECT ... FROM besichtigung.sessions`. A view is validated at CREATE time, so on a clean
-- stack schema.sql halts with `relation "besichtigung.sessions" does not exist`. (The
-- besichtigung-referencing FUNCTIONS are fine — their bodies are deferred by
-- `check_function_bodies = false` and no assertion calls them.)
--
-- This stub provides EXACTLY the columns that view projects (transcribed from its own
-- definition in schema.sql — not invented), so the view can be created. It is a disposable
-- test scaffold, NOT the real besichtigung schema. The proper fix is to regenerate the
-- baseline with `--schema=public --schema=besichtigung` (İter.2 baseline completeness).
-- (auth.jwt() is supplemented separately in auth-supplement.sql, which must run as the
-- auth-schema owner supabase_admin — this file runs as the unprivileged postgres role.)
DROP SCHEMA IF EXISTS besichtigung CASCADE;
CREATE SCHEMA besichtigung;

CREATE TABLE besichtigung.sessions (
  id              uuid,
  token           text,
  company_id      uuid,
  lead_id         uuid,
  offer_id        uuid,
  customer_name   text,
  customer_email  text,
  customer_phone  text,
  from_address    text,
  from_plz        text,
  from_city       text,
  status          text,
  created_at      timestamptz,
  uploaded_at     timestamptz,
  analyzed_at     timestamptz,
  completed_at    timestamptz,
  expires_at      timestamptz,
  customer_notes  text,
  created_by      uuid,
  data_expires_at timestamptz
);
