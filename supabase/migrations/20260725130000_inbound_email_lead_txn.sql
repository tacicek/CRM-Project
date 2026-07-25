-- =============================================================================
-- Inbound-E-Mail: Lead-Erstellung und Verknüpfung in EINER Transaktion
--
-- Vorher schrieb die Edge Function zwei Anweisungen nacheinander:
--   1. INSERT INTO leads …
--   2. UPDATE inbound_emails SET lead_id = …, processing_status = 'lead_created'
--
-- Bricht die Verbindung dazwischen ab, existiert der Lead, aber die Mail bleibt
-- auf 'processing' stehen: in keinem Tab der Review-Oberfläche sichtbar, und weil
-- lead_id NULL geblieben ist, greift auch die "es gibt schon einen Lead"-Sperre
-- nicht mehr. Genau dieses Fenster schliesst die Funktion hier.
--
-- Die FELD-ZUORDNUNG bleibt bewusst in TypeScript (_shared/leadMapping.ts) — sie
-- ist für den manuellen Import und die Mail-Pipeline dieselbe. Diese Funktion
-- bekommt die fertige Zeile als JSONB und tut nur noch das, was atomar sein muss.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_lead_from_inbound_email(
  p_inbound_id UUID,
  p_company_id UUID,
  p_lead       JSONB,
  p_outcome    JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_lead_id    UUID;
  v_existing   UUID;
  v_payload    JSONB;
  v_columns    TEXT;
BEGIN
  -- Zeile sperren: zwei gleichzeitige Zustellungen derselben Nachricht laufen
  -- hier hintereinander durch, nicht nebeneinander.
  SELECT company_id, lead_id INTO v_company_id, v_existing
  FROM public.inbound_emails
  WHERE id = p_inbound_id
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'inbound_email % not found', p_inbound_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Der Aufrufer muss dieselbe Firma meinen wie die Zeile. Die Edge Functions
  -- arbeiten mit dem Service-Role-Key und umgehen RLS; ohne diese Prüfung könnte
  -- eine mitgeschickte fremde inbound_email_id einen Lead in einer fremden Firma
  -- anlegen.
  IF p_company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'inbound_email % belongs to another company', p_inbound_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Letzte Verteidigungslinie gegen einen zweiten Lead aus derselben Mail.
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Die Firma kommt aus der Zeile, nicht aus dem Aufrufer: ein manipuliertes
  -- company_id im JSONB darf keinen Lead in einer fremden Firma anlegen.
  v_payload := p_lead || jsonb_build_object('company_id', v_company_id);

  -- NUR die mitgelieferten Spalten werden geschrieben. Ein
  -- "INSERT … SELECT * FROM jsonb_populate_record(NULL::leads, …)" würde jede
  -- nicht gelieferte Spalte explizit auf NULL setzen und damit die DEFAULTs
  -- aushebeln — id, created_at und updated_at kämen als NULL an.
  -- Schlüssel, die keine Spalte von leads sind, fallen hier ebenfalls weg.
  SELECT string_agg(quote_ident(key), ', ')
  INTO v_columns
  FROM jsonb_object_keys(v_payload) AS key
  WHERE key IN (
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads'
  );

  IF v_columns IS NULL THEN
    RAISE EXCEPTION 'lead payload contains no known column'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  EXECUTE format(
    'INSERT INTO public.leads (%1$s) SELECT %1$s FROM jsonb_populate_record(NULL::public.leads, $1) RETURNING id',
    v_columns
  )
  USING v_payload
  INTO v_lead_id;

  UPDATE public.inbound_emails
  SET lead_id                 = v_lead_id,
      processing_status       = 'lead_created',
      classification          = COALESCE(p_outcome->>'classification', classification),
      confidence_score        = COALESCE((p_outcome->>'confidence_score')::NUMERIC, confidence_score),
      missing_critical_fields = COALESCE(p_outcome->'missing_critical_fields', missing_critical_fields),
      extracted_data          = COALESCE(p_outcome->'extracted_data', extracted_data),
      processed_at            = NOW(),
      last_error              = NULL
  WHERE id = p_inbound_id;

  RETURN v_lead_id;
END;
$$;

COMMENT ON FUNCTION public.create_lead_from_inbound_email(UUID, UUID, JSONB, JSONB) IS
  'Legt den Lead an und verknüpft ihn mit der eingehenden E-Mail — atomar. '
  'Gibt bei einer bereits verknüpften Mail den bestehenden Lead zurück, statt einen zweiten anzulegen.';

REVOKE ALL ON FUNCTION public.create_lead_from_inbound_email(UUID, UUID, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_lead_from_inbound_email(UUID, UUID, JSONB, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_lead_from_inbound_email(UUID, UUID, JSONB, JSONB) TO service_role;

-- =============================================================================
-- Hängengebliebene Verarbeitungen einsammeln
--
-- Stirbt die Edge Function mitten im Lauf (Timeout, Deploy, OOM), bleibt die
-- Zeile auf 'processing' — unsichtbar in allen vier Tabs und für keinen der
-- beiden Eingänge wiederholbar. Nach 15 Minuten gilt der Lauf als gescheitert;
-- damit taucht die Mail unter "Fehlgeschlagen" auf und ist erneut verarbeitbar.
--
-- Gleiches Muster wie reap_stuck_sending_offers() — kein neuer Scheduler.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reap_stuck_inbound_emails(
  p_minutes INTEGER DEFAULT 15
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.inbound_emails
  SET processing_status = 'failed',
      last_error = COALESCE(last_error, 'Verarbeitung abgebrochen (Timeout)')
  WHERE processing_status = 'processing'
    AND lead_id IS NULL
    AND updated_at < NOW() - (p_minutes || ' minutes')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.reap_stuck_inbound_emails(INTEGER) IS
  'Setzt Zeilen, die länger als p_minutes auf processing stehen, auf failed — '
  'damit werden sie in der Review-Oberfläche sichtbar und wiederholbar.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('reap-stuck-inbound-emails');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'reap-stuck-inbound-emails',
      '*/15 * * * *',
      $cron$SELECT public.reap_stuck_inbound_emails();$cron$
    );
  ELSE
    RAISE WARNING '[inbound_emails] pg_cron fehlt — Reaper nicht eingerichtet';
  END IF;
END;
$$;

COMMIT;
