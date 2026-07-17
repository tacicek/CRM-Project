-- In-database identity marker for the CRM disposable test stack.
--
-- This is the THIRD, port-independent proof (alongside CRM_TEST_ENV and the unique
-- container name/port) that a database is the CRM test target before scripts/test-db.sh
-- runs `DROP SCHEMA public CASCADE`. It deliberately lives in its OWN schema, never in
-- `public`, so the disposable rebuild does not delete it. A database created by any other
-- project will not have this row, so the guard refuses to touch it.
--
-- Written ONLY by `npm run test:db:bootstrap`, after the container-identity checks pass.
CREATE SCHEMA IF NOT EXISTS crm_test_guard;

CREATE TABLE IF NOT EXISTS crm_test_guard.identity (
  singleton      boolean PRIMARY KEY DEFAULT true,
  project_id     text    NOT NULL,
  marker_version integer NOT NULL,
  note           text    NOT NULL,
  CONSTRAINT crm_test_guard_identity_singleton CHECK (singleton)
);

-- Idempotent: bootstrap can re-run. The guard compares project_id + marker_version to the
-- values the script expects; a mismatch (wrong project, stale marker version) → refuse.
INSERT INTO crm_test_guard.identity (singleton, project_id, marker_version, note)
VALUES (true, 'crm-test', 1, 'CRM disposable integration-test stack. Safe to DROP SCHEMA public.')
ON CONFLICT (singleton) DO UPDATE
  SET project_id = EXCLUDED.project_id,
      marker_version = EXCLUDED.marker_version,
      note = EXCLUDED.note;
