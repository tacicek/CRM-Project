-- Der Auftrag und die Annahmefrist rechnen mit dem ersten Arbeitstag
--
-- Das Datum der Leistung steht an zwei Stellen: `offers.service_date` (das
-- globale Feld) und `offer_items.scheduled_date` (je Servicegruppe). Traegt
-- eine Gruppe ihr eigenes Datum, gilt dieses — so verspricht es das Formular
-- («Leer = globales Ausfuehrungsdatum gilt»), und so drucken es die PDFs seit
-- `_shared/offerTermin.ts`.
--
-- Diese Funktion las weiter das rohe Feld, an zwei Stellen:
--
--   1. die Annahmefrist (service_date minus ein Tag) — sie haette eine Zusage
--      abgewiesen, die die Oberflaeche noch angeboten hat, oder umgekehrt;
--   2. das Datum des Auftrags — Offerte 10098 haette einen Auftrag auf den
--      04.09. erzeugt, waehrend alle Positionen den 02.10. tragen.
--
-- Gerechnet wird der FRUEHESTE Tag ueber die Gruppen (`earliestTermin` in
-- `_shared/offerTermin.ts`), nicht die Kopfzeilen-Regel `resolveOfferTermin`:
-- ein Auftrag braucht immer ein Datum, und eine Zusage nach Arbeitsbeginn ist
-- keine mehr. Wo die Kopfzeile des Dokuments schweigen darf, muss hier ein Tag
-- herauskommen.
--
-- SQL kann die TypeScript-Datei nicht importieren. Die Doppelung ist bewusst
-- und traegt hier denselben Wortlaut; `create_appointments_for_auftrag` rechnet
-- die Gruppentermine bereits selbst und bleibt unveraendert.

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
