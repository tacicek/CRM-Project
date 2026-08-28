-- Ruecknahme zu 20260828160000.
--
-- Gibt anon und authenticated TRUNCATE im public-Schema zurueck — also die
-- Faehigkeit, jede Tabelle des Schemas zu leeren, gegen die RLS nichts
-- ausrichtet. Das ist der UNSICHERE Zustand. Diese Datei existiert, damit der
-- Eingriff umkehrbar ist, nicht weil der alte Zustand richtig waere.

BEGIN;

GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO anon;
GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT TRUNCATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT TRUNCATE ON TABLES TO authenticated;

COMMIT;
