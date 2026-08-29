-- =============================================================================
-- Ein Verbrauchszaehler fuer bezahlte Fremd-APIs, der die Anfrage ueberlebt
-- =============================================================================
--
-- BEFUND R2-01 (gemessen 2026-08-28, beim Ausrollen von calculate-distance)
--
-- `_shared/rateLimit.ts` haelt seinen Zaehler in einer `Map` im Modulkoerper.
-- Der ausgerollte Router erzeugt PRO ANFRAGE einen neuen User-Worker
-- (`EdgeRuntime.userWorkers.create(...)` gefolgt von `worker.fetch(req)`), also
-- wird der Modulkoerper jedes Mal neu ausgewertet. Die `Map` ist immer leer.
--
-- Gemessen: 61 Anfragen, 0 Antworten mit 429 — vor und nach dem Ausrollen der
-- Drossel identisch. Der Kopf von `rateLimit.ts` sagt es selbst: "resets on
-- function cold starts". In dieser Topologie IST jede Anfrage ein Cold Start.
--
-- WAS HIER ENTSTEHT
--
-- Ein Zaehler in Postgres. Er ueberlebt Worker und Neustarts, ist unter
-- Nebenlaeufigkeit atomar (ein `INSERT … ON CONFLICT DO UPDATE … RETURNING`
-- je Topf), und er kennt drei Toepfe gleichzeitig: Benutzer, Firma und eine
-- globale Notbremse.
--
-- WAS ER NICHT IST
--
-- Kein Ersatz fuer Authentifizierung. Eine bezahlte API anonym erreichbar zu
-- lassen und nur zu drosseln, waere weiterhin falsch — die aufrufenden Edge
-- Functions pruefen deshalb ZUERST das JWT und uebergeben eine bereits
-- SERVERSEITIG geprueffte Benutzer-Kennung. Diese Funktion vertraut keinem
-- Wert aus einem Anfragerumpf.
--
-- WER DARF SIE AUFRUFEN
--
-- Nur `service_role`. Nicht PUBLIC, nicht `anon`, nicht `authenticated`. Der
-- Aufrufer ist die Edge Function, die das JWT bereits geprueft hat; der
-- Endbenutzer erreicht diese Funktion nie direkt. Die Zaehlertabelle traegt RLS
-- und keine einzige Policy — sie ist damit fuer jede Rolle ausser der
-- BYPASSRLS-tragenden `service_role` leer.
--
-- BUDGETS STEHEN HIER, NICHT IM AUFRUF
--
-- Wuerde der Aufrufer sie mitgeben, koennte er sie erhoehen. Aenderungen sind
-- eine neue Migration.
-- =============================================================================

BEGIN;

-- ── Zaehler ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_rate_budget (
  bucket       text        NOT NULL,
  -- 'user:<uuid>' | 'company:<uuid>' | 'global'
  principal    text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, principal, window_start)
);

COMMENT ON TABLE public.api_rate_budget IS
  'Verbrauchszaehler fuer bezahlte Fremd-APIs. Nur ueber consume_api_budget() beschrieben. Begrenzte Aufbewahrung: aeltere Fenster werden beim ersten Zugriff eines neuen Fensters entfernt.';

CREATE INDEX IF NOT EXISTS idx_api_rate_budget_window
  ON public.api_rate_budget (window_start);

ALTER TABLE public.api_rate_budget ENABLE ROW LEVEL SECURITY;
-- Bewusst KEINE Policy: ohne Policy ist die Tabelle fuer jede Rolle leer, die
-- nicht BYPASSRLS traegt. `service_role` traegt es.

REVOKE ALL ON TABLE public.api_rate_budget FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_rate_budget TO service_role;

-- ── Verbrauch ───────────────────────────────────────────────────────────────

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
  -- Budgets: im Repo verwaltet, nicht im Aufruf.
  CASE p_bucket
    WHEN 'google-places' THEN
      v_fenster_sekunden := 60; v_limit_benutzer := 60;  v_limit_firma := 300; v_limit_global := 1000;
    WHEN 'google-distance' THEN
      v_fenster_sekunden := 60; v_limit_benutzer := 30;  v_limit_firma := 150; v_limit_global := 500;
    ELSE
      RAISE EXCEPTION 'Unbekannter Budgettopf: %', p_bucket
        USING ERRCODE = 'invalid_parameter_value';
  END CASE;

  -- Fail closed: ohne geprueften Aufrufer wird nichts verbraucht und nichts
  -- erlaubt. Die Kennung kommt von der Edge Function, die das JWT geprueft hat.
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Kein geprueffter Aufrufer'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  -- Die Firma wird gegen die Mitgliedschaft geprueft, nicht geglaubt. Eine
  -- erfundene company_id im Rumpf faellt hier durch.
  IF p_company_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.company_members
                     WHERE user_id = p_user_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Keine Mitgliedschaft in dieser Firma'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Festes Fenster, aus der Serveruhr abgeleitet. `clock_timestamp()` statt
  -- `now()`: `now()` ist der Transaktionsbeginn und wuerde bei langen
  -- Transaktionen dasselbe Fenster festhalten.
  v_fenster_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / v_fenster_sekunden) * v_fenster_sekunden
  );

  -- Atomar: ein Rundgang je Topf. `ON CONFLICT DO UPDATE` serialisiert
  -- konkurrierende Anfragen auf derselben Zeile.
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

  -- Deterministisch: Sekunden bis zum Ende DIESES Fensters, nie unter 1.
  v_retry_after := GREATEST(
    1,
    ceil(extract(epoch FROM
      (v_fenster_start + make_interval(secs => v_fenster_sekunden)) - clock_timestamp()
    ))::int
  );

  -- Begrenzte Aufbewahrung. Nur beim ERSTEN Zugriff eines Prinzipals in einem
  -- neuen Fenster, damit das Aufraeumen nicht an jeder Anfrage haengt.
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
                      'global',  v_zaehler_global),
    'limits',       jsonb_build_object(
                      'user',    v_limit_benutzer,
                      'company', v_limit_firma,
                      'global',  v_limit_global)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_api_budget(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_budget(text, uuid, uuid) TO service_role;

-- ── Nachweis ────────────────────────────────────────────────────────────────

DO $pruefung$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
              WHERE p.oid = 'public.consume_api_budget(text,uuid,uuid)'::regprocedure
                AND a.privilege_type = 'EXECUTE'
                AND (a.grantee = 0 OR a.grantee = 'anon'::regrole::oid
                     OR a.grantee = 'authenticated'::regrole::oid)) THEN
    RAISE EXCEPTION 'consume_api_budget ist fuer PUBLIC, anon oder authenticated ausfuehrbar';
  END IF;

  IF has_table_privilege('anon', 'public.api_rate_budget', 'SELECT')
     OR has_table_privilege('anon', 'public.api_rate_budget', 'INSERT')
     OR has_table_privilege('authenticated', 'public.api_rate_budget', 'SELECT')
     OR has_table_privilege('authenticated', 'public.api_rate_budget', 'INSERT') THEN
    RAISE EXCEPTION 'api_rate_budget ist fuer anon oder authenticated erreichbar';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.api_rate_budget'::regclass) THEN
    RAISE EXCEPTION 'RLS ist auf api_rate_budget nicht aktiv';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.consume_api_budget(text,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role kann consume_api_budget nicht ausfuehren — die Drossel waere tot';
  END IF;
END
$pruefung$;

COMMIT;
