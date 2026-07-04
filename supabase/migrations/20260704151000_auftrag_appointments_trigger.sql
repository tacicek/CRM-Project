-- Accept → calendar integration (feature spec 2026-07-04, design decision 3).
-- Appointment creation lives in an AFTER INSERT trigger on auftraege — NOT inside
-- update_offer_by_token — so RPC rewrites cannot silently drop the side effect.
--
--  * ≥2 service_type groups on the linked offer → ONE appointment PER group; date/time =
--    the group's scheduled_* (MIN() — the group invariant guarantees a single value),
--    NULL → fallback to the auftrag's primary date (same fallback rule as the renderers).
--  * single group / no groups → one appointment (auftrag primary date), title unchanged.
--  * Manual aufträge (offer_id IS NULL) are skipped — AuftragModal creates and links its
--    own appointment.
--  * Idempotent: an existing 'service' appointment for the offer (e.g. created by
--    AuftragModal, which also sets offer_id) suppresses creation entirely.
--  * Non-blocking: any error only WARNs — appointment failure must never block the
--    auftrag INSERT (customer acceptance).
--  * auftraege.appointment_id is linked to the FIRST created appointment so the existing
--    status-sync trigger (trg_sync_auftrag_status_to_appointment) keeps working.

CREATE OR REPLACE FUNCTION public.create_appointments_for_auftrag()
RETURNS trigger
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

  v_first := split_part(COALESCE(NEW.customer_name, ''), ' ', 1);
  v_last  := NULLIF(TRIM(substr(COALESCE(NEW.customer_name, ''), length(v_first) + 1)), '');

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
        NEW.from_address, NULLIF(v_first, ''), v_last,
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
      NEW.from_address, NULLIF(v_first, ''), v_last,
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

DROP TRIGGER IF EXISTS trg_create_appointments_for_auftrag ON public.auftraege;
CREATE TRIGGER trg_create_appointments_for_auftrag
AFTER INSERT ON public.auftraege
FOR EACH ROW EXECUTE FUNCTION public.create_appointments_for_auftrag();
