-- =============================================================================
-- ROLLBACK zu 20260828100000_landing_analytics_anon_insert_entzogen.sql
-- =============================================================================
--
-- Stellt die Policy wieder her, die die Migration in
-- public.undo_20260828100000 festgehalten hat — und NUR sie. Ohne die Tabelle
-- gibt es nichts wiederherzustellen; dann bricht diese Datei ab, statt zu raten.
--
-- AUSDRUECKLICH: der wiederhergestellte Zustand ist der GEMESSEN OFFENE.
-- Diese Datei existiert, damit der Eingriff umkehrbar ist, nicht weil der alte
-- Zustand richtig waere. Wer sie ausfuehrt, oeffnet `landing_page_analytics`
-- wieder fuer unauthentifizierte INSERTs.
-- =============================================================================

BEGIN;

DO $rollback$
DECLARE
  z record;
BEGIN
  IF to_regclass('public.undo_20260828100000') IS NULL THEN
    RAISE EXCEPTION 'public.undo_20260828100000 fehlt — 20260828100000 lief hier nie, es gibt nichts zurueckzunehmen';
  END IF;

  IF to_regclass('public.landing_page_analytics') IS NULL THEN
    RAISE EXCEPTION 'public.landing_page_analytics fehlt — die Policy haette kein Ziel';
  END IF;

  SELECT * INTO z
    FROM public.undo_20260828100000
   WHERE tabelle = 'public.landing_page_analytics'
     AND policyname = 'Service role can insert analytics';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'kein Eintrag fuer die Policy in public.undo_20260828100000';
  END IF;

  IF z.rollen <> 'PUBLIC' THEN
    RAISE EXCEPTION 'festgehaltene Rollen waren "%", nicht PUBLIC — diese Datei stellt nur den PUBLIC-Fall her', z.rollen;
  END IF;

  EXECUTE format(
    'CREATE POLICY %I ON public.landing_page_analytics FOR INSERT WITH CHECK (%s)',
    z.policyname, coalesce(z.withcheck, 'true')
  );

  RAISE NOTICE 'Policy % wiederhergestellt (roles=PUBLIC, WITH CHECK %)', z.policyname, coalesce(z.withcheck, 'true');
END
$rollback$;

DROP TABLE IF EXISTS public.undo_20260828100000;

COMMIT;
