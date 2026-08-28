-- M01-05: anon und authenticated verlieren TRUNCATE im public-Schema.
--
-- WARUM
--
-- TRUNCATE unterliegt keiner Row Level Security. Alle 101 Tabellen des
-- public-Schemas tragen RLS, und trotzdem gilt (gemessen 2026-08-28, lesend):
--
--     anon           haelt TRUNCATE auf  97 Tabellen
--     authenticated  haelt TRUNCATE auf 101 Tabellen
--
-- RLS schuetzt Zeilen. TRUNCATE fragt nicht nach Zeilen. Ein Recht, das die
-- Datenbank leert, laesst sich mit Policies nicht einhegen.
--
-- ERREICHBARKEIT — DESHALB HAERTUNG, NICHT VORFALL
--
--     Portfreigabe des DB-Containers   keine
--     anon / authenticated             rolcanlogin = false
--     Funktionen mit TRUNCATE im Rumpf keine (alle exponierten Schemata)
--     ON-TRUNCATE-Trigger              nur cron.job (System, nicht exponiert)
--     pg_cron-Jobs mit TRUNCATE        0 von 12
--     PostgREST                        bietet kein TRUNCATE an
--
-- Es gibt heute keinen gemessenen Weg von aussen. Das Recht ist trotzdem falsch
-- vergeben: niemand braucht es, und es steht quer zu allem anderen.
--
-- HERKUNFT
--
-- Nicht aus einer Migration, sondern aus `ALTER DEFAULT PRIVILEGES`. Im
-- public-Schema stehen ZWEI solche Zeilen, mit verschiedenen Erteilern:
--
--     Erteiler postgres        -> anon, authenticated: arwdDxt
--     Erteiler supabase_admin  -> anon, authenticated: arwdDxt
--
-- WAS DIESE MIGRATION NICHT KANN
--
-- `postgres` ist hier **kein Superuser** und **kein Mitglied von
-- supabase_admin** (beides gemessen). Standardrechte kann nur ihr Erteiler
-- aendern. Diese Migration raeumt deshalb:
--
--     · die bestehenden Rechte auf allen Tabellen  -> vollstaendig
--     · die Standardrechte mit Erteiler postgres   -> vollstaendig
--     · die Standardrechte mit Erteiler supabase_admin -> NUR, wenn der
--       Ausfuehrende es darf; sonst bleibt sie stehen und wird gemeldet.
--
-- Kuenftige Tabellen, die **supabase_admin** im public-Schema anlegt, erben also
-- weiterhin TRUNCATE. Migrationen dieses Projekts laufen als `postgres`, deren
-- Tabellen sind abgedeckt. Die Restzeile braucht einen Superuser-Lauf:
--
--     ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
--       REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
--
-- Das ist Absicht und steht hier, statt sich spaeter als Luecke herauszustellen.
--
-- AUSDRUECKLICH UNBERUEHRT
--
-- SELECT, INSERT, UPDATE, DELETE. Nachweis 2 vergleicht sie Tabelle fuer Tabelle
-- gegen den Zustand vor dem Eingriff — nicht als Zaehler, sondern als Menge.
--
-- NICHT IM UMFANG: die Schemata `storage` (3 Tabellen), `net` (2) und
-- `supabase_functions` (2) tragen dieselbe Drift, gehoeren aber anderen
-- Eigentuemern (supabase_storage_admin, supabase_admin, supabase_functions_admin)
-- und liegen ausserhalb des vereinbarten Vertrags. Eigener Befund.

BEGIN;

-- Zustand VOR dem Eingriff, als Menge. Nachweis 2 vergleicht dagegen.
CREATE TEMP TABLE m0105_vorher ON COMMIT DROP AS
SELECT c.oid AS tabelle, r.rolle, p.recht,
       has_table_privilege(r.rolle, c.oid, p.recht) AS hatte
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolle)
 CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(recht)
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p');

-- 1. Bestehende Rechte.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM authenticated;

-- 2. Standardrechte, Erteiler postgres — kuenftige Tabellen dieses Projekts.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM authenticated;

-- 3. Standardrechte, Erteiler supabase_admin — nur wenn erlaubt.
DO $supabase_admin$
BEGIN
  IF pg_has_role(current_user, 'supabase_admin', 'MEMBER') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public '
            'REVOKE TRUNCATE ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public '
            'REVOKE TRUNCATE ON TABLES FROM authenticated';
    RAISE NOTICE 'Standardrechte von supabase_admin ebenfalls bereinigt.';
  ELSE
    RAISE NOTICE
      'RESTBESTAND: % ist kein Mitglied von supabase_admin. Die Standardrechte '
      'mit Erteiler supabase_admin bleiben stehen; von supabase_admin im '
      'public-Schema angelegte Tabellen erben weiter TRUNCATE. Ein Superuser '
      'muss nachziehen (Anweisung im Kopf dieser Datei).', current_user;
  END IF;
END
$supabase_admin$;

-- Nachweis 1: keine Tabelle im public-Schema gibt anon oder authenticated
-- noch TRUNCATE.
DO $pruefung$
DECLARE
  v_rest integer;
  v_liste text;
BEGIN
  SELECT count(*), coalesce(string_agg(c.relname, ', ' ORDER BY c.relname), '')
    INTO v_rest, v_liste
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
     AND (has_table_privilege('anon', c.oid, 'TRUNCATE')
       OR has_table_privilege('authenticated', c.oid, 'TRUNCATE'));

  IF v_rest > 0 THEN
    RAISE EXCEPTION '% Tabellen geben weiterhin TRUNCATE: %', v_rest, left(v_liste, 300);
  END IF;
END
$pruefung$;

-- Nachweis 2: SELECT/INSERT/UPDATE/DELETE sind Tabelle fuer Tabelle unveraendert.
-- Der eigentliche Zweck der Migration ist, NICHTS anderes anzufassen.
DO $pruefung$
DECLARE
  v_abweichung integer;
  v_beispiel   text;
BEGIN
  SELECT count(*), coalesce(min(c.relname || '/' || v.rolle || '/' || v.recht), '')
    INTO v_abweichung, v_beispiel
    FROM m0105_vorher v
    JOIN pg_class c ON c.oid = v.tabelle
   WHERE v.hatte IS DISTINCT FROM has_table_privilege(v.rolle, v.tabelle, v.recht);

  IF v_abweichung > 0 THEN
    RAISE EXCEPTION
      'Der Entzug hat % andere Rechte veraendert (z.B. %). Nur TRUNCATE durfte weichen.',
      v_abweichung, v_beispiel;
  END IF;

  RAISE NOTICE 'SELECT/INSERT/UPDATE/DELETE unveraendert (% Paare geprueft).',
    (SELECT count(*) FROM m0105_vorher);
END
$pruefung$;

-- Nachweis 3: die Standardrechte mit Erteiler postgres geben kein TRUNCATE mehr.
DO $pruefung$
DECLARE
  v_rest integer;
BEGIN
  SELECT count(*) INTO v_rest
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE n.nspname = 'public'
     AND d.defaclobjtype = 'r'
     AND d.defaclrole = 'postgres'::regrole
     AND a.privilege_type = 'TRUNCATE'
     AND a.grantee::regrole::text IN ('anon', 'authenticated');

  IF v_rest > 0 THEN
    RAISE EXCEPTION
      'Die Standardrechte mit Erteiler postgres geben weiterhin TRUNCATE (% Eintraege).', v_rest;
  END IF;
END
$pruefung$;

-- Nachweis 4: den Restbestand benennen, statt ihn zu verschweigen.
DO $pruefung$
DECLARE
  v_rest integer;
BEGIN
  SELECT count(*) INTO v_rest
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE n.nspname = 'public'
     AND d.defaclobjtype = 'r'
     AND a.privilege_type = 'TRUNCATE'
     AND a.grantee::regrole::text IN ('anon', 'authenticated');

  IF v_rest > 0 THEN
    RAISE NOTICE
      'RESTBESTAND: % Standardrechte-Eintraege geben kuenftigen Tabellen weiter '
      'TRUNCATE (Erteiler supabase_admin). Superuser-Nachzug noetig.', v_rest;
  ELSE
    RAISE NOTICE 'Keine Standardrechte im public-Schema geben noch TRUNCATE.';
  END IF;
END
$pruefung$;

COMMIT;
