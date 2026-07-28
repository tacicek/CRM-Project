-- =============================================================================
-- Die Regeln, die die Wiedervorlage fuellen
-- =============================================================================
--
-- Drei Regeln, die ohne Aussenkontakt auskommen und deshalb hier in SQL stehen:
--
--   offer_no_response   Offerte seit 5 Tagen versendet, keine Antwort
--                       -> Aufgabe "nachfassen"
--   offer_expiring      Gueltigkeit laeuft in 3 Tagen ab, noch keine Antwort
--                       -> Aufgabe "Gueltigkeit verlaengern oder nachfassen"
--   lost_reason_missing Offerte abgelehnt, Grund steht auf dem Vorschlagswert
--                       -> Aufgabe "Verlustgrund erfassen"
--
-- Jede schreibt in `automation_deliveries` und prueft dort vorher. `ON CONFLICT
-- DO NOTHING` auf dem zusammengesetzten Schluessel entscheidet, ob geliefert
-- wurde — nicht ein vorheriges SELECT. Zwei gleichzeitige Laeufe koennen sich so
-- nicht gegenseitig ueberholen.
--
-- Die Funktion ist bewusst OHNE Firmenparameter: sie laeuft als Cron ueber alle
-- Firmen. Aufgerufen wird sie mit dem Service-Role-Weg (pg_cron laeuft als
-- Superuser), nicht aus dem Browser — deshalb keine is_company_member-Pruefung,
-- sondern kein Ausfuehrungsrecht fuer authenticated.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.run_pipeline_automations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_heute DATE := CURRENT_DATE;
  v_a INT := 0; v_b INT := 0; v_c INT := 0;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. Versendet, seit 5 Tagen keine Antwort
  -- ---------------------------------------------------------------------------
  WITH faellig AS (
    SELECT o.id, o.company_id, o.lead_id, o.title, o.offer_number,
           l.customer_first_name, l.customer_last_name
    FROM public.offers o
    LEFT JOIN public.leads l ON l.id = o.lead_id
    WHERE o.status IN ('sent', 'viewed')
      AND o.superseded_at IS NULL
      AND o.sent_at IS NOT NULL
      AND o.sent_at < NOW() - INTERVAL '5 days'
  ),
  geliefert AS (
    INSERT INTO public.automation_deliveries
      (company_id, rule_key, entity_type, entity_id, schedule_window, result)
    SELECT company_id, 'offer_no_response', 'offer', id, v_heute, 'task'
    FROM faellig
    ON CONFLICT (rule_key, entity_type, entity_id, schedule_window) DO NOTHING
    RETURNING entity_id, company_id
  )
  INSERT INTO public.crm_tasks (company_id, title, description, task_type, priority,
                                due_at, lead_id, offer_id)
  SELECT g.company_id,
         'Nachfassen: Offerte ' || COALESCE(f.offer_number::TEXT, '') ,
         COALESCE(f.customer_first_name || ' ' || f.customer_last_name, '') ||
           ' — seit 5 Tagen keine Antwort auf „' || COALESCE(f.title, '') || '".',
         'follow_up', 'normal', NOW(), f.lead_id, f.id
  FROM geliefert g JOIN faellig f ON f.id = g.entity_id;
  GET DIAGNOSTICS v_a = ROW_COUNT;

  -- ---------------------------------------------------------------------------
  -- 2. Gueltigkeit laeuft in drei Tagen ab
  -- ---------------------------------------------------------------------------
  WITH faellig AS (
    SELECT o.id, o.company_id, o.lead_id, o.title, o.offer_number, o.valid_until
    FROM public.offers o
    WHERE o.status IN ('sent', 'viewed')
      AND o.superseded_at IS NULL
      AND o.valid_until IS NOT NULL
      AND o.valid_until BETWEEN v_heute AND v_heute + 3
  ),
  geliefert AS (
    INSERT INTO public.automation_deliveries
      (company_id, rule_key, entity_type, entity_id, schedule_window, result)
    SELECT company_id, 'offer_expiring', 'offer', id, valid_until, 'task'
    FROM faellig
    ON CONFLICT (rule_key, entity_type, entity_id, schedule_window) DO NOTHING
    RETURNING entity_id, company_id
  )
  INSERT INTO public.crm_tasks (company_id, title, description, task_type, priority,
                                due_at, lead_id, offer_id)
  SELECT g.company_id,
         'Gueltigkeit laeuft ab: Offerte ' || COALESCE(f.offer_number::TEXT, ''),
         'Gueltig bis ' || f.valid_until || '. Verlaengern oder nachfassen.',
         'offer', 'high', f.valid_until::TIMESTAMPTZ, f.lead_id, f.id
  FROM geliefert g JOIN faellig f ON f.id = g.entity_id;
  GET DIAGNOSTICS v_b = ROW_COUNT;

  -- ---------------------------------------------------------------------------
  -- 3. Verloren, aber der Grund ist nur der Vorschlagswert
  --
  -- 'no_response' setzt der Stufen-Trigger, wenn eine Offerte abgelehnt wird —
  -- er kann den wahren Grund nicht kennen. Die Aufgabe holt ihn nach, damit die
  -- Verlustgruende spaeter etwas aussagen.
  -- ---------------------------------------------------------------------------
  WITH faellig AS (
    SELECT l.id, l.company_id, l.customer_first_name, l.customer_last_name
    FROM public.leads l
    WHERE l.sales_stage = 'lost'
      AND l.lost_reason_code = 'no_response'
      AND l.company_id IS NOT NULL
  ),
  geliefert AS (
    INSERT INTO public.automation_deliveries
      (company_id, rule_key, entity_type, entity_id, schedule_window, result)
    SELECT company_id, 'lost_reason_missing', 'lead', id, v_heute, 'task'
    FROM faellig
    ON CONFLICT (rule_key, entity_type, entity_id, schedule_window) DO NOTHING
    RETURNING entity_id, company_id
  )
  INSERT INTO public.crm_tasks (company_id, title, description, task_type, priority,
                                due_at, lead_id)
  SELECT g.company_id,
         'Verlustgrund erfassen',
         COALESCE(f.customer_first_name || ' ' || f.customer_last_name, '') ||
           ' — der Grund steht auf dem Vorschlagswert „keine Rueckmeldung".',
         'lost_reason', 'low', NOW(), f.id
  FROM geliefert g JOIN faellig f ON f.id = g.entity_id;
  GET DIAGNOSTICS v_c = ROW_COUNT;

  RETURN jsonb_build_object(
    'offer_no_response',   v_a,
    'offer_expiring',      v_b,
    'lost_reason_missing', v_c);
END;
$$;

COMMENT ON FUNCTION public.run_pipeline_automations() IS
  'Fuellt die Wiedervorlage. Idempotent ueber automation_deliveries — darf '
  'beliebig oft laufen. Laeuft als Cron ueber alle Firmen; kein '
  'Ausfuehrungsrecht fuer authenticated.';

REVOKE ALL ON FUNCTION public.run_pipeline_automations() FROM PUBLIC, anon, authenticated;

-- Einmal taeglich frueh am Morgen — die Aufgaben sollen dastehen, wenn jemand
-- den Arbeitstag beginnt, nicht mittendrin auftauchen.
SELECT cron.unschedule('pipeline-automations')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pipeline-automations');

SELECT cron.schedule('pipeline-automations', '15 6 * * *',
                     $cron$SELECT public.run_pipeline_automations();$cron$);

COMMIT;
