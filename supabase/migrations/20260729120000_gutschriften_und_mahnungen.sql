-- =============================================================================
-- Gutschriften und Mahnungen
-- =============================================================================
--
-- BEFUND
-- Eine gestellte Rechnung laesst sich heute auf zwei Arten "korrigieren": den
-- Betrag ueberschreiben oder die Zeile loeschen. Das erste faelscht einen
-- Beleg, den der Kunde bereits hat; das zweite verbietet der Loeschwaechter aus
-- 20260727130000 zu Recht. Es fehlt der dritte, richtige Weg — die Gutschrift.
--
-- Und wenn eine Rechnung ueberfaellig wird, passiert nichts. Weder wird der
-- Status nachgezogen (er bleibt auf 'versendet', obwohl die DB den Wert
-- 'ueberfaellig' kennt), noch entsteht irgendwo eine Spur, dass gemahnt wurde.
-- Auf der Produktion steht heute keine Rechnung ueberfaellig — bei 6 versendeten
-- Rechnungen ist das Glueck, nicht Ordnung.
--
-- ABHILFE
--   credit_notes       Gutschriften mit eigener Nummer; senken open_amount
--   invoice_reminders  welche Mahnstufe wann heraus ist, mit Gebuehr
--
-- EINE GUTSCHRIFT AENDERT DIE RECHNUNG NICHT. Sie ist ein eigener Beleg, der
-- dagegen steht. Der Kunde hat die Rechnung ueber 1'000 und die Gutschrift
-- ueber 200; offen sind 800. Beide Belege bleiben, wie sie waren.
--
-- Die Mahnstufe steht als eigene Zeile, nicht als Zaehler auf der Rechnung:
-- eine Mahnung ist ein versendeter Beleg mit Datum, Betrag und Gebuehr. Ein
-- Zaehler `mahnstufe = 2` sagt nicht, wann Stufe 1 heraus war.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Gutschriften
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gutschrift_nr_counter (
  company_id UUID    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  jahr       INTEGER NOT NULL,
  letzte_nr  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, jahr)
);

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rechnung_id    UUID NOT NULL,
  customer_id    UUID,

  gutschrift_nr  TEXT UNIQUE,
  datum          DATE NOT NULL DEFAULT CURRENT_DATE,
  amount         NUMERIC(12,2) NOT NULL,
  reason         TEXT,
  positionen     JSONB NOT NULL DEFAULT '[]'::jsonb,
  status         TEXT NOT NULL DEFAULT 'entwurf',

  -- Die Sprache des KUNDEN, aus der Rechnung uebernommen. Kein Vorgabewert:
  -- ein DEFAULT 'de' greift vor dem Trigger und ein franzoesischer Kunde
  -- bekaeme eine deutsche Gutschrift — dieselbe Falle wie beim Nachtrag
  -- (20260728220000).
  language       TEXT NOT NULL,
  pdf_url        TEXT,
  note           TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT credit_notes_amount_positive CHECK (amount > 0),
  CONSTRAINT credit_notes_status_check CHECK (status IN ('entwurf','versendet','storniert')),
  CONSTRAINT credit_notes_language_check CHECK (language IN ('de','fr','en'))
);

ALTER TABLE public.credit_notes
  DROP CONSTRAINT IF EXISTS credit_notes_rechnung_fk,
  ADD  CONSTRAINT credit_notes_rechnung_fk
       FOREIGN KEY (rechnung_id, company_id)
       REFERENCES public.rechnungen (id, company_id) ON DELETE CASCADE;

ALTER TABLE public.credit_notes
  DROP CONSTRAINT IF EXISTS credit_notes_customer_fk,
  ADD  CONSTRAINT credit_notes_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

COMMENT ON TABLE public.credit_notes IS
  'Gutschriften. Ein eigener Beleg gegen eine Rechnung — die Rechnung selbst '
  'bleibt unveraendert, ihr offener Betrag sinkt.';

CREATE INDEX IF NOT EXISTS idx_credit_notes_rechnung ON public.credit_notes (rechnung_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_company  ON public.credit_notes (company_id, datum DESC);

CREATE OR REPLACE FUNCTION public.generate_gutschrift_nr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_nr  INTEGER;
  jahr_int INTEGER;
BEGIN
  IF NEW.gutschrift_nr IS NULL THEN
    jahr_int := EXTRACT(YEAR FROM COALESCE(NEW.datum, CURRENT_DATE))::INTEGER;

    INSERT INTO public.gutschrift_nr_counter AS c (company_id, jahr, letzte_nr)
    VALUES (NEW.company_id, jahr_int, 1)
    ON CONFLICT (company_id, jahr)
      DO UPDATE SET letzte_nr = c.letzte_nr + 1
    RETURNING c.letzte_nr INTO next_nr;

    NEW.gutschrift_nr := 'GS-' || jahr_int::TEXT || '-' || LPAD(next_nr::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_notes_set_nr ON public.credit_notes;
CREATE TRIGGER credit_notes_set_nr
  BEFORE INSERT ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.generate_gutschrift_nr();

-- Sprache und Kunde von der Rechnung erben. Beides muss aus der Rechnung
-- kommen und nicht aus dem Kontext des Bedieners.
CREATE OR REPLACE FUNCTION public.credit_notes_von_rechnung_erben()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_r RECORD;
BEGIN
  SELECT language, customer_id INTO v_r
  FROM public.rechnungen WHERE id = NEW.rechnung_id;

  NEW.language    := COALESCE(NEW.language, v_r.language, 'de');
  NEW.customer_id := COALESCE(NEW.customer_id, v_r.customer_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_notes_erben ON public.credit_notes;
CREATE TRIGGER credit_notes_erben
  BEFORE INSERT ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.credit_notes_von_rechnung_erben();

DROP TRIGGER IF EXISTS credit_notes_updated_at ON public.credit_notes;
CREATE TRIGGER credit_notes_updated_at
  BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Fortschreibung: credited_total auf der Rechnung
--
-- Entwuerfe zaehlen nicht. Eine Gutschrift, die noch niemand ausgestellt hat,
-- darf den offenen Betrag nicht senken — sonst mahnt man einen Kunden nicht,
-- weil intern ein Entwurf herumliegt.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rechnung_gutschriften_fortschreiben()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rechnung UUID := COALESCE(NEW.rechnung_id, OLD.rechnung_id);
  v_summe    NUMERIC(12,2);
  v_zeile    RECORD;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_summe
  FROM public.credit_notes
  WHERE rechnung_id = v_rechnung AND status = 'versendet';

  UPDATE public.rechnungen
  SET credited_total = v_summe
  WHERE id = v_rechnung
  RETURNING * INTO v_zeile;

  IF v_zeile.status <> 'entwurf' AND v_zeile.open_amount <= 0
     AND v_zeile.status <> 'bezahlt' THEN
    UPDATE public.rechnungen SET status = 'bezahlt' WHERE id = v_rechnung;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_credit_notes_fortschreiben ON public.credit_notes;
CREATE TRIGGER trigger_credit_notes_fortschreiben
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.rechnung_gutschriften_fortschreiben();

-- Eine Gutschrift kann nicht mehr hergeben, als die Rechnung wert ist.
CREATE OR REPLACE FUNCTION public.guard_gutschrift_hoehe()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_rechnungswert NUMERIC(12,2);
  v_gutgeschrieben NUMERIC(12,2);
BEGIN
  SELECT COALESCE(gesamttotal, total, 0) INTO v_rechnungswert
  FROM public.rechnungen WHERE id = NEW.rechnung_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_gutgeschrieben
  FROM public.credit_notes
  WHERE rechnung_id = NEW.rechnung_id AND status = 'versendet';

  IF v_gutgeschrieben > v_rechnungswert THEN
    RAISE EXCEPTION
      'Gutschriften (%) uebersteigen den Rechnungsbetrag (%).',
      v_gutgeschrieben, v_rechnungswert
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_gutschrift_hoehe ON public.credit_notes;
CREATE TRIGGER trigger_gutschrift_hoehe
  AFTER INSERT OR UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.guard_gutschrift_hoehe();

-- -----------------------------------------------------------------------------
-- 3. Mahnungen
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_reminders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rechnung_id  UUID NOT NULL,

  level        SMALLINT NOT NULL,
  sent_at      TIMESTAMPTZ,

  -- Festgehalten, wie es zum Zeitpunkt der Mahnung war. Wer spaeter fragt,
  -- worauf sich die zweite Mahnung bezog, findet die Antwort hier und nicht
  -- im heutigen Stand der Rechnung.
  open_amount_snapshot NUMERIC(12,2) NOT NULL,
  due_date_snapshot    DATE,
  fee          NUMERIC(12,2) NOT NULL DEFAULT 0,
  interest     NUMERIC(12,2) NOT NULL DEFAULT 0,

  language     TEXT NOT NULL,
  pdf_url      TEXT,
  note         TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT invoice_reminders_level_check CHECK (level BETWEEN 1 AND 3),
  CONSTRAINT invoice_reminders_fee_check   CHECK (fee >= 0 AND interest >= 0),
  CONSTRAINT invoice_reminders_language_check CHECK (language IN ('de','fr','en')),
  CONSTRAINT invoice_reminders_stufe_einmal UNIQUE (rechnung_id, level)
);

ALTER TABLE public.invoice_reminders
  DROP CONSTRAINT IF EXISTS invoice_reminders_rechnung_fk,
  ADD  CONSTRAINT invoice_reminders_rechnung_fk
       FOREIGN KEY (rechnung_id, company_id)
       REFERENCES public.rechnungen (id, company_id) ON DELETE CASCADE;

COMMENT ON TABLE public.invoice_reminders IS
  'Mahnungen je Rechnung und Stufe. Eine Zeile ist ein Beleg, kein Zaehler — '
  'der Stand zum Mahnzeitpunkt ist mitgeschrieben.';

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_rechnung
  ON public.invoice_reminders (rechnung_id, level);

CREATE OR REPLACE FUNCTION public.invoice_reminders_sprache_erben()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_r RECORD;
BEGIN
  SELECT language, faellig_am, open_amount INTO v_r
  FROM public.rechnungen WHERE id = NEW.rechnung_id;

  NEW.language := COALESCE(NEW.language, v_r.language, 'de');
  NEW.due_date_snapshot := COALESCE(NEW.due_date_snapshot, v_r.faellig_am);
  IF NEW.open_amount_snapshot IS NULL THEN
    NEW.open_amount_snapshot := v_r.open_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_reminders_erben ON public.invoice_reminders;
CREATE TRIGGER invoice_reminders_erben
  BEFORE INSERT ON public.invoice_reminders
  FOR EACH ROW EXECUTE FUNCTION public.invoice_reminders_sprache_erben();

-- Stufe 2 ohne Stufe 1 waere keine Mahnung, sondern ein Sprung.
CREATE OR REPLACE FUNCTION public.guard_mahnstufe_reihenfolge()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.level > 1 AND NOT EXISTS (
    SELECT 1 FROM public.invoice_reminders
    WHERE rechnung_id = NEW.rechnung_id AND level = NEW.level - 1
  ) THEN
    RAISE EXCEPTION 'Mahnstufe % setzt Stufe % voraus.', NEW.level, NEW.level - 1
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_mahnstufe_reihenfolge ON public.invoice_reminders;
CREATE TRIGGER trigger_mahnstufe_reihenfolge
  BEFORE INSERT ON public.invoice_reminders
  FOR EACH ROW EXECUTE FUNCTION public.guard_mahnstufe_reihenfolge();

-- -----------------------------------------------------------------------------
-- 4. RLS — wie bei den Rechnungen: lesen alle, schreiben owner|admin
-- -----------------------------------------------------------------------------

ALTER TABLE public.credit_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gutschrift_nr_counter ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_notes_select_member ON public.credit_notes;
CREATE POLICY credit_notes_select_member ON public.credit_notes FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS credit_notes_write_owner_admin ON public.credit_notes;
CREATE POLICY credit_notes_write_owner_admin ON public.credit_notes FOR ALL
  TO authenticated
  USING      (public.is_company_role(company_id, ARRAY['owner','admin']))
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS invoice_reminders_select_member ON public.invoice_reminders;
CREATE POLICY invoice_reminders_select_member ON public.invoice_reminders FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS invoice_reminders_write_owner_admin ON public.invoice_reminders;
CREATE POLICY invoice_reminders_write_owner_admin ON public.invoice_reminders FOR ALL
  TO authenticated
  USING      (public.is_company_role(company_id, ARRAY['owner','admin']))
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner','admin']));

-- Der Zaehler wird ausschliesslich vom SECURITY-DEFINER-Trigger gefuehrt.
-- Keine Policy heisst: aus dem Browser kommt niemand heran.

COMMIT;
