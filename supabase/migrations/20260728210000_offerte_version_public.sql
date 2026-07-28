-- =============================================================================
-- Der oeffentliche Weg kennt jetzt Versionen
-- =============================================================================
--
-- BEFUND
-- Seit 20260728200000 kann es zu einer Offerte mehrere Fassungen geben. Der
-- oeffentliche Link zeigt weiterhin genau die Fassung, zu der er gehoert — das
-- ist gewollt und der eigentliche Zweck der Uebung: der Kunde muss nachlesen
-- koennen, was er gesehen hat.
--
-- Zwei Dinge fehlten dazu noch:
--
--   1. Der Kunde konnte eine UEBERHOLTE Fassung annehmen. Damit haette er einem
--      Umfang zugestimmt, den die Firma inzwischen ersetzt hat — und der Auftrag
--      waere aus der falschen Fassung entstanden.
--   2. Die Seite wusste nicht, dass sie eine alte Fassung zeigt, und konnte es
--      dem Kunden folglich nicht sagen.
--
-- ABHILFE
--   `update_offer_by_token` weist Annahme und Ablehnung einer ueberholten
--   Fassung ab. Das blosse Oeffnen (`viewed`) bleibt erlaubt — sonst verloere
--   man die Information, dass jemand den alten Link noch benutzt.
--
--   `get_offer_by_token` liefert zusaetzlich `is_superseded` und
--   `version_number`, damit die Seite einen Hinweis zeigen kann.
--
-- Beide Rumpfe sind der Stand aus der Produktion, unveraendert bis auf die hier
-- beschriebenen Stellen.
-- =============================================================================

BEGIN;

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
    IF v_service_date IS NOT NULL THEN
      IF v_acceptance_deadline IS NULL OR (v_service_date - INTERVAL '1 day')::date < v_acceptance_deadline THEN
        v_acceptance_deadline := (v_service_date - INTERVAL '1 day')::date;
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
      COALESCE(o.service_date, l.preferred_date, CURRENT_DATE + INTERVAL '7 days'),
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

-- Der Rueckgabetyp waechst um zwei Spalten; CREATE OR REPLACE kann das nicht.
DROP FUNCTION IF EXISTS public.get_offer_by_token(text);

CREATE OR REPLACE FUNCTION public.get_offer_by_token(offer_access_token text)
 RETURNS TABLE(id uuid, title character varying, description text, customer_first_name character varying, customer_last_name character varying, customer_email character varying, customer_phone character varying, service_date date, valid_until date, subtotal numeric, vat_rate numeric, vat_amount numeric, total numeric, status character varying, created_at timestamp with time zone, sent_at timestamp with time zone, viewed_at timestamp with time zone, accepted_at timestamp with time zone, rejected_at timestamp with time zone, company_id uuid, lead_id uuid, agb_accepted_at timestamp with time zone, service_type character varying, is_expired boolean, from_street character varying, from_house_number character varying, from_plz character varying, from_city character varying, from_floor integer, from_has_lift boolean, to_street character varying, to_house_number character varying, to_plz character varying, to_city character varying, to_floor integer, to_has_lift boolean, surcharges jsonb, price_model text, hourly_rate numeric, kostendach_max numeric, offerte_type text, discount_percent numeric, from_has_estrich boolean, from_has_keller boolean, language text, is_superseded boolean, version_number integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    o.id,
    o.title,
    o.description,
    o.customer_first_name,
    o.customer_last_name,
    o.customer_email,
    o.customer_phone,
    o.service_date,
    o.valid_until,
    o.subtotal,
    o.vat_rate,
    o.vat_amount,
    o.total,
    o.status,
    o.created_at,
    o.sent_at,
    o.viewed_at,
    o.accepted_at,
    o.rejected_at,
    o.company_id,
    o.lead_id,
    o.agb_accepted_at,
    l.service_type,
    CASE
      WHEN o.valid_until IS NOT NULL AND o.valid_until < CURRENT_DATE THEN true
      ELSE false
    END AS is_expired,
    -- Frozen öncelik, lead fallback (LEFT JOIN leads korunur)
    COALESCE(o.frozen_from_street, l.from_street)::character varying             AS from_street,
    COALESCE(o.frozen_from_house_number, l.from_house_number)::character varying AS from_house_number,
    COALESCE(o.frozen_from_plz, l.from_plz)::character varying                   AS from_plz,
    COALESCE(o.frozen_from_city, l.from_city)::character varying                 AS from_city,
    COALESCE(o.frozen_from_floor, l.from_floor)                                  AS from_floor,
    COALESCE(o.frozen_from_has_lift, l.from_has_lift)                            AS from_has_lift,
    COALESCE(o.frozen_to_street, l.to_street)::character varying                 AS to_street,
    COALESCE(o.frozen_to_house_number, l.to_house_number)::character varying     AS to_house_number,
    COALESCE(o.frozen_to_plz, l.to_plz)::character varying                       AS to_plz,
    COALESCE(o.frozen_to_city, l.to_city)::character varying                     AS to_city,
    COALESCE(o.frozen_to_floor, l.to_floor)                                      AS to_floor,
    COALESCE(o.frozen_to_has_lift, l.to_has_lift)                                AS to_has_lift,
    o.surcharges,
    o.price_model,
    o.hourly_rate,
    o.kostendach_max,
    o.offerte_type,
    o.discount_percent,
    COALESCE(o.frozen_has_estrich, l.from_has_estrich) AS from_has_estrich,
    COALESCE(o.frozen_has_keller, l.from_has_keller)   AS from_has_keller,
    o.language,
    (o.superseded_at IS NOT NULL) AS is_superseded,
    o.version_number
  FROM public.offers o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.access_token = offer_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected');
$function$;

-- Das DROP oben nimmt die Rechte mit. Die oeffentliche Offertenseite arbeitet
-- mit dem anon-Schluessel — ohne dieses GRANT waere sie sofort tot.
--
-- BEWUSST enger als vorher: statt PUBLIC nur die drei Rollen, die es wirklich
-- gibt. PUBLIC schliesst jede kuenftige Rolle mit ein, auch eine, die den Zugriff
-- nicht haben soll.
REVOKE ALL ON FUNCTION public.get_offer_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_offer_by_token(TEXT) TO anon, authenticated, service_role;

COMMIT;
