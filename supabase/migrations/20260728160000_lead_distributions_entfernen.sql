-- =============================================================================
-- lead_distributions entfernen — der letzte Rest des Marktplatzes
-- =============================================================================
--
-- ⚠️ REIHENFOLGE: Diese Datei erst einspielen, NACHDEM die Oberflaeche ohne
--    lead_distributions ausgeliefert ist. Heute fragen vier Dateien die Tabelle
--    noch ab (Dashboard, Datenarchiv, AppointmentModal, OfferteErstellen). Sie
--    liefert 0 Zeilen, also faellt es nicht auf — nach dem DROP kaeme ein
--    Fehler statt einer leeren Liste.
--
-- BEFUND
-- Die Tabelle stammt aus dem Marktplatz, aus dem dieses CRM abgezweigt wurde:
-- dort wurde ein Lead an mehrere Firmen verteilt, und jede Verteilung war eine
-- Zeile. Im Einzelmandanten gibt es nichts zu verteilen.
--
--   lead_distributions               0 Zeilen
--   offers.lead_distribution_id      0 von 54 Offerten gefuellt
--   Fremdschluessel darauf           nur offers
--   Aufrufer im Code                 keiner (die vier Abfragen oben laufen leer)
--
-- Trotzdem traegt die Tabelle sechs RLS-Policies, erscheint in jeder
-- Schema-Auswertung und hat in einer frueheren Analyse die Frage ausgeloest,
-- warum die Kennzahlen des Dashboards immer null sind. Sie kostet nichts ausser
-- Verwirrung.
--
-- ABHILFE — drei Dinge, die zusammengehoeren
--   1. update_offer_by_token schreibt bei der Annahme noch in die Tabelle. Ohne
--      diese Anpassung wuerde JEDE Angebotsannahme nach dem DROP scheitern.
--      Der Rest der Funktion bleibt Zeichen fuer Zeichen wie in 20260728120000.
--   2. atomic_accept_lead ist die Annahmefunktion des Marktplatzes. Kein
--      Aufrufer im Repo, und ihr Rumpf liest die Tabelle — sie faellt mit.
--   3. Spalte und Tabelle.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. update_offer_by_token ohne den Verteilungs-Zweig
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_offer_by_token(
  offer_access_token          TEXT,
  new_status                  TEXT        DEFAULT NULL,
  new_viewed_at               TIMESTAMPTZ DEFAULT NULL,
  new_accepted_at             TIMESTAMPTZ DEFAULT NULL,
  new_rejected_at             TIMESTAMPTZ DEFAULT NULL,
  new_customer_response_note  TEXT        DEFAULT NULL,
  new_agb_accepted_at         TIMESTAMPTZ DEFAULT NULL,
  new_agb_version             TEXT        DEFAULT NULL,
  new_agb_ip_address          TEXT        DEFAULT NULL
)
RETURNS BOOLEAN
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
  ALLOWED_STATUSES      text[] := ARRAY['viewed', 'accepted', 'rejected'];
  TERMINAL_STATUSES     text[] := ARRAY['accepted', 'rejected'];
BEGIN
  IF new_status IS NOT NULL AND NOT (new_status = ANY(ALLOWED_STATUSES)) THEN
    RAISE EXCEPTION 'Invalid status value: %', new_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT status, service_date, valid_until, id, company_id, lead_id
  INTO v_status, v_service_date, v_valid_until, v_offer_id, v_company_id, v_lead_id
  FROM public.offers
  WHERE access_token = offer_access_token;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Eine angenommene Offerte wird nicht abgelehnt und umgekehrt.
  IF new_status IS NOT NULL AND v_status = ANY(TERMINAL_STATUSES) THEN
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

-- -----------------------------------------------------------------------------
-- 2. atomic_accept_lead — Annahmefunktion des Marktplatzes, ohne Aufrufer
-- -----------------------------------------------------------------------------

-- Signatur aus der Produktion abgelesen, nicht geraten: die Funktion traegt
-- noch das Token-Guthaben des Marktplatzes im Kopf (p_token_cost,
-- p_current_balance) — Begriffe, die es in diesem CRM nicht mehr gibt.
DROP FUNCTION IF EXISTS public.atomic_accept_lead(UUID, UUID, UUID, NUMERIC, NUMERIC, INTEGER);

-- -----------------------------------------------------------------------------
-- 3. Spalte, View und Tabelle
--
-- Die View offer_details fuehrt lead_distribution_id mit. Sie wird deshalb neu
-- aufgebaut — BEWUSST nicht per DROP COLUMN … CASCADE, denn das haette die View
-- ersatzlos entfernt. Der Rumpf ist Zeichen fuer Zeichen der bestehende, nur
-- ohne diese eine Spalte; security_invoker und die Rechte werden mitgesetzt
-- (siehe 20260728080000 — ohne security_invoker umgeht die View RLS).
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.offer_details;

ALTER TABLE public.offers DROP COLUMN IF EXISTS lead_distribution_id;

CREATE VIEW public.offer_details AS
SELECT o.id,
    o.company_id,
    o.lead_id,
    o.customer_first_name,
    o.customer_last_name,
    o.customer_email,
    o.customer_phone,
    o.title,
    o.description,
    o.service_date,
    o.valid_until,
    o.subtotal,
    o.vat_rate,
    o.vat_amount,
    o.total,
    o.status,
    o.sent_at,
    o.viewed_at,
    o.accepted_at,
    o.rejected_at,
    o.created_at,
    o.updated_at,
    o.access_token,
    o.customer_response_note,
    o.checklist_url,
    o.leistungsuebersicht_url,
    o.agb_accepted_at,
    o.agb_version,
    o.agb_ip_address,
    o.offer_number,
    o.company_reference,
    o.customer_salutation,
    o.service_start_time,
    o.service_end_time,
    o.secondary_service_date,
    o.secondary_service_type,
    o.service_details,
    o.resources,
    o.highlighted_items,
    o.payment_method,
    o.payment_due_days,
    o.internal_notes,
    o.assigned_team_member_id,
    c.company_name,
    c.street AS company_street,
    c.house_number AS company_house_number,
    c.plz AS company_plz,
    c.city AS company_city,
    c.phone AS company_phone,
    c.email AS company_email,
    c.mwst_number AS company_mwst_number,
    c.logo_url AS company_logo_url,
    l.service_type,
    l.from_street,
    l.from_house_number,
    l.from_plz,
    l.from_city,
    l.from_floor,
    l.from_has_lift,
    l.from_rooms,
    l.from_living_space_m2,
    l.to_street,
    l.to_house_number,
    l.to_plz,
    l.to_city,
    l.to_floor,
    l.to_has_lift,
    l.preferred_date,
    l.description AS lead_description,
    tm.first_name AS reference_first_name,
    tm.last_name AS reference_last_name,
    tm.email AS reference_email,
    tm.phone AS reference_phone
   FROM offers o
     LEFT JOIN companies c ON o.company_id = c.id
     LEFT JOIN leads l ON o.lead_id = l.id
     LEFT JOIN team_members tm ON o.assigned_team_member_id = tm.id;;

ALTER VIEW public.offer_details SET (security_invoker = on);

REVOKE ALL ON public.offer_details FROM anon;
GRANT SELECT ON public.offer_details TO authenticated, service_role;

COMMENT ON VIEW public.offer_details IS
  'Offerte mit Firma, Lead und Betreuer. security_invoker = on — ohne das laeuft '
  'die View als postgres und umgeht RLS. anon hat hier nichts verloren.';

-- -----------------------------------------------------------------------------
-- 4. Die einzige SELECT-Policy auf leads haengt an der Tabelle
--
-- ⚠️ Das ist die gefaehrlichste Stelle dieser Migration. `leads` hat GENAU EINE
-- SELECT-Policy, und ihr mittlerer Zweig liest lead_distributions:
--
--   is_admin(auth.uid())
--   OR EXISTS (SELECT 1 FROM lead_distributions ld JOIN companies c …)   <-- tot
--   OR is_company_member(company_id, auth.uid())
--
-- Ein DROP TABLE … CASCADE haette diese Policy mitgenommen — und damit die
-- Leseberechtigung auf leads ERSATZLOS entfernt. Die Anwendung waere nicht mit
-- einem Fehler stehengeblieben, sondern haette ueberall leere Listen gezeigt:
-- Anfragen, Dashboard, Kalenderauswahl. Der Zweig selbst ist tot (0 Zeilen),
-- die beiden anderen tragen den gesamten Zugriff.
--
-- Deshalb wird die Policy VORHER ersetzt und danach OHNE CASCADE geloescht:
-- taucht dann noch eine Abhaengigkeit auf, bricht die Migration ab, statt still
-- etwas mitzunehmen.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS leads_select_company_or_distribution ON public.leads;

CREATE POLICY leads_select_company_or_admin
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_company_member(company_id, auth.uid())
  );

DROP TABLE IF EXISTS public.lead_distributions;

COMMIT;
