-- Ruecknahme zu 20260829120000.
--
-- ⚠️ EHRLICH: diese Datei stellt die TOPFVERGIFTUNG WIEDER HER.
--
-- Sie setzt die Funktion aus 20260828130000 zurueck, und die erhoeht Benutzer-,
-- Firmen- und Globalzaehler, BEVOR sie entscheidet. Danach kann ein einzelnes
-- ausgeschoepftes Konto den globalen Topf wieder leerlaufen lassen und damit
-- jede Firma auf 429 setzen, ohne dass eine einzige Google-Anfrage entsteht.
--
-- DESHALB IST DIE BETRIEBLICHE RUECKNAHMEREIHENFOLGE UMGEKEHRT:
--
--   Bei einem Fehler in den Handlern oder der Wache wird ZUERST die Edge-Seite
--   zurueckgenommen. Die Datenbankfunktion bleibt stehen — sie ist die
--   strengere. Erst wenn KEIN ausgerollter Handler mehr consume_api_budget
--   aufruft, darf diese Datei laufen.
--
--   Wer sie frueher laufen laesst, tauscht einen Handlerfehler gegen eine
--   wiederhergestellte Denial-of-Service-Flaeche.
--
-- Die Tabellenrechte fuer service_role werden ebenfalls zurueckgegeben, weil die
-- alte Fassung ohne sie zwar liefe (sie ist SECURITY DEFINER), der Zustand aber
-- exakt dem von 20260828130000 entsprechen soll.

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_rate_budget TO service_role;

CREATE OR REPLACE FUNCTION public.consume_api_budget(
  p_bucket     text,
  p_user_id    uuid,
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fenster_sekunden int;
  v_limit_benutzer   int;
  v_limit_firma      int;
  v_limit_global     int;
  v_fenster_start    timestamptz;
  v_zaehler_benutzer int;
  v_zaehler_firma    int;
  v_zaehler_global   int;
  v_erlaubt          boolean;
  v_retry_after      int;
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

  IF p_company_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.company_members
                     WHERE user_id = p_user_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Keine Mitgliedschaft in dieser Firma'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_fenster_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / v_fenster_sekunden) * v_fenster_sekunden
  );

  INSERT INTO public.api_rate_budget (bucket, principal, window_start, count)
  VALUES (p_bucket, 'user:' || p_user_id::text, v_fenster_start, 1)
  ON CONFLICT (bucket, principal, window_start)
  DO UPDATE SET count = public.api_rate_budget.count + 1
  RETURNING count INTO v_zaehler_benutzer;

  INSERT INTO public.api_rate_budget (bucket, principal, window_start, count)
  VALUES (p_bucket, 'company:' || p_company_id::text, v_fenster_start, 1)
  ON CONFLICT (bucket, principal, window_start)
  DO UPDATE SET count = public.api_rate_budget.count + 1
  RETURNING count INTO v_zaehler_firma;

  INSERT INTO public.api_rate_budget (bucket, principal, window_start, count)
  VALUES (p_bucket, 'global', v_fenster_start, 1)
  ON CONFLICT (bucket, principal, window_start)
  DO UPDATE SET count = public.api_rate_budget.count + 1
  RETURNING count INTO v_zaehler_global;

  v_erlaubt := v_zaehler_benutzer <= v_limit_benutzer
           AND v_zaehler_firma    <= v_limit_firma
           AND v_zaehler_global   <= v_limit_global;

  v_retry_after := GREATEST(
    1,
    ceil(extract(epoch FROM
      (v_fenster_start + make_interval(secs => v_fenster_sekunden)) - clock_timestamp()
    ))::int
  );

  IF v_zaehler_benutzer = 1 THEN
    DELETE FROM public.api_rate_budget
     WHERE window_start < clock_timestamp() - interval '1 hour';
  END IF;

  RETURN jsonb_build_object(
    'allowed',      v_erlaubt,
    'retry_after',  CASE WHEN v_erlaubt THEN 0 ELSE v_retry_after END,
    'bucket',       p_bucket,
    'window_start', v_fenster_start,
    'counts',       jsonb_build_object(
                      'user',    v_zaehler_benutzer,
                      'company', v_zaehler_firma,
                      'global',  v_zaehler_global
                    )
  );
END
$function$;

COMMIT;
