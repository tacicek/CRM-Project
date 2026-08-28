-- =============================================================================
-- Die vier oeffentlichen Schreib-RPCs: EXECUTE von PUBLIC auf anon+authenticated
-- =============================================================================
--
-- BEFUND (gemessen, ops/production-truth/2026-08-28/function-authz.json)
--
-- Vier Funktionen sind `anon`-ausfuehrbar, `SECURITY DEFINER` und schreiben:
--
--   portal_redeem_magic_link(text)
--   portal_request_change(text,text,text,text)
--   update_amendment_by_token(text,text,text,text)
--   update_offer_by_token(text,text,timestamptz,timestamptz,timestamptz,text,timestamptz,text,text)
--
-- Alle vier wurden einzeln gelesen. Sie sind KEIN Rest und kein Fehler: sie sind
-- die oeffentlichen Eingaenge des Kundenbereichs und der Token-Seiten. Jede
-- schliesst ueber ein Token genau eine Zeile auf, leitet den Mandanten aus
-- dieser Zeile ab, prueft Status und Fristen und ist gegen Wiederholung
-- gesichert. `anon` behaelt sein EXECUTE — ohne das gibt es keinen
-- Kundenzugang.
--
-- WAS HIER ENGER WIRD
--
-- Drei der vier tragen ihr EXECUTE zusaetzlich fuer `PUBLIC` (`=X/postgres` in
-- der ACL). `update_amendment_by_token` tut das NICHT — dieselbe Aufgabe, ohne
-- PUBLIC. Es geht also.
--
-- Der praktische Unterschied ist heute klein: von aussen kommt man als `anon`
-- oder `authenticated`, und beide behalten ihr Recht. Der Unterschied entsteht
-- beim naechsten Rollennamen, den jemand anlegt — der erbt sonst stillschweigend
-- vier schreibende Endpunkte. Das ist der ganze Grund, und mehr wird hier auch
-- nicht behauptet.
--
-- WAS HIER NICHT PASSIERT
--
-- Keine Funktion wird geaendert, keine Signatur, kein Verhalten. `anon` und
-- `authenticated` behalten genau das, was sie heute haben. Wer eine dieser
-- Funktionen fuer einen Rest haelt und entfernen will, tut das nicht hier: das
-- waere eine Produktentscheidung ueber den Kundenbereich (P5, DEC-001).
--
-- WIEDERHOLBAR. `REVOKE` auf ein nicht vorhandenes Recht ist ein No-op.
-- =============================================================================

BEGIN;

DO $mig$
DECLARE
  f text;
  sig text;
  gefunden int;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'portal_redeem_magic_link',
    'portal_request_change',
    'update_amendment_by_token',
    'update_offer_by_token'
  ] LOOP
    gefunden := 0;

    FOR sig IN
      SELECT p.oid::regprocedure::text
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = f
    LOOP
      gefunden := gefunden + 1;
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', sig);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', sig);
      RAISE NOTICE 'verengt: %', sig;
    END LOOP;

    IF gefunden = 0 THEN
      -- Fail closed: eine Funktion, die es nicht gibt, ist kein Erfolg.
      RAISE EXCEPTION 'Funktion public.% nicht gefunden — Migration passt nicht zu diesem Schema', f;
    END IF;
  END LOOP;
END
$mig$;

-- Nachweis: keine der vier traegt danach noch ein EXECUTE fuer PUBLIC,
-- und alle vier sind fuer anon weiterhin ausfuehrbar.
DO $pruefung$
DECLARE
  f text;
  sig text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'portal_redeem_magic_link',
    'portal_request_change',
    'update_amendment_by_token',
    'update_offer_by_token'
  ] LOOP
    FOR sig IN
      SELECT p.oid::regprocedure::text
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = f
    LOOP
      IF EXISTS (
        SELECT 1
          FROM pg_proc p,
               aclexplode(p.proacl) a
         WHERE p.oid = sig::regprocedure
           AND a.grantee = 0                      -- 0 = PUBLIC
           AND a.privilege_type = 'EXECUTE'
      ) THEN
        RAISE EXCEPTION '% traegt weiterhin EXECUTE fuer PUBLIC', sig;
      END IF;

      IF NOT has_function_privilege('anon', sig::regprocedure, 'EXECUTE') THEN
        RAISE EXCEPTION '% ist fuer anon nicht mehr ausfuehrbar — der Kundenzugang waere zerstoert', sig;
      END IF;
    END LOOP;
  END LOOP;
END
$pruefung$;

COMMIT;
