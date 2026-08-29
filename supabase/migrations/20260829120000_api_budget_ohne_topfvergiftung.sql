-- Ein abgewiesener Aufruf darf keinen fremden Topf leeren.
--
-- DER FEHLER IN 20260828130000
--
-- Die erste Fassung erhoeht erst alle drei Zaehler und entscheidet DANACH:
--
--     INSERT … 'user:…'    ON CONFLICT DO UPDATE SET count = count + 1  RETURNING …
--     INSERT … 'company:…' ON CONFLICT DO UPDATE SET count = count + 1  RETURNING …
--     INSERT … 'global'    ON CONFLICT DO UPDATE SET count = count + 1  RETURNING …
--     v_erlaubt := benutzer <= limit AND firma <= limit AND global <= limit;
--
-- Ein Benutzer, der sein eigenes Limit laengst ueberschritten hat, treibt damit
-- weiterhin Firmen- und Globalzaehler hoch — ohne dass je eine Anfrage bei
-- Google ankommt. Nach 500 abgewiesenen Versuchen eines einzigen Kontos ist der
-- globale Topf leer und JEDE Firma bekommt 429. Ein Denial-of-Service, der die
-- Drossel selbst als Waffe benutzt, und er kostet den Angreifer nichts.
--
-- 20260828130000 wird NICHT bearbeitet — sie liegt auf `main`, Migrationen sind
-- anfuegend. Dies ist die Nachfolgerin; die Anwendungsreihenfolge ist
-- 20260828130000 zuerst, dann diese, und erst danach darf ein Handler ausgerollt
-- werden.
--
-- DER VERTRAG
--
--   1. Topf pruefen (Grenzen kommen aus dem Repo, nie vom Aufrufer).
--   2. Geprueften Aufrufer verlangen.
--   3. Mitgliedschaft serverseitig pruefen — VOR jeder Zustandsaenderung.
--   4. Festes Fenster aus der Serveruhr.
--   5. Die drei Zeilen mit count 0 anlegen (global, firma, benutzer).
--   6. In GENAU dieser Reihenfolge sperren: global, firma, benutzer.
--   7. Alle drei Staende unter gehaltener Sperre lesen.
--   8. Ist irgendein Limit schon erreicht: allowed=false und KEINE Erhoehung.
--   9. Sonst: alle drei genau einmal erhoehen, allowed=true.
--  10. Fehler schlagen geschlossen fehl.
--
-- ZUR SPERRREIHENFOLGE — ehrlich gesagt
--
-- `global` steht bei jeder Transaktion an erster Stelle und ist fuer alle
-- dieselbe Zeile. Diese Entscheidung **serialisiert** die kurze Budgetentscheidung
-- also ueber alle Aufrufer hinweg. Das ist kein sperrfreier Entwurf und wird hier
-- nicht als solcher ausgegeben: es ist Korrektheit zuerst. Bei 500 bzw. 1000
-- Anfragen je Minute ist die gehaltene Zeit pro Transaktion winzig, und der
-- Preis dafuer ist, dass eine Zykluskante gar nicht erst entstehen kann — wer
-- immer zuerst dieselbe Zeile nimmt, kann nicht mit jemandem verklemmen, der sie
-- spaeter nimmt. Sollte die Last je steigen, ist der globale Topf die Stelle, die
-- man neu entwirft, nicht die Reihenfolge.

BEGIN;

-- ── Dienstrolle verliert den direkten Tabellenzugriff ───────────────────────
--
-- Die Edge Functions rufen die SECURITY-DEFINER-Funktion auf. Direkten Zugriff
-- auf die Zaehlertabelle brauchen sie dafuer nicht — und was man nicht braucht,
-- bekommt man nicht. Der Tabellenzugriff laeuft ueber den Funktionseigentuemer.
REVOKE ALL ON TABLE public.api_rate_budget FROM PUBLIC;
REVOKE ALL ON TABLE public.api_rate_budget FROM anon;
REVOKE ALL ON TABLE public.api_rate_budget FROM authenticated;
REVOKE ALL ON TABLE public.api_rate_budget FROM service_role;

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
  v_erlaubt          boolean;
  v_retry_after      int;
  v_erste_im_fenster boolean := false;
BEGIN
  -- 1. Topf und Grenzen — im Repo verwaltet, nie vom Aufrufer.
  CASE p_bucket
    WHEN 'google-places' THEN
      v_fenster_sekunden := 60; v_limit_benutzer := 60; v_limit_firma := 300; v_limit_global := 1000;
    WHEN 'google-distance' THEN
      v_fenster_sekunden := 60; v_limit_benutzer := 30; v_limit_firma := 150; v_limit_global := 500;
    ELSE
      RAISE EXCEPTION 'Unbekannter Budgettopf: %', p_bucket
        USING ERRCODE = 'invalid_parameter_value';
  END CASE;

  -- 2. Ohne geprueften Aufrufer geschieht nichts.
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Kein geprueffter Aufrufer'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  -- 3. Mitgliedschaft VOR jeder Zustandsaenderung. Eine erfundene company_id
  --    faellt hier durch, ohne einen einzigen Zaehler zu beruehren.
  IF p_company_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.company_members
                     WHERE user_id = p_user_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Keine Mitgliedschaft in dieser Firma'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 4. Festes Fenster aus der Serveruhr. `clock_timestamp()` statt `now()`:
  --    `now()` ist der Transaktionsbeginn und wuerde bei langen Transaktionen
  --    dasselbe Fenster festhalten.
  v_fenster_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / v_fenster_sekunden) * v_fenster_sekunden
  );
  v_p_benutzer := 'user:' || p_user_id::text;
  v_p_firma    := 'company:' || p_company_id::text;

  -- 5. Die drei Zeilen anlegen, falls sie fehlen — mit count 0, nicht 1.
  --    Reihenfolge wie beim Sperren, damit schon das Einfuegen keine
  --    Zykluskante bauen kann.
  INSERT INTO public.api_rate_budget (bucket, principal, window_start, count)
  VALUES (p_bucket, 'global', v_fenster_start, 0)
  ON CONFLICT (bucket, principal, window_start) DO NOTHING;

  INSERT INTO public.api_rate_budget (bucket, principal, window_start, count)
  VALUES (p_bucket, v_p_firma, v_fenster_start, 0)
  ON CONFLICT (bucket, principal, window_start) DO NOTHING;

  INSERT INTO public.api_rate_budget (bucket, principal, window_start, count)
  VALUES (p_bucket, v_p_benutzer, v_fenster_start, 0)
  ON CONFLICT (bucket, principal, window_start) DO NOTHING;

  -- 6./7. Deterministisch sperren und lesen: global, firma, benutzer.
  SELECT count INTO v_zaehler_global
    FROM public.api_rate_budget
   WHERE bucket = p_bucket AND principal = 'global' AND window_start = v_fenster_start
     FOR UPDATE;

  SELECT count INTO v_zaehler_firma
    FROM public.api_rate_budget
   WHERE bucket = p_bucket AND principal = v_p_firma AND window_start = v_fenster_start
     FOR UPDATE;

  SELECT count INTO v_zaehler_benutzer
    FROM public.api_rate_budget
   WHERE bucket = p_bucket AND principal = v_p_benutzer AND window_start = v_fenster_start
     FOR UPDATE;

  -- 8. Ist ein Topf schon voll, wird KEINER erhoeht.
  v_erlaubt := v_zaehler_benutzer < v_limit_benutzer
           AND v_zaehler_firma    < v_limit_firma
           AND v_zaehler_global   < v_limit_global;

  -- 9. Nur der erlaubte Aufruf zaehlt — und dann alle drei genau einmal.
  IF v_erlaubt THEN
    v_erste_im_fenster := (v_zaehler_benutzer = 0);

    UPDATE public.api_rate_budget SET count = count + 1
     WHERE bucket = p_bucket AND principal = 'global' AND window_start = v_fenster_start;
    UPDATE public.api_rate_budget SET count = count + 1
     WHERE bucket = p_bucket AND principal = v_p_firma AND window_start = v_fenster_start;
    UPDATE public.api_rate_budget SET count = count + 1
     WHERE bucket = p_bucket AND principal = v_p_benutzer AND window_start = v_fenster_start;

    v_zaehler_global   := v_zaehler_global + 1;
    v_zaehler_firma    := v_zaehler_firma + 1;
    v_zaehler_benutzer := v_zaehler_benutzer + 1;
  END IF;

  v_retry_after := GREATEST(
    1,
    ceil(extract(epoch FROM
      (v_fenster_start + make_interval(secs => v_fenster_sekunden)) - clock_timestamp()
    ))::int
  );

  -- Begrenzte Aufbewahrung, nur beim ersten ERLAUBTEN Zugriff eines Benutzers
  -- in einem neuen Fenster. Ein abgewiesener Aufruf raeumt nicht auf — sonst
  -- haette er wieder eine Wirkung, die er nicht haben soll.
  IF v_erste_im_fenster THEN
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

REVOKE ALL ON FUNCTION public.consume_api_budget(text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_api_budget(text, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.consume_api_budget(text, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_budget(text, uuid, uuid) TO service_role;

-- ── Nachweise ───────────────────────────────────────────────────────────────

-- Nachweis 1: kein Tabellenrecht mehr, in allen sieben Auspraegungen, fuer alle
-- vier Rollen. PUBLIC wird ueber die ACL geprueft, nicht ueber
-- has_table_privilege — PUBLIC ist dort kein zulaessiger Rollenname.
DO $pruefung$
DECLARE
  v_rolle text;
  v_recht text;
  v_funde text := '';
BEGIN
  FOREACH v_rolle IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH v_recht IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege(v_rolle, 'public.api_rate_budget', v_recht) THEN
        v_funde := v_funde || format('%s/%s ', v_rolle, v_recht);
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_class c
     CROSS JOIN LATERAL aclexplode(c.relacl) a
     WHERE c.oid = 'public.api_rate_budget'::regclass AND a.grantee = 0
  ) THEN
    v_funde := v_funde || 'PUBLIC/beliebig ';
  END IF;

  IF v_funde <> '' THEN
    RAISE EXCEPTION 'Restrechte auf api_rate_budget: %', v_funde;
  END IF;
END
$pruefung$;

-- Nachweis 2: keine Spalten-Grants.
DO $pruefung$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n
    FROM pg_attribute a
   CROSS JOIN LATERAL aclexplode(a.attacl) x
   WHERE a.attrelid = 'public.api_rate_budget'::regclass AND a.attacl IS NOT NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION '% Spalten-Grants auf api_rate_budget uebrig', v_n;
  END IF;
END
$pruefung$;

-- Nachweis 3: RLS an, keine Policy.
DO $pruefung$
DECLARE v_rls boolean; v_pol int;
BEGIN
  SELECT relrowsecurity INTO v_rls FROM pg_class WHERE oid = 'public.api_rate_budget'::regclass;
  SELECT count(*) INTO v_pol FROM pg_policy WHERE polrelid = 'public.api_rate_budget'::regclass;
  IF NOT v_rls THEN RAISE EXCEPTION 'RLS auf api_rate_budget ist aus'; END IF;
  IF v_pol <> 0 THEN RAISE EXCEPTION '% Policies auf api_rate_budget — erwartet 0', v_pol; END IF;
END
$pruefung$;

-- Nachweis 4: Ausfuehrungsrechte der Funktion.
DO $pruefung$
DECLARE v_oid oid; v_owner text;
BEGIN
  v_oid := to_regprocedure('public.consume_api_budget(text,uuid,uuid)');
  IF v_oid IS NULL THEN RAISE EXCEPTION 'consume_api_budget fehlt'; END IF;

  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon darf consume_api_budget ausfuehren';
  END IF;
  IF has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated darf consume_api_budget ausfuehren';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
              WHERE p.oid = v_oid AND a.grantee = 0) THEN
    RAISE EXCEPTION 'PUBLIC darf consume_api_budget ausfuehren';
  END IF;
  IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role darf consume_api_budget NICHT ausfuehren — der Laufzeitweg waere tot';
  END IF;

  SELECT pg_get_userbyid(proowner) INTO v_owner FROM pg_proc WHERE oid = v_oid;
  IF v_owner <> current_user THEN
    RAISE EXCEPTION 'Funktionseigentuemer ist %, erwartet der einspielende Betreiber %', v_owner, current_user;
  END IF;

  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'consume_api_budget ist nicht SECURITY DEFINER — ohne Tabellenrechte waere sie wirkungslos';
  END IF;
END
$pruefung$;

COMMIT;
