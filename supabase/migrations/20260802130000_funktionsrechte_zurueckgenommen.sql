-- =============================================================================
-- Schreibende SECURITY-DEFINER-Funktionen: anon und PUBLIC entzogen
-- =============================================================================
--
-- BEFUND
--
-- Von 214 Funktionen im Schema `public` sind 175 für `anon` ausführbar. Nach
-- Abzug der Trigger-Funktionen (über PostgREST nicht als RPC erreichbar) und
-- derer mit eigener Prüfung im Rumpf bleiben 23, auf die alles zutrifft:
-- `SECURITY DEFINER` (also RLS umgangen), schreibend, ohne jede Berechtigungs-
-- prüfung — und über `/rest/v1/rpc/<name>` ohne Anmeldung aufrufbar. Darunter
--
--     create_appointment_from_lead(…, p_company_id, …)  Termin in fremder Firma
--     save_moving_calculation(p_offer_id, …)            fremde Offerte überschreiben
--     grant_trial / extend_subscription / *_manual_import   Offerio-Abrechnung
--     cleanup_* / expire_* / reap_*                     löschende Wartungsjobs
--
-- DASS DAS EIN DRIFT IST, NICHT ABSICHT, steht in den Migrationen selbst: 14
-- der 23 erklären ihre Rechte ausdrücklich, und `anon` kommt darin nur zweimal
-- vor. `consume_rate_limit` ist der deutlichste Fall — 20260308000000 schreibt
--
--     REVOKE ALL ON FUNCTION public.consume_rate_limit(…) FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION public.consume_rate_limit(…) TO service_role;
--
-- und trotzdem darf `anon` sie heute ausführen. Die Rechte wurden nach dem
-- Anlegen wieder geöffnet; der wahrscheinliche Weg ist ein Schema-Abzug ohne
-- Privilegien, bei dem alles auf die Vorgabe (PUBLIC EXECUTE) zurückfällt.
--
-- ABHILFE
--
-- ES REICHT NICHT, `anon` ZU ENTZIEHEN. Die Funktionen tragen BEIDES: eine
-- ausdrückliche Rolle und zusätzlich den PUBLIC-Eintrag (`=X/postgres`). Wer
-- nur `FROM anon` entzieht, ändert nichts — `anon` erbt weiter über PUBLIC.
-- Auf der Produktion nachgemessen, bevor diese Datei entstand: nach
-- `REVOKE … FROM anon` blieb `has_function_privilege('anon', …)` auf true,
-- erst `FROM PUBLIC, anon, authenticated` setzte es auf false.
--
-- ZWEI AUSNAHMEN, beide bewusst:
--
--   `generate_recurring_appointments` wird aus AppointmentModal.tsx im
--   angemeldeten Bereich gerufen, also mit der Rolle `authenticated`. Hier geht
--   nur PUBLIC und `anon` weg; `authenticated` bleibt, sonst brechen
--   wiederkehrende Termine im Kalender.
--
--   `increment_blog_view_count` bleibt unangetastet. Ein Blog-Besucher ist
--   `anon`, der Aufruf ist der vorgesehene Weg. Missbrauch hiesse: jemand
--   zählt einen Zähler hoch. Kein Datenabfluss, nichts wird gelöscht.
--
-- `service_role` behält überall EXECUTE — Cron und Edge Functions arbeiten
-- darüber. Die Cron-Jobs laufen ohnehin als `postgres` und sind von Rechten
-- der Anwendungsrollen nicht betroffen.
--
-- KEIN AUFRUFER GEHT VERLOREN. Für alle 21 vollständig entzogenen Funktionen
-- wurde geprüft: kein Treffer in `src/`, keiner in den 41 ausgelieferten Edge
-- Functions, keiner in anderen DB-Funktionen, keiner in den 12 Cron-Jobs.
-- Die sechs, die ein Edge Function ruft (atomic_confirm_lead,
-- delete_besichtigung_photo, cleanup_expired_besichtigung_data,
-- schedule_besichtigung_cleanup, archive_returned_boxes, cleanup_archived_boxes),
-- werden dort mit dem service_role-Schlüssel gerufen, nicht als anon.
--
-- WIEDERHOLBAR. REVOKE auf ein bereits entzogenes Recht ist ein No-op, und der
-- Vorzustand wird nur beim ersten Lauf vermerkt.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Rückbau-Speicher
--
-- Rechte sind keine Zeilen; ohne Vermerk wüsste das ROLLBACK-Skript nicht, was
-- vorher galt. Festgehalten wird je Funktion, ob PUBLIC, anon und authenticated
-- EXECUTE hatten.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.undo_20260802130000 (
  func_name         TEXT PRIMARY KEY,
  func_signature    TEXT        NOT NULL,
  had_public        BOOLEAN     NOT NULL,
  had_anon          BOOLEAN     NOT NULL,
  had_authenticated BOOLEAN     NOT NULL,
  noted_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.undo_20260802130000 IS
  'Vorzustand der von 20260802130000 entzogenen Funktionsrechte. Das zugehoerige ROLLBACK-Skript liest hier und entfernt die Tabelle danach.';

ALTER TABLE public.undo_20260802130000 ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 1. Entzug
--
-- Geführt wird die Liste über NAMEN, nicht über Signaturen: alle 22 sind im
-- Schema eindeutig (nachgeprüft, keine Überladung), und die Signatur wird zur
-- Laufzeit aus dem Katalog geholt. So kann sie nicht abweichen, und ein
-- Tippfehler in einer langen Parameterliste ist ausgeschlossen.
--
-- Findet sich ein Name nicht, bricht der Lauf ab — lieber laut als halb.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fname     TEXT;
  fsig      TEXT;
  foid      OID;
  hat_pub   BOOLEAN;

  -- Vollständig entzogen: PUBLIC, anon UND authenticated
  vollstaendig TEXT[] := ARRAY[
    'archive_returned_boxes',
    'atomic_confirm_lead',
    'cleanup_archived_boxes',
    'cleanup_expired_besichtigung_data',
    'cleanup_inbound_emails',
    'consume_rate_limit',
    'create_appointment_from_lead',
    'create_archive_log',
    'create_company_after_signup',
    'deactivate_expired_subscriptions',
    'deactivate_manual_import',
    'delete_besichtigung_photo',
    'expire_unconfirmed_risky_leads',
    'expire_unverified_leads',
    'extend_subscription',
    'grant_trial',
    'increment_manual_import_count',
    'reap_stuck_inbound_emails',
    'reap_stuck_sending_offers',
    'save_moving_calculation',
    'schedule_besichtigung_cleanup'
  ];

  -- Nur PUBLIC und anon; `authenticated` bleibt (AppointmentModal.tsx)
  nur_anon TEXT[] := ARRAY[
    'generate_recurring_appointments'
  ];
BEGIN
  FOREACH fname IN ARRAY vollstaendig || nur_anon LOOP
    -- Signatur mit TYPEN, nicht mit Parameternamen. `to_regprocedure` — vom
    -- Prüfblock und vom ROLLBACK-Skript gebraucht — versteht nur diese Form und
    -- wirft bei Namen einen Syntaxfehler. REVOKE und GRANT nehmen beide.
    SELECT p.oid,
           format('public.%I(%s)', p.proname,
                  coalesce((SELECT string_agg(format_type(t, NULL), ', ')
                              FROM unnest(p.proargtypes) t), '')),
           EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
      INTO foid, fsig, hat_pub
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = fname;

    IF foid IS NULL THEN
      RAISE EXCEPTION 'Funktion public.% existiert nicht — Liste und Datenbank passen nicht zusammen.', fname;
    END IF;

    INSERT INTO public.undo_20260802130000
      (func_name, func_signature, had_public, had_anon, had_authenticated)
    VALUES (
      fname, fsig,
      -- proacl NULL heisst "Vorgabe", und die Vorgabe ist PUBLIC EXECUTE
      coalesce(hat_pub, TRUE),
      has_function_privilege('anon',          foid, 'EXECUTE'),
      has_function_privilege('authenticated', foid, 'EXECUTE')
    )
    ON CONFLICT (func_name) DO NOTHING;
  END LOOP;

  -- Ab hier wird die Signatur aus dem Vermerk gelesen statt neu gebildet: so
  -- kann das, was entzogen wird, nicht von dem abweichen, was notiert wurde.
  FOREACH fname IN ARRAY vollstaendig LOOP
    SELECT func_signature INTO fsig
      FROM public.undo_20260802130000 WHERE func_name = fname;

    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fsig);
  END LOOP;

  FOREACH fname IN ARRAY nur_anon LOOP
    SELECT func_signature INTO fsig
      FROM public.undo_20260802130000 WHERE func_name = fname;

    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fsig);
    -- `authenticated` hatte den Weg bisher auch über PUBLIC; nach dessen Entzug
    -- muss das ausdrückliche Recht stehen, sonst faellt der Kalender mit.
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fsig);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Nachweis
--
-- Vier Aussagen, jede einzeln geprüft. Stimmt eine nicht, fällt die ganze
-- Transaktion — ein halb entzogenes Recht sieht aus wie ein entzogenes.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r        RECORD;
  offen    INTEGER := 0;
  fehlend  INTEGER := 0;
BEGIN
  -- (1) Nichts, was hier steht, darf noch von anon ausführbar sein.
  FOR r IN SELECT u.func_name, p.oid
             FROM public.undo_20260802130000 u
             JOIN pg_proc p ON p.oid = to_regprocedure(u.func_signature)
  LOOP
    IF has_function_privilege('anon', r.oid, 'EXECUTE') THEN
      RAISE WARNING 'anon darf weiterhin %', r.func_name;
      offen := offen + 1;
    END IF;
  END LOOP;
  IF offen > 0 THEN
    RAISE EXCEPTION '% Funktion(en) sind fuer anon weiterhin ausfuehrbar.', offen;
  END IF;

  -- (2) service_role muss ueberall geblieben sein.
  FOR r IN SELECT u.func_name, p.oid
             FROM public.undo_20260802130000 u
             JOIN pg_proc p ON p.oid = to_regprocedure(u.func_signature)
  LOOP
    IF NOT has_function_privilege('service_role', r.oid, 'EXECUTE') THEN
      RAISE WARNING 'service_role fehlt bei %', r.func_name;
      fehlend := fehlend + 1;
    END IF;
  END LOOP;
  IF fehlend > 0 THEN
    RAISE EXCEPTION 'service_role hat bei % Funktion(en) kein EXECUTE mehr — Cron und Edge Functions waeren tot.', fehlend;
  END IF;

  -- (3) Die eine Ausnahme muss fuer authenticated offen geblieben sein.
  IF NOT has_function_privilege(
       'authenticated',
       'public.generate_recurring_appointments(uuid, date)'::REGPROCEDURE,
       'EXECUTE') THEN
    RAISE EXCEPTION 'generate_recurring_appointments ist fuer authenticated zu — wiederkehrende Termine waeren kaputt.';
  END IF;

  -- (4) Der Blog-Zaehler wurde ausdruecklich nicht angefasst.
  IF NOT has_function_privilege(
       'anon',
       'public.increment_blog_view_count(uuid)'::REGPROCEDURE,
       'EXECUTE') THEN
    RAISE EXCEPTION 'increment_blog_view_count wurde entzogen, obwohl sie bleiben sollte.';
  END IF;

  RAISE NOTICE 'Rechte entzogen: % Funktionen vermerkt, anon kommt an keine davon mehr heran.',
    (SELECT count(*) FROM public.undo_20260802130000);
END $$;

COMMIT;
