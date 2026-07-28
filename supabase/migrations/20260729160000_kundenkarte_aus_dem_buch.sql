-- =============================================================================
-- Die Kundenkarte liest ab jetzt aus dem Zahlungsbuch
-- =============================================================================
--
-- 20260728150000 hat die beiden Lesefunktionen mit einer Ansage gebaut:
--
--   "Naeherung bis zum Zahlungsbuch: 'versendet' gilt als offen. Sobald es
--    payments/payment_allocations gibt, kommt der Wert von dort."
--
-- Es gibt sie jetzt. Diese Migration loest die Ansage ein — sonst bliebe die
-- Kundenkarte auf der alten Naeherung stehen, waehrend die Rechnungsliste schon
-- den echten offenen Betrag zeigt, und zwei Bildschirme im selben Programm
-- wuerden verschiedene Zahlen nennen.
--
-- WAS SICH IN DER ANTWORT AENDERT
--   finanzen.bezahlt          Summe der Rechnungen mit Status 'bezahlt'
--                             -> Summe der Zahlungseingaenge
--   finanzen.offen            Summe der 'versendet'-Rechnungen
--                             -> Summe der offenen Betraege (Teilzahlung zaehlt)
--   finanzen.quittungen       eigener Umsatz, absichtlich nicht addiert
--                             -> ENTFAELLT, ersetzt durch davon_quittungen
--   finanzen.davon_quittungen NEU: Anteil AM Kassierten, kein zweiter Topf
--   finanzen.gutschriften     NEU
--
-- `davon_quittungen` ist die eigentliche Aufloesung des alten Problems. Solange
-- es zwei Toepfe gab, musste sich jede Auswertungsstelle daran erinnern, sie
-- NICHT zu addieren — ein Kommentar als einziger Schutz. Jetzt gibt es einen
-- Topf, und die Quittungen sind ein Ausschnitt daraus.
--
-- Dazu die vierte Regel der Automatik: ueberfaellige Rechnungen. Sie laeuft als
-- EIGENER Cron-Auftrag und nicht in run_pipeline_automations() — die Funktion
-- dort haette sonst nur wegen einer angehaengten Regel neu geschrieben werden
-- muessen.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.customer_summary(p_customer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kunde public.customers;
BEGIN
  SELECT * INTO v_kunde FROM public.customers WHERE id = p_customer_id;
  IF v_kunde.id IS NULL OR NOT public.is_company_member(v_kunde.company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Kunden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'kunde', to_jsonb(v_kunde),
    'anzahl', jsonb_build_object(
      'anfragen',   (SELECT count(*) FROM public.leads          WHERE customer_id = p_customer_id),
      'offerten',   (SELECT count(*) FROM public.offers         WHERE customer_id = p_customer_id),
      'auftraege',  (SELECT count(*) FROM public.auftraege      WHERE customer_id = p_customer_id AND deleted_at IS NULL),
      'termine',    (SELECT count(*) FROM public.appointments   WHERE customer_id = p_customer_id),
      'rechnungen', (SELECT count(*) FROM public.rechnungen     WHERE customer_id = p_customer_id),
      'quittungen', (SELECT count(*) FROM public.quittungen     WHERE customer_id = p_customer_id),
      'emails',     (SELECT count(*) FROM public.inbound_emails WHERE customer_id = p_customer_id)
    ),
    'pipeline', jsonb_build_object(
      'offerten_offen',     (SELECT count(*) FROM public.offers
                             WHERE customer_id = p_customer_id AND status IN ('draft','sent','viewed')),
      'offerten_akzeptiert',(SELECT count(*) FROM public.offers
                             WHERE customer_id = p_customer_id AND status = 'accepted'),
      'auftraege_offen',    (SELECT count(*) FROM public.auftraege
                             WHERE customer_id = p_customer_id AND deleted_at IS NULL
                               AND status NOT IN ('abgeschlossen','storniert'))
    ),
    -- Aus dem Zahlungsbuch. Bis 20260729100000 stand hier der Status der
    -- Rechnung und eine Naeherung ueber 'versendet'; der Kommentar an dieser
    -- Stelle hat genau diesen Wechsel angekuendigt.
    'finanzen', jsonb_build_object(
      'fakturiert',  (SELECT COALESCE(SUM(COALESCE(gesamttotal, total, 0)), 0)
                      FROM public.rechnungen
                      WHERE customer_id = p_customer_id AND status <> 'entwurf'),
      -- Alles, was von diesem Kunden hereinkam — gegen Rechnung ODER gegen
      -- Quittung. Stornos sind negativ und rechnen sich selbst heraus.
      'bezahlt',     (SELECT COALESCE(SUM(amount), 0) FROM public.payments
                      WHERE customer_id = p_customer_id),
      'offen',       (SELECT COALESCE(SUM(open_amount), 0) FROM public.rechnungen
                      WHERE customer_id = p_customer_id
                        AND status <> 'entwurf' AND open_amount > 0),
      -- Kein zweiter Umsatz mehr, sondern ein Anteil des ersten: wie viel des
      -- Kassierten ueber eine Quittung kam. In 'bezahlt' ist es enthalten.
      -- Verknuepft ueber quittungen.payment_id und nicht ueber created_via,
      -- damit die vom Backfill uebernommenen Zeilen mitzaehlen.
      'davon_quittungen', (SELECT COALESCE(SUM(p.amount), 0)
                      FROM public.payments p
                      JOIN public.quittungen q ON q.payment_id = p.id
                      WHERE p.customer_id = p_customer_id),
      'gutschriften', (SELECT COALESCE(SUM(amount), 0) FROM public.credit_notes
                      WHERE customer_id = p_customer_id AND status = 'versendet')
    ),
    'aktivitaet', jsonb_build_object(
      'erster_kontakt',  v_kunde.first_seen_at,
      'letzte_aktion',   (SELECT max(t) FROM (
          SELECT max(created_at) t FROM public.leads        WHERE customer_id = p_customer_id
          UNION ALL SELECT max(created_at) FROM public.offers       WHERE customer_id = p_customer_id
          UNION ALL SELECT max(created_at) FROM public.auftraege    WHERE customer_id = p_customer_id
          UNION ALL SELECT max(created_at) FROM public.rechnungen   WHERE customer_id = p_customer_id
          UNION ALL SELECT max(created_at) FROM public.quittungen   WHERE customer_id = p_customer_id
          UNION ALL SELECT max(received_at) FROM public.inbound_emails WHERE customer_id = p_customer_id
          UNION ALL SELECT max(appointment_date::timestamptz) FROM public.appointments WHERE customer_id = p_customer_id
        ) x),
      'naechster_termin', (SELECT jsonb_build_object('id', a.id, 'datum', a.appointment_date,
                                                     'start', a.start_time, 'titel', a.title)
                           FROM public.appointments a
                           WHERE a.customer_id = p_customer_id
                             AND a.appointment_date >= CURRENT_DATE
                             AND a.status NOT IN ('cancelled')
                           ORDER BY a.appointment_date, a.start_time LIMIT 1)
    ),
    'zusammengefuehrt_aus', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', s.id, 'anzeigename', s.display_name, 'am', s.merged_at)), '[]'::jsonb)
      FROM public.customers s WHERE s.merged_into_customer_id = p_customer_id)
  );
END;
$$;

COMMENT ON FUNCTION public.customer_summary(UUID) IS
  'Kennzahlen der Kundenkarte. finanzen.bezahlt ist die Summe der '
  'Zahlungseingaenge; finanzen.davon_quittungen ist ein Anteil davon und wird '
  'NICHT dazugezaehlt. finanzen.offen kommt aus rechnungen.open_amount.';

CREATE OR REPLACE FUNCTION public.search_customers(
  p_company_id UUID,
  p_query      TEXT    DEFAULT NULL,
  p_filter     TEXT    DEFAULT 'alle',
  p_limit      INTEGER DEFAULT 25,
  p_offset     INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                  UUID,
  display_name        TEXT,
  customer_type       TEXT,
  first_name          TEXT,
  last_name           TEXT,
  company_name        TEXT,
  primary_email       TEXT,
  primary_phone       TEXT,
  language            TEXT,
  status              TEXT,
  possible_duplicate  BOOLEAN,
  first_seen_at       TIMESTAMPTZ,
  letzte_aktion       TIMESTAMPTZ,
  offerten_offen      INTEGER,
  auftraege_gesamt    INTEGER,
  offener_betrag      NUMERIC(12,2),
  bezahlter_betrag    NUMERIC(12,2),
  ort                 TEXT,
  gesamt              BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit  INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
  v_such   TEXT;
  v_ziffer TEXT;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_such := NULLIF(TRIM(COALESCE(p_query, '')), '');

  -- Der Bediener tippt "079 123 45 67", gespeichert ist "+41791234567". Nach dem
  -- Entfernen der Nicht-Ziffern bliebe "0791234567" — und das kommt in
  -- "+41791234567" NICHT vor. Die fuehrende Null der nationalen Schreibweise
  -- muss also weg, sonst findet die Suche ausgerechnet die Form nicht, die man
  -- am ehesten eintippt.
  v_ziffer := NULLIF(regexp_replace(
                regexp_replace(COALESCE(v_such, ''), '\D', '', 'g'),
                '^0+', ''), '');

  RETURN QUERY
  WITH treffer AS (
    SELECT c.*
    FROM public.customers c
    WHERE c.company_id = p_company_id
      -- Zusammengefuehrte Kunden erscheinen NIE in der Liste; die
      -- Nachvollziehbarkeit haengt am Hinweisband der Kundenkarte.
      AND c.merged_into_customer_id IS NULL
      AND (p_filter IS DISTINCT FROM 'person'    OR c.customer_type = 'person')
      AND (p_filter IS DISTINCT FROM 'firma'     OR c.customer_type = 'company')
      AND (p_filter IS DISTINCT FROM 'duplikate' OR c.possible_duplicate)
      AND (
        v_such IS NULL
        OR c.display_name  ILIKE '%' || v_such || '%'
        OR c.primary_email ILIKE '%' || v_such || '%'
        OR (v_ziffer IS NOT NULL AND length(v_ziffer) >= 3
            AND c.phone_normalized ILIKE '%' || v_ziffer || '%')
      )
  ),
  gezaehlt AS (SELECT count(*) AS n FROM treffer)
  SELECT
    t.id, t.display_name, t.customer_type, t.first_name, t.last_name, t.company_name,
    t.primary_email, t.primary_phone, t.language, t.status, t.possible_duplicate,
    t.first_seen_at,
    akt.letzte,
    COALESCE(off.offen, 0)::INTEGER,
    COALESCE(auf.n, 0)::INTEGER,
    COALESCE(fin.offen, 0)::NUMERIC(12,2),
    COALESCE(fin.bezahlt, 0)::NUMERIC(12,2),
    ort.ort,
    gezaehlt.n
  FROM treffer t
  CROSS JOIN gezaehlt
  LEFT JOIN LATERAL (
    SELECT max(x.t) AS letzte FROM (
      SELECT max(l.created_at) t FROM public.leads      l WHERE l.customer_id = t.id
      UNION ALL SELECT max(o.created_at) FROM public.offers     o WHERE o.customer_id = t.id
      UNION ALL SELECT max(a.created_at) FROM public.auftraege  a WHERE a.customer_id = t.id
      UNION ALL SELECT max(r.created_at) FROM public.rechnungen r WHERE r.customer_id = t.id
      UNION ALL SELECT max(i.received_at) FROM public.inbound_emails i WHERE i.customer_id = t.id
    ) x
  ) akt ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*) AS offen FROM public.offers o
    WHERE o.customer_id = t.id AND o.status IN ('draft','sent','viewed')
  ) off ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*) AS n FROM public.auftraege a
    WHERE a.customer_id = t.id AND a.deleted_at IS NULL
  ) auf ON TRUE
  -- Offen kommt jetzt aus open_amount statt aus dem Status: eine Rechnung, auf
  -- die die Haelfte eingegangen ist, war vorher voll offen oder gar nicht.
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(r.open_amount) FILTER (
             WHERE r.status <> 'entwurf' AND r.open_amount > 0), 0) AS offen,
           COALESCE((SELECT SUM(p.amount) FROM public.payments p
                     WHERE p.customer_id = t.id), 0) AS bezahlt
    FROM public.rechnungen r WHERE r.customer_id = t.id
  ) fin ON TRUE
  LEFT JOIN LATERAL (
    SELECT NULLIF(TRIM(CONCAT_WS(' ', l.from_plz, l.from_city)), '') AS ort
    FROM public.leads l WHERE l.customer_id = t.id AND l.from_city IS NOT NULL
    ORDER BY l.created_at DESC LIMIT 1
  ) ort ON TRUE
  ORDER BY akt.letzte DESC NULLS LAST, t.display_name
  LIMIT v_limit OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

-- -----------------------------------------------------------------------------
-- Ueberfaellige Rechnungen melden
--
-- Zwei Dinge: der Status wird nachgezogen (die DB kennt 'ueberfaellig' seit
-- jeher, gesetzt hat ihn nie jemand), und es entsteht eine Aufgabe.
--
-- Die Aufgabe kommt dreimal, nicht einmal und nicht taeglich: bei Faelligkeit,
-- nach 10 und nach 30 Tagen. Das entspricht den Mahnstufen. Das Zeitfenster im
-- Lieferschein ist der jeweilige Stichtag, nicht der heutige — damit bleibt
-- jede Stufe genau einmal faellig, auch wenn ein Lauf ausfaellt.
--
-- BEWUSST NICHT DABEI: das Versenden der Mahnung. Das geht an den KUNDEN und
-- braucht Resend und einen eigenen Deploy-Schritt — dieselbe Grenze wie bei den
-- Offerten-Erinnerungen in 20260728250000. `invoice_reminders` traegt den Beleg
-- ein, wenn der Bediener die Mahnung tatsaechlich verschickt.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.run_invoice_automations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status INT := 0;
  v_tasks  INT := 0;
BEGIN
  UPDATE public.rechnungen
  SET status = 'ueberfaellig'
  WHERE status = 'versendet'
    AND open_amount > 0
    AND faellig_am IS NOT NULL
    AND faellig_am < CURRENT_DATE;
  GET DIAGNOSTICS v_status = ROW_COUNT;

  WITH faellig AS (
    SELECT r.id, r.company_id, r.customer_id, r.rechnung_nr, r.customer_name,
           r.open_amount, r.faellig_am,
           (CURRENT_DATE - r.faellig_am) AS tage,
           CASE WHEN CURRENT_DATE - r.faellig_am >= 30 THEN 30
                WHEN CURRENT_DATE - r.faellig_am >= 10 THEN 10
                ELSE 1 END AS stufe_tage
    FROM public.rechnungen r
    WHERE r.status IN ('versendet', 'ueberfaellig')
      AND r.open_amount > 0
      AND r.faellig_am IS NOT NULL
      AND r.faellig_am < CURRENT_DATE
  ),
  geliefert AS (
    INSERT INTO public.automation_deliveries
      (company_id, rule_key, entity_type, entity_id, schedule_window, result)
    SELECT company_id, 'invoice_overdue', 'rechnung', id,
           faellig_am + stufe_tage, 'task'
    FROM faellig
    ON CONFLICT (rule_key, entity_type, entity_id, schedule_window) DO NOTHING
    RETURNING entity_id, company_id
  )
  INSERT INTO public.crm_tasks (company_id, title, description, task_type,
                                priority, due_at, customer_id)
  SELECT g.company_id,
         'Rechnung ' || COALESCE(f.rechnung_nr, '') || ' ueberfaellig',
         COALESCE(f.customer_name, '') || ' — ' || f.open_amount ||
           ' offen, faellig war ' || f.faellig_am || ' (' || f.tage || ' Tage).',
         'admin',
         CASE WHEN f.stufe_tage >= 30 THEN 'high' ELSE 'normal' END,
         NOW(), f.customer_id
  FROM geliefert g JOIN faellig f ON f.id = g.entity_id;
  GET DIAGNOSTICS v_tasks = ROW_COUNT;

  RETURN jsonb_build_object('status_nachgezogen', v_status, 'aufgaben', v_tasks);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_invoice_automations() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('invoice-automations')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-automations');

SELECT cron.schedule('invoice-automations', '30 6 * * *',
                     $cron$SELECT public.run_invoice_automations();$cron$);

COMMIT;
