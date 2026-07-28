-- =============================================================================
-- Ein Posteingang statt zweier Spuren
-- =============================================================================
--
-- BEFUND
-- Kommunikation liegt heute in zwei Tabellen, die nichts voneinander wissen:
--
--   inbound_emails   53 Zeilen — was hereinkam, als Warteschlange fuer die
--                    Lead-Extraktion gedacht, nicht als Postfach
--   email_logs      187 Zeilen — was hinausging, als Protokoll gedacht
--
-- Beide tragen `lead_id`, keine von beiden kennt einen Gespraechsfaden. Wer
-- wissen will, was mit einem Kunden besprochen wurde, muss zwei Tabellen
-- lesen, nach E-Mail-Adresse verbinden und die Reihenfolge selbst herstellen.
-- `email_logs` traegt nicht einmal `customer_id`.
--
-- ABHILFE
--   communication_threads   ein Gespraech, an Kunde und Vorgang gehaengt
--   communication_messages  eine Nachricht darin, mit Richtung und Kanal
--
-- Beide bestehenden Tabellen BLEIBEN, wie sie sind. `inbound_emails` ist und
-- bleibt die Extraktionswarteschlange; `email_logs` bleibt das Versandprotokoll.
-- Diese Schicht liegt darueber und wird von beiden per Trigger gefuellt.
--
-- DATENSPARSAMKEIT — die wichtigste Entscheidung hier
-- `inbound_emails` speichert den Rohtext einer E-Mail NICHT. Es gibt
-- `body_preview`, es gibt kein `body`. Das ist eine bewusste Entscheidung des
-- bestehenden Ablaufs, und die Roadmap warnt ausdruecklich davor, sie beim Bau
-- eines Posteingangs unbemerkt zu kippen.
--
-- Sie wird hier NICHT gekippt. `communication_messages` traegt ebenfalls nur
-- `preview` und keine Spalte fuer den vollen Text. Wer spaeter Volltext will,
-- muss dafuer eine eigene Entscheidung treffen und sie begruenden — er kann
-- nicht versehentlich hineinrutschen, weil die Spalte schon dastuende.
--
-- AUFBEWAHRUNG
-- Die Tatsache eines Kontakts bleibt: Datum, Richtung, Kanal, Betreff. Der
-- Vorschautext wird nach 24 Monaten geleert (`communication_retention()`,
-- taeglich per Cron). Damit bleibt die Beziehungsgeschichte nachvollziehbar,
-- ohne dass Inhalte unbegrenzt liegen.
--
-- ANTWORTEN AUS DEM CRM ist bewusst noch nicht dabei: das braeuchte eine Edge
-- Function mit Resend und einen eigenen Deploy-Schritt. Was heute schon
-- hinausgeht, erscheint trotzdem im Faden — der Trigger auf `email_logs` sorgt
-- dafuer, ohne dass irgendwo anders etwas geaendert werden muss.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Faden
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.communication_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID,

  subject     TEXT,
  channel     TEXT NOT NULL DEFAULT 'email',
  status      TEXT NOT NULL DEFAULT 'offen',

  -- Woran das Gespraech haengt. Mehrspaltig gefuehrt statt (typ, id), damit
  -- echte Fremdschluessel greifen — dieselbe Begruendung wie bei crm_tasks.
  lead_id     UUID REFERENCES public.leads(id)      ON DELETE SET NULL,
  offer_id    UUID REFERENCES public.offers(id)     ON DELETE SET NULL,
  auftrag_id  UUID REFERENCES public.auftraege(id)  ON DELETE SET NULL,
  case_id     UUID REFERENCES public.customer_cases(id) ON DELETE SET NULL,

  -- Fuer die SLA-Frage "wie lange wartet der Kunde schon".
  last_message_at      TIMESTAMPTZ,
  last_direction       TEXT,
  first_unanswered_at  TIMESTAMPTZ,

  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT communication_threads_channel_check
    CHECK (channel IN ('email','sms','whatsapp','phone','note')),
  CONSTRAINT communication_threads_status_check
    CHECK (status IN ('offen','wartet_auf_kunde','erledigt')),
  CONSTRAINT communication_threads_direction_check
    CHECK (last_direction IS NULL OR last_direction IN ('inbound','outbound'))
);

ALTER TABLE public.communication_threads
  DROP CONSTRAINT IF EXISTS communication_threads_customer_fk,
  ADD  CONSTRAINT communication_threads_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id) ON DELETE SET NULL (customer_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'communication_threads_id_company_uniq'
      AND conrelid = 'public.communication_threads'::regclass
  ) THEN
    ALTER TABLE public.communication_threads
      ADD CONSTRAINT communication_threads_id_company_uniq UNIQUE (id, company_id);
  END IF;
END $$;

COMMENT ON TABLE public.communication_threads IS
  'Gespraechsfaeden. Liegt UEBER inbound_emails und email_logs — beide bleiben, '
  'was sie sind, und fuellen diese Schicht per Trigger.';

CREATE INDEX IF NOT EXISTS idx_comm_threads_kunde
  ON public.communication_threads (customer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_threads_offen
  ON public.communication_threads (company_id, first_unanswered_at)
  WHERE status <> 'erledigt';

DROP TRIGGER IF EXISTS communication_threads_updated_at ON public.communication_threads;
CREATE TRIGGER communication_threads_updated_at
  BEFORE UPDATE ON public.communication_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Nachricht
--
-- KEINE SPALTE FUER DEN VOLLTEXT. Siehe Kopf.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.communication_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  thread_id   UUID NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,

  direction   TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'email',

  from_address TEXT,
  to_address   TEXT,
  subject      TEXT,
  -- Ausschnitt, kein Inhalt. Wird nach 24 Monaten geleert.
  preview      TEXT,

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ,

  -- Herkunft, damit der Backfill nicht doppelt einliest.
  source_table TEXT,
  source_id    UUID,
  external_id  TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT communication_messages_direction_check
    CHECK (direction IN ('inbound','outbound')),
  CONSTRAINT communication_messages_channel_check
    CHECK (channel IN ('email','sms','whatsapp','phone','note'))
);

COMMENT ON COLUMN public.communication_messages.preview IS
  'Ausschnitt, NICHT der volle Text. Der bestehende Inbound-Ablauf speichert '
  'bewusst keinen Rohtext; diese Schicht kippt das nicht. Nach 24 Monaten leer.';

CREATE INDEX IF NOT EXISTS idx_comm_messages_faden
  ON public.communication_messages (thread_id, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_messages_quelle
  ON public.communication_messages (source_table, source_id)
  WHERE source_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Faden fortschreiben
--
-- Der Faden traegt keine eigene Wahrheit — er fasst zusammen, was in seinen
-- Nachrichten steht. `first_unanswered_at` ist die Antwort auf "seit wann
-- wartet der Kunde": gesetzt bei einer eingehenden Nachricht, geloescht bei
-- der naechsten ausgehenden.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.communication_thread_fortschreiben()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.communication_threads t
  SET last_message_at = GREATEST(COALESCE(t.last_message_at, NEW.occurred_at), NEW.occurred_at),
      last_direction  = NEW.direction,
      first_unanswered_at = CASE
        WHEN NEW.direction = 'outbound' THEN NULL
        ELSE COALESCE(t.first_unanswered_at, NEW.occurred_at)
      END,
      status = CASE
        WHEN t.status = 'erledigt' AND NEW.direction = 'inbound' THEN 'offen'
        WHEN NEW.direction = 'outbound' THEN 'wartet_auf_kunde'
        ELSE t.status
      END
  WHERE t.id = NEW.thread_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_comm_thread_fortschreiben ON public.communication_messages;
CREATE TRIGGER trigger_comm_thread_fortschreiben
  AFTER INSERT ON public.communication_messages
  FOR EACH ROW EXECUTE FUNCTION public.communication_thread_fortschreiben();

-- -----------------------------------------------------------------------------
-- 4. Faden finden oder anlegen
--
-- Ein Gespraech je Kunde und Kanal. Feiner zu unterteilen (nach Betreff, nach
-- Vorgang) waere ohne Message-ID-Kette geraten: die Betreffzeile aendert sich,
-- „Re: Re: Aw:" verlaesslich zu normalisieren geht nicht, und `inbound_emails`
-- traegt keine In-Reply-To-Kette. Ein Faden je Kunde ist eine ehrliche
-- Naeherung; einer je geratener Betreffgruppe waere es nicht.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_or_create_thread(
  p_company_id  UUID,
  p_customer_id UUID,
  p_channel     TEXT DEFAULT 'email',
  p_subject     TEXT DEFAULT NULL,
  p_lead_id     UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_customer_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.communication_threads
    WHERE customer_id = p_customer_id AND channel = p_channel
    ORDER BY created_at LIMIT 1;
    IF FOUND THEN RETURN v_id; END IF;
  ELSIF p_lead_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.communication_threads
    WHERE lead_id = p_lead_id AND channel = p_channel
    ORDER BY created_at LIMIT 1;
    IF FOUND THEN RETURN v_id; END IF;
  ELSE
    -- Ohne Kunde und ohne Anfrage gibt es nichts, woran ein Faden haengen
    -- koennte. Lieber keine Zeile als eine, die nirgends auftaucht.
    RETURN NULL;
  END IF;

  INSERT INTO public.communication_threads
    (company_id, customer_id, lead_id, channel, subject)
  VALUES (p_company_id, p_customer_id, p_lead_id, p_channel, p_subject)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_or_create_thread(UUID,UUID,TEXT,TEXT,UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resolve_or_create_thread(UUID,UUID,TEXT,TEXT,UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Die beiden bestehenden Tabellen speisen den Posteingang
--
-- AFTER INSERT, damit an keiner der bestehenden Schreibstellen etwas geaendert
-- werden muss — und damit ein Fehler hier niemals eine eingehende Mail oder
-- einen Mailversand verhindert.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inbound_email_in_faden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_thread UUID;
BEGIN
  v_thread := public.resolve_or_create_thread(
    NEW.company_id, NEW.customer_id, 'email', NEW.subject, NEW.lead_id);
  IF v_thread IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.communication_messages
    (company_id, thread_id, direction, channel, from_address, subject, preview,
     occurred_at, source_table, source_id, external_id)
  VALUES (NEW.company_id, v_thread, 'inbound', 'email', NEW.from_email, NEW.subject,
          NEW.body_preview, COALESCE(NEW.received_at, NOW()),
          'inbound_emails', NEW.id, NEW.provider_message_id)
  ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Posteingang: eingehende Mail nicht eingeordnet: %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_inbound_email_faden ON public.inbound_emails;
CREATE TRIGGER trigger_inbound_email_faden
  AFTER INSERT ON public.inbound_emails
  FOR EACH ROW EXECUTE FUNCTION public.inbound_email_in_faden();

CREATE OR REPLACE FUNCTION public.email_log_in_faden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kunde  UUID;
  v_thread UUID;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NULL; END IF;

  -- `email_logs` traegt keinen customer_id. Ueber die Anfrage oder die
  -- Empfaengeradresse laesst er sich finden — dieselbe Identitaetsregel wie
  -- ueberall, ueber find_customer_by_identity.
  SELECT customer_id INTO v_kunde FROM public.leads WHERE id = NEW.lead_id;
  IF v_kunde IS NULL THEN
    -- find_customer_by_identity liefert eine TABELLE (customer_id, matched_on),
    -- keinen skalaren Wert — deshalb als Unterabfrage.
    SELECT f.customer_id INTO v_kunde
    FROM public.find_customer_by_identity(NEW.company_id, NEW.recipient_email, NULL) f
    LIMIT 1;
  END IF;

  v_thread := public.resolve_or_create_thread(
    NEW.company_id, v_kunde, 'email', NEW.subject, NEW.lead_id);
  IF v_thread IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.communication_messages
    (company_id, thread_id, direction, channel, to_address, subject,
     occurred_at, source_table, source_id)
  VALUES (NEW.company_id, v_thread, 'outbound', 'email', NEW.recipient_email,
          NEW.subject, COALESCE(NEW.created_at, NOW()), 'email_logs', NEW.id)
  ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Posteingang: ausgehende Mail nicht eingeordnet: %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_email_log_faden ON public.email_logs;
CREATE TRIGGER trigger_email_log_faden
  AFTER INSERT ON public.email_logs
  FOR EACH ROW EXECUTE FUNCTION public.email_log_in_faden();

-- -----------------------------------------------------------------------------
-- 6. Backfill
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.run_communication_backfill(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_r RECORD;
  v_thread UUID;
  v_ein INTEGER := 0;
  v_aus INTEGER := 0;
  v_n   INTEGER;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR v_r IN
    SELECT * FROM public.inbound_emails
    WHERE company_id = p_company_id
      AND NOT EXISTS (SELECT 1 FROM public.communication_messages m
                      WHERE m.source_table = 'inbound_emails' AND m.source_id = inbound_emails.id)
    ORDER BY received_at
  LOOP
    v_thread := public.resolve_or_create_thread(
      v_r.company_id, v_r.customer_id, 'email', v_r.subject, v_r.lead_id);
    CONTINUE WHEN v_thread IS NULL;

    INSERT INTO public.communication_messages
      (company_id, thread_id, direction, channel, from_address, subject, preview,
       occurred_at, source_table, source_id, external_id)
    VALUES (v_r.company_id, v_thread, 'inbound', 'email', v_r.from_email, v_r.subject,
            v_r.body_preview, COALESCE(v_r.received_at, v_r.created_at),
            'inbound_emails', v_r.id, v_r.provider_message_id)
    ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ein := v_ein + v_n;
  END LOOP;

  FOR v_r IN
    SELECT * FROM public.email_logs
    WHERE company_id = p_company_id
      AND NOT EXISTS (SELECT 1 FROM public.communication_messages m
                      WHERE m.source_table = 'email_logs' AND m.source_id = email_logs.id)
    ORDER BY created_at
  LOOP
    v_thread := public.resolve_or_create_thread(
      v_r.company_id,
      COALESCE(
        (SELECT l.customer_id FROM public.leads l WHERE l.id = v_r.lead_id),
        (SELECT f.customer_id
         FROM public.find_customer_by_identity(v_r.company_id, v_r.recipient_email, NULL) f
         LIMIT 1)),
      'email', v_r.subject, v_r.lead_id);
    CONTINUE WHEN v_thread IS NULL;

    INSERT INTO public.communication_messages
      (company_id, thread_id, direction, channel, to_address, subject,
       occurred_at, source_table, source_id)
    VALUES (v_r.company_id, v_thread, 'outbound', 'email', v_r.recipient_email,
            v_r.subject, v_r.created_at, 'email_logs', v_r.id)
    ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_aus := v_aus + v_n;
  END LOOP;

  RETURN jsonb_build_object('eingehend', v_ein, 'ausgehend', v_aus,
    'faeden', (SELECT COUNT(*) FROM public.communication_threads WHERE company_id = p_company_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_communication_backfill(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.run_communication_backfill(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Aufbewahrung
--
-- Die Tatsache des Kontakts bleibt, der Ausschnitt geht. Ohne diese Regel
-- waere „wir speichern nur eine Vorschau" nach ein paar Jahren eine sehr grosse
-- Sammlung von Vorschauen.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.communication_retention()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_n INTEGER;
BEGIN
  UPDATE public.communication_messages
  SET preview = NULL
  WHERE preview IS NOT NULL
    AND occurred_at < NOW() - INTERVAL '24 months';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('geleert', v_n);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.communication_retention() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('communication-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'communication-retention');

SELECT cron.schedule('communication-retention', '15 4 * * *',
                     $cron$SELECT public.communication_retention();$cron$);

-- -----------------------------------------------------------------------------
-- 8. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.communication_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comm_threads_select_member ON public.communication_threads;
CREATE POLICY comm_threads_select_member ON public.communication_threads FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS comm_threads_insert_member ON public.communication_threads;
CREATE POLICY comm_threads_insert_member ON public.communication_threads FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS comm_threads_update_member ON public.communication_threads;
CREATE POLICY comm_threads_update_member ON public.communication_threads FOR UPDATE
  TO authenticated
  USING      (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS comm_threads_delete_owner_admin ON public.communication_threads;
CREATE POLICY comm_threads_delete_owner_admin ON public.communication_threads FOR DELETE
  TO authenticated USING (public.is_company_role(company_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS comm_messages_select_member ON public.communication_messages;
CREATE POLICY comm_messages_select_member ON public.communication_messages FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
-- Als gelesen markieren ist Tagesarbeit; geschrieben wird sonst nur per Trigger.
DROP POLICY IF EXISTS comm_messages_update_member ON public.communication_messages;
CREATE POLICY comm_messages_update_member ON public.communication_messages FOR UPDATE
  TO authenticated
  USING      (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

COMMIT;
