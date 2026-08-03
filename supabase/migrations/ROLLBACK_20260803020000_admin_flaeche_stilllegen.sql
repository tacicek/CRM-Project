-- Rollback zu 20260803020000_admin_flaeche_stilllegen.sql
--
-- ── Was dieser Rollback IST, und was er nicht ist ──────────────────────────
--
-- Er stellt `public.get_user_overview()` in ihrer Struktur wieder her: dieselbe
-- Signatur, dieselben Spalten, dieselben Verknuepfungen. Er stellt sie NICHT
-- wortgleich wieder her, und das ist Absicht.
--
-- Die Originalfassung entschied ihre gesamte Berechtigung an einer fest im
-- Quelltext stehenden E-Mail-Adresse — der echten Adresse eines Menschen. Diese
-- Adresse kommt hier nicht zurueck. An ihrer Stelle steht
-- `test@test.invalid`. `.invalid` ist die per RFC 2606 reservierte Endung, die
-- nie an jemanden vergeben werden kann; ein Konto mit dieser Adresse gibt es in
-- keiner Installation und kann es nicht geben.
--
-- Die wiederhergestellte Funktion weist damit JEDEN Aufrufer ab. Sie existiert
-- wieder als Objekt, gibt aber niemandem Daten. Das ist der Sinn: falls je
-- etwas ihre blosse Existenz braucht, ist sie da — Benutzerdaten fliessen
-- deswegen trotzdem keine.
--
-- ── Warum nicht die Originaladresse ────────────────────────────────────────
--
-- Weil sie der Befund war. Die Funktion ist SECURITY DEFINER und liest
-- `auth.users`; ihre Zugangskontrolle war keine Rolle und kein Recht, sondern
-- ein Name. Wer diese Adresse kontrolliert — durch Uebernahme des Kontos, durch
-- einen E-Mail-Wechsel oder weil er sie irgendwann besass —, liest die
-- Benutzerliste der ganzen Installation. Einen Rollback zu schreiben, der genau
-- diese Konstruktion zurueckholt, hiesse, den Fehler in einer Datei
-- aufzubewahren, die jemand unter Druck ausfuehrt.
--
-- Wer die Funktion wirklich wieder in Betrieb nehmen will, muss die Bedingung
-- bewusst ersetzen — und dann gehoert dort eine Rollenpruefung hin
-- (`has_role`, `is_staff`), keine Adresse. Dass diese Datei dazu zwingt, ist
-- kein Mangel, sondern die Absicht.
--
-- ── Rechte ─────────────────────────────────────────────────────────────────
--
-- `anon` bekommt EXECUTE bewusst NICHT zurueck. Es stammt aus demselben
-- `--no-privileges`-Rueckstand wie die Tabellenrechte in 20260803010000. Ein
-- Rollback stellt die Absicht von damals wieder her, nicht das Versehen.
--
-- Wiederholbar: CREATE OR REPLACE, ein zweiter Lauf ist ein No-op.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_overview()
 RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, role text, user_type text, last_sign_in_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND u.email = 'test@test.invalid'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Owner access required';
  END IF;

  RETURN QUERY
  SELECT
    u.id as user_id,
    u.email::text,
    p.first_name,
    p.last_name,
    COALESCE(ur.role::text, 'user') as role,
    CASE
      WHEN ur.role IS NOT NULL THEN 'staff'
      WHEN c.id IS NOT NULL THEN 'company'
      ELSE 'unknown'
    END as user_type,
    u.last_sign_in_at,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.companies c ON c.user_id = u.id
  WHERE u.email != 'test@test.invalid'
  ORDER BY u.last_sign_in_at DESC NULLS LAST;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_overview() TO authenticated, service_role;

DO $pruef$
DECLARE
  v_anzahl    integer;
  v_lieferte  boolean := false;
BEGIN
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_user_overview';
  IF v_anzahl <> 1 THEN
    RAISE EXCEPTION 'Rollback: erwartet genau 1 Signatur, gefunden %', v_anzahl;
  END IF;

  IF pg_catalog.has_function_privilege('anon',
       'public.get_user_overview()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback: anon haette wieder EXECUTE — das war nie beabsichtigt';
  END IF;

  -- Und der Kern: die wiederhergestellte Fassung gibt niemandem Daten.
  --
  -- Der Aufruf muss abgewiesen werden. Der innere Block faengt AUSSCHLIESSLICH
  -- die Abweisung der Funktion (`raise_exception`, P0001) und setzt eine Marke;
  -- die eigene Zusicherung steht ausserhalb. Stuende sie darin, finge dieser
  -- Handler sie selbst — und die Pruefung meldete Erfolg, gerade wenn sie
  -- fehlschlaegt.
  BEGIN
    PERFORM 1 FROM public.get_user_overview();
    v_lieferte := true;
  EXCEPTION WHEN raise_exception THEN
    v_lieferte := false;
  END;

  IF v_lieferte THEN
    RAISE EXCEPTION 'Rollback: get_user_overview hat Daten geliefert — die Bedingung wurde scharf geschaltet';
  END IF;

  RAISE NOTICE 'Rollback 20260803020000: get_user_overview existiert wieder und weist jeden ab. Zum Scharfschalten die Bedingung durch eine Rollenpruefung ersetzen.';
END
$pruef$;

COMMIT;
