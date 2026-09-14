-- =============================================================================
-- Eine Offerte manuell annehmen — derselbe Weg wie die Zusage ueber den Link
-- =============================================================================
--
-- BEFUND
--
-- Kunden sagen oft am Telefon zu. Die Firma konnte das nirgends festhalten:
-- alles, was eine Zusage ausloest (Status, Auftrag, Kalendertermine ueber
-- `create_appointments_for_auftrag`, Lead `job_confirmed`), stand IN
-- `update_offer_by_token` — und die ruft nur die oeffentliche Seite mit dem
-- Kunden-Token. Die Oberflaeche bietet «Auftrag erstellen» erst ab `accepted`
-- an; die telefonisch zugesagte Offerte blieb auf `sent/viewed` stehen.
-- Gemessen 2026-09-14: 44 von 56 offenen Offerten haben die Annahmefrist
-- bereits hinter sich.
--
-- Zwei weitere Fehler auf demselben Weg (gemessen, Produktion):
--
--   1. Der Auftrag und seine Termine wurden OHNE `language` geschrieben und
--      bekamen den Spaltenvorgabewert 'de'. Die pg_cron-Erinnerungen lesen die
--      Sprache aus der Zeile — eine franzoesische Kundin haette ihre
--      Erinnerung auf Deutsch bekommen. Heute 0 betroffene Zeilen, weil alle
--      30 angenommenen Offerten deutsch sind.
--   2. `offers_update_member` erlaubt jedem Mitglied `status = 'accepted'`
--      direkt. Dieser Weg legt keinen Auftrag an, und der Beweis-Trigger
--      stempelt die IP des Bedieners als «AGB-Zustimmung des Kunden».
--
-- WAS HIER GILT
--
--   * `perform_offer_acceptance(offer, via)` ist die EINE Zusage. Beide
--     Eingaenge rufen sie: `update_offer_by_token` (Kunde, via Link) und das
--     neue `accept_offer_manually` (Firma, Mitgliedschaft geprueft).
--   * `offers.accepted_via` ('customer_link' | 'manual') und `accepted_by`
--     halten fest, WIE zugesagt wurde. Bestehende Zeilen bleiben NULL — wie
--     sie angenommen wurden, weiss heute niemand sicher.
--   * Manuell: keine Annahmefrist (die Firma entscheidet, die Oberflaeche
--     warnt), die Termine werden `confirmed` — der Termin wurde am Telefon
--     besprochen. `agb_accepted_at` und `agb_ip_address` bleiben LEER: der
--     Kunde hat nichts angeklickt, und die IP des Bedieners ist kein Beweis.
--     `agb_version` wird trotzdem gesetzt — sie sagt, welcher AGB-Wortlaut
--     galt.
--   * Der Uebergang nach `accepted` geht nur noch ueber diese Funktion. Sie
--     setzt `app.offer_acceptance` transaktionslokal; der Beweis-Trigger lehnt
--     ohne diesen Merker ab. Ausgenommen sind direkte Sitzungen als
--     `postgres`/`supabase_admin` (Wartung). `session_user`, nicht
--     `current_user`: der Trigger ist SECURITY DEFINER, `current_user` waere
--     dort immer der Eigentuemer.
--   * Auftrag und Termine erben die Sprache der Offerte.
--
-- Der Rumpf von `update_offer_by_token` ist sonst der aus 20260904160000
-- (in der Produktion byte-gleich ausgelesen); Fristregel, Ueberholt-Pruefung
-- und Endzustaende sind unveraendert. Neu ist nur `FOR UPDATE` beim Lesen:
-- zwei gleichzeitige Zusagen warten jetzt aufeinander, statt beide die
-- Endzustands-Pruefung zu bestehen.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Wie wurde zugesagt?
-- -----------------------------------------------------------------------------

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS accepted_via text,
  ADD COLUMN IF NOT EXISTS accepted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_accepted_via_check;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_accepted_via_check
  CHECK (accepted_via IS NULL OR accepted_via IN ('customer_link', 'manual'));

COMMENT ON COLUMN public.offers.accepted_via IS
  'Wie die Zusage kam: customer_link (Kunde auf der Offertenseite) oder manual (Firma, z. B. telefonisch). NULL = vor 2026-09-14, unbekannt.';
COMMENT ON COLUMN public.offers.accepted_by IS
  'Bei accepted_via = manual: der Benutzer, der die Zusage erfasst hat.';

-- -----------------------------------------------------------------------------
-- 2. Die Sperre nach dem Versand kennt die beiden neuen Felder
--
-- Unveraendert gegenueber 20260728190000 bis auf die zwei Eintraege in
-- `erlaubt`: sie gehoeren zur Zusage, nicht zum Inhalt.
-- -----------------------------------------------------------------------------

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
    'accepted_via', 'accepted_by',
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

-- -----------------------------------------------------------------------------
-- 3. Beweis-Trigger: der Kanal entscheidet, was als Beweis gilt — und ohne
--    Kanal gibt es keine Zusage
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_offer_acceptance_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ip      TEXT;
  v_headers JSON;
  v_via     TEXT;
BEGIN
  -- Nur beim Übergang in 'accepted'. Ein erneutes UPDATE derselben Offerte darf
  -- den ursprünglichen Zeitpunkt nicht überschreiben.
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    v_via := NULLIF(current_setting('app.offer_acceptance', true), '');

    IF v_via IS NULL AND session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION
        'Offerte % kann nur ueber update_offer_by_token oder accept_offer_manually angenommen werden.',
        COALESCE(OLD.offer_number::TEXT, OLD.id::TEXT)
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    NEW.accepted_at  := now();
    NEW.accepted_via := v_via;
    NEW.agb_version  := public.agb_content_hash(NEW.access_token);

    IF v_via = 'manual' THEN
      -- Der Kunde hat nichts angeklickt. Welcher AGB-Wortlaut galt, steht in
      -- agb_version; eine Zustimmungszeit oder IP gibt es nicht.
      NEW.accepted_by     := auth.uid();
      NEW.agb_accepted_at := NULL;
      NEW.agb_ip_address  := NULL;
    ELSE
      NEW.accepted_by := NULL;

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
  END IF;

  RETURN NEW;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 4. Der erste Arbeitstag — einmal, fuer Frist und Auftragsdatum
--
-- Wortgleich die Rechnung aus 20260904160000 (`earliestTermin` in
-- `_shared/offerTermin.ts`): je Servicegruppe ihr eigenes Datum, sonst das
-- globale Feld; davon der frueheste.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.offer_arbeitsbeginn(p_offer_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT MIN(COALESCE(g.d, o.service_date))
      FROM (
        SELECT MIN(i.scheduled_date) AS d
        FROM public.offer_items i
        WHERE i.offer_id = o.id
        GROUP BY NULLIF(lower(btrim(COALESCE(i.service_type, ''))), '')
      ) g
    ),
    o.service_date
  )
  FROM public.offers o
  WHERE o.id = p_offer_id;
$function$;

-- -----------------------------------------------------------------------------
-- 5. Die eine Zusage
--
-- Der Aufrufer hat die Zeile gesperrt und Status, Ueberholt und Frist nach
-- SEINER Regel geprueft. Hier wird nur noch einmal abgewiesen, was nie
-- angenommen werden darf.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.perform_offer_acceptance(p_offer_id uuid, p_via text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status        text;
  v_lead_id       uuid;
  v_superseded_at timestamptz;
  v_arbeitsbeginn date;
  v_auftrag_id    uuid;
BEGIN
  IF p_via IS NULL OR p_via NOT IN ('customer_link', 'manual') THEN
    RAISE EXCEPTION 'Invalid acceptance channel: %', p_via
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT status, lead_id, superseded_at
  INTO v_status, v_lead_id, v_superseded_at
  FROM public.offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer_not_found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_superseded_at IS NOT NULL THEN
    RAISE EXCEPTION 'offer_superseded' USING ERRCODE = 'check_violation';
  END IF;
  IF v_status IS DISTINCT FROM 'sent' AND v_status IS DISTINCT FROM 'viewed' THEN
    RAISE EXCEPTION 'offer_not_open' USING ERRCODE = 'check_violation';
  END IF;

  v_arbeitsbeginn := public.offer_arbeitsbeginn(p_offer_id);

  PERFORM set_config('app.offer_acceptance', p_via, true);
  UPDATE public.offers SET status = 'accepted' WHERE id = p_offer_id;
  PERFORM set_config('app.offer_acceptance', '', true);

  INSERT INTO public.auftraege (
    company_id, offer_id, lead_id, auftrag_nummer, title,
    customer_name, customer_first_name, customer_last_name,
    customer_email, customer_phone, from_address, to_address,
    scheduled_date, scheduled_time, description, status,
    subtotal, vat_rate, vat_amount, total,
    service_type, pricing_type, hourly_rate, items, language
  )
  SELECT
    o.company_id,
    o.id,
    o.lead_id,
    '',   -- auftrag_nummer: vom Trigger vergeben
    COALESCE(NULLIF(o.title, ''), 'Auftrag'),
    TRIM(CONCAT(
      COALESCE(o.customer_first_name, ''), ' ',
      COALESCE(o.customer_last_name, '')
    )),
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
    ),
    -- Die Dokumentsprache der Offerte, nicht der Spaltenvorgabewert.
    o.language
  FROM public.offers o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.id = p_offer_id
    AND NOT EXISTS (
      SELECT 1 FROM public.auftraege a
      WHERE a.offer_id = o.id
    )
  RETURNING id INTO v_auftrag_id;

  IF v_auftrag_id IS NULL THEN
    SELECT a.id INTO v_auftrag_id
    FROM public.auftraege a
    WHERE a.offer_id = p_offer_id
    ORDER BY a.created_at
    LIMIT 1;
  END IF;

  UPDATE public.leads
  SET status = 'job_confirmed', updated_at = NOW()
  WHERE id = v_lead_id;

  RETURN v_auftrag_id;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 6. Eingang Kunde: update_offer_by_token
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_offer_by_token(offer_access_token text, new_status text DEFAULT NULL::text, new_viewed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_accepted_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_rejected_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_customer_response_note text DEFAULT NULL::text, new_agb_accepted_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_agb_version text DEFAULT NULL::text, new_agb_ip_address text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_rows         integer;
  v_status              text;
  v_arbeitsbeginn       date;
  v_valid_until         date;
  v_acceptance_deadline date;
  v_offer_id            uuid;
  v_superseded_at       timestamptz;
  ALLOWED_STATUSES      text[] := ARRAY['viewed', 'accepted', 'rejected'];
  TERMINAL_STATUSES     text[] := ARRAY['accepted', 'rejected'];
BEGIN
  IF new_status IS NOT NULL AND NOT (new_status = ANY(ALLOWED_STATUSES)) THEN
    RAISE EXCEPTION 'Invalid status value: %', new_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT status, valid_until, id, superseded_at
  INTO v_status, v_valid_until, v_offer_id, v_superseded_at
  FROM public.offers
  WHERE access_token = offer_access_token
  FOR UPDATE;

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
    -- Die Frist gilt fuer den Kunden. Die Firma entscheidet selbst
    -- (accept_offer_manually prueft sie nicht).
    v_arbeitsbeginn := public.offer_arbeitsbeginn(v_offer_id);
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

  -- Der Status nach `accepted` geht nicht hier, sondern in
  -- perform_offer_acceptance — dort entstehen Auftrag und Termine.
  UPDATE public.offers
  SET
    status                 = CASE WHEN new_status = 'accepted' THEN status ELSE COALESCE(new_status, status) END,
    viewed_at              = COALESCE(new_viewed_at, viewed_at),
    accepted_at            = COALESCE(new_accepted_at, accepted_at),
    rejected_at            = COALESCE(new_rejected_at, rejected_at),
    customer_response_note = COALESCE(new_customer_response_note, customer_response_note),
    agb_accepted_at        = COALESCE(new_agb_accepted_at, agb_accepted_at),
    agb_version            = COALESCE(new_agb_version, agb_version)
    -- agb_ip_address intentionally NOT updated from caller-supplied value
  WHERE id = v_offer_id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 0 THEN
    RETURN false;
  END IF;

  IF new_status = 'accepted' THEN
    PERFORM public.perform_offer_acceptance(v_offer_id, 'customer_link');
  END IF;

  RETURN true;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 7. Eingang Firma: accept_offer_manually
--
-- Jedes Mitglied darf — `offers_update_member` erlaubt jedem Mitglied, die
-- Offerte zu bearbeiten und zu versenden; eine Rollenhuerde nur hier waere
-- willkuerlich. «Gibt es nicht» und «gehoert dir nicht» sind dieselbe Antwort.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_offer_manually(p_offer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_auftrag_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_company_member(v_company_id, auth.uid()) THEN
    RAISE EXCEPTION 'offer_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  v_auftrag_id := public.perform_offer_acceptance(p_offer_id, 'manual');

  -- Der Termin wurde mit dem Kunden besprochen: bestaetigt statt ausstehend.
  UPDATE public.appointments
  SET status             = 'confirmed',
      confirmed_by_firma = true,
      confirmed_at       = now()
  WHERE offer_id = p_offer_id
    AND appointment_type = 'service'
    AND status = 'pending';

  RETURN v_auftrag_id;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 8. Termine erben die Sprache des Auftrags
--
-- Unveraendert gegenueber 20260728120000 bis auf `language` in beiden INSERTs.
-- -----------------------------------------------------------------------------

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
        customer_email, customer_phone, title, description, language
      ) VALUES (
        NEW.company_id, NEW.offer_id, NEW.lead_id, 'service', 'pending',
        v_date, v_start, v_end, false,
        NEW.from_address, v_first, v_last,
        NEW.customer_email, NEW.customer_phone,
        v_label || ' - ' || COALESCE(NULLIF(NEW.title, ''), 'Auftrag'), NEW.description,
        NEW.language
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
      customer_email, customer_phone, title, description, language
    ) VALUES (
      NEW.company_id, NEW.offer_id, NEW.lead_id, 'service', 'pending',
      NEW.scheduled_date, v_start, v_end, false,
      NEW.from_address, v_first, v_last,
      NEW.customer_email, NEW.customer_phone,
      COALESCE(NULLIF(NEW.title, ''), 'Auftrag'), NEW.description,
      NEW.language
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

-- -----------------------------------------------------------------------------
-- 9. Rechte
--
-- Neue Funktionen erben EXECUTE fuer PUBLIC (und ueber die Default-Privilegien
-- fuer anon/authenticated). Die beiden inneren Bausteine sind fuer niemanden
-- von aussen; accept_offer_manually nur fuer angemeldete Benutzer.
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.offer_arbeitsbeginn(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.perform_offer_acceptance(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_offer_manually(uuid)          FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.offer_arbeitsbeginn(uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION public.perform_offer_acceptance(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_offer_manually(uuid)          TO authenticated, service_role;

-- Nachweis: fail closed.
DO $pruefung$
BEGIN
  IF has_function_privilege('anon', 'public.perform_offer_acceptance(uuid, text)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.perform_offer_acceptance(uuid, text)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'perform_offer_acceptance ist von aussen ausfuehrbar';
  END IF;
  IF has_function_privilege('anon', 'public.offer_arbeitsbeginn(uuid)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.offer_arbeitsbeginn(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'offer_arbeitsbeginn ist von aussen ausfuehrbar';
  END IF;
  IF has_function_privilege('anon', 'public.accept_offer_manually(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'accept_offer_manually ist fuer anon ausfuehrbar';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.accept_offer_manually(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'accept_offer_manually ist fuer authenticated nicht ausfuehrbar';
  END IF;
  -- Gegenprobe: der Kundenzugang bleibt offen.
  IF NOT has_function_privilege('anon', 'public.update_offer_by_token(text,text,timestamptz,timestamptz,timestamptz,text,timestamptz,text,text)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'update_offer_by_token ist fuer anon nicht mehr ausfuehrbar — der Kundenzugang waere zerstoert';
  END IF;
END
$pruefung$;

COMMIT;
