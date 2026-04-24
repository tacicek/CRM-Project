-- Automatically create a calendar appointment when an offer is accepted by customer.
-- This extends the public RPC used by token-based offer responses.

CREATE OR REPLACE FUNCTION public.update_offer_by_token(
  offer_access_token text,
  new_status text DEFAULT NULL,
  new_viewed_at timestamp with time zone DEFAULT NULL,
  new_accepted_at timestamp with time zone DEFAULT NULL,
  new_rejected_at timestamp with time zone DEFAULT NULL,
  new_customer_response_note text DEFAULT NULL,
  new_agb_accepted_at timestamp with time zone DEFAULT NULL,
  new_agb_version text DEFAULT NULL,
  new_agb_ip_address text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE public.offers
  SET
    status = COALESCE(new_status, status),
    viewed_at = COALESCE(new_viewed_at, viewed_at),
    accepted_at = COALESCE(new_accepted_at, accepted_at),
    rejected_at = COALESCE(new_rejected_at, rejected_at),
    customer_response_note = COALESCE(new_customer_response_note, customer_response_note),
    agb_accepted_at = COALESCE(new_agb_accepted_at, agb_accepted_at),
    agb_version = COALESCE(new_agb_version, agb_version),
    agb_ip_address = COALESCE(new_agb_ip_address, agb_ip_address),
    updated_at = now()
  WHERE access_token = offer_access_token;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  -- Create a service appointment in calendar on acceptance (idempotent).
  IF affected_rows > 0 AND new_status = 'accepted' THEN
    INSERT INTO public.appointments (
      company_id,
      lead_id,
      offer_id,
      appointment_type,
      status,
      appointment_date,
      start_time,
      end_time,
      duration_minutes,
      all_day,
      location_address,
      location_plz,
      location_city,
      customer_first_name,
      customer_last_name,
      customer_email,
      customer_phone,
      title,
      description,
      internal_notes,
      confirmed_by_customer
    )
    SELECT
      o.company_id,
      o.lead_id,
      o.id,
      'service'::public.appointment_type,
      'pending'::public.appointment_status,
      COALESCE(o.service_date, l.preferred_date, CURRENT_DATE),
      ts.start_time,
      ts.end_time,
      ts.duration_minutes,
      false,
      NULLIF(TRIM(CONCAT(COALESCE(l.from_street, ''), ' ', COALESCE(l.from_house_number, ''))), ''),
      l.from_plz,
      l.from_city,
      o.customer_first_name,
      o.customer_last_name,
      o.customer_email,
      o.customer_phone,
      CONCAT('Auftrag - ', COALESCE(NULLIF(o.title, ''), 'Offerte')),
      o.description,
      'Automatisch aus angenommener Offerte erstellt.',
      true
    FROM public.offers o
    LEFT JOIN public.leads l ON l.id = o.lead_id
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(
          o.service_start_time::time,
          CASE
            WHEN l.preferred_time_slot = 'morning' THEN '08:00:00'::time
            WHEN l.preferred_time_slot = 'afternoon' THEN '13:00:00'::time
            WHEN COALESCE(l.preferred_time_slot, '') ~ '^\d{1,2}:\d{2}' THEN
              substring(l.preferred_time_slot from '(\d{1,2}:\d{2})')::time
            ELSE '09:00:00'::time
          END
        ) AS start_time
    ) start_calc
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(
          o.service_end_time::time,
          (start_calc.start_time + interval '2 hour')::time
        ) AS end_time
    ) end_calc
    CROSS JOIN LATERAL (
      SELECT
        start_calc.start_time AS start_time,
        end_calc.end_time AS end_time,
        CASE
          WHEN end_calc.end_time > start_calc.start_time
            THEN GREATEST(
              15,
              (extract(epoch from (end_calc.end_time - start_calc.start_time)) / 60)::int
            )
          ELSE 120
        END AS duration_minutes
    ) ts
    WHERE o.access_token = offer_access_token
      AND NOT EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.offer_id = o.id
          AND a.appointment_type = 'service'
      );
  END IF;

  RETURN affected_rows > 0;
END;
$$;
