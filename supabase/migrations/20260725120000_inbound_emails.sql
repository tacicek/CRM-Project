-- =============================================================================
-- Inbound E-Mail → Lead (Pilot, eine Firma)
-- =============================================================================
--
-- Eine eingehende E-Mail ist NICHT automatisch ein Lead. Sie wird zuerst als
-- Nachricht erfasst und durchläuft dann:
--
--   Resend-Webhook → Signaturprüfung → Idempotenz → Normalisierung →
--   deterministische Vorfilter → KI-Klassifizierung → Konfidenz-Entscheid →
--   Lead | Review-Queue | Ablehnung
--
-- Diese Tabelle trägt drei Aufgaben gleichzeitig:
--   1. IDEMPOTENZ   — unique (provider, provider_message_id). Resend stellt einen
--      Webhook mehrfach zu; ohne DB-Constraint entstehen bei parallelen
--      Zustellungen doppelte Leads (ein "erst lesen, dann schreiben" im Code
--      genügt dafür nachweislich nicht).
--   2. REVIEW-QUEUE — processing_status = 'needs_review' ist die Arbeitsliste
--      des Operators.
--   3. AUDIT        — warum wurde eine Mail abgelehnt, was hat das Modell
--      extrahiert, welcher Lead ist daraus entstanden.
--
-- BEWUSST NICHT gespeichert: der vollständige Mail-Body und Anhang-Binärdaten.
-- Resend hält die Nachricht selbst vor (GET /emails/receiving/{id}), deshalb
-- genügt hier eine gekappte Text-Vorschau. Das hält die Tabelle klein und
-- vermeidet, fremde HTML-Inhalte im CRM zu lagern.
--
-- MEHRMANDANTEN-FÄHIGKEIT: company_id ist ab Tag 1 NOT NULL. Die spätere
-- Offerio-Erweiterung (firmenspezifische Inbound-Aliase) ist damit ein
-- Lookup-Wechsel beim Auflösen des Empfängers — keine Schemaänderung.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Tabelle
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Mandant. NOT NULL, siehe Kopfkommentar.
  company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Idempotenz-Schlüssel: Provider + dessen Message-ID.
  provider                TEXT NOT NULL DEFAULT 'resend',
  provider_message_id     TEXT NOT NULL,

  -- Normalisierter Absender / Empfänger
  from_email              TEXT NOT NULL,
  from_name               TEXT,
  to_emails               TEXT[] NOT NULL DEFAULT '{}',
  subject                 TEXT NOT NULL DEFAULT '',

  -- Gekappte Klartext-Vorschau. Nie HTML, nie der volle Body.
  body_preview            TEXT,

  -- Verarbeitungszustand
  processing_status       TEXT NOT NULL DEFAULT 'received',
  classification          TEXT,
  confidence_score        NUMERIC(5,4),
  rejection_reason        TEXT,
  missing_critical_fields JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Was das Modell extrahiert hat — inklusive der ehrlichen NULLs. Die leads-
  -- Tabelle verlangt NOT NULL auf customer_email/-phone/-name/from_plz/from_city
  -- und bekommt dort (wie beim manuellen Import) Platzhalter; welche Angabe in
  -- Wahrheit fehlte, bleibt nur hier nachvollziehbar.
  extracted_data          JSONB,

  -- NUR Metadaten (filename, content_type, size, provider-id). Niemals Inhalte.
  attachments             JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Verknüpfung zum erzeugten Lead. SET NULL: ein gelöschter Lead darf den
  -- Audit-Eintrag nicht mitreissen.
  lead_id                 UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  processing_attempts     INTEGER NOT NULL DEFAULT 0,
  last_error              TEXT,

  received_at             TIMESTAMPTZ NOT NULL,
  processed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT inbound_emails_provider_message_key
    UNIQUE (provider, provider_message_id),

  CONSTRAINT inbound_emails_status_check CHECK (
    processing_status IN (
      'received',      -- Zeile beansprucht, Verarbeitung noch nicht gestartet
      'processing',    -- läuft
      'needs_review',  -- mittlere Konfidenz → Operator entscheidet
      'lead_created',  -- Lead erzeugt
      'rejected',      -- kein Anliegen / zu geringe Konfidenz → kein Lead
      'failed'         -- transienter Fehler, Wiederholung erlaubt
    )
  ),

  -- Das Modell liefert die Zahl; der Entscheid fällt im Code. Ein Wert
  -- ausserhalb [0,1] ist ein Fehler und darf nicht gespeichert werden.
  CONSTRAINT inbound_emails_confidence_range CHECK (
    confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)
  ),

  -- Datensparsamkeit als Constraint, nicht als Konvention.
  CONSTRAINT inbound_emails_body_preview_len CHECK (
    body_preview IS NULL OR LENGTH(body_preview) <= 2000
  ),

  CONSTRAINT inbound_emails_attempts_check CHECK (processing_attempts >= 0)
);

COMMENT ON TABLE public.inbound_emails IS
  'Eingehende E-Mails aus dem Resend-Inbound-Webhook: Idempotenz, Review-Queue und Audit. '
  'Enthält bewusst weder den vollen Body noch Anhang-Binärdaten.';

COMMENT ON COLUMN public.inbound_emails.provider_message_id IS
  'Message-ID des Providers (Resend: email.id). Idempotenz-Schlüssel — eine erneute '
  'Zustellung desselben Webhooks darf keinen zweiten Lead erzeugen.';

COMMENT ON COLUMN public.inbound_emails.body_preview IS
  'Gekappte Klartext-Vorschau (max. 2000 Zeichen). Kein HTML, kein vollständiger Body.';

COMMENT ON COLUMN public.inbound_emails.attachments IS
  'Nur Metadaten: [{id, filename, content_type, size}]. Binärdaten gehören nicht in Postgres.';

-- =============================================================================
-- 2. Indizes
-- =============================================================================

-- Arbeitsliste der Review-UI (Tabs: needs_review / lead_created / rejected / failed).
CREATE INDEX IF NOT EXISTS idx_inbound_emails_company_status_received
  ON public.inbound_emails (company_id, processing_status, received_at DESC);

-- Rückweg Lead → Mail (Lead-Detail zeigt die Herkunft).
CREATE INDEX IF NOT EXISTS idx_inbound_emails_lead
  ON public.inbound_emails (lead_id)
  WHERE lead_id IS NOT NULL;

-- Aufräum-Job (siehe 5.).
CREATE INDEX IF NOT EXISTS idx_inbound_emails_status_created
  ON public.inbound_emails (processing_status, created_at);

-- =============================================================================
-- 3. updated_at
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_inbound_emails_updated_at ON public.inbound_emails;
CREATE TRIGGER trigger_inbound_emails_updated_at
  BEFORE UPDATE ON public.inbound_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- 4. RLS
--
-- Schreibend arbeitet nur die Edge Function mit dem Service-Role-Key (umgeht RLS).
-- Für die Review-UI gilt dasselbe Muster wie bei manual_imported_leads.
-- =============================================================================

ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inbound_emails_manage_member ON public.inbound_emails;
CREATE POLICY inbound_emails_manage_member
  ON public.inbound_emails FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS inbound_emails_select_admin ON public.inbound_emails;
CREATE POLICY inbound_emails_select_admin
  ON public.inbound_emails FOR SELECT
  USING (public.is_admin(auth.uid()));

-- =============================================================================
-- 5. Aufbewahrung
--
-- Kein neuer Scheduler: pg_cron läuft bereits (Termin-Reminder, Besichtigungs-
-- Cleanup, reap-stuck-offers). 'needs_review' wird NIE automatisch gelöscht —
-- das ist die Arbeitsliste eines Menschen.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_inbound_emails(
  p_rejected_days  INTEGER DEFAULT 14,
  p_failed_days    INTEGER DEFAULT 30,
  p_converted_days INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.inbound_emails
  WHERE (processing_status = 'rejected'
         AND created_at < NOW() - (p_rejected_days  || ' days')::INTERVAL)
     OR (processing_status = 'failed'
         AND created_at < NOW() - (p_failed_days    || ' days')::INTERVAL)
     OR (processing_status = 'lead_created'
         AND created_at < NOW() - (p_converted_days || ' days')::INTERVAL);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_inbound_emails(INTEGER, INTEGER, INTEGER) IS
  'Aufbewahrung: rejected 14 Tage, failed 30 Tage, lead_created 90 Tage. '
  'needs_review bleibt unangetastet — der erzeugte Lead selbst wird nie gelöscht.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('daily-inbound-email-cleanup');
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- Job existierte noch nicht
    END;

    PERFORM cron.schedule(
      'daily-inbound-email-cleanup',
      '30 3 * * *',
      $cron$SELECT public.cleanup_inbound_emails();$cron$
    );
  ELSE
    RAISE WARNING '[inbound_emails] pg_cron fehlt — Aufbewahrungs-Job nicht eingerichtet';
  END IF;
END;
$$;

-- =============================================================================
-- 6. leads.source um 'email' erweitern
--
-- Rückwärtssicher: bestehende Zeilen erfüllen die neue Bedingung unverändert.
-- Die Herkunft wird bewusst NICHT auf 'import' gemappt — Mail-Leads und manuell
-- eingefügte Leads unterscheiden sich in Verantwortung und Qualität, und die
-- Migration ist gefahrlos.
-- =============================================================================

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_source_check
  CHECK (source IN ('web_form', 'ai_voice', 'manual', 'import', 'widget', 'api', 'email'));

COMMENT ON COLUMN public.leads.source IS
  'Herkunft des Leads: web_form, ai_voice, manual, import, widget, api, email';

COMMIT;
