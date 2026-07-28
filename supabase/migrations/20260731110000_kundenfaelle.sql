-- =============================================================================
-- Kundenfaelle: Schaden, Reklamation, Nachreinigung, Serviceaenderung
-- =============================================================================
--
-- BEFUND
-- Wenn beim Umzug ein Schrank beschaedigt wird, wenn ein Kunde reklamiert, wenn
-- nachgereinigt werden muss oder wenn er den Umfang aendern will — dann gibt es
-- dafuer heute keinen Ort. Es landet in `auftraege.internal_notes`, in einer
-- E-Mail oder in niemandes Gedaechtnis. Auf der Produktion existiert keine
-- einzige Tabelle, die einen dieser Vorgaenge fuehrt.
--
-- Was daran haengt: eine Reklamation hat einen Zustand (offen, in Arbeit,
-- geloest), eine Zustaendigkeit, eine Frist und ein Ergebnis — im schlimmsten
-- Fall eine Gutschrift. Nichts davon laesst sich in einem Notizfeld fuehren.
--
-- ABHILFE
-- EINE Tabelle mit einem Typfeld, nicht vier aehnliche. So steht es in der
-- Roadmap ("Ayrı ayrı dört benzer tablo oluşturulmaz") und so ist es richtig:
-- die vier Faelle unterscheiden sich im Anlass, nicht im Ablauf. Alle vier
-- werden gemeldet, zugewiesen, bearbeitet und abgeschlossen. Vier Tabellen
-- waeren vier Mal dieselbe Zustandslogik, die dann drei Mal veraltet.
--
-- ANGEBUNDEN, NICHT FREISCHWEBEND. Ein Fall zeigt auf den Kunden und optional
-- auf Auftrag, Termin oder Rechnung. Der Bezug ist mehrspaltig — dieselbe
-- Mandantensicherung wie ueberall seit 20260728110000.
--
-- DIE GUTSCHRIFT BLEIBT WO SIE IST. Ein Fall kann auf eine `credit_notes`-Zeile
-- zeigen, erzeugt sie aber nicht: Geld gehoert ins Zahlungsbuch
-- (20260729120000) und nicht in die Reklamationsakte.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_cases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID,

  case_number TEXT,
  case_type   TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,

  status      TEXT NOT NULL DEFAULT 'offen',
  priority    TEXT NOT NULL DEFAULT 'normal',

  auftrag_id    UUID REFERENCES public.auftraege(id)   ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  rechnung_id   UUID,
  location_id   UUID,

  -- Wer gemeldet hat: die Firma selbst oder der Kunde ueber das Portal.
  reported_by   TEXT NOT NULL DEFAULT 'firma',
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at        TIMESTAMPTZ,

  resolution      TEXT,
  resolution_type TEXT,
  -- Zeigt auf die Gutschrift, erzeugt sie aber nicht.
  credit_note_id  UUID,
  closed_at       TIMESTAMPTZ,

  -- Belegdateien. Ein eigener, NICHT oeffentlicher Bucket fehlt noch (der
  -- vorhandene `besichtigung-uploads` steht auf public = true); bis dahin
  -- bleibt die Spalte leer statt Kundenfotos offen ins Netz zu stellen.
  evidence    JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT customer_cases_type_check
    CHECK (case_type IN ('damage','complaint','recleaning','service_change')),
  CONSTRAINT customer_cases_status_check
    CHECK (status IN ('offen','in_arbeit','wartet_auf_kunde','geloest','abgelehnt')),
  CONSTRAINT customer_cases_priority_check
    CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT customer_cases_reported_by_check
    CHECK (reported_by IN ('firma','kunde')),
  CONSTRAINT customer_cases_resolution_type_check
    CHECK (resolution_type IS NULL OR resolution_type IN
           ('repariert','ersetzt','gutschrift','nachgeholt','kulanz','abgelehnt','sonstiges')),
  CONSTRAINT customer_cases_titel_da CHECK (length(TRIM(title)) > 0),
  -- Ein abgeschlossener Fall ohne Ergebnis waere ein Fall, den niemand mehr
  -- nachvollziehen kann.
  CONSTRAINT customer_cases_abschluss_vollstaendig
    CHECK (status NOT IN ('geloest','abgelehnt')
           OR (closed_at IS NOT NULL AND resolution_type IS NOT NULL))
);

-- Voraussetzung fuer den Verweis auf die Gutschrift weiter unten: die
-- Zieltabelle braucht den mehrspaltigen Schluessel, bevor jemand darauf zeigt.
ALTER TABLE public.credit_notes
  DROP CONSTRAINT IF EXISTS credit_notes_id_company_uniq,
  ADD  CONSTRAINT credit_notes_id_company_uniq UNIQUE (id, company_id);

ALTER TABLE public.customer_cases
  DROP CONSTRAINT IF EXISTS customer_cases_customer_fk,
  ADD  CONSTRAINT customer_cases_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id) ON DELETE SET NULL (customer_id);

ALTER TABLE public.customer_cases
  DROP CONSTRAINT IF EXISTS customer_cases_rechnung_fk,
  ADD  CONSTRAINT customer_cases_rechnung_fk
       FOREIGN KEY (rechnung_id, company_id)
       REFERENCES public.rechnungen (id, company_id) ON DELETE SET NULL (rechnung_id);

ALTER TABLE public.customer_cases
  DROP CONSTRAINT IF EXISTS customer_cases_location_fk,
  ADD  CONSTRAINT customer_cases_location_fk
       FOREIGN KEY (location_id, company_id)
       REFERENCES public.service_locations (id, company_id) ON DELETE SET NULL (location_id);

ALTER TABLE public.customer_cases
  DROP CONSTRAINT IF EXISTS customer_cases_credit_note_fk,
  ADD  CONSTRAINT customer_cases_credit_note_fk
       FOREIGN KEY (credit_note_id, company_id)
       REFERENCES public.credit_notes (id, company_id) ON DELETE SET NULL (credit_note_id);

COMMENT ON TABLE public.customer_cases IS
  'Schaden, Reklamation, Nachreinigung, Serviceaenderung — EINE Tabelle mit '
  'Typfeld. Die vier unterscheiden sich im Anlass, nicht im Ablauf.';

CREATE INDEX IF NOT EXISTS idx_customer_cases_offen
  ON public.customer_cases (company_id, due_at)
  WHERE status NOT IN ('geloest','abgelehnt');
CREATE INDEX IF NOT EXISTS idx_customer_cases_kunde
  ON public.customer_cases (customer_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_cases_auftrag
  ON public.customer_cases (auftrag_id) WHERE auftrag_id IS NOT NULL;

DROP TRIGGER IF EXISTS customer_cases_updated_at ON public.customer_cases;
CREATE TRIGGER customer_cases_updated_at
  BEFORE UPDATE ON public.customer_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------------------------
-- Nummer — je Firma und Jahr, nach dem Muster der Rechnungen
--
-- Und von Anfang an je Firma eindeutig: der Fehler aus 20260729170000 wird
-- hier nicht wiederholt.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fall_nr_counter (
  company_id UUID    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  jahr       INTEGER NOT NULL,
  letzte_nr  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, jahr)
);
ALTER TABLE public.fall_nr_counter ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_cases
  DROP CONSTRAINT IF EXISTS customer_cases_nr_je_firma,
  ADD  CONSTRAINT customer_cases_nr_je_firma UNIQUE (company_id, case_number);

CREATE OR REPLACE FUNCTION public.generate_fall_nr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_nr  INTEGER;
  jahr_int INTEGER;
BEGIN
  IF NEW.case_number IS NULL THEN
    jahr_int := EXTRACT(YEAR FROM COALESCE(NEW.reported_at, NOW()))::INTEGER;

    INSERT INTO public.fall_nr_counter AS c (company_id, jahr, letzte_nr)
    VALUES (NEW.company_id, jahr_int, 1)
    ON CONFLICT (company_id, jahr) DO UPDATE SET letzte_nr = c.letzte_nr + 1
    RETURNING c.letzte_nr INTO next_nr;

    NEW.case_number := 'FA-' || jahr_int::TEXT || '-' || LPAD(next_nr::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_cases_set_nr ON public.customer_cases;
CREATE TRIGGER customer_cases_set_nr
  BEFORE INSERT ON public.customer_cases
  FOR EACH ROW EXECUTE FUNCTION public.generate_fall_nr();

-- -----------------------------------------------------------------------------
-- Verlauf — was am Fall passiert ist
--
-- Append-only. Eine Reklamationsakte, in der sich der Verlauf umschreiben
-- laesst, belegt nichts. Dieselbe Bauart wie sales_stage_history
-- (20260728240000).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_case_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID NOT NULL REFERENCES public.customer_cases(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  alt_wert   TEXT,
  neu_wert   TEXT,
  note       TEXT,

  actor_id   UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT customer_case_events_type_check
    CHECK (event_type IN ('angelegt','status','zuweisung','notiz','abschluss'))
);

CREATE INDEX IF NOT EXISTS idx_case_events_fall
  ON public.customer_case_events (case_id, created_at);

CREATE OR REPLACE FUNCTION public.guard_case_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Der Fallverlauf ist ein Nachweis und wird nicht veraendert.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trigger_case_events_append_only ON public.customer_case_events;
CREATE TRIGGER trigger_case_events_append_only
  BEFORE UPDATE OR DELETE ON public.customer_case_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_case_events_append_only();

CREATE OR REPLACE FUNCTION public.customer_cases_verlauf_schreiben()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.customer_case_events
      (case_id, company_id, event_type, neu_wert, note, actor_id)
    VALUES (NEW.id, NEW.company_id, 'angelegt', NEW.status, NEW.title, auth.uid());
    RETURN NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.customer_case_events
      (case_id, company_id, event_type, alt_wert, neu_wert, note, actor_id)
    VALUES (NEW.id, NEW.company_id,
            CASE WHEN NEW.status IN ('geloest','abgelehnt') THEN 'abschluss' ELSE 'status' END,
            OLD.status, NEW.status, NEW.resolution, auth.uid());
  END IF;

  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    INSERT INTO public.customer_case_events
      (case_id, company_id, event_type, alt_wert, neu_wert, actor_id)
    VALUES (NEW.id, NEW.company_id, 'zuweisung',
            OLD.assigned_user_id::TEXT, NEW.assigned_user_id::TEXT, auth.uid());
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_customer_cases_verlauf ON public.customer_cases;
CREATE TRIGGER trigger_customer_cases_verlauf
  AFTER INSERT OR UPDATE ON public.customer_cases
  FOR EACH ROW EXECUTE FUNCTION public.customer_cases_verlauf_schreiben();

-- -----------------------------------------------------------------------------
-- Ein offener Fall gehoert in die Wiedervorlage
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.customer_cases_aufgabe_anlegen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.crm_tasks (company_id, title, description, task_type, priority,
                                due_at, customer_id, auftrag_id, assigned_user_id)
  VALUES (
    NEW.company_id,
    COALESCE(NEW.case_number, 'Fall') || ': ' || NEW.title,
    NEW.description,
    'admin',
    CASE WHEN NEW.priority = 'urgent' THEN 'high' ELSE NEW.priority END,
    COALESCE(NEW.due_at, NOW()),
    NEW.customer_id, NEW.auftrag_id, NEW.assigned_user_id
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_customer_cases_aufgabe ON public.customer_cases;
CREATE TRIGGER trigger_customer_cases_aufgabe
  AFTER INSERT ON public.customer_cases
  FOR EACH ROW EXECUTE FUNCTION public.customer_cases_aufgabe_anlegen();

-- -----------------------------------------------------------------------------
-- Der Kunde meldet selbst — aus dem Portal
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_report_case(
  p_session     TEXT,
  p_case_type   TEXT,
  p_title       TEXT,
  p_description TEXT DEFAULT NULL,
  p_auftrag_id  UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_kunde_id UUID;
  v_company  UUID;
  v_id       UUID;
BEGIN
  v_kunde_id := public.portal_session_customer(p_session);
  IF v_kunde_id IS NULL THEN
    RAISE EXCEPTION 'Zugang ungueltig oder abgelaufen.'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  SELECT company_id INTO v_company FROM public.customers WHERE id = v_kunde_id;

  -- Der Auftrag muss dem meldenden Kunden gehoeren. Ohne diese Pruefung waere
  -- die ID ein Weg, einen Fall an einen fremden Auftrag zu haengen.
  IF p_auftrag_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.auftraege
    WHERE id = p_auftrag_id AND customer_id = v_kunde_id
  ) THEN
    RAISE EXCEPTION 'Auftrag gehoert nicht zu diesem Kunden.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.customer_cases
    (company_id, customer_id, case_type, title, description,
     auftrag_id, reported_by, priority)
  VALUES (v_company, v_kunde_id, p_case_type, TRIM(p_title), p_description,
          p_auftrag_id, 'kunde', 'high')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_report_case(TEXT,TEXT,TEXT,TEXT,UUID) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS — ein Fall ist Tagesarbeit; abschliessen darf jedes Mitglied,
-- loeschen niemand ausser owner|admin.
-- -----------------------------------------------------------------------------

ALTER TABLE public.customer_cases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_case_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_cases_select_member ON public.customer_cases;
CREATE POLICY customer_cases_select_member ON public.customer_cases FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS customer_cases_insert_member ON public.customer_cases;
CREATE POLICY customer_cases_insert_member ON public.customer_cases FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS customer_cases_update_member ON public.customer_cases;
CREATE POLICY customer_cases_update_member ON public.customer_cases FOR UPDATE
  TO authenticated
  USING      (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS customer_cases_delete_owner_admin ON public.customer_cases;
CREATE POLICY customer_cases_delete_owner_admin ON public.customer_cases FOR DELETE
  TO authenticated USING (public.is_company_role(company_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS case_events_select_member ON public.customer_case_events;
CREATE POLICY case_events_select_member ON public.customer_case_events FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

COMMIT;
