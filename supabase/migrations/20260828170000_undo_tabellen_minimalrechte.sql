-- Belegtabellen gehoeren dem Eigentuemer. Sonst niemandem.
--
-- BEFUND
--
-- Fuenf `public.undo_*`-Tabellen halten den Vorzustand frueherer Eingriffe fest.
-- Alle fuenf tragen bis heute die Supabase-Standardrechte:
--
--     acl = postgres=arwdDxt  anon=arwdDxt  authenticated=arwdDxt  service_role=arwdDxt
--
-- Vier haben RLS (0 Policies, also fuer anon/authenticated gesperrt), eine nicht
-- (`undo_20260828100000`, siehe M01-03 und `20260828150000`). Aber RLS deckt
-- TRUNCATE nicht ab, und `service_role` umgeht RLS ohnehin per BYPASSRLS.
--
-- AUFRUFER — GEMESSEN, NICHT VERMUTET
--
--     Datenbankfunktionen, die eine undo-Tabelle lesen oder schreiben   keine
--     Views darauf                                                      keine
--     Trigger darauf                                                    keine
--     Edge Functions                                                    keine
--     Frontend (`src/`)                                                 keine
--
-- Die einzigen Fundstellen im Repo sind Testvorrichtungen des Ruecknahme-Tors
-- und eine Zeichenkette in `scripts/test-baseline-tooling.sh`. Kein Laufzeitweg
-- braucht diese Tabellen — auch `service_role` nicht.
--
-- VERTRAG
--
--     postgres (Eigentuemer)              behaelt Zugriff
--     PUBLIC, anon, authenticated         kein Recht
--     service_role                        kein Recht — kein Aufrufer belegt Bedarf
--     Ruecknahme                          bleibt ausdruecklicher postgres-Vorgang
--
-- `service_role` zu entziehen ist kein Bruch des Ruecknahmepfads: die Ruecknahmen
-- fuehren `CREATE POLICY`, `GRANT` und `DROP TABLE` aus, und das verlangt
-- EIGENTUEMERSCHAFT, nicht BYPASSRLS. Gemessen:
--     set role service_role; drop table public.undo_20260828100000;
--       -> ERROR: must be owner of table
-- Der Pfad lief also ohnehin nie unter service_role.
--
-- Zusaetzlich RLS auf allen fuenf, damit die zweite Linie ueberall gleich steht.
--
-- Angewendete Migrationen werden nicht angefasst; dies ist eine neue Datei.

BEGIN;

DO $entzug$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'undo\_%'
     ORDER BY c.relname
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM service_role', t.relname);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    RAISE NOTICE 'verriegelt: %', t.relname;
  END LOOP;
END
$entzug$;

-- Nachweis 1: kein Tabellenrecht mehr, in JEDER Auspraegung.
-- SELECT allein zu pruefen waere die Luecke, durch die M01-05 gekommen ist.
DO $pruefung$
DECLARE
  v_rolle  text;
  v_recht  text;
  v_tab    record;
  v_funde  text := '';
BEGIN
  FOR v_tab IN
    SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'undo\_%'
  LOOP
    FOREACH v_rolle IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      FOREACH v_recht IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(v_rolle, v_tab.oid, v_recht) THEN
          v_funde := v_funde || format('%s/%s/%s ', v_tab.relname, v_rolle, v_recht);
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  IF v_funde <> '' THEN
    RAISE EXCEPTION 'Restrechte auf Belegtabellen: %', left(v_funde, 400);
  END IF;
END
$pruefung$;

-- Nachweis 2: keine SPALTEN-Grants. Ein Spaltenrecht ueberlebt ein
-- Tabellen-REVOKE nicht automatisch sichtbar — deshalb eigens geprueft.
DO $pruefung$
DECLARE
  v_funde integer;
BEGIN
  SELECT count(*) INTO v_funde
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   CROSS JOIN LATERAL aclexplode(a.attacl) x
   WHERE n.nspname = 'public' AND c.relname LIKE 'undo\_%'
     AND a.attacl IS NOT NULL
     AND (x.grantee = 0 OR x.grantee::regrole::text IN ('anon','authenticated','service_role'));

  IF v_funde > 0 THEN
    RAISE EXCEPTION '% Spalten-Grants auf Belegtabellen uebrig', v_funde;
  END IF;
END
$pruefung$;

-- Nachweis 3: kein PUBLIC-Grant.
DO $pruefung$
DECLARE
  v_funde integer;
BEGIN
  SELECT count(*) INTO v_funde
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   CROSS JOIN LATERAL aclexplode(c.relacl) x
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'undo\_%'
     AND x.grantee = 0;

  IF v_funde > 0 THEN
    RAISE EXCEPTION '% PUBLIC-Grants auf Belegtabellen uebrig', v_funde;
  END IF;
END
$pruefung$;

-- Nachweis 4: der Eigentuemer behaelt Zugriff, und RLS steht ueberall.
DO $pruefung$
DECLARE
  v_tab record;
BEGIN
  FOR v_tab IN
    SELECT c.oid, c.relname, c.relrowsecurity, pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'undo\_%'
  LOOP
    IF v_tab.owner <> 'postgres' THEN
      RAISE EXCEPTION 'Eigentuemer von % ist %, erwartet postgres', v_tab.relname, v_tab.owner;
    END IF;
    IF NOT v_tab.relrowsecurity THEN
      RAISE EXCEPTION 'RLS auf % ist aus', v_tab.relname;
    END IF;
    IF NOT has_table_privilege('postgres', v_tab.oid, 'SELECT') THEN
      RAISE EXCEPTION 'postgres kann % nicht mehr lesen — der Beleg waere unerreichbar', v_tab.relname;
    END IF;
  END LOOP;
END
$pruefung$;

-- Nachweis 5: die Belege selbst sind unversehrt. Verriegeln ist kein Loeschen.
DO $pruefung$
DECLARE
  v_tab   record;
  v_summe bigint := 0;
  v_n     bigint;
BEGIN
  FOR v_tab IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'undo\_%'
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_tab.relname) INTO v_n;
    v_summe := v_summe + v_n;
  END LOOP;
  RAISE NOTICE 'Belegzeilen insgesamt nach dem Verriegeln: %', v_summe;
END
$pruefung$;

COMMIT;
