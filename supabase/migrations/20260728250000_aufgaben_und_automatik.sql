-- =============================================================================
-- Wiedervorlage: Aufgaben und die Regeln, die sie erzeugen
-- =============================================================================
--
-- BEFUND
-- Mit den Verkaufsstufen (20260728240000) sieht man, WO eine Anfrage steht.
-- Was fehlt, ist der naechste Schritt: eine versendete Offerte, auf die niemand
-- antwortet, faellt heute niemandem auf. Auf der Produktion stehen 30 Anfragen
-- auf `offer_sent` — ob eine davon seit drei Wochen liegt, weiss nur, wer die
-- Liste von Hand durchgeht.
--
-- ABHILFE
-- Zwei Tabellen und eine Regelfunktion:
--
--   crm_tasks              was zu tun ist, mit Faelligkeit und Zustaendigkeit
--   automation_deliveries  was eine Regel schon erledigt hat
--
-- DER LIEFERSCHEIN IST DER KERN DER SACHE. Eine Regel, die stuendlich laeuft,
-- wuerde ohne ihn stuendlich dieselbe Aufgabe erzeugen. Der eindeutige Schluessel
-- (rule_key, entity_type, entity_id, schedule_window) macht jede Regel
-- idempotent — sie kann so oft laufen, wie sie will.
--
-- `schedule_window` ist dabei der Zeitraum, fuer den die Regel gilt, nicht der
-- Zeitpunkt des Laufs: eine Erinnerung "nach 3 Tagen ohne Antwort" traegt das
-- Datum, ab dem sie faellig war. Damit greift derselbe Schluessel auch dann, wenn
-- der Lauf einmal ausfaellt und nachgeholt wird.
--
-- BEWUSST NOCH NICHT DABEI: die Regeln, die dem KUNDEN schreiben (Erinnerung an
-- eine ungeoeffnete Offerte, Hinweis auf ablaufende Gueltigkeit). Die brauchen
-- eine Edge Function mit Resend und einen eigenen Deploy-Schritt. Das Geruest —
-- Lieferschein, Zeitfenster, Cron — steht hier bereits; es fehlt nur der
-- Versandweg.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Aufgaben
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  title         TEXT NOT NULL,
  description   TEXT,
  task_type     TEXT NOT NULL DEFAULT 'follow_up',
  priority      TEXT NOT NULL DEFAULT 'normal',
  status        TEXT NOT NULL DEFAULT 'open',

  due_at        TIMESTAMPTZ,
  done_at       TIMESTAMPTZ,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Der Bezug ist bewusst mehrspaltig statt (entity_type, entity_id): so
  -- greifen echte Fremdschluessel, und ein geloeschter Vorgang laesst keine
  -- Aufgabe zurueck, die ins Leere zeigt.
  lead_id       UUID REFERENCES public.leads(id)      ON DELETE CASCADE,
  offer_id      UUID REFERENCES public.offers(id)     ON DELETE CASCADE,
  auftrag_id    UUID REFERENCES public.auftraege(id)  ON DELETE CASCADE,
  customer_id   UUID,

  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT crm_tasks_title_present CHECK (length(TRIM(title)) > 0),
  CONSTRAINT crm_tasks_type_check
    CHECK (task_type IN ('follow_up','call','offer','inspection','admin','lost_reason','cross_sell')),
  CONSTRAINT crm_tasks_priority_check CHECK (priority IN ('low','normal','high')),
  CONSTRAINT crm_tasks_status_check   CHECK (status IN ('open','done','cancelled')),
  CONSTRAINT crm_tasks_done_needs_time
    CHECK (status <> 'done' OR done_at IS NOT NULL)
);

ALTER TABLE public.crm_tasks
  DROP CONSTRAINT IF EXISTS crm_tasks_customer_fk,
  ADD  CONSTRAINT crm_tasks_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

COMMENT ON TABLE public.crm_tasks IS
  'Wiedervorlage: was als naechstes zu tun ist. Wird von Hand oder von den '
  'Regeln in run_pipeline_automations() erzeugt.';

CREATE INDEX IF NOT EXISTS idx_crm_tasks_offen
  ON public.crm_tasks (company_id, due_at)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead   ON public.crm_tasks (lead_id)   WHERE lead_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_kunde  ON public.crm_tasks (customer_id) WHERE customer_id IS NOT NULL;

DROP TRIGGER IF EXISTS trigger_crm_tasks_updated_at ON public.crm_tasks;
CREATE TRIGGER trigger_crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

-- Aufgaben sind Betrieb, kein Konfigurationsgut: jedes Mitglied arbeitet damit.
DROP POLICY IF EXISTS crm_tasks_select_member ON public.crm_tasks;
CREATE POLICY crm_tasks_select_member ON public.crm_tasks FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS crm_tasks_insert_member ON public.crm_tasks;
CREATE POLICY crm_tasks_insert_member ON public.crm_tasks FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS crm_tasks_update_member ON public.crm_tasks;
CREATE POLICY crm_tasks_update_member ON public.crm_tasks FOR UPDATE
  TO authenticated
  USING      (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS crm_tasks_delete_member ON public.crm_tasks;
CREATE POLICY crm_tasks_delete_member ON public.crm_tasks FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- -----------------------------------------------------------------------------
-- 2. Lieferschein der Automatik
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.automation_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_key        TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  -- Der Zeitraum, FUER den geliefert wurde — nicht der Zeitpunkt des Laufs.
  -- Nur so wirkt der Schluessel auch bei einem nachgeholten Lauf.
  schedule_window DATE NOT NULL,
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result          TEXT,
  CONSTRAINT automation_deliveries_uniq
    UNIQUE (rule_key, entity_type, entity_id, schedule_window)
);

COMMENT ON TABLE public.automation_deliveries IS
  'Was eine Regel bereits erledigt hat. Der eindeutige Schluessel macht jede '
  'Regel idempotent: sie darf beliebig oft laufen, ohne zu wiederholen.';

CREATE INDEX IF NOT EXISTS idx_automation_deliveries_company
  ON public.automation_deliveries (company_id, delivered_at DESC);

ALTER TABLE public.automation_deliveries ENABLE ROW LEVEL SECURITY;

-- Nur lesen; geschrieben wird ausschliesslich von der Regelfunktion.
DROP POLICY IF EXISTS automation_deliveries_select_member ON public.automation_deliveries;
CREATE POLICY automation_deliveries_select_member
  ON public.automation_deliveries FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

COMMIT;
