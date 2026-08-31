-- Ruecknahme zu 20260831100000: die Sprachregeln wieder auf 'de','en' engen.
--
-- WANN MAN DAS TUT: praktisch nie. Die Vorwaertsmigration weitet nur, was die
-- Oberflaeche ohnehin anbietet. Diese Datei existiert, damit der Weg zurueck
-- beschrieben ist, nicht weil er empfohlen waere.
--
-- WAS SIE ZUERST PRUEFT
--
-- Eine Verengung kann Daten unmoeglich machen, die bereits gespeichert sind.
-- Deshalb bricht sie ab, sobald irgendwo eine franzoesische Zeile steht — sonst
-- entstuende eine Regel, die vorhandene Zeilen verbietet, und die naechste
-- Aenderung an so einer Zeile schluege fehl. Lieber hier laut scheitern als
-- spaeter still eine Tabelle unbeschreibbar machen.

BEGIN;

DO $schutz$
DECLARE
  v_treffer text;
BEGIN
  -- Bewusst OHNE dynamisches SQL: eine Ruecknahme laeuft selten, unter Druck und
  -- als Eigentuemer. Sie ist der letzte Ort, an dem irgendetwas zur Laufzeit zu
  -- SQL zusammengesetzt werden sollte. Elf ausgeschriebene Zaehlungen sind
  -- laenger, aber sie stehen vollstaendig da und lassen sich lesen.
  SELECT string_agg(t || '=' || n::text, ' ')
    INTO v_treffer
  FROM (
    SELECT 'appointments'      AS t, count(*) AS n FROM public.appointments      WHERE language = 'fr'
    UNION ALL SELECT 'auftraege',         count(*) FROM public.auftraege         WHERE language = 'fr'
    UNION ALL SELECT 'companies',         count(*) FROM public.companies         WHERE default_language = 'fr'
    UNION ALL SELECT 'credit_notes',      count(*) FROM public.credit_notes      WHERE language = 'fr'
    UNION ALL SELECT 'customers',         count(*) FROM public.customers         WHERE language = 'fr'
    UNION ALL SELECT 'invoice_reminders', count(*) FROM public.invoice_reminders WHERE language = 'fr'
    UNION ALL SELECT 'leads',             count(*) FROM public.leads             WHERE language = 'fr'
    UNION ALL SELECT 'offer_amendments',  count(*) FROM public.offer_amendments  WHERE language = 'fr'
    UNION ALL SELECT 'offers',            count(*) FROM public.offers            WHERE language = 'fr'
    UNION ALL SELECT 'quittungen',        count(*) FROM public.quittungen        WHERE language = 'fr'
    UNION ALL SELECT 'rechnungen',        count(*) FROM public.rechnungen        WHERE language = 'fr'
  ) AS z
  WHERE z.n > 0;

  IF v_treffer IS NOT NULL THEN
    RAISE EXCEPTION 'Ruecknahme abgelehnt: es gibt bereits franzoesische Zeilen: %', v_treffer;
  END IF;
END
$schutz$;

ALTER TABLE public.appointments      DROP CONSTRAINT IF EXISTS appointments_language_check;
ALTER TABLE public.appointments      ADD  CONSTRAINT appointments_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'en'::text]));

ALTER TABLE public.auftraege         DROP CONSTRAINT IF EXISTS auftraege_language_check;
ALTER TABLE public.auftraege         ADD  CONSTRAINT auftraege_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'en'::text]));

ALTER TABLE public.companies         DROP CONSTRAINT IF EXISTS companies_default_language_check;
ALTER TABLE public.companies         ADD  CONSTRAINT companies_default_language_check
  CHECK (default_language = ANY (ARRAY['de'::text, 'en'::text]));

ALTER TABLE public.credit_notes      DROP CONSTRAINT IF EXISTS credit_notes_language_check;
ALTER TABLE public.credit_notes      ADD  CONSTRAINT credit_notes_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'en'::text]));

ALTER TABLE public.customers         DROP CONSTRAINT IF EXISTS customers_language_check;
ALTER TABLE public.customers         ADD  CONSTRAINT customers_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'en'::text]));

ALTER TABLE public.invoice_reminders DROP CONSTRAINT IF EXISTS invoice_reminders_language_check;
ALTER TABLE public.invoice_reminders ADD  CONSTRAINT invoice_reminders_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'en'::text]));

ALTER TABLE public.leads             DROP CONSTRAINT IF EXISTS leads_language_check;
ALTER TABLE public.leads             ADD  CONSTRAINT leads_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'en'::text]));

ALTER TABLE public.offer_amendments  DROP CONSTRAINT IF EXISTS offer_amendments_language_check;
ALTER TABLE public.offer_amendments  ADD  CONSTRAINT offer_amendments_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'en'::text]));

ALTER TABLE public.offers            DROP CONSTRAINT IF EXISTS offers_language_check;
ALTER TABLE public.offers            ADD  CONSTRAINT offers_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'en'::text]));

ALTER TABLE public.quittungen        DROP CONSTRAINT IF EXISTS quittungen_language_check;
ALTER TABLE public.quittungen        ADD  CONSTRAINT quittungen_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'en'::text]));

ALTER TABLE public.rechnungen        DROP CONSTRAINT IF EXISTS rechnungen_language_check;
ALTER TABLE public.rechnungen        ADD  CONSTRAINT rechnungen_language_check
  CHECK (language = ANY (ARRAY['de'::text, 'en'::text]));

COMMIT;
