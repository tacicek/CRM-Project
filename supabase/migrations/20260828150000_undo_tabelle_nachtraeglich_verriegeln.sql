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
-- 1. RLS einschalten, ohne Policy — dieselbe Form wie bei den vier aelteren
--    Undo-Tabellen. RLS ohne Policy heisst: alles verboten, ausser fuer Rollen
--    mit BYPASSRLS. Gemessen: service_role und postgres haben BYPASSRLS, anon
--    und authenticated nicht. Der Ruecknahmeweg bleibt damit offen.
-- 2. Die Tabellenrechte von anon und authenticated zusaetzlich entziehen. RLS
--    allein wuerde genuegen; das Entziehen ist die zweite Linie, falls jemand
--    spaeter versehentlich eine Policy anlegt. Es gibt keinen Aufrufer im
--    Anwendungscode (geprueft in src/, supabase/functions/, scripts/).
--
-- Die urspruengliche Migration 20260828100000 wird NICHT angefasst — sie ist
-- angewendet, und angewendete Migrationen sind unveraenderlich.

ALTER TABLE public.undo_20260828100000 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.undo_20260828100000 FROM anon;
REVOKE ALL ON public.undo_20260828100000 FROM authenticated;

-- Nachweis 1: RLS ist an, und keine Policy oeffnet sie wieder.
DO $pruefung$
DECLARE
  v_rls      boolean;
  v_policies integer;
BEGIN
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
  FOREACH v_rolle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH v_recht IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege(v_rolle, 'public.undo_20260828100000', v_recht) THEN
        RAISE EXCEPTION '% haelt weiterhin %-Recht auf der Undo-Tabelle.', v_rolle, v_recht;
      END IF;
    END LOOP;
  END LOOP;
END
$pruefung$;

-- Nachweis 3: der Ruecknahmeweg bleibt benutzbar — service_role kommt weiter heran.
DO $pruefung$
BEGIN
  IF NOT has_table_privilege('service_role', 'public.undo_20260828100000', 'SELECT') THEN
    RAISE EXCEPTION 'service_role kann die Undo-Zeile nicht mehr lesen — die Ruecknahme waere blind.';
  END IF;
  IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'service_role umgeht RLS nicht — RLS ohne Policy wuerde auch sie sperren.';
  END IF;
END
$pruefung$;

-- Nachweis 4: der Beleg selbst ist noch da. Verriegeln darf nicht loeschen.
DO $pruefung$
DECLARE
  v_zeilen integer;
BEGIN
  SELECT count(*) INTO v_zeilen FROM public.undo_20260828100000;
  IF v_zeilen < 1 THEN
    RAISE EXCEPTION 'Die Undo-Zeile ist verschwunden — der R-1-Beleg waere verloren.';
  END IF;
END
$pruefung$;
