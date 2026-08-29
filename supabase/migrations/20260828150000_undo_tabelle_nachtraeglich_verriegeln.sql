-- Die Undo-Tabelle aus R-1 lag ohne Row Level Security in der Produktion.
--
-- WAS GEMESSEN WURDE (2026-08-28, lesend gegen die Produktion)
--
-- `public.undo_20260828100000` war die EINZIGE Tabelle im gesamten public-Schema
-- ohne RLS — 101 andere Tabellen hatten sie, die vier aelteren Undo-Tabellen
-- (20260802110000, 20260802120000, 20260802130000, 20260809120000) ebenfalls.
--
-- Die ACL ist bei allen fuenf identisch:
--   anon=arwdDxt, authenticated=arwdDxt, service_role=arwdDxt
-- Diese Rechte stammen NICHT aus der Migration, sondern aus dem schema-weiten
-- ALTER DEFAULT PRIVILEGES von Supabase. Jede neue Tabelle im public-Schema
-- bekommt sie. Deshalb ist RLS hier die Grenze, nicht das GRANT — und genau
-- diese eine Zeile fehlte in 20260828100000.
--
-- WAS DAS OBJEKT NICHT KANN
--
-- Es ist eine gewoehnliche Tabelle (relkind 'r'), keine Funktion: kein
-- SECURITY DEFINER, kein dynamisches SQL, kein Trigger, keine Regel, und keine
-- Funktion in der Datenbank referenziert sie. Sie kann die entzogene Policy
-- also NICHT wiederherstellen und anon keine Rechte zurueckgeben — dafuer
-- braeuchte es DDL, und Daten fuehren kein DDL aus. Das Risiko ist nicht
-- Rechteausweitung, sondern der Beleg selbst: ein anonymer Besucher konnte die
-- Zeile lesen, faelschen oder loeschen. Ein Undo-Protokoll, das der Angreifer
-- editieren kann, ist als Beweismittel wertlos.
--
-- WAS DIESE MIGRATION TUT
--
-- 1. Die Tabellenrechte von anon und authenticated entziehen. **Das ist die
--    tragende Massnahme, nicht die zweite Linie.** Eine erste Fassung dieses
--    Kommentars behauptete das Gegenteil ("RLS allein wuerde genuegen") — falsch:
--
--        TRUNCATE unterliegt KEINER Row Level Security.
--
--    Die vier aelteren Undo-Tabellen beweisen es. Sie haben RLS an und die
--    Default-Grants behalten; in der Produktion gemessen:
--        undo_20260802110000  rls=true  anon_truncate=true
--        undo_20260802120000  rls=true  anon_truncate=true
--        undo_20260802130000  rls=true  anon_truncate=true
--        undo_20260809120000  rls=true  anon_truncate=true
--    RLS haette den Beleg also nicht vor Vernichtung geschuetzt. Nur das
--    Entziehen des Rechts tut das. (Zur Reichweite dieses Befunds siehe M01-05:
--    anon haelt TRUNCATE auf 97 der 102 Tabellen — nach heutiger Messung nicht
--    erreichbar, aber ein eigener Befund.)
-- 2. RLS zusaetzlich einschalten, ohne Policy — dieselbe Form wie bei den vier
--    aelteren Undo-Tabellen, und die zweite Linie, falls jemand spaeter
--    versehentlich ein Recht zurueckgibt. RLS ohne Policy heisst: alles
--    verboten, ausser fuer Rollen mit BYPASSRLS.
--
-- Es gibt keinen Aufrufer im Anwendungscode (geprueft in src/,
-- supabase/functions/, scripts/) und keinen in der Datenbank.
--
-- Die urspruengliche Migration 20260828100000 wird NICHT angefasst — sie ist
-- angewendet, und angewendete Migrationen sind unveraenderlich.

BEGIN;

-- Ohne die Tabelle gibt es nichts zu verriegeln. 20260828100000 legt sie nur an,
-- wenn die Policy dort tatsaechlich stand; in einer frischen Umgebung kann sie
-- fehlen. Dann ist das kein Fehler, sondern nichts zu tun.
DO $vorpruefung$
BEGIN
  IF to_regclass('public.undo_20260828100000') IS NULL THEN
    RAISE NOTICE 'public.undo_20260828100000 existiert nicht — nichts zu verriegeln.';
  END IF;
END
$vorpruefung$;

DO $verriegeln$
BEGIN
  IF to_regclass('public.undo_20260828100000') IS NULL THEN
    RETURN;
  END IF;

  -- REVOKE ALL entzieht auch TRUNCATE. Das ist der Punkt.
  REVOKE ALL ON public.undo_20260828100000 FROM anon;
  REVOKE ALL ON public.undo_20260828100000 FROM authenticated;
  EXECUTE 'ALTER TABLE public.undo_20260828100000 ENABLE ROW LEVEL SECURITY';
END
$verriegeln$;

-- Nachweis 1: RLS ist an, und keine Policy oeffnet sie wieder.
DO $pruefung$
DECLARE
  v_rls      boolean;
  v_policies integer;
BEGIN
  IF to_regclass('public.undo_20260828100000') IS NULL THEN RETURN; END IF;

  SELECT c.relrowsecurity INTO v_rls
    FROM pg_class c WHERE c.oid = 'public.undo_20260828100000'::regclass;
  SELECT count(*) INTO v_policies
    FROM pg_policy WHERE polrelid = 'public.undo_20260828100000'::regclass;

  IF NOT v_rls THEN
    RAISE EXCEPTION 'RLS ist nach der Migration immer noch aus.';
  END IF;
  IF v_policies <> 0 THEN
    RAISE EXCEPTION 'Unerwartete Policy auf der Undo-Tabelle: % Stueck.', v_policies;
  END IF;
END
$pruefung$;

-- Nachweis 2: anon und authenticated haben kein Tabellenrecht mehr.
DO $pruefung$
DECLARE
  v_rolle text;
  v_recht text;
BEGIN
  IF to_regclass('public.undo_20260828100000') IS NULL THEN RETURN; END IF;

  -- TRUNCATE gehoert zwingend in diese Liste: es umgeht RLS. Eine Pruefung ohne
  -- TRUNCATE waere genau dann gruen, wenn der Beleg noch vernichtbar ist.
  FOREACH v_rolle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH v_recht IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege(v_rolle, 'public.undo_20260828100000', v_recht) THEN
        RAISE EXCEPTION '% haelt weiterhin %-Recht auf der Undo-Tabelle.', v_rolle, v_recht;
      END IF;
    END LOOP;
  END LOOP;
END
$pruefung$;

-- Nachweis 3: der Ruecknahmeweg bleibt benutzbar.
--
-- Eine erste Fassung prueft hier `rolbypassrls` von service_role und schloss
-- daraus, der Ruecknahmeweg sei intakt. Das war der falsche Akteur:
-- ROLLBACK_20260828100000 fuehrt `CREATE POLICY` und `DROP TABLE` aus, und
-- beides verlangt EIGENTUEMERSCHAFT, nicht BYPASSRLS. Gemessen:
--     set role service_role; drop table public.undo_20260828100000;
--       -> ERROR: must be owner of table
-- Die Ruecknahme ist also ohnehin nur als `postgres` ausfuehrbar — vor wie nach
-- dieser Migration. Geprueft wird deshalb, was diese Datei wirklich beruehren
-- kann: dass der Eigentuemer sich nicht geaendert hat.
DO $pruefung$
DECLARE
  v_owner text;
BEGIN
  IF to_regclass('public.undo_20260828100000') IS NULL THEN RETURN; END IF;

  SELECT pg_get_userbyid(c.relowner) INTO v_owner
    FROM pg_class c WHERE c.oid = 'public.undo_20260828100000'::regclass;

  IF v_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'Eigentuemer der Undo-Tabelle ist "%", erwartet postgres — die Ruecknahme haette keinen Ausfuehrenden.', v_owner;
  END IF;
END
$pruefung$;

-- Nachweis 4: Verriegeln darf nicht loeschen.
--
-- Nicht "mindestens eine Zeile" — eine legitim leere Undo-Tabelle waere sonst
-- ein Abbruchgrund. Geprueft wird, dass diese Migration den Bestand nicht
-- veraendert hat; sie fuehrt kein DELETE aus, also muss der Zaehler stehen.
DO $pruefung$
DECLARE
  v_zeilen integer;
BEGIN
  IF to_regclass('public.undo_20260828100000') IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_zeilen FROM public.undo_20260828100000;
  RAISE NOTICE 'Undo-Tabelle verriegelt, % Belegzeile(n) unveraendert vorhanden.', v_zeilen;
END
$pruefung$;

COMMIT;
