-- Franzoesisch war ueberall angeboten und nirgends erlaubt.
--
-- WAS GEMESSEN WURDE (2026-08-31, Produktion)
--
-- Die Oberflaeche bietet die Kundensprache aus `LOCALES = ["de","fr","en"]` an
-- (src/i18n/locale.ts), und CLAUDE.md §11b beschreibt die Dokumentachse
-- ausdruecklich als DE/FR/EN. Die Datenbank kannte davon zwei:
--
--   appointments  auftraege  companies.default_language  credit_notes
--   customers     invoice_reminders  leads  offer_amendments  offers
--   quittungen    rechnungen                    -> alle nur 'de','en'
--   email_logs                                  -> 'de','fr','en'  (richtig)
--
-- Elf von zwoelf. Wer im Formular Franzoesisch waehlt, bekommt beim Speichern
-- einen Constraint-Verstoss — und zwar an jeder Station der Kette
-- lead -> offer -> auftrag/rechnung/quittung, nicht nur an einer.
--
-- Aufgefallen ist es nur deshalb nicht, weil bisher 95 Offerten auf 'de' und
-- eine auf 'en' stehen. Die erste franzoesische Kundschaft haette es gefunden.
--
-- Dass `email_logs` bereits drei Sprachen kennt, zeigt, dass die Erweiterung
-- einmal begonnen und nicht zu Ende gefuehrt wurde.
--
-- WAS DIESE MIGRATION TUT
--
-- Sie erweitert die elf Regeln um 'fr' und laesst sonst alles, wie es ist:
-- dieselben Namen, dieselbe NULL-Behandlung je Tabelle. Eine Regel zu WEITEN
-- kann keine bestehende Zeile verletzen, deshalb ist keine Nachpruefung noetig
-- und kein NOT VALID.
--
-- Sie aendert KEINE Vorgabewerte. `default_language` und die Spaltenvorgaben
-- bleiben 'de' — welche Sprache voreingestellt ist, ist eine fachliche Frage
-- und nicht Gegenstand dieser Migration.
--
-- Am Ende prueft sie sich selbst: keine einzige Sprachregel im Schema `public`
-- darf danach noch 'fr' verbieten. Eine uebersehene Tabelle laesst die
-- Migration scheitern, statt sie stillschweigend offen zu lassen.

BEGIN;

-- Elf Regeln, die nur zwei Sprachen kannten. Form je Tabelle unveraendert.
ALTER TABLE public.appointments      DROP CONSTRAINT IF EXISTS appointments_language_check;
ALTER TABLE public.appointments      ADD  CONSTRAINT appointments_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

ALTER TABLE public.auftraege         DROP CONSTRAINT IF EXISTS auftraege_language_check;
ALTER TABLE public.auftraege         ADD  CONSTRAINT auftraege_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

ALTER TABLE public.companies         DROP CONSTRAINT IF EXISTS companies_default_language_check;
ALTER TABLE public.companies         ADD  CONSTRAINT companies_default_language_check
  CHECK (default_language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

ALTER TABLE public.credit_notes      DROP CONSTRAINT IF EXISTS credit_notes_language_check;
ALTER TABLE public.credit_notes      ADD  CONSTRAINT credit_notes_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

ALTER TABLE public.customers         DROP CONSTRAINT IF EXISTS customers_language_check;
ALTER TABLE public.customers         ADD  CONSTRAINT customers_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

ALTER TABLE public.invoice_reminders DROP CONSTRAINT IF EXISTS invoice_reminders_language_check;
ALTER TABLE public.invoice_reminders ADD  CONSTRAINT invoice_reminders_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

ALTER TABLE public.leads             DROP CONSTRAINT IF EXISTS leads_language_check;
ALTER TABLE public.leads             ADD  CONSTRAINT leads_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

ALTER TABLE public.offer_amendments  DROP CONSTRAINT IF EXISTS offer_amendments_language_check;
ALTER TABLE public.offer_amendments  ADD  CONSTRAINT offer_amendments_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

ALTER TABLE public.offers            DROP CONSTRAINT IF EXISTS offers_language_check;
ALTER TABLE public.offers            ADD  CONSTRAINT offers_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

ALTER TABLE public.quittungen        DROP CONSTRAINT IF EXISTS quittungen_language_check;
ALTER TABLE public.quittungen        ADD  CONSTRAINT quittungen_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

ALTER TABLE public.rechnungen        DROP CONSTRAINT IF EXISTS rechnungen_language_check;
ALTER TABLE public.rechnungen        ADD  CONSTRAINT rechnungen_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]));

-- email_logs wird bewusst NICHT angefasst: die Regel dort kennt bereits alle
-- drei Sprachen und behandelt NULL ausdruecklich. Sie umzuschreiben haette nur
-- das Risiko, ihre NULL-Behandlung zu verlieren.

DO $pruefung$
DECLARE
  v_offen text;
  v_erwartet text[] := ARRAY[
    'appointments_language_check', 'auftraege_language_check',
    'companies_default_language_check', 'credit_notes_language_check',
    'customers_language_check', 'invoice_reminders_language_check',
    'leads_language_check', 'offer_amendments_language_check',
    'offers_language_check', 'quittungen_language_check',
    'rechnungen_language_check'
  ];
  v_name text;
BEGIN
  -- 1. Jede der elf Regeln muss noch da sein und 'fr' nennen.
  FOREACH v_name IN ARRAY v_erwartet LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.conname = v_name AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) LIKE '%''fr''%'
    ) THEN
      RAISE EXCEPTION 'Regel % fehlt oder erlaubt kein fr', v_name;
    END IF;
  END LOOP;

  -- 2. Und es darf im ganzen Schema keine Sprachregel mehr geben, die 'fr'
  --    verbietet. Genau daran scheitert diese Migration, wenn eine Tabelle
  --    uebersehen wurde oder spaeter eine neue dazukommt.
  SELECT string_agg(c.conrelid::regclass::text || '.' || c.conname, ', ')
    INTO v_offen
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE c.contype = 'c' AND n.nspname = 'public'
    AND pg_get_constraintdef(c.oid) ~* '(language|locale)'
    AND pg_get_constraintdef(c.oid) LIKE '%''de''%'
    AND pg_get_constraintdef(c.oid) NOT LIKE '%''fr''%';

  IF v_offen IS NOT NULL THEN
    RAISE EXCEPTION 'Diese Sprachregeln verbieten weiterhin fr: %', v_offen;
  END IF;
END
$pruefung$;

COMMIT;
