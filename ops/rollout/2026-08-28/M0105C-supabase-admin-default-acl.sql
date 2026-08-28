-- M01-05C — Standardrechte mit Erteiler supabase_admin im public-Schema.
--
-- DIESE DATEI IST KEINE MIGRATION DES PROJEKTS und laeuft nicht als `postgres`.
--
-- Standardrechte kann nur ihr Erteiler aendern. Gemessen in der Produktion:
--     postgres  rolsuper = false
--     postgres  Mitglied von supabase_admin = false
-- Also kann `20260828160000` diese Zeile nicht raeumen und meldet sie als
-- Restbestand. Ohne diesen Nachzug erben Tabellen, die supabase_admin im
-- public-Schema anlegt, weiterhin TRUNCATE fuer anon und authenticated.
--
-- ERFORDERLICHE AUSFUEHRUNGSIDENTITAET
--     supabase_admin selbst, oder eine Rolle, die Mitglied von supabase_admin
--     ist, oder ein Superuser.
--
-- Auf dieser Installation ist keine solche Identitaet fuer die Automatisierung
-- verfuegbar. Zustand daher: BLOCKED_BY_EXECUTION_IDENTITY.

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM authenticated;

-- Nachweis: danach darf KEINE Standardrechte-Zeile im public-Schema noch
-- TRUNCATE an anon oder authenticated geben — gleich welcher Erteiler.
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
    RAISE EXCEPTION
      'Noch % Standardrechte-Eintraege geben kuenftigen Tabellen TRUNCATE. '
      'Lief 20260828160000 (Erteiler postgres) schon?', v_rest;
  END IF;
  RAISE NOTICE 'Beide Erteiler geraeumt — kuenftige Tabellen erben kein TRUNCATE mehr.';
END
$pruefung$;
