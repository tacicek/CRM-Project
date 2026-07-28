-- =============================================================================
-- Belegnummern sind je Firma eindeutig, nicht weltweit
-- =============================================================================
--
-- BEFUND — gefunden von supabase-test/tests/finanzen.sql
-- Der neue Testfall D legt eine Rechnung fuer die ZWEITE Testfirma an und
-- scheiterte mit `duplicate key value violates unique constraint
-- "rechnungen_rechnung_nr_key"`. Nicht der Test war falsch.
--
-- Die Nummernvergabe zaehlt je Firma und Jahr:
--
--   rechnung_nr_counter PRIMARY KEY (company_id, jahr)
--   -> 'RE-' || jahr || '-' || LPAD(letzte_nr, 4, '0')
--
-- Die Eindeutigkeit wird aber WELTWEIT verlangt:
--
--   rechnungen_rechnung_nr_key  UNIQUE (rechnung_nr)
--   quittungen_quittung_nr_key  UNIQUE (quittung_nr)
--
-- Solange es eine Firma gab, fiel das nicht auf. Seit Juli 2026 gibt es zwei.
-- Stand heute auf der Produktion:
--
--   Hirschenumzug GmbH   rechnung_nr_counter 2026 = 29   (RE-2026-0001 … 0029)
--   Bernova Umzug        kein Zaehler, 0 Rechnungen
--
-- Bernovas ERSTE Rechnung bekaeme also 'RE-2026-0001' — die Nummer, die
-- Hirschenumzug seit Februar traegt. Der INSERT scheitert. Dasselbe fuer die
-- erste Quittung. Das ist kein theoretischer Fall: es ist genau der Vorgang,
-- mit dem die zweite Firma anfangen wuerde.
--
-- ABHILFE
-- Die Eindeutigkeit auf die Firma beziehen — so, wie die Vergabe es ohnehin
-- schon tut. `UNIQUE (company_id, rechnung_nr)`.
--
-- Kein Umnummerieren: die bestehenden Nummern bleiben, wie sie sind. Sie
-- stehen auf Belegen, die beim Kunden liegen.
--
-- Die Gutschriften aus 20260729120000 tragen denselben Fehler (sie waren dem
-- Muster der Rechnungen nachgebaut) und werden hier mitgezogen — noch bevor
-- die erste Gutschrift existiert.
--
-- NICHT BETROFFEN: `offer_amendments_number_uniq UNIQUE (offer_id,
-- amendment_number)` — dort ist der Bezug von Anfang an richtig gesetzt.
--
-- KEINE FREMDSCHLUESSEL BETROFFEN. Geprueft: die drei Fremdschluessel auf
-- `rechnungen` (payment_allocations, credit_notes, invoice_reminders) zeigen
-- alle auf (id, company_id), keiner auf die Nummer. Und nichts im Frontend
-- oder in den Edge Functions schlaegt einen Beleg ueber seine Nummer nach.
-- =============================================================================

BEGIN;

ALTER TABLE public.rechnungen
  DROP CONSTRAINT IF EXISTS rechnungen_rechnung_nr_key,
  ADD  CONSTRAINT rechnungen_rechnung_nr_je_firma UNIQUE (company_id, rechnung_nr);

ALTER TABLE public.quittungen
  DROP CONSTRAINT IF EXISTS quittungen_quittung_nr_key,
  ADD  CONSTRAINT quittungen_quittung_nr_je_firma UNIQUE (company_id, quittung_nr);

ALTER TABLE public.credit_notes
  DROP CONSTRAINT IF EXISTS credit_notes_gutschrift_nr_key,
  ADD  CONSTRAINT credit_notes_gutschrift_nr_je_firma UNIQUE (company_id, gutschrift_nr);

COMMENT ON CONSTRAINT rechnungen_rechnung_nr_je_firma ON public.rechnungen IS
  'Je Firma eindeutig — so, wie rechnung_nr_counter (company_id, jahr) zaehlt. '
  'Weltweit eindeutig war es, solange es eine Firma gab.';

COMMIT;
