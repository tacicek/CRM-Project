-- =============================================================================
-- landing_page_analytics: anon verliert auch das TABELLENRECHT zum Schreiben
-- =============================================================================
--
-- WARUM ZWEITE DATEI
--
-- `20260828100000` entzieht die Policy `Service role can insert analytics`
-- (roles=PUBLIC, WITH CHECK true). Damit ist der Zugriff geschlossen: ohne
-- erlaubende INSERT-Policy weist RLS jeden Schreibversuch ab.
--
-- Das Tabellenrecht bleibt davon unberuehrt. Gemessen im Preflight zu R-1:
--
--     anon_insert=true  anon_update=true  anon_delete=true
--
-- Es stammt aus der Supabase-Vorgabe (`GRANT ALL ON ALL TABLES IN SCHEMA public
-- TO anon, authenticated`) und liegt auf 97 der 101 Tabellen. RLS ist dort die
-- einzige Schranke — und eine Schranke allein ist eine Schranke zu wenig, wenn
-- die Tabelle ueberhaupt keinen Schreiber hat.
--
-- BELEG, DASS SIE KEINEN HAT
--
-- Ausserhalb der generierten `src/integrations/supabase/types.ts` kommt
-- `landing_page_analytics` weder in `src/` noch in `supabase/functions/` vor,
-- und `src/App.tsx` fuehrt keine Landingpage-Route. Der Entzug nimmt also
-- niemandem etwas.
--
-- WAS HIER NICHT PASSIERT
--
-- SELECT bleibt. Die Lesepolicy `Admins can view analytics` bleibt unberuehrt —
-- ob die Tabelle als Offerio-Rest stillzulegen ist, ist eine eigene, gemessene
-- Entscheidung (P5) und kein Beiwerk dieser Datei. `authenticated` wird nicht
-- angefasst: der Befund handelt von `anon`, und eine Aenderung ohne Befund ist
-- eine Aenderung ohne Grund.
--
-- WIEDERHOLBAR. REVOKE auf ein bereits entzogenes Recht ist ein No-op.
-- =============================================================================

BEGIN;

DO $mig$
BEGIN
  IF to_regclass('public.landing_page_analytics') IS NULL THEN
    RAISE NOTICE 'landing_page_analytics fehlt — nichts zu tun';
    RETURN;
  END IF;

  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.landing_page_analytics FROM PUBLIC;
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.landing_page_analytics FROM anon;

  RAISE NOTICE 'Schreibrechte auf landing_page_analytics fuer PUBLIC und anon entzogen';
END
$mig$;

-- Nachweis: anon darf danach nicht mehr schreiben — und die Tabelle traegt
-- weiterhin RLS.
DO $pruefung$
BEGIN
  IF to_regclass('public.landing_page_analytics') IS NULL THEN
    RETURN;
  END IF;

  IF has_table_privilege('anon', 'public.landing_page_analytics', 'INSERT')
     OR has_table_privilege('anon', 'public.landing_page_analytics', 'UPDATE')
     OR has_table_privilege('anon', 'public.landing_page_analytics', 'DELETE')
     OR has_table_privilege('anon', 'public.landing_page_analytics', 'TRUNCATE') THEN
    RAISE EXCEPTION 'anon haelt weiterhin ein Schreibrecht auf landing_page_analytics';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.landing_page_analytics'::regclass) THEN
    RAISE EXCEPTION 'RLS ist auf landing_page_analytics nicht aktiv';
  END IF;
END
$pruefung$;

COMMIT;
