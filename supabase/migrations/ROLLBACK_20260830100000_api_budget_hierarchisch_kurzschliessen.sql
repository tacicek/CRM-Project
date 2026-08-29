-- Ruecknahme zu 20260830100000.
--
-- ⚠️ Stellt die Fassung aus 20260829120000 wieder her. Die zaehlt zwar korrekt,
-- legt aber bei einer Abweisung durch Global- oder Firmentopf trotzdem eine
-- Zeile fuer den nie gesehenen Prinzipal an. Gemessen: 100 abgewiesene neue
-- Mitglieder -> 101 Benutzerzeilen mit count 0, und die Aufraeumung laeuft nur
-- beim ersten ERLAUBTEN Aufruf, also gerade dann nicht.
--
-- Ausserdem faellt die maschinenlesbare Mitgliedschafts-Abweisung weg: statt
-- SQLSTATE R2403 mit DETAIL r2_membership_denied hebt die alte Fassung wieder
-- 42501, denselben Code wie ein echter Rechteschwund. Ein Handler kann danach
-- einen Fremdfirmen-Zugriff nicht mehr von einem kaputten GRANT unterscheiden
-- und wuerde einen Ausfall als 403 an den Kunden melden.
--
-- Reihenfolge wie bei der Vorgaengerin: zuerst die Edge-Seite zuruecknehmen,
-- diese Datei zuletzt und nur, wenn kein ausgerollter Handler mehr
-- consume_api_budget aufruft.
--
-- Die Wiederherstellung geschieht durch erneutes Einspielen von
-- 20260829120000_api_budget_ohne_topfvergiftung.sql. Diese Datei enthaelt
-- bewusst keine zweite Kopie derselben Funktion: zwei Quellen fuer denselben
-- Koerper laufen frueher oder spaeter auseinander.
--
--   psql ... -f supabase/migrations/20260829120000_api_budget_ohne_topfvergiftung.sql
--
-- Danach pruefen:
--   SELECT prosrc LIKE '%denied_at%' FROM pg_proc
--    WHERE oid = to_regprocedure('public.consume_api_budget(text,uuid,uuid)');
--   -- erwartet: false (die hierarchische Fassung ist weg)

-- In eine Transaktion gefasst, damit der Abbruch unten geschlossen scheitert
-- statt einen halben Zustand zu hinterlassen. Das eigene Ruecknahme-Tor hat
-- genau das an dieser Datei bemaengelt, und zu Recht.
BEGIN;

DO $$
BEGIN
  RAISE EXCEPTION
    'Diese Ruecknahme wird durch erneutes Einspielen von 20260829120000 ausgefuehrt, nicht durch diese Datei. Siehe Kopfkommentar.'
    USING ERRCODE = 'invalid_parameter_value';
END
$$;

COMMIT;
