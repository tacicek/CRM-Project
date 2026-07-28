-- =============================================================================
-- Das Zahlungsbuch: was tatsaechlich hereingekommen ist
-- =============================================================================
--
-- BEFUND
-- Ob eine Rechnung bezahlt ist, steht heute in einem einzigen Textfeld:
-- `rechnungen.status = 'bezahlt'`. Ein Knopf in der Rechnungsansicht setzt es
-- ([RechnungDetail.tsx:710]). Dieses Feld ist die einzige Finanzquelle des
-- Systems — die Umsatzanzeige summiert `gesamttotal` aller Zeilen mit diesem
-- Wert ([Rechnungen.tsx:147]).
--
-- Auf der Produktion (2026-07-28) stehen dort 4 Rechnungen ueber 5'988.07.
-- Was das Feld NICHT sagt:
--
--   * WANN gezahlt wurde. Die vier Zeilen tragen alle `updated_at` vom
--     2026-07-27 — dem Tag des Kunden-Backfills. Das echte Zahlungsdatum ist
--     nirgends festgehalten.
--   * WIE VIEL. Eine Teilzahlung hat keinen Platz: entweder ganz oder gar nicht.
--   * WOMIT. Bank, TWINT, bar — nicht unterscheidbar.
--   * OB es stimmt. Ein Fehlklick ist von einer echten Zahlung nicht zu trennen,
--     und es gibt nichts, wogegen man abgleichen koennte.
--
-- Dazu kommt die zweite Einnahmequelle: 8 Quittungen, davon 3 ausgestellt und
-- nicht mehr offen (13'674.65). Sie stehen voellig neben den Rechnungen — keine
-- einzige traegt einen `auftrag_id`. Wer beide Summen addiert, zaehlt jede
-- Barzahlung, fuer die auch eine Rechnung existiert, doppelt.
--
-- ABHILFE
-- Zwei Tabellen, die zusammen beantworten, was hereingekommen ist und worauf es
-- angerechnet wurde:
--
--   payments             ein Zahlungseingang: Betrag, Datum, Weg, Referenz
--   payment_allocations  worauf er angerechnet wird — n:m zu den Rechnungen
--
-- Die Trennung ist nicht akademisch. Eine Ueberweisung ueber 5'000 kann drei
-- Rechnungen decken; eine Rechnung ueber 5'000 kann in drei Raten kommen. Mit
-- einem Feld `bezahlt` auf der Rechnung laesst sich weder das eine noch das
-- andere abbilden.
--
-- ANGELEGT, NICHT GEBUCHT: was ueberzaehlig hereinkommt, bleibt als nicht
-- zugeordneter Rest auf der Zahlung stehen. Es verschwindet nicht und es wird
-- auch nicht gewaltsam auf eine Rechnung gedrueckt.
--
-- APPEND-ONLY. Eine Zahlung wird nicht korrigiert, sie wird storniert: eine
-- zweite Zeile mit umgekehrtem Vorzeichen, die auf die erste zeigt. Das ist
-- keine Formalie — wer Betraege nachtraeglich aendern darf, hat kein Buch,
-- sondern eine Notiz. Aenderbar bleibt nur, was nach der Zahlung entsteht:
-- Abgleichstand, Referenz, Bemerkung.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Voraussetzung: mandantensichere Fremdschluessel
--
-- `payment_allocations` verweist auf Zahlung UND Rechnung. Ein einfaches
-- REFERENCES wuerde nicht verhindern, dass eine Zahlung von Firma A auf eine
-- Rechnung von Firma B gebucht wird — RLS sieht beim INSERT nicht, zu wem die
-- referenzierte Zeile gehoert. Der mehrspaltige Schluessel schon. Dafuer braucht
-- jede Zieltabelle einen eindeutigen (id, company_id).
-- -----------------------------------------------------------------------------

ALTER TABLE public.rechnungen
  DROP CONSTRAINT IF EXISTS rechnungen_id_company_uniq,
  ADD  CONSTRAINT rechnungen_id_company_uniq UNIQUE (id, company_id);

-- -----------------------------------------------------------------------------
-- 2. Zahlungseingaenge
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id   UUID,

  payment_date  DATE           NOT NULL,
  amount        NUMERIC(12,2)  NOT NULL,
  currency      TEXT           NOT NULL DEFAULT 'CHF',
  method        TEXT           NOT NULL DEFAULT 'bank',

  -- Was die Bank oder der Anbieter zurueckmeldet: ESR-/QR-Referenz,
  -- TWINT-Transaktion, Belegnummer der Kasse.
  reference     TEXT,
  reconciliation_status TEXT NOT NULL DEFAULT 'unreconciled',

  -- Storno: zeigt auf die Zahlung, die diese Zeile aufhebt.
  reverses_payment_id UUID REFERENCES public.payments(id) ON DELETE RESTRICT,

  note          TEXT,
  created_via   TEXT NOT NULL DEFAULT 'manual',
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ein Betrag von 0 ist keine Zahlung.
  CONSTRAINT payments_amount_not_zero CHECK (amount <> 0),
  -- Nur ein Storno darf negativ sein. Sonst waere jede Zahlung ein stiller
  -- Weg, Umsatz zu verringern, ohne dass eine Gegenbuchung sichtbar wird.
  CONSTRAINT payments_negative_only_reversal
    CHECK (amount > 0 OR reverses_payment_id IS NOT NULL),
  CONSTRAINT payments_method_check
    CHECK (method IN ('bank','qr','cash','twint','card','other')),
  CONSTRAINT payments_reconciliation_check
    CHECK (reconciliation_status IN ('unreconciled','reconciled','disputed')),
  CONSTRAINT payments_created_via_check
    CHECK (created_via IN ('manual','backfill','quittung','portal')),
  -- Mehrwaehrung braucht Kurse, einen Stichtag und eine Bewertung. Nichts davon
  -- gibt es hier. Die Spalte steht trotzdem, damit ein spaeterer Schritt sie
  -- nicht nachtraeglich in ein volles Buch einziehen muss.
  CONSTRAINT payments_currency_chf_only CHECK (currency = 'CHF'),
  CONSTRAINT payments_no_self_reversal
    CHECK (reverses_payment_id IS NULL OR reverses_payment_id <> id)
);

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_id_company_uniq,
  ADD  CONSTRAINT payments_id_company_uniq UNIQUE (id, company_id);

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_customer_fk,
  ADD  CONSTRAINT payments_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

COMMENT ON TABLE public.payments IS
  'Zahlungseingaenge. Append-only: Korrekturen laufen ueber eine Stornozeile '
  'mit umgekehrtem Vorzeichen (reverses_payment_id), nicht ueber ein UPDATE.';
COMMENT ON COLUMN public.payments.payment_date IS
  'Wertstellung. Beim Backfill aus Belegdaten uebernommen — dann steht '
  'reconciliation_status auf unreconciled, weil das echte Datum unbekannt ist.';

CREATE INDEX IF NOT EXISTS idx_payments_company_datum
  ON public.payments (company_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_kunde
  ON public.payments (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_offen
  ON public.payments (company_id) WHERE reconciliation_status = 'unreconciled';
-- Eine Zahlung darf nur einmal storniert werden.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_storno_einmalig
  ON public.payments (reverses_payment_id) WHERE reverses_payment_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Anrechnung
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_id   UUID NOT NULL,
  rechnung_id  UUID NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  note         TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_allocations_amount_not_zero CHECK (amount <> 0)
);

-- Mehrspaltig, damit eine Zahlung nicht auf die Rechnung einer anderen Firma
-- gebucht werden kann. ON DELETE CASCADE ist hier richtig: verschwindet die
-- Zahlung, ist auch ihre Anrechnung gegenstandslos.
ALTER TABLE public.payment_allocations
  DROP CONSTRAINT IF EXISTS payment_allocations_payment_fk,
  ADD  CONSTRAINT payment_allocations_payment_fk
       FOREIGN KEY (payment_id, company_id)
       REFERENCES public.payments (id, company_id) ON DELETE CASCADE;

ALTER TABLE public.payment_allocations
  DROP CONSTRAINT IF EXISTS payment_allocations_rechnung_fk,
  ADD  CONSTRAINT payment_allocations_rechnung_fk
       FOREIGN KEY (rechnung_id, company_id)
       REFERENCES public.rechnungen (id, company_id) ON DELETE CASCADE;

COMMENT ON TABLE public.payment_allocations IS
  'Worauf ein Zahlungseingang angerechnet wird. n:m — eine Ueberweisung kann '
  'mehrere Rechnungen decken, eine Rechnung mehrere Raten haben.';

CREATE INDEX IF NOT EXISTS idx_payment_allocations_rechnung
  ON public.payment_allocations (rechnung_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment
  ON public.payment_allocations (payment_id);

-- -----------------------------------------------------------------------------
-- 4. Was eine Zahlung hergibt, ist begrenzt
--
-- Die Summe der Anrechnungen darf den Zahlbetrag nicht ueberschreiten. Ohne
-- diese Pruefung liesse sich dieselben 1'000 Franken auf drei Rechnungen
-- buchen und das Buch waere wertlos.
--
-- Geprueft wird nach der Aenderung (AFTER, mit Sperre auf die Zahlung), weil
-- die Summe erst dann vollstaendig ist. Die Sperre verhindert, dass zwei
-- gleichzeitige Buchungen beide "passt noch" sehen.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_allocation_within_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_payment  RECORD;
  v_gebucht  NUMERIC(12,2);
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id)
  FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_gebucht
  FROM public.payment_allocations
  WHERE payment_id = v_payment.id;

  -- Vorzeichenrichtig vergleichen: eine Stornozahlung ist negativ, ihre
  -- Anrechnungen sind es auch. ABS macht beide Faelle zu derselben Frage.
  IF ABS(v_gebucht) > ABS(v_payment.amount) THEN
    RAISE EXCEPTION
      'Anrechnung uebersteigt die Zahlung: % von % bereits gebucht.',
      ABS(v_gebucht), ABS(v_payment.amount)
      USING ERRCODE = 'check_violation';
  END IF;

  IF sign(v_gebucht) <> 0 AND sign(v_gebucht) <> sign(v_payment.amount) THEN
    RAISE EXCEPTION 'Anrechnung und Zahlung haben verschiedene Vorzeichen.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_allocation_within_payment ON public.payment_allocations;
CREATE TRIGGER trigger_allocation_within_payment
  AFTER INSERT OR UPDATE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.guard_allocation_within_payment();

-- -----------------------------------------------------------------------------
-- 5. Append-only
--
-- Aenderbar ist nur, was NACH der Zahlung entsteht. Betrag, Datum, Weg und
-- Zugehoerigkeit sind der Vorgang selbst.
--
-- Erlaubnisliste statt Verbotsliste: eine spaeter hinzugefuegte Spalte ist
-- damit von sich aus geschuetzt und nicht aus Versehen offen.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_payment_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  erlaubt TEXT[] := ARRAY['reconciliation_status','reference','note'];
  spalte  TEXT;
  alt_j   JSONB := to_jsonb(OLD);
  neu_j   JSONB := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Zahlungen werden nicht geloescht, sondern storniert (Gegenbuchung).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR spalte IN
    SELECT a.attname FROM pg_attribute a
    WHERE a.attrelid = TG_RELID AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attgenerated = ''
  LOOP
    IF NOT (spalte = ANY(erlaubt))
       AND (alt_j -> spalte) IS DISTINCT FROM (neu_j -> spalte) THEN
      RAISE EXCEPTION
        'Zahlung %: "%" ist nicht nachtraeglich aenderbar. Korrektur nur per Storno.',
        OLD.id, spalte
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_payments_append_only ON public.payments;
CREATE TRIGGER trigger_payments_append_only
  BEFORE UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_payment_append_only();

-- Eine gebuchte Anrechnung wird ebenfalls nicht umgeschrieben. Sie darf
-- geloescht werden, solange die Zahlung offen zugeordnet wird — das ist eine
-- Zuordnung, kein Zahlungsvorgang. Der Betrag selbst bleibt unantastbar.
CREATE OR REPLACE FUNCTION public.guard_allocation_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.amount      IS DISTINCT FROM OLD.amount
  OR NEW.payment_id  IS DISTINCT FROM OLD.payment_id
  OR NEW.rechnung_id IS DISTINCT FROM OLD.rechnung_id
  OR NEW.company_id  IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION
      'Anrechnung %: Betrag und Bezug sind nicht aenderbar. Loeschen und neu buchen.',
      OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_allocation_immutable ON public.payment_allocations;
CREATE TRIGGER trigger_allocation_immutable
  BEFORE UPDATE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.guard_allocation_immutable();

-- -----------------------------------------------------------------------------
-- 6. RLS
--
-- Lesen: jedes Mitglied — wer eine Rechnung stellt, muss sehen, ob sie bezahlt
-- ist. Schreiben: owner|admin. Eine Zahlung zu buchen ist keine Tagesarbeit
-- wie das Schreiben einer Rechnung, sondern der Eintrag ins Buch.
-- Loeschen: gar nicht (siehe Waechter oben) — deshalb auch keine Policy.
-- -----------------------------------------------------------------------------

ALTER TABLE public.payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_member ON public.payments;
CREATE POLICY payments_select_member ON public.payments FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS payments_insert_owner_admin ON public.payments;
CREATE POLICY payments_insert_owner_admin ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS payments_update_owner_admin ON public.payments;
CREATE POLICY payments_update_owner_admin ON public.payments FOR UPDATE
  TO authenticated
  USING      (public.is_company_role(company_id, ARRAY['owner','admin']))
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS payment_allocations_select_member ON public.payment_allocations;
CREATE POLICY payment_allocations_select_member ON public.payment_allocations FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS payment_allocations_insert_owner_admin ON public.payment_allocations;
CREATE POLICY payment_allocations_insert_owner_admin ON public.payment_allocations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS payment_allocations_delete_owner_admin ON public.payment_allocations;
CREATE POLICY payment_allocations_delete_owner_admin ON public.payment_allocations FOR DELETE
  TO authenticated
  USING (public.is_company_role(company_id, ARRAY['owner','admin']));

COMMIT;
