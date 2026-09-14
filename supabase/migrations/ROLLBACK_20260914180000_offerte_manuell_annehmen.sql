-- =============================================================================
-- ROLLBACK für 20260914180000_offerte_manuell_annehmen.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach kann die Firma eine Offerte nicht mehr manuell annehmen, und die
--    Oberfläche, die `accept_offer_manually` ruft, bekommt einen Fehler.
--    Auftrag und Termine einer Zusage tragen wieder den Spaltenvorgabewert 'de'
--    statt der Sprache der Offerte, und ein Mitglied kann `status = 'accepted'`
--    wieder direkt schreiben.
--
--    Die Spalten `offers.accepted_via` / `accepted_by` bleiben absichtlich
--    STEHEN: sie sind für alle seit 2026-09-14 angenommenen Offerten die einzige
--    Auskunft, WIE zugesagt wurde. Sie zu löschen wäre der eigentliche
--    Datenverlust. Nach dem Rollback schreibt sie niemand mehr.
--
--    Die Funktionsrümpfe unten sind wörtlich: update_offer_by_token aus
--    20260904160000, create_appointments_for_auftrag aus 20260728120000,
--    guard_offer_content_after_send aus 20260728190000,
--    set_offer_acceptance_evidence aus der Produktion ausgelesen (2026-09-14).
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.accept_offer_manually(uuid);

-- Stand 20260904160000
CREATE OR REPLACE FUNCTION public.update_offer_by_token(offer_access_token text, new_status text DEFAULT NULL::text, new_viewed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_accepted_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_rejected_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_customer_response_note text DEFAULT NULL::text, new_agb_accepted_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_agb_version text DEFAULT NULL::text, new_agb_ip_address text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_rows         integer;
  v_status              text;
  v_service_date        date;
  v_arbeitsbeginn       date;
  v_valid_until         date;
  v_acceptance_deadline date;
  v_offer_id            uuid;
  v_company_id          uuid;
  v_lead_id             uuid;
  v_superseded_at       timestamptz;
  ALLOWED_STATUSES      text[] := ARRAY['viewed', 'accepted', 'rejected'];
  TERMINAL_STATUSES     text[] := ARRAY['accepted', 'rejected'];
BEGIN
  IF new_status IS NOT NULL AND NOT (new_status = ANY(ALLOWED_STATUSES)) THEN
    RAISE EXCEPTION 'Invalid status value: %', new_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT status, service_date, valid_until, id, company_id, lead_id, superseded_at
  INTO v_status, v_service_date, v_valid_until, v_offer_id, v_company_id, v_lead_id, v_superseded_at
  FROM public.offers
  WHERE access_token = offer_access_token;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Der erste Arbeitstag: je Servicegruppe ihr eigenes Datum, sonst das globale
  -- Feld; davon der frueheste. Ohne Positionen und ohne Gruppendaten bleibt es
  -- genau das globale Feld — fuer die grosse Mehrheit der Offerten aendert sich
  -- nichts.
  SELECT MIN(COALESCE(g.d, v_service_date))
  INTO v_arbeitsbeginn
  FROM (
    SELECT MIN(i.scheduled_date) AS d
    FROM public.offer_items i
    WHERE i.offer_id = v_offer_id
    GROUP BY NULLIF(lower(btrim(COALESCE(i.service_type, ''))), '')
  ) g;
  v_arbeitsbeginn := COALESCE(v_arbeitsbeginn, v_service_date);

  -- Eine angenommene Offerte wird nicht abgelehnt und umgekehrt.
  IF new_status IS NOT NULL AND v_status = ANY(TERMINAL_STATUSES) THEN
    RETURN false;
  END IF;

  -- Ueberholte Fassung: der Link bleibt gueltig und zeigt weiterhin, was der
  -- Kunde damals gesehen hat — aber zugestimmt wird der aktuellen Fassung.
  -- Das blosse Oeffnen (viewed) bleibt erlaubt, sonst verloere man die
  -- Information, dass jemand den alten Link noch benutzt.
  IF v_superseded_at IS NOT NULL AND new_status IN ('accepted', 'rejected') THEN
    RETURN false;
  END IF;

  IF new_status = 'accepted' THEN
    v_acceptance_deadline := v_valid_until;
    IF v_arbeitsbeginn IS NOT NULL THEN
      IF v_acceptance_deadline IS NULL OR (v_arbeitsbeginn - INTERVAL '1 day')::date < v_acceptance_deadline THEN
        v_acceptance_deadline := (v_arbeitsbeginn - INTERVAL '1 day')::date;
      END IF;
    END IF;
    IF v_acceptance_deadline IS NOT NULL AND CURRENT_DATE > v_acceptance_deadline THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE public.offers
  SET
    status                 = COALESCE(new_status, status),
    viewed_at              = COALESCE(new_viewed_at, viewed_at),
    accepted_at            = COALESCE(new_accepted_at, accepted_at),
    rejected_at            = COALESCE(new_rejected_at, rejected_at),
    customer_response_note = COALESCE(new_customer_response_note, customer_response_note),
    agb_accepted_at        = COALESCE(new_agb_accepted_at, agb_accepted_at),
    agb_version            = COALESCE(new_agb_version, agb_version)
    -- agb_ip_address intentionally NOT updated from caller-supplied value
  WHERE access_token = offer_access_token;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 0 THEN
    RETURN false;
  END IF;

  IF new_status = 'accepted' AND v_offer_id IS NOT NULL THEN
    INSERT INTO public.auftraege (
      company_id, offer_id, lead_id, auftrag_nummer, title,
      customer_name, customer_first_name, customer_last_name,
      customer_email, customer_phone, from_address, to_address,
      scheduled_date, scheduled_time, description, status,
      subtotal, vat_rate, vat_amount, total,
      service_type, pricing_type, hourly_rate, items
    )
    SELECT
      o.company_id,
      o.id,
      o.lead_id,
      '',   -- auftrag_nummer: trigger tarafından otomatik oluşturulur
      COALESCE(NULLIF(o.title, ''), 'Auftrag'),
      -- Anzeigename fuer den Beleg …
      TRIM(CONCAT(
        COALESCE(o.customer_first_name, ''), ' ',
        COALESCE(o.customer_last_name, '')
      )),
      -- … und daneben die Trennung, die die Offerte ohnehin schon kennt.
      NULLIF(TRIM(o.customer_first_name), ''),
      NULLIF(TRIM(o.customer_last_name), ''),
      o.customer_email,
      o.customer_phone,
      NULLIF(TRIM(CONCAT(
        COALESCE(l.from_street, ''), ' ',
        COALESCE(l.from_house_number, ''),
        CASE WHEN l.from_plz IS NOT NULL THEN ', ' || l.from_plz || ' ' || COALESCE(l.from_city, '') ELSE '' END
      )), ''),
      NULLIF(TRIM(CONCAT(
        COALESCE(l.to_street, ''), ' ',
        COALESCE(l.to_house_number, ''),
        CASE WHEN l.to_plz IS NOT NULL THEN ', ' || l.to_plz || ' ' || COALESCE(l.to_city, '') ELSE '' END
      )), ''),
      COALESCE(v_arbeitsbeginn, l.preferred_date, CURRENT_DATE + INTERVAL '7 days'),
      o.service_start_time::time,
      o.description,
      'geplant'::public.auftrag_status,
      COALESCE(o.subtotal, 0),
      COALESCE(o.vat_rate, 8.1),
      COALESCE(o.vat_amount, 0),
      COALESCE(o.total, 0),
      l.service_type,
      CASE o.price_model
        WHEN 'stundenansatz' THEN 'hourly'
        WHEN 'kostendach'    THEN 'estimate'
        ELSE 'fixed'
      END,
      o.hourly_rate,
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(oi.*) ORDER BY oi.position)
         FROM public.offer_items oi WHERE oi.offer_id = o.id),
        '[]'::jsonb
      )
    FROM public.offers o
    LEFT JOIN public.leads l ON l.id = o.lead_id
    WHERE o.access_token = offer_access_token
      AND NOT EXISTS (
        SELECT 1 FROM public.auftraege a
        WHERE a.offer_id = o.id
      );

    -- Der frueher hier stehende UPDATE auf lead_distributions ist entfallen:
    -- die Tabelle existiert nicht mehr (Marktplatz-Rest, 0 Zeilen).

    UPDATE public.leads
    SET status = 'job_confirmed', updated_at = NOW()
    WHERE id = v_lead_id;
  END IF;

  RETURN true;
END;
$function$;

DROP FUNCTION IF EXISTS public.perform_offer_acceptance(uuid, text);
DROP FUNCTION IF EXISTS public.offer_arbeitsbeginn(uuid);

-- Stand 20260728120000
CREATE OR REPLACE FUNCTION public.create_appointments_for_auftrag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_group        RECORD;
  v_group_count  integer;
  v_date         date;
  v_start        time;
  v_end          time;
  v_label        text;
  v_first        text;
  v_last         text;
  v_rest         text;
  v_appt_id      uuid;
  v_primary_appt uuid := NULL;
BEGIN
  IF NEW.offer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE offer_id = NEW.offer_id AND appointment_type = 'service'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(DISTINCT service_type) INTO v_group_count
  FROM public.offer_items
  WHERE offer_id = NEW.offer_id AND service_type IS NOT NULL;

  -- Getrennte Felder haben Vorrang. Der split_part darunter ist der Rueckfall
  -- fuer Auftraege von vor 2026-07-28 und fuer direkt per SQL geschriebene
  -- Zeilen — dort gibt es nichts Getrenntes zu lesen.
  v_first := NULLIF(TRIM(COALESCE(NEW.customer_first_name, '')), '');
  v_last  := NULLIF(TRIM(COALESCE(NEW.customer_last_name, '')), '');

  IF v_first IS NULL AND v_last IS NULL THEN
    v_rest  := split_part(COALESCE(NEW.customer_name, ''), ' ', 1);
    v_first := NULLIF(v_rest, '');
    v_last  := NULLIF(TRIM(substr(COALESCE(NEW.customer_name, ''), length(v_rest) + 1)), '');
  END IF;

  IF v_group_count >= 2 THEN
    FOR v_group IN
      SELECT service_type,
             MIN(scheduled_date)       AS d,
             MIN(scheduled_start_time) AS st,
             MIN(scheduled_end_time)   AS et
      FROM public.offer_items
      WHERE offer_id = NEW.offer_id AND service_type IS NOT NULL
      GROUP BY service_type
      ORDER BY MIN(position)
    LOOP
      v_label := CASE v_group.service_type
        WHEN 'umzug'      THEN 'Umzug'
        WHEN 'reinigung'  THEN 'Reinigung'
        WHEN 'raeumung'   THEN 'Räumung'
        WHEN 'entsorgung' THEN 'Entsorgung'
        WHEN 'lagerung'   THEN 'Lagerung'
        WHEN 'transport'  THEN 'Transport'
        ELSE initcap(v_group.service_type)
      END;
      v_date  := COALESCE(v_group.d, NEW.scheduled_date);
      v_start := COALESCE(v_group.st, NEW.scheduled_time, TIME '08:00');
      v_end   := COALESCE(v_group.et, v_start + INTERVAL '4 hours');

      INSERT INTO public.appointments (
        company_id, offer_id, lead_id, appointment_type, status,
        appointment_date, start_time, end_time, all_day,
        location_address, customer_first_name, customer_last_name,
        customer_email, customer_phone, title, description
      ) VALUES (
        NEW.company_id, NEW.offer_id, NEW.lead_id, 'service', 'pending',
        v_date, v_start, v_end, false,
        NEW.from_address, v_first, v_last,
        NEW.customer_email, NEW.customer_phone,
        v_label || ' - ' || COALESCE(NULLIF(NEW.title, ''), 'Auftrag'), NEW.description
      ) RETURNING id INTO v_appt_id;

      IF v_primary_appt IS NULL THEN
        v_primary_appt := v_appt_id;
      END IF;
    END LOOP;
  ELSE
    v_start := COALESCE(NEW.scheduled_time, TIME '08:00');
    v_end   := v_start + INTERVAL '4 hours';

    INSERT INTO public.appointments (
      company_id, offer_id, lead_id, appointment_type, status,
      appointment_date, start_time, end_time, all_day,
      location_address, customer_first_name, customer_last_name,
      customer_email, customer_phone, title, description
    ) VALUES (
      NEW.company_id, NEW.offer_id, NEW.lead_id, 'service', 'pending',
      NEW.scheduled_date, v_start, v_end, false,
      NEW.from_address, v_first, v_last,
      NEW.customer_email, NEW.customer_phone,
      COALESCE(NULLIF(NEW.title, ''), 'Auftrag'), NEW.description
    ) RETURNING id INTO v_primary_appt;
  END IF;

  IF v_primary_appt IS NOT NULL THEN
    UPDATE public.auftraege SET appointment_id = v_primary_appt WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_appointments_for_auftrag failed for auftrag %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Stand 20260728190000
CREATE OR REPLACE FUNCTION public.guard_offer_content_after_send()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  -- Was sich nach dem Versand noch aendern DARF. Alles andere ist gesperrt,
  -- auch Spalten, die es zum Zeitpunkt dieser Migration noch nicht gibt.
  erlaubt CONSTANT TEXT[] := ARRAY[
    'status', 'sent_at', 'viewed_at', 'accepted_at', 'rejected_at',
    'customer_response_note',
    'agb_accepted_at', 'agb_version', 'agb_ip_address',
    'updated_at', 'customer_id',
    'offer_series_id', 'version_number', 'supersedes_offer_id',
    'superseded_at', 'locked_at', 'revision_reason'
  ];
  alt_j  JSONB;
  neu_j  JSONB;
  spalte TEXT;
BEGIN
  -- Der Uebergang nach `sent` setzt die Sperre — und darf sie im selben
  -- Statement noch nicht gegen sich selbst wenden.
  IF NEW.status = 'sent' AND OLD.status IS DISTINCT FROM 'sent' AND NEW.locked_at IS NULL THEN
    NEW.locked_at := NOW();
  END IF;

  IF OLD.locked_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- BEWUSST SECURITY INVOKER (Default): in einer DEFINER-Funktion waere
  -- current_user immer der Eigentuemer und die Ausnahme wuerde stets greifen —
  -- derselbe Fallstrick wie in guard_company_ownership.
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  alt_j := to_jsonb(OLD);
  neu_j := to_jsonb(NEW);

  -- Nur echte Spalten vergleichen. Generierte Spalten (total, vat_amount) sind in
  -- einem BEFORE-Trigger auf NEW noch nicht berechnet und wuerden sich deshalb
  -- IMMER von OLD unterscheiden — jede Statusaenderung waere faelschlich
  -- blockiert. Schutz verlieren sie dadurch nicht: sie leiten sich aus Spalten
  -- ab, die selbst gesperrt sind.
  FOR spalte IN
    SELECT a.attname
    FROM pg_attribute a
    WHERE a.attrelid = TG_RELID
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attgenerated = ''
  LOOP
    IF NOT (spalte = ANY(erlaubt))
       AND (alt_j -> spalte) IS DISTINCT FROM (neu_j -> spalte) THEN
      RAISE EXCEPTION
        'Offerte % wurde versendet und ist inhaltlich gesperrt (Feld "%"). '
        'Aenderungen laufen ueber create_offer_revision().',
        COALESCE(OLD.offer_number::TEXT, OLD.id::TEXT), spalte
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Stand Produktion 2026-09-14 (20260727170000)
CREATE OR REPLACE FUNCTION public.set_offer_acceptance_evidence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ip      TEXT;
  v_headers JSON;
BEGIN
  -- Nur beim Übergang in 'accepted'. Ein erneutes UPDATE derselben Offerte darf
  -- den ursprünglichen Zeitpunkt nicht überschreiben.
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    NEW.accepted_at := now();
    NEW.agb_version := public.agb_content_hash(NEW.access_token);
    IF NEW.agb_version IS NOT NULL THEN
      NEW.agb_accepted_at := now();
    END IF;
    -- PostgREST stellt die Kopfzeilen als GUC bereit. Bei direktem SQL-Zugriff
    -- gibt es sie nicht — dann bleibt das Feld leer statt zu scheitern.
    BEGIN
      v_headers := current_setting('request.headers', true)::json;
      v_ip := split_part(COALESCE(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1);
      NEW.agb_ip_address := NULLIF(TRIM(v_ip), '');
    EXCEPTION WHEN OTHERS THEN
      NEW.agb_ip_address := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
