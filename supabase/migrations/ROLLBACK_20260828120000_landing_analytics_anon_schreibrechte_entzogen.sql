-- =============================================================================
-- ROLLBACK zu 20260828120000_landing_analytics_anon_schreibrechte_entzogen.sql
-- =============================================================================
--
-- Gibt `anon` die Schreibrechte auf public.landing_page_analytics zurueck.
--
-- AUSDRUECKLICH: der wiederhergestellte Zustand ist der WEITERE. Diese Datei
-- existiert, damit der Eingriff umkehrbar ist, nicht weil der alte Zustand
-- richtig waere. Sie gibt NICHT die Policy zurueck — dafuer gibt es
-- ROLLBACK_20260828100000. Wer beide ausfuehrt, stellt den gemessenen offenen
-- Zustand vom 2026-08-28 wieder her.
--
-- PUBLIC bekommt nichts zurueck: dort stand das Recht vor der Supabase-Vorgabe
-- nicht, und es zurueckzugeben waere weiter als der Vorzustand.
-- =============================================================================

BEGIN;

DO $rollback$
BEGIN
  IF to_regclass('public.landing_page_analytics') IS NULL THEN
    RAISE EXCEPTION 'public.landing_page_analytics fehlt — es gibt nichts zurueckzugeben';
  END IF;

  GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.landing_page_analytics TO anon;
  RAISE NOTICE 'Schreibrechte fuer anon zurueckgegeben';
END
$rollback$;

COMMIT;
