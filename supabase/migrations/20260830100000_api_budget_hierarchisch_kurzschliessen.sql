-- Ein abgewiesener Aufruf darf auch keine ZEILE anlegen.
--
-- WAS 20260829120000 NOCH ZULIESS
--
-- Sie legt erst alle drei Zeilen mit count 0 an und sperrt dann. Die ZAEHLER
-- blieben dabei korrekt — aber eine Anfrage, die am Firmen- oder Globaltopf
-- scheitert, hinterlaesst trotzdem eine frische Zeile fuer einen nie gesehenen
-- Prinzipal. Am Wegwerf-Stapel gemessen:
--
--   Firma auf 150/150, global 150, Tabelle 7 Zeilen
--   ein Aufruf eines sechsten, nie gesehenen Mitglieds -> allowed=false,
--     Zaehler unveraendert, aber Tabelle 8 Zeilen
--   100 weitere nie gesehene Mitglieder -> 108 Zeilen, davon 101 Benutzerzeilen
--     mit count 0
--
-- Die Aufraeumung laeuft nur beim ersten ERLAUBTEN Aufruf eines Fensters. Genau
-- solange ein Topf erschoepft ist, gibt es keinen erlaubten Aufruf — die Zeilen
-- wachsen also gerade dann, wenn niemand mehr aufraeumt. Wer viele gueltige
-- Mitglieder oder viele Firmen hat, blaeht die Tabelle mit lauter Anfragen auf,
-- die nie bei Google ankommen.
--
-- 20260829120000 wird NICHT bearbeitet. Dies ist die Begleitmigration.
-- Anwendungsreihenfolge: 20260828130000, 20260829120000, dann diese.
--
-- DIE HIERARCHIE
--
--   global anlegen -> sperren -> voll? dann Schluss, OHNE Firmen- oder
--   Benutzerzeile anzulegen
--     -> Firma anlegen -> sperren -> voll? dann Schluss, OHNE Benutzerzeile
--       -> Benutzer anlegen -> sperren -> voll? dann Schluss
--         -> alle drei genau einmal erhoehen
--
-- Die Sperrreihenfolge bleibt global -> firma -> benutzer, jetzt aber
-- kurzschliessend: was nicht gebraucht wird, wird nicht angefasst.
--
-- MASCHINENLESBARE MITGLIEDSCHAFTS-ABWEISUNG
--
-- Bisher hob die Funktion `insufficient_privilege` (42501). Denselben Code hebt
-- Postgres auch bei echtem Rechteschwund — ein Handler koennte einen kaputten
-- GRANT nicht von einem Fremdfirmen-Zugriff unterscheiden und wuerde einen
-- Ausfall als 403 an den Kunden melden. Deshalb ein eigener, kollisionsfreier
-- Code plus ein stabiler Marker im DETAIL:
--
--   SQLSTATE R2403
--   DETAIL   r2_membership_denied
--
-- Der Handler prueft beides. Die Antwort an den Kunden bleibt allgemein und
-- verraet nicht, ob die fremde Firma existiert.

BEGIN;

CREATE OR REPLACE FUNCTION public.consume_api_budget(
  p_bucket     text,
  p_user_id    uuid,
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_fenster_sekunden int;
  v_limit_benutzer   int;
  v_limit_firma      int;
  v_limit_global     int;
  v_fenster_start    timestamptz;
  v_p_benutzer       text;
  v_p_firma          text;
  v_zaehler_benutzer int;
  v_zaehler_firma    int;
  v_zaehler_global   int;
  v_retry_after      int;
  v_erste_im_fenster boolean := false;
BEGIN
  CASE p_bucket
    WHEN 'google-places' THEN
      v_fenster_sekunden := 60; v_limit_benutzer := 60; v_limit_firma := 300; v_limit_global := 1000;
    WHEN 'google-distance' THEN
      v_fenster_sekunden := 60; v_limit_benutzer := 30; v_limit_firma := 150; v_limit_global := 500;
    ELSE
      RAISE EXCEPTION 'Unbekannter Budgettopf: %', p_bucket
        USING ERRCODE = 'invalid_parameter_value';
  END CASE;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Kein geprueffter Aufrufer'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  -- Mitgliedschaft VOR jeder Zustandsaenderung, mit maschinenlesbarer Identitaet.
  IF p_company_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.company_members
                     WHERE user_id = p_user_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Keine Mitgliedschaft in dieser Firma'
      USING ERRCODE = 'R2403', DETAIL = 'r2_membership_denied';
  END IF;

  v_fenster_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / v_fenster_sekunden) * v_fenster_sekunden
  );
  v_p_benutzer := 'user:' || p_user_id::text;
  v_p_firma    := 'company:' || p_company_id::text;

  v_retry_after := GREATEST(
    1,
    ceil(extract(epoch FROM
      (v_fenster_start + make_interval(secs => v_fenster_sekunden)) - clock_timestamp()
    ))::int
  );

  -- ── global ───────────────────────────────────────────────────────────────
  INSERT INTO public.api_rate_budget (bucket, principal, window_start, count)
  VALUES (p_bucket, 'global', v_fenster_start, 0)
  ON CONFLICT (bucket, principal, window_start) DO NOTHING;

  SELECT count INTO v_zaehler_global
    FROM public.api_rate_budget
   WHERE bucket = p_bucket AND principal = 'global' AND window_start = v_fenster_start
     FOR UPDATE;

  IF v_zaehler_global >= v_limit_global THEN
    -- Schluss. Keine Firmen-, keine Benutzerzeile.
    RETURN jsonb_build_object(
      'allowed', false, 'retry_after', v_retry_after, 'bucket', p_bucket,
      'window_start', v_fenster_start, 'denied_at', 'global',
      'counts', jsonb_build_object('global', v_zaehler_global));
  END IF;

  -- ── Firma ────────────────────────────────────────────────────────────────
  INSERT INTO public.api_rate_budget (bucket, principal, window_start, count)
  VALUES (p_bucket, v_p_firma, v_fenster_start, 0)
  ON CONFLICT (bucket, principal, window_start) DO NOTHING;

  SELECT count INTO v_zaehler_firma
    FROM public.api_rate_budget
   WHERE bucket = p_bucket AND principal = v_p_firma AND window_start = v_fenster_start
     FOR UPDATE;

  IF v_zaehler_firma >= v_limit_firma THEN
    -- Schluss. Keine Benutzerzeile.
    RETURN jsonb_build_object(
      'allowed', false, 'retry_after', v_retry_after, 'bucket', p_bucket,
      'window_start', v_fenster_start, 'denied_at', 'company',
      'counts', jsonb_build_object('global', v_zaehler_global, 'company', v_zaehler_firma));
  END IF;

  -- ── Benutzer ─────────────────────────────────────────────────────────────
  INSERT INTO public.api_rate_budget (bucket, principal, window_start, count)
  VALUES (p_bucket, v_p_benutzer, v_fenster_start, 0)
  ON CONFLICT (bucket, principal, window_start) DO NOTHING;

  SELECT count INTO v_zaehler_benutzer
    FROM public.api_rate_budget
   WHERE bucket = p_bucket AND principal = v_p_benutzer AND window_start = v_fenster_start
     FOR UPDATE;

  IF v_zaehler_benutzer >= v_limit_benutzer THEN
    RETURN jsonb_build_object(
      'allowed', false, 'retry_after', v_retry_after, 'bucket', p_bucket,
      'window_start', v_fenster_start, 'denied_at', 'user',
      'counts', jsonb_build_object('global', v_zaehler_global,
                                   'company', v_zaehler_firma,
                                   'user', v_zaehler_benutzer));
  END IF;

  -- ── erlaubt: alle drei genau einmal ──────────────────────────────────────
  v_erste_im_fenster := (v_zaehler_benutzer = 0);

  UPDATE public.api_rate_budget SET count = count + 1
   WHERE bucket = p_bucket AND principal = 'global' AND window_start = v_fenster_start;
  UPDATE public.api_rate_budget SET count = count + 1
   WHERE bucket = p_bucket AND principal = v_p_firma AND window_start = v_fenster_start;
  UPDATE public.api_rate_budget SET count = count + 1
   WHERE bucket = p_bucket AND principal = v_p_benutzer AND window_start = v_fenster_start;

  IF v_erste_im_fenster THEN
    DELETE FROM public.api_rate_budget
     WHERE window_start < clock_timestamp() - interval '1 hour';
  END IF;

  RETURN jsonb_build_object(
    'allowed', true, 'retry_after', 0, 'bucket', p_bucket,
    'window_start', v_fenster_start,
    'counts', jsonb_build_object('user',    v_zaehler_benutzer + 1,
                                 'company', v_zaehler_firma + 1,
                                 'global',  v_zaehler_global + 1));
END
$function$;

REVOKE ALL ON FUNCTION public.consume_api_budget(text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_api_budget(text, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.consume_api_budget(text, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_budget(text, uuid, uuid) TO service_role;

DO $pruefung$
DECLARE v_oid oid;
BEGIN
  v_oid := to_regprocedure('public.consume_api_budget(text,uuid,uuid)');
  IF v_oid IS NULL THEN RAISE EXCEPTION 'consume_api_budget fehlt'; END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon oder authenticated darf consume_api_budget ausfuehren';
  END IF;
  IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role darf consume_api_budget nicht ausfuehren';
  END IF;
  IF (SELECT proconfig FROM pg_proc WHERE oid = v_oid) IS DISTINCT FROM
     ARRAY['search_path=pg_catalog, public'] THEN
    RAISE EXCEPTION 'search_path ist nicht der beabsichtigte Wert: %',
      (SELECT proconfig FROM pg_proc WHERE oid = v_oid);
  END IF;
END
$pruefung$;

COMMIT;
