-- =============================================================================
-- landing_page_analytics: eine Policy, die service_role sagt und "jeder" tut
-- =============================================================================
--
-- BEFUND (gemessen, nicht vermutet)
--
-- ops/production-truth/2026-08-10/policies.json fuehrt auf
-- public.landing_page_analytics eine INSERT-Policy namens
-- "Service role can insert analytics" mit roles={public} und unbeschraenktem
-- WITH CHECK. Der Name nennt eine Rolle, die Wirkung kennt keine.
--
-- URSACHE
--
-- 20251228200001_landing_pages_system.sql:132-135 schreibt:
--
--     CREATE POLICY "Service role can insert analytics"
--       ON public.landing_page_analytics
--       FOR INSERT
--       WITH CHECK (true);
--
-- Ohne `TO`-Klausel setzt PostgreSQL `TO PUBLIC` — also jede Rolle, `anon`
-- eingeschlossen. Zusammen mit `WITH CHECK (true)` darf damit jeder
-- unauthentifizierte Aufrufer beliebige Zeilen in die Tabelle schreiben.
--
-- Die Annahme dahinter war ausserdem von Anfang an falsch: `service_role`
-- traegt BYPASSRLS und wird von Policies gar nicht erst geprueft. Eine Policy
-- "fuer service_role" gewaehrt dieser Rolle nichts, was sie nicht ohnehin haette
-- — sie oeffnet nur alle anderen.
--
-- WARUM ENTZUG UND NICHT KORREKTUR
--
-- Eine auf `TO service_role` verengte Fassung waere wirkungslos (BYPASSRLS) und
-- wuerde denselben Irrtum als Dokument konservieren. Die Tabelle hat in diesem
-- Repo keinen Schreiber: ausserhalb der generierten
-- src/integrations/supabase/types.ts kommt `landing_page_analytics` weder in
-- src/ noch in supabase/functions/ vor, und src/App.tsx fuehrt keine
-- Landingpage-Route. Der Entzug nimmt also niemandem etwas, ausser `anon` den
-- Schreibzugriff.
--
-- WAS HIER NICHT PASSIERT
--
-- Die Tabelle selbst bleibt stehen. Ob sie Rest der Offerio-Herkunft ist und
-- stillgelegt gehoert, ist eine eigene, gemessene Entscheidung — kein Beiwerk
-- dieser Datei. RLS bleibt aktiv, die Admin-Lesepolicy bleibt unberuehrt.
-- =============================================================================

BEGIN;

DO $mig$
DECLARE
  p record;
BEGIN
  IF to_regclass('public.landing_page_analytics') IS NULL THEN
    RAISE NOTICE 'landing_page_analytics fehlt — nichts zu tun';
    RETURN;
  END IF;

  SELECT pol.polname,
         pg_get_expr(pol.polwithcheck, pol.polrelid) AS withcheck,
         CASE WHEN pol.polroles = '{0}'::oid[] THEN 'PUBLIC'
              ELSE (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                      FROM pg_roles r WHERE r.oid = ANY(pol.polroles)) END AS rollen
    INTO p
    FROM pg_policy pol
   WHERE pol.polrelid = 'public.landing_page_analytics'::regclass
     AND pol.polname  = 'Service role can insert analytics';

  IF NOT FOUND THEN
    RAISE NOTICE 'Policy "Service role can insert analytics" ist bereits fort — nichts zu tun';
    RETURN;
  END IF;

  -- Den Zustand VOR dem Eingriff festhalten, damit der Rollback nicht raten muss.
  CREATE TABLE IF NOT EXISTS public.undo_20260828100000 (
    tabelle    text        NOT NULL,
    policyname text        NOT NULL,
    kommando   text        NOT NULL,
    rollen     text        NOT NULL,
    withcheck  text,
    erfasst_am timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tabelle, policyname)
  );

  INSERT INTO public.undo_20260828100000 (tabelle, policyname, kommando, rollen, withcheck)
  VALUES ('public.landing_page_analytics', p.polname, 'INSERT', p.rollen, p.withcheck)
  ON CONFLICT (tabelle, policyname) DO NOTHING;

  EXECUTE format('DROP POLICY %I ON public.landing_page_analytics', p.polname);

  RAISE NOTICE 'Policy % entzogen (war: roles=%, WITH CHECK %)', p.polname, p.rollen, p.withcheck;
END
$mig$;

-- Nachweis: auf dieser Tabelle darf danach keine Policy mehr fuer PUBLIC schreiben.
DO $pruefung$
DECLARE
  offen integer;
BEGIN
  IF to_regclass('public.landing_page_analytics') IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO offen
    FROM pg_policy pol
   WHERE pol.polrelid = 'public.landing_page_analytics'::regclass
     AND pol.polcmd IN ('a', 'w', 'd', '*')          -- INSERT, UPDATE, DELETE, ALL
     AND pol.polroles = '{0}'::oid[]                 -- TO PUBLIC
     AND coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), 'true') = 'true';

  IF offen > 0 THEN
    RAISE EXCEPTION 'noch % unbeschraenkte PUBLIC-Schreibpolicy(s) auf landing_page_analytics', offen;
  END IF;
END
$pruefung$;

COMMIT;
