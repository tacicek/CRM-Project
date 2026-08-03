-- Rollback zu 20260803020000_admin_flaeche_stilllegen.sql
--
-- ── Was dieser Rollback tut ────────────────────────────────────────────────
--
-- Er bringt `public.get_user_overview()` als AUFRUFBARES OBJEKT zurueck —
-- gleiche Signatur, gleiche Spalten, gleicher Rueckgabetyp — und sonst nichts.
-- Der Rumpf besteht aus einer einzigen Anweisung:
--
--     RAISE EXCEPTION 'get_user_overview is retired'
--
-- Es gibt keinen Zweig, keine Bedingung und keinen Zustand, unter dem diese
-- Funktion Daten herausgibt. Sie liest `auth.users` nicht, sie vergleicht keine
-- E-Mail-Adresse, sie sieht keine Zeile irgendeiner Tabelle. Wer sie aufruft,
-- bekommt einen Fehler — jeder, immer.
--
-- ── Warum nicht die alte Fassung ───────────────────────────────────────────
--
-- Die Originalfassung war SECURITY DEFINER, las `auth.users` und entschied ihre
-- gesamte Berechtigung an einer fest im Quelltext stehenden E-Mail-Adresse. Das
-- ist keine Rolle und kein Recht, sondern ein Name: wer die Adresse
-- kontrolliert — durch Uebernahme des Kontos, durch einen E-Mail-Wechsel oder
-- weil er sie irgendwann besass —, liest die Benutzerliste der ganzen
-- Installation.
--
-- Eine Zwischenfassung dieser Datei ersetzte die echte Adresse durch eine aus
-- der per RFC 2606 im DNS reservierten Endung und nannte das Ergebnis
-- funktionslos. Das war falsch. Die Adressspalte in der Benutzertabelle ist
-- freier Text, den niemand gegen das DNS prueft: wer eine Zeile mit genau
-- diesem Wert anlegen kann, schaltet die Funktion damit scharf. Die
-- Konstruktion blieb also dieselbe wie zuvor, nur mit einem anderen Namen
-- darin; ihre Sicherheit haette daran gehangen, dass niemand auf die Idee
-- kommt. Deshalb ist der Vergleich jetzt ganz weg — und nicht nur sein Inhalt.
--
-- ── Wozu die Funktion dann noch gut ist ────────────────────────────────────
--
-- Fuer den einen Fall, fuer den ein Rollback ueberhaupt gedacht ist: irgendetwas
-- erwartet, dass der Name im Katalog steht — ein Client mit generierten Typen,
-- ein Skript, eine Ansicht. Das ist wieder erfuellt, ohne dass ein einziges
-- Datum fliesst.
--
-- Wer die Uebersicht wirklich zurueck will, schreibt eine neue Funktion mit
-- einer Rollenpruefung (`has_role`, `is_staff`). Diese Datei ist dafuer
-- ausdruecklich nicht die Vorlage.
--
-- ── Rechte ─────────────────────────────────────────────────────────────────
--
-- `PUBLIC` und `anon` bekommen EXECUTE nicht zurueck. Fuer `anon` stammte es
-- aus demselben `--no-privileges`-Rueckstand wie die Tabellenrechte in
-- 20260803010000; ein Rollback stellt die Absicht von damals wieder her, nicht
-- das Versehen. `authenticated` behaelt EXECUTE, damit der Aufruf eine echte
-- Abweisung ergibt und nicht an einem fehlenden Recht scheitert — die
-- Nachpruefung unten stuetzt sich darauf.
--
-- Wiederholbar: CREATE OR REPLACE, ein zweiter Lauf ist ein No-op.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_overview()
 RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, role text, user_type text, last_sign_in_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 -- Kein SECURITY DEFINER: die Funktion liest nichts, also braucht sie auch
 -- keine fremden Rechte. Die alte Fassung brauchte sie nur fuer `auth.users`.
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'get_user_overview is retired';
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_overview() TO authenticated, service_role;

-- ── Nachpruefung, fail-closed ──────────────────────────────────────────────
DO $pruef$
DECLARE
  v_anzahl   integer;
  v_quelle   text;
  v_lieferte boolean := false;
BEGIN
  -- (1) Genau eine Signatur.
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_user_overview';
  IF v_anzahl <> 1 THEN
    RAISE EXCEPTION 'Rollback: erwartet genau 1 Signatur, gefunden %', v_anzahl;
  END IF;

  SELECT p.prosrc INTO v_quelle
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_user_overview';

  -- (2) Der Rumpf kann von keiner Zeile abhaengen.
  --
  --     Das ist die eigentliche Zusicherung. Steht im Rumpf weder ein Zugriff
  --     auf `auth.users` noch ein Vergleich mit einer Adresse, dann kann auch
  --     ein neu angelegtes Konto — mit welcher Adresse auch immer — am
  --     Ergebnis nichts aendern. Die Aussage gilt damit fuer alle Zeilen, die
  --     es je geben wird, und nicht nur fuer die, die es gerade gibt.
  IF v_quelle ILIKE '%auth.users%' THEN
    RAISE EXCEPTION 'Rollback: der Rumpf liest auth.users';
  END IF;
  IF v_quelle ILIKE '%email%' THEN
    RAISE EXCEPTION 'Rollback: der Rumpf nennt eine E-Mail-Spalte';
  END IF;
  IF v_quelle LIKE '%@%' THEN
    RAISE EXCEPTION 'Rollback: der Rumpf enthaelt eine Adresse';
  END IF;
  IF v_quelle NOT LIKE '%get_user_overview is retired%' THEN
    RAISE EXCEPTION 'Rollback: die unbedingte Abweisung fehlt im Rumpf';
  END IF;

  -- (3) Und sie braucht keine fremden Rechte mehr.
  PERFORM 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_user_overview' AND p.prosecdef;
  IF FOUND THEN
    RAISE EXCEPTION 'Rollback: die Funktion ist wieder SECURITY DEFINER';
  END IF;

  -- (4) Rechte: authenticated ja (sonst waere (5) keine Abweisung, sondern ein
  --     fehlendes Recht), PUBLIC und anon nein.
  IF NOT pg_catalog.has_function_privilege('authenticated',
       'public.get_user_overview()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback: authenticated kann nicht aufrufen — (5) waere aussagelos';
  END IF;
  IF pg_catalog.has_function_privilege('anon',
       'public.get_user_overview()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback: anon haette wieder EXECUTE — das war nie beabsichtigt';
  END IF;

  -- (5) Der Aufruf als `authenticated` wird abgewiesen.
  --
  --     Der innere Block setzt nur eine Marke; die eigene Zusicherung steht
  --     ausserhalb. Stuende sie darin, finge dieser Handler sie selbst — und
  --     die Pruefung meldete Erfolg, gerade wenn sie fehlschlaegt.
  BEGIN
    SET LOCAL ROLE authenticated;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'Rollback: kann nicht als authenticated pruefen — Rollenwechsel verweigert';
  END;

  BEGIN
    PERFORM 1 FROM public.get_user_overview();
    v_lieferte := true;
  EXCEPTION WHEN OTHERS THEN
    v_lieferte := false;
  END;

  RESET ROLE;

  IF v_lieferte THEN
    RAISE EXCEPTION 'Rollback: get_user_overview hat einen Aufruf beantwortet, statt ihn abzuweisen';
  END IF;

  RAISE NOTICE 'Rollback 20260803020000: get_user_overview existiert wieder und weist jeden Aufruf ab. Kein Tabellenzugriff, kein Adressvergleich.';
END
$pruef$;

COMMIT;
