-- =============================================================================
-- Der Kunde meldet eine Aenderung — die Firma entscheidet
-- =============================================================================
--
-- Ein Kunde zieht um, wechselt die Telefonnummer, korrigiert einen Tippfehler
-- im Namen. Heute muss er anrufen. Die naheliegende Loesung waere, ihn im
-- Portal direkt in `customers` schreiben zu lassen — und genau das ist falsch:
--
--   * `customers` ist der kanonische Stammsatz, an dem sieben Tabellen haengen.
--   * `display_name` und die Zusammenfuehrungslogik haengen an first/last name.
--   * Wer einen Portallink hat, kaeme damit an den Stammsatz.
--
-- Deshalb eine Warteschlange. Der Wunsch wird festgehalten, die Firma sieht ihn
-- als Aufgabe, und erst die Annahme schreibt — durch dieselbe Funktion, die
-- prueft, wer sie aufruft.
--
-- Das ist auch die Vorgabe der Roadmap: "kanonik kaydı doğrudan değiştirmek
-- yerine firma onay kuyruğu".
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_change_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL,

  feld         TEXT NOT NULL,
  alt_wert     TEXT,
  neu_wert     TEXT NOT NULL,
  bemerkung    TEXT,

  status       TEXT NOT NULL DEFAULT 'offen',
  entschieden_von UUID,
  entschieden_am  TIMESTAMPTZ,
  entscheid_notiz TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Nur Felder, die dem Kunden gehoeren. Nicht `status`, nicht `language`,
  -- nicht `merged_into_customer_id` — das sind Angaben der Firma ueber den
  -- Kunden, nicht Angaben des Kunden ueber sich.
  CONSTRAINT customer_change_requests_feld_check
    CHECK (feld IN ('first_name','last_name','company_name','primary_email','primary_phone')),
  CONSTRAINT customer_change_requests_status_check
    CHECK (status IN ('offen','angenommen','abgelehnt')),
  CONSTRAINT customer_change_requests_wert_da
    CHECK (length(TRIM(neu_wert)) > 0),
  CONSTRAINT customer_change_requests_entscheid_vollstaendig
    CHECK (status = 'offen' OR entschieden_am IS NOT NULL)
);

ALTER TABLE public.customer_change_requests
  DROP CONSTRAINT IF EXISTS customer_change_requests_customer_fk,
  ADD  CONSTRAINT customer_change_requests_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id) ON DELETE CASCADE;

COMMENT ON TABLE public.customer_change_requests IS
  'Aenderungswuensche aus dem Kundenportal. Der Kunde schreibt NIE direkt in '
  'customers — erst die Annahme durch die Firma uebernimmt den Wert.';

CREATE INDEX IF NOT EXISTS idx_change_requests_offen
  ON public.customer_change_requests (company_id, created_at DESC)
  WHERE status = 'offen';

-- Ein Kunde soll nicht denselben Wunsch fuenfmal einreichen koennen, weil die
-- Seite langsam war.
CREATE UNIQUE INDEX IF NOT EXISTS idx_change_requests_ein_offener_je_feld
  ON public.customer_change_requests (customer_id, feld)
  WHERE status = 'offen';

-- -----------------------------------------------------------------------------
-- Einreichen — aus dem Portal, ohne Anmeldung
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_request_change(
  p_session   TEXT,
  p_feld      TEXT,
  p_neu_wert  TEXT,
  p_bemerkung TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_kunde_id UUID;
  v_kunde    RECORD;
  v_alt      TEXT;
  v_id       UUID;
BEGIN
  v_kunde_id := public.portal_session_customer(p_session);
  IF v_kunde_id IS NULL THEN
    RAISE EXCEPTION 'Zugang ungueltig oder abgelaufen.'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  SELECT * INTO v_kunde FROM public.customers WHERE id = v_kunde_id;

  v_alt := CASE p_feld
             WHEN 'first_name'    THEN v_kunde.first_name
             WHEN 'last_name'     THEN v_kunde.last_name
             WHEN 'company_name'  THEN v_kunde.company_name
             WHEN 'primary_email' THEN v_kunde.primary_email
             WHEN 'primary_phone' THEN v_kunde.primary_phone
           END;

  IF TRIM(COALESCE(p_neu_wert, '')) = '' THEN
    RAISE EXCEPTION 'Der neue Wert fehlt.' USING ERRCODE = 'check_violation';
  END IF;
  IF TRIM(p_neu_wert) IS NOT DISTINCT FROM v_alt THEN
    RAISE EXCEPTION 'Der Wert ist unveraendert.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.customer_change_requests
    (company_id, customer_id, feld, alt_wert, neu_wert, bemerkung)
  VALUES (v_kunde.company_id, v_kunde_id, p_feld, v_alt, TRIM(p_neu_wert), p_bemerkung)
  ON CONFLICT (customer_id, feld) WHERE status = 'offen'
  DO UPDATE SET neu_wert = EXCLUDED.neu_wert,
                bemerkung = EXCLUDED.bemerkung,
                created_at = NOW()
  RETURNING id INTO v_id;

  -- Die Firma erfaehrt davon ueber die Wiedervorlage und nicht dadurch, dass
  -- jemand zufaellig in die Tabelle schaut.
  INSERT INTO public.crm_tasks (company_id, title, description, task_type, priority,
                                due_at, customer_id)
  VALUES (
    v_kunde.company_id,
    'Aenderungswunsch: ' || COALESCE(v_kunde.display_name, ''),
    p_feld || ': „' || COALESCE(v_alt, '—') || '" → „' || TRIM(p_neu_wert) || '"',
    'admin', 'normal', NOW(), v_kunde_id
  );

  RETURN jsonb_build_object('id', v_id, 'status', 'offen');
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_request_change(TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Entscheiden — die Firma
--
-- Die Annahme schreibt den Wert. Der Weg fuehrt bewusst durch diese Funktion
-- und nicht durch ein UPDATE aus dem Browser: so ist der Uebernahmezeitpunkt
-- festgehalten und der Wunsch kann nicht als „angenommen" markiert werden,
-- ohne dass etwas passiert.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decide_change_request(
  p_id      UUID,
  p_annehmen BOOLEAN,
  p_notiz   TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_w RECORD;
BEGIN
  SELECT * INTO v_w FROM public.customer_change_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wunsch nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_company_role(v_w.company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen entscheiden.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_w.status <> 'offen' THEN
    RAISE EXCEPTION 'Ueber diesen Wunsch ist bereits entschieden.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_annehmen THEN
    -- Ein dynamisches UPDATE waere hier eine Einladung: `feld` kaeme aus dem
    -- Portal. Der CHECK begrenzt es zwar, aber die Zuordnung steht trotzdem
    -- ausgeschrieben da, damit kein spaeter erlaubter Wert stillschweigend
    -- irgendwohin schreibt.
    UPDATE public.customers SET
      first_name    = CASE WHEN v_w.feld = 'first_name'    THEN v_w.neu_wert ELSE first_name END,
      last_name     = CASE WHEN v_w.feld = 'last_name'     THEN v_w.neu_wert ELSE last_name END,
      company_name  = CASE WHEN v_w.feld = 'company_name'  THEN v_w.neu_wert ELSE company_name END,
      primary_email = CASE WHEN v_w.feld = 'primary_email' THEN v_w.neu_wert ELSE primary_email END,
      primary_phone = CASE WHEN v_w.feld = 'primary_phone' THEN v_w.neu_wert ELSE primary_phone END
    WHERE id = v_w.customer_id;
  END IF;

  UPDATE public.customer_change_requests
  SET status = CASE WHEN p_annehmen THEN 'angenommen' ELSE 'abgelehnt' END,
      entschieden_von = auth.uid(),
      entschieden_am  = NOW(),
      entscheid_notiz = p_notiz
  WHERE id = p_id;

  RETURN jsonb_build_object('id', p_id,
    'status', CASE WHEN p_annehmen THEN 'angenommen' ELSE 'abgelehnt' END);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decide_change_request(UUID,BOOLEAN,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.decide_change_request(UUID,BOOLEAN,TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS — lesen alle Mitglieder, geschrieben wird nur ueber die Funktionen
-- -----------------------------------------------------------------------------

ALTER TABLE public.customer_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS change_requests_select_member ON public.customer_change_requests;
CREATE POLICY change_requests_select_member
  ON public.customer_change_requests FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

COMMIT;
