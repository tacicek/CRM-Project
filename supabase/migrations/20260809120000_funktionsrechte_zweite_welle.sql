-- =============================================================================
-- Funktionsrechte, zweite Welle: anon/PUBLIC entzogen, wo kein Aufrufer steht
-- =============================================================================
--
-- BEFUND (gemessen, nicht vermutet)
--
-- Die Aufnahme vom 2026-08-09 (ops/production-truth/2026-08-09/) zaehlt im
-- Schema `public` 220 Funktionen, davon 154 fuer `anon` ausfuehrbar und 94
-- davon zusaetzlich `SECURITY DEFINER`. 20260802130000 hatte 23 schreibende
-- Faelle geschlossen; der Rest blieb offen, weil niemand wusste, wer sie ruft.
--
-- Jetzt ist es gemessen. Die 154 zerfallen in:
--
--   81  TRIGGER-Funktionen. PostgREST bietet nichts an, was `trigger`
--       zurueckgibt, und ein direkter Aufruf scheitert ohnehin
--       ("trigger functions can only be called as triggers"). Beim Feuern
--       prueft PostgreSQL kein EXECUTE. Das Recht bewirkt hier also nichts —
--       es blaeht nur die Zahl auf, an der man die echten Faelle sucht.
--
--   73  aufrufbare Funktionen. Fuer jede wurde erhoben, ob sie in einer
--       Policy, einem anderen Funktionsrumpf, einem cron-Kommando, einer
--       oeffentlichen Seite, einer /firma-Seite oder einer Edge Function
--       vorkommt.
--
-- WAS HIER NICHT ANGEFASST WIRD, und warum
--
--   12  Token-RPCs der oeffentlichen Seiten (`get_offer_by_token`,
--       `get_appointment_by_action_token`, `portal_*`, `*_by_token` …).
--       Sie WERDEN von `anon` gerufen — das ist ihr Zweck.
--
--    9  Helfer, die in Policy-Ausdruecken stehen (`is_company_member` in 94
--       Policies, `is_admin` in 59, …). Ein Policy-Ausdruck laeuft mit den
--       Rechten des Fragenden. Nimmt man `anon` das EXECUTE, liefert eine
--       anon-Abfrage auf die betroffene Tabelle keinen leeren Satz mehr,
--       sondern einen Fehler. Das ist eine Verhaltensaenderung mit eigenem
--       Entwurf, kein Beiwerk dieser Datei.
--
--    2  `normalize_customer_email` und `normalize_customer_phone`. Sie stehen
--       in einer CHECK-Constraint UND in einem Spalten-Default. Beide werden
--       mit den Rechten des Einfuegenden ausgewertet — ein Entzug braeche
--       INSERTs. Nachgemessen, bevor diese Datei entstand.
--
--       Uebrige Rumpf-Helfer (`i18n_text`, `calculate_distance_km`, …) bleiben
--       ebenfalls stehen: ob der Aufrufer sie als DEFINER oder als INVOKER
--       ruft, entscheidet ueber die Notwendigkeit des Rechts, und das ist je
--       Funktion zu klaeren statt pauschal.
--
-- WAS HIER ENTZOGEN WIRD
--
--   trigger_fns (81)  anon und authenticated. Wirkungslos, also weg.
--   beide_fns   (31)  anon und authenticated. Kein Aufrufer ausser
--                     service_role (Edge Functions, cron) oder ueberhaupt
--                     keiner. Darunter die scharfen Faelle:
--                       archive-/purge-nahe Leser, `get_auth_audit_log`,
--                       `get_admin_activity_log`, `debug_storage_objects`,
--                       die `invoke_*`-Ausloeser (sie stossen Mailversand an
--                       und waren ohne Anmeldung aufrufbar), sowie die
--                       Offerio-Reste `activate_self_trial`,
--                       `atomic_adjust_token_balance`,
--                       `calculate_min_token_price`.
--   firma_fns   (10)  nur anon. Sie werden aus /firma gerufen, also von
--                     `authenticated` — darunter
--                     `archive_and_purge_company_data` und
--                     `replace_offer_items`, die als `anon` erreichbar waren.
--
-- ES REICHT NICHT, `anon` ZU ENTZIEHEN — nachgemessen und in 20260802130000
-- bereits festgehalten: die meisten dieser Funktionen tragen zusaetzlich den
-- PUBLIC-Eintrag (`=X/postgres`). Wer nur `FROM anon` entzieht, aendert nichts,
-- weil `anon` ueber PUBLIC weitererbt. Deshalb geht jeder Entzug
-- `FROM PUBLIC, anon, authenticated`, und was bleiben soll, wird danach
-- ausdruecklich neu vergeben.
--
-- `service_role` wird NIRGENDS angefasst. Die Edge Functions arbeiten darueber.
--
-- WIEDERHOLBAR. REVOKE auf ein bereits entzogenes Recht ist ein No-op, die
-- undo-Tabelle wird mit ON CONFLICT DO NOTHING gefuellt, und die Pruefungen am
-- Ende gelten fuer jeden Lauf gleich.
--
-- ROLLBACK: ROLLBACK_20260809120000_funktionsrechte_zweite_welle.sql stellt
-- exakt den Zustand wieder her, den die undo-Tabelle festhaelt.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.undo_20260809120000 (
  func_signature text PRIMARY KEY,
  hatte_public   boolean NOT NULL,
  hatte_anon     boolean NOT NULL,
  hatte_auth     boolean NOT NULL,
  erfasst_am     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.undo_20260809120000 IS
  'Rechtestand vor 20260809120000. Grundlage des Rollbacks und zugleich Beleg, '
  'dass diese Migration in dieser Datenbank gelaufen ist.';

ALTER TABLE public.undo_20260809120000 ENABLE ROW LEVEL SECURITY;

DO $migration$
DECLARE
  trigger_fns text[] := ARRAY[
    'appointments_set_customer', 'auftraege_set_customer',
    'auftraege_set_locations', 'beleg_set_customer',
    'calculate_appointment_duration', 'calculate_lead_spam_score',
    'communication_thread_fortschreiben',
    'companies_ensure_owner_membership', 'create_appointments_for_auftrag',
    'credit_notes_von_rechnung_erben',
    'customer_addresses_eine_hauptadresse',
    'customer_addresses_hauptadresse_nachruecken',
    'customer_cases_aufgabe_anlegen', 'customer_cases_verlauf_schreiben',
    'customers_set_display_name', 'email_log_in_faden',
    'generate_auftrag_nummer', 'generate_fall_nr', 'generate_gutschrift_nr',
    'generate_klavier_nummer', 'generate_moebellift_nummer',
    'generate_offer_number', 'generate_quittung_nr',
    'generate_raeumung_nummer', 'generate_rechnung_nr',
    'generate_umzug_nummer', 'guard_allocation_immutable',
    'guard_allocation_within_payment', 'guard_amendment_after_send',
    'guard_case_events_append_only', 'guard_company_ownership',
    'guard_customer_merge_fields', 'guard_customer_merges_append_only',
    'guard_gutschrift_hoehe', 'guard_mahnstufe_reihenfolge',
    'guard_offer_content_after_send', 'guard_payment_append_only',
    'guard_quittung_bezahlt_braucht_buchung', 'guard_quittung_delete',
    'guard_quittung_status_regression',
    'guard_rechnung_bezahlt_braucht_deckung', 'guard_rechnung_delete',
    'guard_rechnung_status_regression', 'guard_stage_history_append_only',
    'handle_new_user', 'handle_updated_at', 'inbound_email_in_faden',
    'inbound_emails_set_customer', 'invoice_reminders_sprache_erben',
    'leads_record_stage_change', 'leads_set_customer',
    'log_appointment_changes', 'notify_offer_response',
    'offer_amendments_inherit', 'offers_advance_lead_stage',
    'offers_set_customer', 'offers_set_series',
    'rechnung_gutschriften_fortschreiben',
    'rechnung_zahlungsstand_fortschreiben', 'set_api_keys_updated_at',
    'set_company_slug', 'set_lead_slug', 'set_offer_acceptance_evidence',
    'sync_appointment_cancel_to_auftrag',
    'sync_appointment_schedule_to_auftrag',
    'sync_auftrag_status_to_appointment', 'trigger_notify_admin_high_spam',
    'update_archive_timestamp', 'update_company_pricing_updated_at',
    'update_klaviertransport_updated_at', 'update_landing_pages_updated_at',
    'update_manual_import_sub_updated_at', 'update_moebellift_updated_at',
    'update_quittungen_updated_at', 'update_raeumung_updated_at',
    'update_rechnungen_updated_at', 'update_ticket_timestamp',
    'update_umzug_updated_at', 'update_umzugsbox_rentals_updated_at',
    'update_updated_at', 'update_website_settings_timestamp'
  ];
  firma_fns text[] := ARRAY[
    'archive_and_purge_company_data', 'get_besichtigung_analysis',
    'get_company_besichtigung_sessions', 'get_company_pricing_config',
    'get_plz_distance_km', 'has_role', 'is_company_visible_via_offer',
    'is_crm_enabled', 'replace_offer_items',
    'upsert_company_pricing_config'
  ];
  beide_fns text[] := ARRAY[
    'activate_manual_import', 'activate_self_trial',
    'atomic_adjust_token_balance', 'calculate_min_token_price',
    'create_besichtigung_session', 'debug_storage_objects',
    'find_companies_fallback', 'get_admin_activity_log',
    'get_archivable_leads', 'get_archivable_offers',
    'get_archive_statistics', 'get_auftraege_needing_customer_reminders',
    'get_auftraege_needing_reminders', 'get_auth_audit_log',
    'get_besichtigung_photos', 'get_besichtigung_session_by_token',
    'get_besichtigung_videos', 'get_companies_needing_reminders',
    'get_company_id_from_offer_token', 'get_company_pricing_history',
    'increment_blog_view_count', 'insert_besichtigung_photo',
    'invoke_appointment_reminder', 'invoke_edge_function',
    'invoke_team_reminder', 'portal_report_case',
    'save_besichtigung_analysis', 'trigger_subscription_manager',
    'trigger_team_reminder_for_appointment',
    'update_besichtigung_session_status', 'validate_offer_access_token'
  ];
  alle_fns text[];
  fname    text;
  fsig     text;
  offen    integer;
BEGIN
  alle_fns := trigger_fns || beide_fns || firma_fns;

  -- 1. Zustand festhalten, BEVOR etwas entzogen wird.
  FOREACH fname IN ARRAY alle_fns LOOP
    FOR fsig IN
      SELECT p.oid::regprocedure::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = fname
    LOOP
      INSERT INTO public.undo_20260809120000
             (func_signature, hatte_public, hatte_anon, hatte_auth)
      SELECT fsig,
             EXISTS (SELECT 1
                       FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                      WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE'),
             has_function_privilege('anon', p.oid, 'EXECUTE'),
             has_function_privilege('authenticated', p.oid, 'EXECUTE')
      FROM pg_proc p
      WHERE p.oid = fsig::regprocedure
      ON CONFLICT (func_signature) DO NOTHING;
    END LOOP;
  END LOOP;

  -- 2. Entzug. `%s` und nicht `%I`: fsig ist eine fertige Signatur
  --    ("public.foo(uuid)"), und %I wuerde sie als einen Namen quoten.
  FOREACH fname IN ARRAY (trigger_fns || beide_fns) LOOP
    FOR fsig IN
      SELECT p.oid::regprocedure::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = fname
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fsig);
    END LOOP;
  END LOOP;

  FOREACH fname IN ARRAY firma_fns LOOP
    FOR fsig IN
      SELECT p.oid::regprocedure::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = fname
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fsig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fsig);
    END LOOP;
  END LOOP;

  -- 3. Pruefen statt behaupten.
  SELECT count(*) INTO offen
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND p.proname = ANY (trigger_fns || beide_fns)
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF offen > 0 THEN
    RAISE EXCEPTION 'Entzug unvollstaendig: % Funktion(en) bleiben fuer anon/authenticated ausfuehrbar', offen;
  END IF;

  SELECT count(*) INTO offen
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = ANY (firma_fns)
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF offen > 0 THEN
    RAISE EXCEPTION 'anon bleibt auf % /firma-Funktion(en) ausfuehrbar', offen;
  END IF;

  SELECT count(*) INTO offen
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = ANY (firma_fns)
    AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF offen > 0 THEN
    RAISE EXCEPTION '% /firma-Funktion(en) haben authenticated verloren — /firma waere kaputt', offen;
  END IF;

  -- service_role wird nicht angefasst; das wird nachgewiesen, nicht geglaubt.
  SELECT count(*) INTO offen
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = ANY (alle_fns)
    AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE');
  IF offen > 0 THEN
    RAISE EXCEPTION '% Funktion(en) haben service_role verloren — Edge Functions waeren kaputt', offen;
  END IF;

  -- Und die Gegenprobe: die Token-RPCs der oeffentlichen Seiten muessen fuer
  -- anon ausfuehrbar BLEIBEN. Waere eine davon mitentzogen worden, waere die
  -- Offert-, Absage- oder Nachtragsseite ab dem naechsten Aufruf tot.
  SELECT count(*) INTO offen
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND p.proname = ANY (ARRAY[
      'get_offer_by_token', 'get_offer_items_by_token', 'update_offer_by_token',
      'get_agb_sections_by_offer_token', 'get_checklist_by_offer_token',
      'get_public_company_info', 'get_amendment_by_token', 'update_amendment_by_token',
      'get_appointment_by_action_token'])
    AND NOT has_function_privilege('anon', p.oid, 'EXECUTE');
  IF offen > 0 THEN
    RAISE EXCEPTION '% oeffentliche Token-RPC(s) sind fuer anon nicht mehr ausfuehrbar', offen;
  END IF;

  RAISE NOTICE 'Funktionsrechte zweite Welle: % Signatur(en) festgehalten',
    (SELECT count(*) FROM public.undo_20260809120000);
END
$migration$;

COMMIT;
