--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'super_admin',
    'admin',
    'moderator',
    'user'
);


--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status AS ENUM (
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'rescheduled',
    'no_show'
);


--
-- Name: appointment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_type AS ENUM (
    'besichtigung',
    'service',
    'follow_up',
    'meeting',
    'blocked'
);


--
-- Name: auftrag_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.auftrag_status AS ENUM (
    'geplant',
    'bestaetigt',
    'in_bearbeitung',
    'abgeschlossen',
    'storniert'
);


--
-- Name: box_rental_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.box_rental_status AS ENUM (
    'reserved',
    'delivered',
    'in_use',
    'pickup_requested',
    'pickup_scheduled',
    'returned',
    'lost',
    'damaged'
);


--
-- Name: clearance_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.clearance_scope AS ENUM (
    'complete',
    'partial'
);


--
-- Name: condition_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.condition_level AS ENUM (
    'normal',
    'dirty',
    'very_dirty',
    'extreme'
);


--
-- Name: lead_sharing_preference; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_sharing_preference AS ENUM (
    'only_1',
    'only_3',
    'only_5',
    'both',
    'only_4'
);


--
-- Name: raeumungs_art; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.raeumungs_art AS ENUM (
    'household_dissolution',
    'apartment_clearance',
    'house_clearance',
    'decluttering',
    'death_clearance',
    'estate_clearance',
    'hoarder_clearance',
    'forced_eviction',
    'cellar_clearance',
    'attic_clearance',
    'garage_clearance',
    'office_clearance',
    'company_dissolution',
    'storage_clearance'
);


--
-- Name: requester_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.requester_role AS ENUM (
    'owner',
    'tenant',
    'property_manager',
    'heir',
    'landlord',
    'authority',
    'other'
);


--
-- Name: support_ticket_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.support_ticket_category AS ENUM (
    'technical',
    'billing',
    'feature_request',
    'bug_report',
    'general',
    'account'
);


--
-- Name: support_ticket_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.support_ticket_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


--
-- Name: support_ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.support_ticket_status AS ENUM (
    'open',
    'in_progress',
    'answered',
    'closed'
);


--
-- Name: umzugsbox_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.umzugsbox_type AS ENUM (
    'standard',
    'wardrobe',
    'book',
    'fragile',
    'archive',
    'other'
);


--
-- Name: urgency_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.urgency_level AS ENUM (
    'normal',
    'urgent',
    'very_urgent',
    'emergency'
);


--
-- Name: activate_manual_import(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_manual_import(p_company_id uuid, p_admin_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_company RECORD;
  v_subscription_id UUID;
  v_monthly_fee INTEGER;
BEGIN
  -- Get company and check token balance
  SELECT id, company_name, token_balance, manual_import_enabled, COALESCE(manual_import_monthly_fee, 20) as monthly_fee
  INTO v_company
  FROM public.companies
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company not found');
  END IF;
  
  v_monthly_fee := v_company.monthly_fee;
  
  IF v_company.manual_import_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Manual import already enabled');
  END IF;
  
  IF v_company.token_balance < v_monthly_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient token balance', 'required', v_monthly_fee, 'available', v_company.token_balance);
  END IF;
  
  -- Deduct tokens
  UPDATE public.companies
  SET 
    token_balance = token_balance - v_monthly_fee,
    manual_import_enabled = true,
    manual_import_activated_at = NOW(),
    manual_import_next_billing_at = NOW() + INTERVAL '30 days'
  WHERE id = p_company_id;
  
  -- Create subscription record
  INSERT INTO public.manual_import_subscriptions (
    company_id,
    status,
    monthly_tokens,
    activated_by,
    activated_at,
    expires_at
  ) VALUES (
    p_company_id,
    'active',
    v_monthly_fee,
    p_admin_id,
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_subscription_id;
  
  -- Log token transaction
  INSERT INTO public.token_transactions (
    company_id,
    amount,
    transaction_type,
    description,
    balance_after
  ) VALUES (
    p_company_id,
    -v_monthly_fee,
    'subscription',
    'Manuelle Anfrage Import - Monatsgebühr',
    v_company.token_balance - v_monthly_fee
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'subscription_id', v_subscription_id,
    'tokens_deducted', v_monthly_fee,
    'expires_at', NOW() + INTERVAL '30 days'
  );
END;
$$;


--
-- Name: activate_self_trial(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_self_trial(p_days integer DEFAULT 14) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_company_id UUID;
  v_trial_used BOOLEAN;
  v_new_expires TIMESTAMPTZ;
BEGIN
  -- Find the company of the calling user
  SELECT id, trial_used
    INTO v_company_id, v_trial_used
    FROM public.companies
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Company not found');
  END IF;

  IF v_trial_used THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Trial bereits verwendet');
  END IF;

  v_new_expires := NOW() + (p_days || ' days')::INTERVAL;

  UPDATE public.companies
  SET
    crm_enabled             = TRUE,
    subscription_type       = 'trial',
    subscription_expires_at = v_new_expires,
    trial_used              = TRUE,
    trial_granted_at        = NOW(),
    crm_enabled_at          = COALESCE(crm_enabled_at, NOW()),
    last_reminder_sent_at   = NULL,
    last_reminder_type      = NULL
  WHERE id = v_company_id;

  RETURN jsonb_build_object(
    'success',      TRUE,
    'company_id',   v_company_id,
    'expires_at',   v_new_expires
  );
END;
$$;


--
-- Name: FUNCTION activate_self_trial(p_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.activate_self_trial(p_days integer) IS 'Company owner: activates a one-time free trial (blocked if trial_used=TRUE)';


--
-- Name: agb_content_hash(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agb_content_hash(p_access_token text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN COUNT(*) = 0 THEN NULL
    -- Reihenfolge und Trennzeichen gehören zum Hash: sonst ergäben zwei
    -- unterschiedliche Klauselfolgen denselben Wert.
    ELSE encode(
      sha256(convert_to(string_agg(s.title || E'\n' || s.content, E'\n---\n' ORDER BY s.display_order), 'UTF8')),
      'hex'
    )
  END
  FROM public.get_agb_sections_by_offer_token(p_access_token, NULL) s;
$$;


--
-- Name: FUNCTION agb_content_hash(p_access_token text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.agb_content_hash(p_access_token text) IS 'SHA-256 ueber den Wortlaut aller aktiven AGB-Klauseln der Firma zu dieser Offerte. Beweismittel: aendert sich der Text, aendert sich der Hash.';


--
-- Name: appointments_set_customer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.appointments_set_customer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_res JSONB;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.offer_id IS NOT NULL THEN
    SELECT o.customer_id INTO NEW.customer_id
    FROM public.offers o WHERE o.id = NEW.offer_id AND o.company_id = NEW.company_id;
  END IF;

  IF NEW.customer_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT l.customer_id INTO NEW.customer_id
    FROM public.leads l WHERE l.id = NEW.lead_id AND l.company_id = NEW.company_id;
  END IF;

  IF NEW.customer_id IS NULL THEN
    v_res := public.resolve_or_create_customer(
      NEW.company_id, NEW.customer_email, NEW.customer_phone,
      NEW.customer_first_name, NEW.customer_last_name, NULL,
      NULL, NEW.language, 'termin', COALESCE(NEW.created_at, NOW()));
    NEW.customer_id := NULLIF(v_res ->> 'customer_id', '')::UUID;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'appointments_set_customer: % (Termin wird trotzdem gespeichert)', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: archive_and_purge_company_data(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_and_purge_company_data(p_company_id uuid, p_retention_days integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cutoff        TIMESTAMPTZ;
  v_log_id        UUID;
  v_offer_ids     UUID[];
  v_appt_ids      UUID[];
  v_skipped       INTEGER := 0;
  v_offers_data   JSONB;
  v_appts_data    JSONB;
  v_offers_count  INTEGER := 0;
  v_appts_count   INTEGER := 0;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Nur der Eigentuemer darf archivieren'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_retention_days IS NULL OR p_retention_days < 30 THEN
    RAISE EXCEPTION 'Aufbewahrung muss mindestens 30 Tage betragen'
      USING ERRCODE = 'check_violation';
  END IF;

  v_cutoff := NOW() - (p_retention_days || ' days')::INTERVAL;

  -- Offerten OHNE Buchhaltungsbezug. Die uebrigen bleiben stehen: ein
  -- SET-NULL-Fremdschluessel wuerde die Rechnung von ihrer Offerte trennen.
  SELECT array_agg(o.id) INTO v_offer_ids
  FROM public.offers o
  WHERE o.company_id = p_company_id
    AND o.created_at < v_cutoff
    AND o.status IN ('sent', 'rejected', 'expired')
    AND NOT EXISTS (SELECT 1 FROM public.rechnungen r WHERE r.offer_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM public.quittungen q WHERE q.offer_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM public.auftraege a WHERE a.offer_id = o.id);

  SELECT COUNT(*) INTO v_skipped
  FROM public.offers o
  WHERE o.company_id = p_company_id
    AND o.created_at < v_cutoff
    AND o.status IN ('sent', 'rejected', 'expired', 'accepted')
    AND NOT (o.id = ANY(COALESCE(v_offer_ids, ARRAY[]::UUID[])));

  SELECT array_agg(a.id) INTO v_appt_ids
  FROM public.appointments a
  WHERE a.company_id = p_company_id
    AND a.created_at < v_cutoff
    AND a.status IN ('completed', 'cancelled');

  IF v_offer_ids IS NULL AND v_appt_ids IS NULL THEN
    RETURN jsonb_build_object('offerten', 0, 'termine', 0, 'uebersprungen', v_skipped, 'log_id', NULL);
  END IF;

  -- Werte aus den CHECK-Constraints der Tabelle: archive_type ∈ {…, custom},
  -- triggered_by ∈ {manual, auto, scheduled}, storage_type ist NOT NULL.
  -- Die Sicherung liegt als JSONB in archive_snapshots, also 'local'.
  INSERT INTO public.archive_logs (
    archive_name, archive_type, storage_type, status, triggered_by,
    triggered_by_user_id, data_to_date, source_data_deleted, deleted_at
  )
  VALUES (
    'Manuelle Archivierung ' || to_char(NOW(), 'YYYY-MM-DD HH24:MI'),
    'custom', 'local', 'in_progress', 'manual',
    auth.uid(), v_cutoff, true, NOW()
  )
  RETURNING id INTO v_log_id;

  -- Sicherung VOR dem Loeschen, mit Bezug zum Log und kryptografischer Summe.
  IF v_offer_ids IS NOT NULL THEN
    SELECT jsonb_agg(to_jsonb(o)), COUNT(*) INTO v_offers_data, v_offers_count
    FROM public.offers o WHERE o.id = ANY(v_offer_ids);

    INSERT INTO public.archive_snapshots (archive_log_id, chunk_number, total_chunks, data, record_count, checksum)
    VALUES (v_log_id, 1, 1, v_offers_data, v_offers_count,
            encode(sha256(convert_to(v_offers_data::text, 'UTF8')), 'hex'));

    DELETE FROM public.offers WHERE id = ANY(v_offer_ids);
  END IF;

  IF v_appt_ids IS NOT NULL THEN
    SELECT jsonb_agg(to_jsonb(a)), COUNT(*) INTO v_appts_data, v_appts_count
    FROM public.appointments a WHERE a.id = ANY(v_appt_ids);

    INSERT INTO public.archive_snapshots (archive_log_id, chunk_number, total_chunks, data, record_count, checksum)
    VALUES (v_log_id, 2, 2, v_appts_data, v_appts_count,
            encode(sha256(convert_to(v_appts_data::text, 'UTF8')), 'hex'));

    DELETE FROM public.appointments WHERE id = ANY(v_appt_ids);
  END IF;

  UPDATE public.archive_logs
  SET status = 'completed', records_archived = v_offers_count + v_appts_count
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'offerten',      v_offers_count,
    'termine',       v_appts_count,
    'uebersprungen', v_skipped,
    'log_id',        v_log_id
  );
END;
$$;


--
-- Name: FUNCTION archive_and_purge_company_data(p_company_id uuid, p_retention_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.archive_and_purge_company_data(p_company_id uuid, p_retention_days integer) IS 'Sichert und loescht alte Offerten und Termine EINER Firma in einer Transaktion. Offerten mit Rechnung, Quittung oder Auftrag bleiben stehen. Nur fuer die Rolle owner.';


--
-- Name: archive_returned_boxes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_returned_boxes() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Archive boxes that were returned more than 3 months ago and not yet archived
  UPDATE umzugsbox_rentals
  SET archived_at = now()
  WHERE status IN ('returned', 'lost', 'damaged')
    AND actual_return_date IS NOT NULL
    AND actual_return_date < CURRENT_DATE - INTERVAL '3 months'
    AND archived_at IS NULL;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;


--
-- Name: FUNCTION archive_returned_boxes(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.archive_returned_boxes() IS 'Archives returned boxes older than 3 months. Should be run daily via cron.';


--
-- Name: atomic_adjust_token_balance(uuid, numeric, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atomic_adjust_token_balance(p_company_id uuid, p_amount numeric, p_type text, p_description text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_payment_reference text DEFAULT NULL::text, p_reference_type text DEFAULT NULL::text, p_reference_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- Lock the company row to prevent concurrent balance modifications
  SELECT token_balance INTO v_current_balance
  FROM public.companies
  WHERE id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Company not found'
    );
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);
  v_new_balance := v_current_balance + p_amount;

  -- Prevent negative balance on debits
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'current_balance', v_current_balance,
      'requested_amount', p_amount
    );
  END IF;

  -- Atomic update
  UPDATE public.companies
  SET token_balance = v_new_balance
  WHERE id = p_company_id;

  -- Record transaction
  -- Cast p_reference_id to UUID since the column is UUID type
  INSERT INTO public.token_transactions (
    company_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    payment_method,
    payment_reference,
    reference_type,
    reference_id
  ) VALUES (
    p_company_id,
    p_type,
    p_amount,
    v_current_balance,
    v_new_balance,
    p_description,
    p_payment_method,
    p_payment_reference,
    p_reference_type,
    CASE WHEN p_reference_id IS NOT NULL AND p_reference_id != '' THEN p_reference_id::UUID ELSE NULL END
  );

  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
END;
$$;


--
-- Name: atomic_confirm_lead(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atomic_confirm_lead(p_confirmation_id uuid, p_lead_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.lead_confirmations
     SET confirmed_at = now()
   WHERE id = p_confirmation_id;

  UPDATE public.leads
     SET status = 'pending_verification',
         updated_at = now()
   WHERE id = p_lead_id
     AND status = 'awaiting_customer_confirmation';
END;
$$;


--
-- Name: auftraege_set_customer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auftraege_set_customer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_res JSONB;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.offer_id IS NOT NULL THEN
    SELECT o.customer_id INTO NEW.customer_id
    FROM public.offers o WHERE o.id = NEW.offer_id AND o.company_id = NEW.company_id;
  END IF;

  IF NEW.customer_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT l.customer_id INTO NEW.customer_id
    FROM public.leads l WHERE l.id = NEW.lead_id AND l.company_id = NEW.company_id;
  END IF;

  IF NEW.customer_id IS NULL THEN
    v_res := public.resolve_or_create_customer(
      NEW.company_id, NEW.customer_email, NEW.customer_phone,
      -- Seit 20260728120000 traegt der Auftrag die Trennung selbst.
      NEW.customer_first_name, NEW.customer_last_name, NULL,
      NULL, NEW.language, 'auftrag', COALESCE(NEW.created_at, NOW()));
    NEW.customer_id := NULLIF(v_res ->> 'customer_id', '')::UUID;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auftraege_set_customer: % (Auftrag wird trotzdem gespeichert)', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: auftraege_set_locations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auftraege_set_locations() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.from_location_id := COALESCE(
    NEW.from_location_id,
    public.resolve_or_create_location(NEW.company_id, NEW.customer_id,
                                      NEW.from_address, 'from', 'manual'));
  NEW.to_location_id := COALESCE(
    NEW.to_location_id,
    public.resolve_or_create_location(NEW.company_id, NEW.customer_id,
                                      NEW.to_address, 'to', 'manual'));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ein fehlender Ortsbezug darf niemals einen Auftrag verhindern. Der
  -- Backfill sammelt liegengebliebene Zeilen spaeter ein; dieselbe
  -- Sicherheitslinie wie beim Kundenbezug.
  RAISE WARNING 'Ortsbezug fuer Auftrag nicht aufloesbar: %', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: beleg_set_customer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.beleg_set_customer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_res   JSONB;
  v_first TEXT;
  v_last  TEXT;
  v_head  TEXT;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.auftrag_id IS NOT NULL THEN
    SELECT a.customer_id INTO NEW.customer_id
    FROM public.auftraege a WHERE a.id = NEW.auftrag_id AND a.company_id = NEW.company_id;
  END IF;

  IF NEW.customer_id IS NULL AND NEW.offer_id IS NOT NULL THEN
    SELECT o.customer_id INTO NEW.customer_id
    FROM public.offers o WHERE o.id = NEW.offer_id AND o.company_id = NEW.company_id;
  END IF;

  IF NEW.customer_id IS NULL THEN
    -- Beleg fuehrt nur einen zusammengesetzten Namen. Er wird NICHT zerlegt —
    -- das waere genau der Fehler, den 20260728120000 abgestellt hat. Ohne Beleg
    -- fuer die Trennung geht der ganze Name als Nachname in die Identitaet; die
    -- Anzeige entsteht daraus unveraendert.
    v_head  := NULLIF(TRIM(COALESCE(NEW.customer_name, '')), '');
    v_first := NULL;
    v_last  := v_head;

    v_res := public.resolve_or_create_customer(
      NEW.company_id, NEW.customer_email, NEW.customer_phone,
      v_first, v_last, NULL, NULL, NEW.language, TG_TABLE_NAME,
      COALESCE(NEW.created_at, NOW()));
    NEW.customer_id := NULLIF(v_res ->> 'customer_id', '')::UUID;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'beleg_set_customer (%): % (Beleg wird trotzdem gespeichert)', TG_TABLE_NAME, SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: calculate_appointment_duration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_appointment_duration() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


--
-- Name: calculate_distance_km(numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_distance_km(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  earth_radius_km DECIMAL := 6371;
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);
  
  a := SIN(dlat / 2) * SIN(dlat / 2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlon / 2) * SIN(dlon / 2);
  
  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
  
  RETURN earth_radius_km * c;
END;
$$;


--
-- Name: calculate_lead_spam_score(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_lead_spam_score() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  ip_count_24h INTEGER := 0;
  email_count_24h INTEGER := 0;
  phone_count_24h INTEGER := 0;
  calculated_score INTEGER := 0;
  is_blacklisted BOOLEAN := false;
  blacklist_reason TEXT := NULL;
BEGIN
  IF NEW.ip_address IS NOT NULL AND NEW.ip_address != '' THEN
    SELECT true, reason INTO is_blacklisted, blacklist_reason
    FROM public.ip_blacklist
    WHERE ip_address = NEW.ip_address
    LIMIT 1;

    IF is_blacklisted THEN
      NEW.status := 'rejected';
      NEW.rejection_reason := 'IP-Adresse auf Blacklist: ' || COALESCE(blacklist_reason, 'Spam');
      NEW.spam_score := 100;

      UPDATE public.ip_blacklist
      SET blocked_count = blocked_count + 1, updated_at = now()
      WHERE ip_address = NEW.ip_address;

      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO ip_count_24h
    FROM public.leads
    WHERE ip_address = NEW.ip_address
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND id != NEW.id;

    calculated_score := calculated_score + (ip_count_24h * 2);
  END IF;

  IF NEW.customer_email IS NOT NULL THEN
    SELECT COUNT(*) INTO email_count_24h
    FROM public.leads
    WHERE LOWER(customer_email) = LOWER(NEW.customer_email)
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND id != NEW.id;

    calculated_score := calculated_score + (email_count_24h * 3);
  END IF;

  IF NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '' THEN
    SELECT COUNT(*) INTO phone_count_24h
    FROM public.leads
    WHERE customer_phone = NEW.customer_phone
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND id != NEW.id;

    calculated_score := calculated_score + (phone_count_24h * 2);
  END IF;

  IF NEW.description IS NOT NULL AND LENGTH(NEW.description) < 10 THEN
    calculated_score := calculated_score + 1;
  END IF;

  IF NEW.preferred_date IS NULL THEN
    calculated_score := calculated_score + 1;
  END IF;

  NEW.spam_score := calculated_score;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION calculate_lead_spam_score(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_lead_spam_score() IS 'Computes spam_score on insert; blacklist auto-reject only. Lead distribution requires admin verification.';


--
-- Name: calculate_min_token_price(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_min_token_price(p_service_type text, p_max_companies integer DEFAULT 3) RETURNS integer
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_acquisition RECORD;
  v_lead_cost NUMERIC;
  v_exclusivity_mult NUMERIC;
  v_min_tokens INTEGER;
BEGIN
  -- Get acquisition costs for this service
  SELECT * INTO v_acquisition
  FROM public.service_acquisition_costs
  WHERE service_type = p_service_type AND is_active = true;
  
  IF v_acquisition IS NULL THEN
    -- Default fallback
    RETURN 30;
  END IF;
  
  -- Calculate blended lead acquisition cost
  -- (organic leads are free, paid leads cost CPC/conversion_rate)
  v_lead_cost := (1 - v_acquisition.organic_lead_ratio) * 
                 (v_acquisition.google_ads_cpc_chf / v_acquisition.conversion_rate);
  
  -- Apply exclusivity multiplier
  v_exclusivity_mult := CASE p_max_companies
    WHEN 1 THEN 2.5  -- Exklusiv: 2.5x
    WHEN 3 THEN 1.5  -- Standard: 1.5x
    ELSE 1.0         -- Shared: 1.0x
  END;
  
  -- Calculate minimum profitable price
  v_min_tokens := CEIL(v_lead_cost * v_acquisition.min_profit_margin * v_exclusivity_mult);
  
  -- Ensure minimum of 25 tokens
  RETURN GREATEST(v_min_tokens, 25);
END;
$$;


--
-- Name: FUNCTION calculate_min_token_price(p_service_type text, p_max_companies integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_min_token_price(p_service_type text, p_max_companies integer) IS 'Calculates minimum profitable token price based on acquisition costs and exclusivity';


--
-- Name: can_modify_role(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_modify_role(modifier_id uuid, target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  modifier_role TEXT;
  modifier_level INTEGER;
  target_role TEXT;
  target_level INTEGER;
BEGIN
  -- Get modifier's role and level
  SELECT role::text INTO modifier_role
  FROM user_roles
  WHERE user_id = modifier_id
  ORDER BY get_role_level(role::text) DESC
  LIMIT 1;
  
  IF modifier_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  modifier_level := get_role_level(modifier_role);
  
  -- Only super_admin can modify roles
  IF modifier_level < 100 THEN
    RETURN FALSE;
  END IF;
  
  -- Get target's role and level
  SELECT role::text INTO target_role
  FROM user_roles
  WHERE user_id = target_user_id
  ORDER BY get_role_level(role::text) DESC
  LIMIT 1;
  
  -- If target has no role, allow (new user)
  IF target_role IS NULL THEN
    RETURN TRUE;
  END IF;
  
  target_level := get_role_level(target_role);
  
  -- Cannot modify users at same or higher level (except yourself)
  IF target_level >= modifier_level AND modifier_id != target_user_id THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;


--
-- Name: check_besichtigung_storage_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_besichtigung_storage_access(folder_token text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'besichtigung'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM besichtigung.sessions s
    WHERE s.token = folder_token
      AND s.company_id IN (
        SELECT c.id
        FROM public.companies c
        WHERE c.user_id = auth.uid()
        UNION
        SELECT tm.company_id
        FROM public.team_members tm
        WHERE tm.user_id = auth.uid()
          AND s.status = 'active'
      )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;


--
-- Name: cleanup_archived_boxes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_archived_boxes() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete boxes that have been archived for more than 3 months
  DELETE FROM umzugsbox_rentals
  WHERE archived_at IS NOT NULL
    AND archived_at < CURRENT_DATE - INTERVAL '3 months';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_archived_boxes(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_archived_boxes() IS 'Deletes archived boxes older than 3 months. Should be run daily via cron after archive_returned_boxes().';


--
-- Name: cleanup_expired_besichtigung_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_besichtigung_data() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_expired_ids UUID[];
  v_storage_paths TEXT[];
  v_deleted_sessions INTEGER := 0;
  v_deleted_photos INTEGER := 0;
BEGIN
  -- Find expired sessions
  SELECT ARRAY_AGG(id) INTO v_expired_ids
  FROM besichtigung.sessions
  WHERE data_expires_at < NOW();

  IF v_expired_ids IS NULL OR array_length(v_expired_ids, 1) IS NULL THEN
    RETURN json_build_object(
      'deleted_sessions', 0,
      'deleted_photos', 0,
      'storage_paths', '[]'::json
    );
  END IF;

  -- Collect all storage paths BEFORE deleting (needed for storage cleanup)
  SELECT ARRAY_AGG(p.storage_path) INTO v_storage_paths
  FROM besichtigung.photos p
  WHERE p.session_id = ANY(v_expired_ids);

  -- Count photos
  SELECT COUNT(*) INTO v_deleted_photos
  FROM besichtigung.photos
  WHERE session_id = ANY(v_expired_ids);

  -- Delete sessions (CASCADE will handle photos, videos, ai_analysis)
  DELETE FROM besichtigung.sessions
  WHERE id = ANY(v_expired_ids);
  GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

  RETURN json_build_object(
    'deleted_sessions', v_deleted_sessions,
    'deleted_photos', v_deleted_photos,
    'storage_paths', COALESCE(to_json(v_storage_paths), '[]'::json)
  );
END;
$$;


--
-- Name: cleanup_inbound_emails(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_inbound_emails(p_rejected_days integer DEFAULT 14, p_failed_days integer DEFAULT 30, p_converted_days integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.inbound_emails
  WHERE (processing_status = 'rejected'
         AND created_at < NOW() - (p_rejected_days  || ' days')::INTERVAL)
     OR (processing_status = 'failed'
         AND created_at < NOW() - (p_failed_days    || ' days')::INTERVAL)
     OR (processing_status = 'lead_created'
         AND created_at < NOW() - (p_converted_days || ' days')::INTERVAL);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: FUNCTION cleanup_inbound_emails(p_rejected_days integer, p_failed_days integer, p_converted_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_inbound_emails(p_rejected_days integer, p_failed_days integer, p_converted_days integer) IS 'Aufbewahrung: rejected 14 Tage, failed 30 Tage, lead_created 90 Tage. needs_review bleibt unangetastet — der erzeugte Lead selbst wird nie gelöscht.';


--
-- Name: communication_retention(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.communication_retention() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_n INTEGER;
BEGIN
  UPDATE public.communication_messages
  SET preview = NULL
  WHERE preview IS NOT NULL
    AND occurred_at < NOW() - INTERVAL '24 months';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('geleert', v_n);
END;
$$;


--
-- Name: communication_thread_fortschreiben(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.communication_thread_fortschreiben() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.communication_threads t
  SET last_message_at = GREATEST(COALESCE(t.last_message_at, NEW.occurred_at), NEW.occurred_at),
      last_direction  = NEW.direction,
      first_unanswered_at = CASE
        WHEN NEW.direction = 'outbound' THEN NULL
        ELSE COALESCE(t.first_unanswered_at, NEW.occurred_at)
      END,
      status = CASE
        WHEN t.status = 'erledigt' AND NEW.direction = 'inbound' THEN 'offen'
        WHEN NEW.direction = 'outbound' THEN 'wartet_auf_kunde'
        ELSE t.status
      END
  WHERE t.id = NEW.thread_id;
  RETURN NULL;
END;
$$;


--
-- Name: companies_ensure_owner_membership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.companies_ensure_owner_membership() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ON CONFLICT DO NOTHING statt einer Existenzpruefung: zwei gleichzeitige
  -- Anlagen laufen so hintereinander durch, ohne dass eine scheitert.
  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION companies_ensure_owner_membership(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.companies_ensure_owner_membership() IS 'Legt die owner-Mitgliedschaft zusammen mit der Firma an. Ohne sie sieht der Eigentuemer in der Anwendung nichts — alle Policies und die Firmenaufloesung gehen ueber company_members, nicht ueber companies.user_id.';


--
-- Name: consume_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_rate_limit(p_key text, p_window_ms integer, p_max_requests integer) RETURNS TABLE(is_limited boolean, remaining integer, reset_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window_interval INTERVAL := make_interval(secs => p_window_ms / 1000.0);
  v_record public.edge_rate_limits%ROWTYPE;
  v_count INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 OR p_window_ms <= 0 OR p_max_requests <= 0 THEN
    RETURN QUERY SELECT FALSE, p_max_requests, v_now;
    RETURN;
  END IF;

  INSERT INTO public.edge_rate_limits (key, window_started_at, request_count, updated_at)
  VALUES (p_key, v_now, 1, v_now)
  ON CONFLICT (key) DO NOTHING;

  SELECT * INTO v_record
  FROM public.edge_rate_limits
  WHERE key = p_key
  FOR UPDATE;

  IF v_record.window_started_at + v_window_interval <= v_now THEN
    v_count := 1;
    v_reset_at := v_now + v_window_interval;
    UPDATE public.edge_rate_limits
    SET window_started_at = v_now,
        request_count = v_count,
        updated_at = v_now
    WHERE key = p_key;
  ELSE
    v_count := v_record.request_count + 1;
    v_reset_at := v_record.window_started_at + v_window_interval;
    UPDATE public.edge_rate_limits
    SET request_count = v_count,
        updated_at = v_now
    WHERE key = p_key;
  END IF;

  RETURN QUERY
  SELECT
    (v_count > p_max_requests) AS is_limited,
    GREATEST(p_max_requests - LEAST(v_count, p_max_requests), 0) AS remaining,
    v_reset_at;
END;
$$;


--
-- Name: create_appointment_from_lead(uuid, uuid, character varying, date, time without time zone, time without time zone, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_appointment_from_lead(p_lead_id uuid, p_company_id uuid, p_appointment_type character varying DEFAULT 'besichtigung'::character varying, p_appointment_date date DEFAULT NULL::date, p_start_time time without time zone DEFAULT '09:00:00'::time without time zone, p_end_time time without time zone DEFAULT '10:00:00'::time without time zone, p_title character varying DEFAULT NULL::character varying) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lead RECORD;
  v_appointment_id UUID;
  v_default_date DATE;
  v_final_title VARCHAR;
BEGIN
  -- Get lead data
  SELECT 
    id,
    customer_first_name,
    customer_last_name,
    customer_email,
    customer_phone,
    from_street,
    from_house_number,
    from_plz,
    from_city,
    service_type,
    preferred_date
  INTO v_lead
  FROM leads
  WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  
  -- Use preferred_date if no date provided
  IF p_appointment_date IS NULL THEN
    v_default_date := COALESCE(v_lead.preferred_date::date, CURRENT_DATE + INTERVAL '3 days');
  ELSE
    v_default_date := p_appointment_date;
  END IF;
  
  -- Generate title if not provided
  IF p_title IS NULL THEN
    v_final_title := CASE p_appointment_type
      WHEN 'besichtigung' THEN 'Besichtigung'
      WHEN 'service' THEN 'Umzug'
      ELSE 'Termin'
    END || ' - ' || COALESCE(v_lead.customer_first_name, '') || ' ' || COALESCE(v_lead.customer_last_name, '');
  ELSE
    v_final_title := p_title;
  END IF;
  
  -- Create the appointment
  INSERT INTO appointments (
    company_id,
    lead_id,
    appointment_type,
    status,
    appointment_date,
    start_time,
    end_time,
    title,
    location_address,
    location_plz,
    location_city,
    customer_first_name,
    customer_last_name,
    customer_email,
    customer_phone
  ) VALUES (
    p_company_id,
    p_lead_id,
    p_appointment_type,
    'pending',
    v_default_date,
    p_start_time,
    p_end_time,
    v_final_title,
    TRIM(COALESCE(v_lead.from_street, '') || ' ' || COALESCE(v_lead.from_house_number, '')),
    v_lead.from_plz,
    v_lead.from_city,
    v_lead.customer_first_name,
    v_lead.customer_last_name,
    v_lead.customer_email,
    v_lead.customer_phone
  ) RETURNING id INTO v_appointment_id;
  
  RETURN v_appointment_id;
END;
$$;


--
-- Name: create_appointments_for_auftrag(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_appointments_for_auftrag() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: create_archive_log(text, text, integer, text, text, text, text, uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_archive_log(p_archive_name text, p_archive_type text, p_records_count integer, p_storage_type text, p_storage_path text, p_export_format text DEFAULT 'json'::text, p_triggered_by text DEFAULT 'manual'::text, p_user_id uuid DEFAULT NULL::uuid, p_data_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_data_to timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.archive_logs (
    archive_name,
    archive_type,
    records_archived,
    storage_type,
    storage_path,
    export_format,
    triggered_by,
    triggered_by_user_id,
    data_from_date,
    data_to_date,
    status
  ) VALUES (
    p_archive_name,
    p_archive_type,
    p_records_count,
    p_storage_type,
    p_storage_path,
    p_export_format,
    p_triggered_by,
    p_user_id,
    p_data_from,
    p_data_to,
    'completed'
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


--
-- Name: create_besichtigung_session(uuid, text, text, text, uuid, uuid, text, text, text, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_besichtigung_session(p_company_id uuid, p_customer_name text, p_customer_email text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_lead_id uuid DEFAULT NULL::uuid, p_offer_id uuid DEFAULT NULL::uuid, p_from_address text DEFAULT NULL::text, p_from_plz text DEFAULT NULL::text, p_from_city text DEFAULT NULL::text, p_expires_days integer DEFAULT 30, p_created_by uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_token TEXT;
  v_session_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_result JSON;
BEGIN
  -- Generate URL-safe token without gen_random_bytes()
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token := substring(v_token from 1 for 32);

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM besichtigung.sessions WHERE token = v_token) LOOP
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_token := substring(v_token from 1 for 32);
  END LOOP;

  -- Calculate expiration
  v_expires_at := NOW() + (p_expires_days || ' days')::INTERVAL;

  -- Insert into besichtigung schema
  INSERT INTO besichtigung.sessions (
    token, company_id, lead_id, offer_id,
    customer_name, customer_email, customer_phone,
    from_address, from_plz, from_city,
    expires_at, created_by, status
  ) VALUES (
    v_token, p_company_id, p_lead_id, p_offer_id,
    p_customer_name, p_customer_email, p_customer_phone,
    p_from_address, p_from_plz, p_from_city,
    v_expires_at, COALESCE(p_created_by, auth.uid()), 'pending'
  )
  RETURNING id INTO v_session_id;

  -- Return result as JSON
  SELECT json_build_object(
    'id', s.id,
    'token', s.token,
    'company_id', s.company_id,
    'lead_id', s.lead_id,
    'offer_id', s.offer_id,
    'customer_name', s.customer_name,
    'customer_email', s.customer_email,
    'customer_phone', s.customer_phone,
    'from_address', s.from_address,
    'from_plz', s.from_plz,
    'from_city', s.from_city,
    'status', s.status,
    'expires_at', s.expires_at,
    'created_at', s.created_at
  ) INTO v_result
  FROM besichtigung.sessions s
  WHERE s.id = v_session_id;

  RETURN v_result;
END;
$$;


--
-- Name: create_company_after_signup(uuid, text, text, text, text, text, text, text, text, text, text[], text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_company_after_signup(p_user_id uuid, p_company_name text, p_legal_name text DEFAULT NULL::text, p_street text DEFAULT NULL::text, p_house_number text DEFAULT NULL::text, p_plz text DEFAULT '0000'::text, p_city text DEFAULT ''::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_website text DEFAULT NULL::text, p_services text[] DEFAULT '{}'::text[], p_coverage_plz text DEFAULT NULL::text, p_coverage_radius integer DEFAULT 25) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_company_id UUID;
  v_service TEXT;
  v_priority INT := 1;
BEGIN
  -- Güvenlik: user_id gerçekten auth.users'da var mı?
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Güvenlik: aynı user_id için zaten firma varsa hata ver
  IF EXISTS (SELECT 1 FROM public.companies WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Company already exists for this user';
  END IF;

  -- 1. Firma oluştur
  INSERT INTO public.companies (
    user_id,
    company_name,
    legal_name,
    street,
    house_number,
    plz,
    city,
    phone,
    email,
    website,
    notification_email,
    is_active,
    is_verified
  ) VALUES (
    p_user_id,
    p_company_name,
    p_legal_name,
    p_street,
    p_house_number,
    COALESCE(p_plz, '0000'),
    COALESCE(p_city, ''),
    p_phone,
    p_email,
    p_website,
    p_email,
    true,
    false
  )
  RETURNING id INTO v_company_id;

  -- 2. Services ekle
  FOREACH v_service IN ARRAY p_services
  LOOP
    INSERT INTO public.company_services (
      company_id,
      service_type,
      priority,
      is_active
    ) VALUES (
      v_company_id,
      v_service,
      v_priority,
      true
    );
    v_priority := v_priority + 1;
  END LOOP;

  -- 3. PLZ coverage ekle
  IF p_coverage_plz IS NOT NULL THEN
    INSERT INTO public.company_plz_coverage (
      company_id,
      plz,
      radius_km,
      is_active
    ) VALUES (
      v_company_id,
      p_coverage_plz,
      p_coverage_radius,
      true
    );
  END IF;

  RETURN v_company_id;
END;
$$;


--
-- Name: create_lead_from_inbound_email(uuid, uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_lead_from_inbound_email(p_inbound_id uuid, p_company_id uuid, p_lead jsonb, p_outcome jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
$_$;


--
-- Name: FUNCTION create_lead_from_inbound_email(p_inbound_id uuid, p_company_id uuid, p_lead jsonb, p_outcome jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_lead_from_inbound_email(p_inbound_id uuid, p_company_id uuid, p_lead jsonb, p_outcome jsonb) IS 'Legt den Lead an und verknüpft ihn mit der eingehenden E-Mail — atomar. Gibt bei einer bereits verknüpften Mail den bestehenden Lead zurück, statt einen zweiten anzulegen.';


--
-- Name: create_offer_amendment(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_offer_amendment(p_offer_id uuid, p_title text, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_offer public.offers;
  v_id    UUID;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id;

  IF v_offer.id IS NULL OR NOT public.is_company_member(v_offer.company_id) THEN
    RAISE EXCEPTION 'Offerte nicht gefunden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Ein Nachtrag setzt eine Zustimmung voraus, die er ergaenzt. Ohne sie ist
  -- der richtige Weg die Revision (create_offer_revision).
  IF v_offer.status <> 'accepted' THEN
    RAISE EXCEPTION 'Ein Nachtrag setzt eine angenommene Offerte voraus. '
                    'Solange sie nicht angenommen ist, legen Sie eine neue Version an.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NULLIF(TRIM(COALESCE(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Der Nachtrag braucht einen Titel' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.offer_amendments (company_id, offer_id, amendment_number, title, reason, vat_rate)
  VALUES (v_offer.company_id, v_offer.id, 0, TRIM(p_title),
          NULLIF(TRIM(COALESCE(p_reason, '')), ''), COALESCE(v_offer.vat_rate, 8.1))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('nachtrag_id', v_id);
END;
$$;


--
-- Name: FUNCTION create_offer_amendment(p_offer_id uuid, p_title text, p_reason text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_offer_amendment(p_offer_id uuid, p_title text, p_reason text) IS 'Legt einen Nachtrag zu einer ANGENOMMENEN Offerte an. Nummer, Kunde, Sprache und Auftrag kommen per Trigger aus der Offerte.';


--
-- Name: create_offer_revision(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_offer_revision(p_offer_id uuid, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_alt      public.offers;
  v_neu_id   UUID;
  v_version  INTEGER;
  v_spalten  TEXT;
  v_kind     TEXT;
  -- Was NICHT mitkopiert wird.
  ausschluss CONSTANT TEXT[] := ARRAY[
    'id', 'created_at', 'updated_at', 'access_token',
    'status', 'sent_at', 'viewed_at', 'accepted_at', 'rejected_at',
    'customer_response_note', 'agb_accepted_at', 'agb_version', 'agb_ip_address',
    'locked_at', 'superseded_at', 'supersedes_offer_id',
    'offer_series_id', 'version_number', 'revision_reason'
  ];
BEGIN
  SELECT * INTO v_alt FROM public.offers WHERE id = p_offer_id;

  IF v_alt.id IS NULL OR NOT public.is_company_member(v_alt.company_id) THEN
    RAISE EXCEPTION 'Offerte nicht gefunden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_alt.superseded_at IS NOT NULL THEN
    RAISE EXCEPTION 'Zu dieser Offerte gibt es bereits eine neuere Version — diese zuerst oeffnen'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_alt.status = 'accepted' THEN
    RAISE EXCEPTION 'Die Offerte ist angenommen. Aenderungen am vereinbarten Umfang '
                    'brauchen die erneute Zustimmung des Kunden (Nachtrag).'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_alt.locked_at IS NULL THEN
    RAISE EXCEPTION 'Die Offerte ist noch ein Entwurf und kann direkt bearbeitet werden'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
  FROM public.offers WHERE offer_series_id = v_alt.offer_series_id;

  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO v_spalten
  FROM pg_attribute a
  WHERE a.attrelid = 'public.offers'::regclass
    AND a.attnum > 0 AND NOT a.attisdropped
    AND a.attgenerated = ''                 -- generierte Spalten rechnet die DB selbst
    AND NOT (a.attname = ANY(ausschluss));

  EXECUTE format(
    'INSERT INTO public.offers (%s, offer_series_id, version_number, supersedes_offer_id, revision_reason, status)
     SELECT %s, $1, $2, $3, $4, ''draft'' FROM public.offers WHERE id = $5
     RETURNING id',
    v_spalten, v_spalten)
  INTO v_neu_id
  USING v_alt.offer_series_id, v_version, v_alt.id, NULLIF(TRIM(COALESCE(p_reason, '')), ''), v_alt.id;

  -- Kindtabellen — ebenfalls aus dem Katalog. Beim ersten Anlauf hatte ich die
  -- Spalten hier von Hand aufgezaehlt und mich bei allen drei Tabellen geirrt;
  -- genau davor warnt der Kopf dieser Datei fuer `offers`.
  FOREACH v_kind IN ARRAY ARRAY['offer_items', 'offer_inventory_items', 'offer_leistungsuebersicht'] LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO v_spalten
    FROM pg_attribute a
    WHERE a.attrelid = ('public.' || v_kind)::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attgenerated = ''
      AND a.attname NOT IN ('id', 'offer_id', 'created_at', 'updated_at');

    IF v_spalten IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO public.%I (offer_id, %s) SELECT $1, %s FROM public.%I WHERE offer_id = $2',
        v_kind, v_spalten, v_spalten, v_kind)
      USING v_neu_id, v_alt.id;
    END IF;
  END LOOP;

  UPDATE public.offers SET superseded_at = NOW() WHERE id = v_alt.id;

  RETURN jsonb_build_object(
    'neue_offerte_id', v_neu_id,
    'version',         v_version,
    'serie',           v_alt.offer_series_id,
    'vorgaenger',      v_alt.id);
END;
$_$;


--
-- Name: FUNCTION create_offer_revision(p_offer_id uuid, p_reason text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_offer_revision(p_offer_id uuid, p_reason text) IS 'Legt die naechste Version einer versendeten Offerte an (Offerte + Positionen + Inventar + Leistungsuebersicht, eine Transaktion). Der Vorgaenger bleibt unveraendert — er ist der Stand, den der Kunde gesehen hat. Eine ANGENOMMENE Offerte wird abgewiesen: das waere ein Nachtrag.';


--
-- Name: credit_notes_von_rechnung_erben(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.credit_notes_von_rechnung_erben() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_r RECORD;
BEGIN
  SELECT language, customer_id INTO v_r
  FROM public.rechnungen WHERE id = NEW.rechnung_id;

  NEW.language    := COALESCE(NEW.language, v_r.language, 'de');
  NEW.customer_id := COALESCE(NEW.customer_id, v_r.customer_id);
  RETURN NEW;
END;
$$;


--
-- Name: customer_backfill_quellen(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_backfill_quellen(p_company_id uuid) RETURNS TABLE(quelle_tabelle text, quelle_id uuid, company_id uuid, erstellt_am timestamp with time zone, vorname text, nachname text, ganzer_name text, email_roh text, telefon_roh text, anrede text, sprache text, herkunft text, kundennummer text, customer_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 'leads',  l.id, l.company_id, l.created_at,
         l.customer_first_name, l.customer_last_name, NULL::TEXT,
         l.customer_email, l.customer_phone, l.customer_salutation,
         l.language, l.source, NULL::TEXT, l.customer_id
  FROM public.leads l WHERE l.company_id = p_company_id
  UNION ALL
  SELECT 'offers', o.id, o.company_id, o.created_at,
         o.customer_first_name, o.customer_last_name, NULL::TEXT,
         o.customer_email, o.customer_phone, o.customer_salutation,
         o.language, 'offer', o.customer_number, o.customer_id
  FROM public.offers o WHERE o.company_id = p_company_id
  UNION ALL
  -- Vor-/Nachname erst seit 20260728120000; ganzer_name ist der Altbestand.
  SELECT 'auftraege', a.id, a.company_id, a.created_at,
         a.customer_first_name, a.customer_last_name, a.customer_name,
         a.customer_email, a.customer_phone, NULL::TEXT,
         a.language, 'auftrag', NULL::TEXT, a.customer_id
  FROM public.auftraege a WHERE a.company_id = p_company_id
  UNION ALL
  SELECT 'appointments', t.id, t.company_id, t.created_at,
         t.customer_first_name, t.customer_last_name, NULL::TEXT,
         t.customer_email, t.customer_phone, NULL::TEXT,
         t.language, 'termin', NULL::TEXT, t.customer_id
  FROM public.appointments t WHERE t.company_id = p_company_id
  UNION ALL
  SELECT 'rechnungen', r.id, r.company_id, r.created_at,
         NULL::TEXT, NULL::TEXT, r.customer_name,
         r.customer_email, r.customer_phone, r.anrede,
         r.language, 'rechnung', NULL::TEXT, r.customer_id
  FROM public.rechnungen r WHERE r.company_id = p_company_id
  UNION ALL
  SELECT 'quittungen', q.id, q.company_id, q.created_at,
         NULL::TEXT, NULL::TEXT, q.customer_name,
         q.customer_email, q.customer_phone, NULL::TEXT,
         q.language, 'quittung', NULL::TEXT, q.customer_id
  FROM public.quittungen q WHERE q.company_id = p_company_id;
$$;


--
-- Name: FUNCTION customer_backfill_quellen(p_company_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.customer_backfill_quellen(p_company_id uuid) IS 'Vereinheitlichte Sicht auf alle Zeilen mit Kundenangaben. Von preview_customer_backfill() UND run_customer_backfill() benutzt, damit Bericht und Ausfuehrung dasselbe sehen. inbound_emails fehlt hier bewusst: aus einer eingehenden Mail entsteht nie ein Kunde.';


--
-- Name: customer_cases_aufgabe_anlegen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_cases_aufgabe_anlegen() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.crm_tasks (company_id, title, description, task_type, priority,
                                due_at, customer_id, auftrag_id, assigned_user_id)
  VALUES (
    NEW.company_id,
    COALESCE(NEW.case_number, 'Fall') || ': ' || NEW.title,
    NEW.description,
    'admin',
    CASE WHEN NEW.priority = 'urgent' THEN 'high' ELSE NEW.priority END,
    COALESCE(NEW.due_at, NOW()),
    NEW.customer_id, NEW.auftrag_id, NEW.assigned_user_id
  );
  RETURN NULL;
END;
$$;


--
-- Name: customer_cases_verlauf_schreiben(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_cases_verlauf_schreiben() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.customer_case_events
      (case_id, company_id, event_type, neu_wert, note, actor_id)
    VALUES (NEW.id, NEW.company_id, 'angelegt', NEW.status, NEW.title, auth.uid());
    RETURN NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.customer_case_events
      (case_id, company_id, event_type, alt_wert, neu_wert, note, actor_id)
    VALUES (NEW.id, NEW.company_id,
            CASE WHEN NEW.status IN ('geloest','abgelehnt') THEN 'abschluss' ELSE 'status' END,
            OLD.status, NEW.status, NEW.resolution, auth.uid());
  END IF;

  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    INSERT INTO public.customer_case_events
      (case_id, company_id, event_type, alt_wert, neu_wert, actor_id)
    VALUES (NEW.id, NEW.company_id, 'zuweisung',
            OLD.assigned_user_id::TEXT, NEW.assigned_user_id::TEXT, auth.uid());
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: customer_merge_preview(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_merge_preview(p_company_id uuid, p_source_customer_id uuid, p_target_customer_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_src public.customers; v_tgt public.customers;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_src FROM public.customers WHERE id = p_source_customer_id AND company_id = p_company_id;
  SELECT * INTO v_tgt FROM public.customers WHERE id = p_target_customer_id AND company_id = p_company_id;
  IF v_src.id IS NULL OR v_tgt.id IS NULL THEN
    RAISE EXCEPTION 'Kunde gehoert nicht zu dieser Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'moves', jsonb_build_object(
      'leads',          (SELECT count(*) FROM public.leads          WHERE customer_id = v_src.id),
      'offers',         (SELECT count(*) FROM public.offers         WHERE customer_id = v_src.id),
      'auftraege',      (SELECT count(*) FROM public.auftraege      WHERE customer_id = v_src.id),
      'appointments',   (SELECT count(*) FROM public.appointments   WHERE customer_id = v_src.id),
      'rechnungen',     (SELECT count(*) FROM public.rechnungen     WHERE customer_id = v_src.id),
      'quittungen',     (SELECT count(*) FROM public.quittungen     WHERE customer_id = v_src.id),
      'inbound_emails', (SELECT count(*) FROM public.inbound_emails WHERE customer_id = v_src.id)
    ),
    -- Was das Ziel uebernimmt: NUR seine Luecken. Ein gefuelltes Feld im Ziel
    -- bleibt stehen — die Oberflaeche zeigt das als Vorschau, nicht als Auswahl.
    'fills', (
      SELECT jsonb_object_agg(feld, wert) FROM (
        SELECT 'first_name' AS feld, v_src.first_name AS wert
          WHERE v_tgt.first_name IS NULL AND v_src.first_name IS NOT NULL
        UNION ALL SELECT 'last_name', v_src.last_name
          WHERE v_tgt.last_name IS NULL AND v_src.last_name IS NOT NULL
        UNION ALL SELECT 'company_name', v_src.company_name
          WHERE v_tgt.company_name IS NULL AND v_src.company_name IS NOT NULL
        UNION ALL SELECT 'primary_email', v_src.primary_email
          WHERE v_tgt.primary_email IS NULL AND v_src.primary_email IS NOT NULL
        UNION ALL SELECT 'primary_phone', v_src.primary_phone
          WHERE v_tgt.primary_phone IS NULL AND v_src.primary_phone IS NOT NULL
        UNION ALL SELECT 'salutation', v_src.salutation
          WHERE v_tgt.salutation IS NULL AND v_src.salutation IS NOT NULL
        UNION ALL SELECT 'external_customer_number', v_src.external_customer_number
          WHERE v_tgt.external_customer_number IS NULL AND v_src.external_customer_number IS NOT NULL
      ) f
    ),
    -- Was verloren geht: im Ziel gefuellt und in der Quelle ANDERS.
    'conflicts', (
      SELECT jsonb_object_agg(feld, jsonb_build_object('ziel', ziel, 'quelle', quelle)) FROM (
        SELECT 'first_name' AS feld, v_tgt.first_name AS ziel, v_src.first_name AS quelle
          WHERE v_tgt.first_name IS NOT NULL AND v_src.first_name IS NOT NULL
            AND v_tgt.first_name IS DISTINCT FROM v_src.first_name
        UNION ALL SELECT 'last_name', v_tgt.last_name, v_src.last_name
          WHERE v_tgt.last_name IS NOT NULL AND v_src.last_name IS NOT NULL
            AND v_tgt.last_name IS DISTINCT FROM v_src.last_name
        UNION ALL SELECT 'primary_email', v_tgt.primary_email, v_src.primary_email
          WHERE v_tgt.primary_email IS NOT NULL AND v_src.primary_email IS NOT NULL
            AND v_tgt.primary_email IS DISTINCT FROM v_src.primary_email
        UNION ALL SELECT 'primary_phone', v_tgt.primary_phone, v_src.primary_phone
          WHERE v_tgt.primary_phone IS NOT NULL AND v_src.primary_phone IS NOT NULL
            AND v_tgt.primary_phone IS DISTINCT FROM v_src.primary_phone
        UNION ALL SELECT 'language', v_tgt.language, v_src.language
          WHERE v_tgt.language IS DISTINCT FROM v_src.language
      ) c
    )
  );
END;
$$;


--
-- Name: FUNCTION customer_merge_preview(p_company_id uuid, p_source_customer_id uuid, p_target_customer_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.customer_merge_preview(p_company_id uuid, p_source_customer_id uuid, p_target_customer_id uuid) IS 'Vorschau VOR dem Zusammenfuehren: wie viele Vorgaenge umgehaengt werden, welche Luecken das Ziel uebernimmt und welche Werte der Quelle dabei verloren gehen. Schreibt nichts (STABLE).';


--
-- Name: customer_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_summary(p_customer_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
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


--
-- Name: FUNCTION customer_summary(p_customer_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.customer_summary(p_customer_id uuid) IS 'Kennzahlen der Kundenkarte. finanzen.bezahlt ist die Summe der Zahlungseingaenge; finanzen.davon_quittungen ist ein Anteil davon und wird NICHT dazugezaehlt. finanzen.offen kommt aus rechnungen.open_amount.';


--
-- Name: customer_timeline(uuid, integer, integer, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customer_timeline(p_customer_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(ereignis_am timestamp with time zone, ereignis_art text, entitaet text, entitaet_id uuid, titel text, untertitel text, status text, betrag numeric, sprache text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_company UUID;
  v_limit   INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
BEGIN
  SELECT c.company_id INTO v_company FROM public.customers c WHERE c.id = p_customer_id;
  IF v_company IS NULL OR NOT public.is_company_member(v_company) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Kunden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH alle(ts, art, tab, eid, tit, sub, st, betr, spr) AS (
    -- Jede Spalte ausdruecklich gecastet: die Basistabellen fuehren varchar und
    -- eigene Aufzaehlungstypen, RETURNS TABLE verlangt text.
    SELECT l.created_at, 'anfrage'::TEXT, 'leads'::TEXT, l.id,
           COALESCE(NULLIF(l.service_type::TEXT, ''), 'Anfrage')::TEXT,
           NULLIF(TRIM(CONCAT_WS(' ', l.from_plz, l.from_city)), '')::TEXT,
           l.status::TEXT, NULL::NUMERIC(12,2), l.language::TEXT
    FROM public.leads l WHERE l.customer_id = p_customer_id
    UNION ALL
    SELECT o.created_at, 'offerte', 'offers', o.id,
           COALESCE(NULLIF(o.title, ''), 'Offerte')::TEXT, NULL::TEXT,
           o.status::TEXT, o.total::NUMERIC(12,2), o.language::TEXT
    FROM public.offers o WHERE o.customer_id = p_customer_id
    UNION ALL
    SELECT a.created_at, 'auftrag', 'auftraege', a.id,
           COALESCE(NULLIF(a.title, ''), 'Auftrag')::TEXT, a.auftrag_nummer::TEXT,
           a.status::TEXT, a.total::NUMERIC(12,2), a.language::TEXT
    FROM public.auftraege a WHERE a.customer_id = p_customer_id AND a.deleted_at IS NULL
    UNION ALL
    -- Der Termin wird nach seinem DATUM einsortiert, nicht nach seiner Erfassung.
    SELECT (t.appointment_date + COALESCE(t.start_time, TIME '00:00')) AT TIME ZONE 'Europe/Zurich',
           'termin', 'appointments', t.id,
           COALESCE(NULLIF(t.title, ''), 'Termin')::TEXT, t.appointment_type::TEXT,
           t.status::TEXT, NULL::NUMERIC(12,2), t.language::TEXT
    FROM public.appointments t WHERE t.customer_id = p_customer_id
    UNION ALL
    SELECT r.created_at, 'rechnung', 'rechnungen', r.id,
           COALESCE(r.rechnung_nr, 'Rechnung')::TEXT, NULL::TEXT,
           r.status::TEXT, r.gesamttotal::NUMERIC(12,2), r.language::TEXT
    FROM public.rechnungen r WHERE r.customer_id = p_customer_id
    UNION ALL
    SELECT q.created_at, 'quittung', 'quittungen', q.id,
           COALESCE(q.quittung_nr, 'Quittung')::TEXT, NULL::TEXT,
           q.status::TEXT, q.gesamttotal::NUMERIC(12,2), q.language::TEXT
    FROM public.quittungen q WHERE q.customer_id = p_customer_id
    UNION ALL
    SELECT i.received_at, 'email', 'inbound_emails', i.id,
           COALESCE(NULLIF(i.subject, ''), 'E-Mail')::TEXT, i.from_email::TEXT,
           i.processing_status::TEXT, NULL::NUMERIC(12,2), NULL::TEXT
    FROM public.inbound_emails i WHERE i.customer_id = p_customer_id
  )
  SELECT alle.ts, alle.art, alle.tab, alle.eid, alle.tit, alle.sub, alle.st, alle.betr, alle.spr
  FROM alle
  WHERE p_before IS NULL OR alle.ts < p_before
  ORDER BY alle.ts DESC, alle.eid
  LIMIT v_limit OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;


--
-- Name: FUNCTION customer_timeline(p_customer_id uuid, p_limit integer, p_offset integer, p_before timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.customer_timeline(p_customer_id uuid, p_limit integer, p_offset integer, p_before timestamp with time zone) IS 'Verlauf eines Kunden ueber sieben Tabellen. Termine werden nach ihrem Datum einsortiert, nicht nach ihrer Erfassung. Ab etwa 1000 Ereignissen je Kunde gehoert das LIMIT in die einzelnen Zweige (MergeAppend); heute waere das verfruehte Optimierung.';


--
-- Name: customers_set_display_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.customers_set_display_name() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.display_name IS NULL OR TRIM(NEW.display_name) = '' THEN
    NEW.display_name := COALESCE(
      NULLIF(TRIM(CONCAT_WS(' ',
        NULLIF(TRIM(NEW.first_name), ''),
        NULLIF(TRIM(NEW.last_name), '')
      )), ''),
      NULLIF(TRIM(NEW.company_name), ''),
      public.normalize_customer_email(NEW.primary_email),
      public.normalize_customer_phone(NEW.primary_phone)
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: deactivate_expired_subscriptions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deactivate_expired_subscriptions() RETURNS TABLE(company_id uuid, company_name text, email text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  UPDATE public.companies
  SET 
    crm_enabled = FALSE,
    subscription_type = 'basic'
  WHERE 
    crm_enabled = TRUE
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at < NOW()
  RETURNING id, companies.company_name, companies.email;
END;
$$;


--
-- Name: FUNCTION deactivate_expired_subscriptions(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.deactivate_expired_subscriptions() IS 'Deactivates expired subscriptions and returns affected companies';


--
-- Name: deactivate_manual_import(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deactivate_manual_import(p_company_id uuid, p_reason text DEFAULT 'Admin deactivated'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update company
  UPDATE public.companies
  SET 
    manual_import_enabled = false,
    manual_import_next_billing_at = NULL
  WHERE id = p_company_id;
  
  -- Update subscription
  UPDATE public.manual_import_subscriptions
  SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = p_reason
  WHERE company_id = p_company_id AND status = 'active';
  
  RETURN jsonb_build_object('success', true);
END;
$$;


--
-- Name: debug_storage_objects(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_storage_objects() RETURNS TABLE(info_type text, info_name text, info_detail text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- Triggers
  SELECT 'trigger'::text, tgname::text, 
    pg_get_triggerdef(t.oid)::text
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'storage' AND c.relname = 'objects'
  
  UNION ALL
  
  -- Check constraints
  SELECT 'constraint'::text, conname::text, 
    pg_get_constraintdef(c.oid)::text
  FROM pg_constraint c
  JOIN pg_class cl ON c.conrelid = cl.oid
  JOIN pg_namespace n ON cl.relnamespace = n.oid
  WHERE n.nspname = 'storage' AND cl.relname = 'objects'
  AND c.contype = 'c'
  
  UNION ALL
  
  -- Columns
  SELECT 'column'::text, column_name::text, 
    (data_type || ' ' || COALESCE(column_default, 'no default'))::text
  FROM information_schema.columns
  WHERE table_schema = 'storage' AND table_name = 'objects'
  ORDER BY 1, 2;
$$;


--
-- Name: decide_change_request(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decide_change_request(p_id uuid, p_annehmen boolean, p_notiz text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_w RECORD;
BEGIN
  SELECT * INTO v_w FROM public.customer_change_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wunsch nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_company_role(v_w.company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen entscheiden.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_w.status <> 'offen' THEN
    RAISE EXCEPTION 'Ueber diesen Wunsch ist bereits entschieden.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_annehmen THEN
    -- Ein dynamisches UPDATE waere hier eine Einladung: `feld` kaeme aus dem
    -- Portal. Der CHECK begrenzt es zwar, aber die Zuordnung steht trotzdem
    -- ausgeschrieben da, damit kein spaeter erlaubter Wert stillschweigend
    -- irgendwohin schreibt.
    UPDATE public.customers SET
      first_name    = CASE WHEN v_w.feld = 'first_name'    THEN v_w.neu_wert ELSE first_name END,
      last_name     = CASE WHEN v_w.feld = 'last_name'     THEN v_w.neu_wert ELSE last_name END,
      company_name  = CASE WHEN v_w.feld = 'company_name'  THEN v_w.neu_wert ELSE company_name END,
      primary_email = CASE WHEN v_w.feld = 'primary_email' THEN v_w.neu_wert ELSE primary_email END,
      primary_phone = CASE WHEN v_w.feld = 'primary_phone' THEN v_w.neu_wert ELSE primary_phone END
    WHERE id = v_w.customer_id;
  END IF;

  UPDATE public.customer_change_requests
  SET status = CASE WHEN p_annehmen THEN 'angenommen' ELSE 'abgelehnt' END,
      entschieden_von = auth.uid(),
      entschieden_am  = NOW(),
      entscheid_notiz = p_notiz
  WHERE id = p_id;

  RETURN jsonb_build_object('id', p_id,
    'status', CASE WHEN p_annehmen THEN 'angenommen' ELSE 'abgelehnt' END);
END;
$$;


--
-- Name: delete_besichtigung_photo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_besichtigung_photo(p_photo_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  DELETE FROM besichtigung.photos
  WHERE id = p_photo_id
  RETURNING json_build_object(
    'id', id,
    'storage_path', storage_path
  ) INTO v_result;

  RETURN v_result;
END;
$$;


--
-- Name: duplicate_candidates(uuid, uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.duplicate_candidates(p_company_id uuid, p_customer_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(customer_a_id uuid, customer_a_name text, customer_a_email text, customer_a_phone text, customer_b_id uuid, customer_b_name text, customer_b_email text, customer_b_phone text, match_reason text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT a.id, a.display_name, a.primary_email, a.primary_phone,
         b.id, b.display_name, b.primary_email, b.primary_phone,
         CASE
           WHEN a.phone_normalized IS NOT NULL AND a.phone_normalized = b.phone_normalized
                AND lower(TRIM(COALESCE(a.last_name, ''))) = lower(TRIM(COALESCE(b.last_name, '')))
                AND COALESCE(a.last_name, '') <> ''
             THEN 'same_phone_and_name'
           ELSE 'same_phone'
         END
  FROM public.customers a
  JOIN public.customers b
    ON b.company_id = a.company_id
   AND b.id <> a.id
   AND b.merged_into_customer_id IS NULL
   AND a.phone_normalized IS NOT NULL
   AND a.phone_normalized = b.phone_normalized
  WHERE a.company_id = p_company_id
    AND a.merged_into_customer_id IS NULL
    AND (p_customer_id IS NULL OR a.id = p_customer_id)
    -- Ohne p_customer_id jedes Paar nur einmal zeigen. Der Vergleich laeuft ueber
    -- die id, NICHT ueber created_at: NOW() ist innerhalb einer Transaktion
    -- konstant, also tragen alle im Backfill entstandenen Kunden denselben
    -- Zeitstempel und ein Paar erschiene zweimal.
    AND (p_customer_id IS NOT NULL OR a.id < b.id)
  ORDER BY a.created_at DESC, b.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;


--
-- Name: FUNCTION duplicate_candidates(p_company_id uuid, p_customer_id uuid, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.duplicate_candidates(p_company_id uuid, p_customer_id uuid, p_limit integer, p_offset integer) IS 'Paare mit derselben Telefonnummer. Ohne p_customer_id die Liste fuer die Uebersicht (jedes Paar einmal), mit p_customer_id das Band auf der Kundenkarte. Reine Namensaehnlichkeit gilt bewusst NICHT als Kandidat.';


--
-- Name: email_log_in_faden(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_log_in_faden() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_kunde  UUID;
  v_thread UUID;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NULL; END IF;

  -- `email_logs` traegt keinen customer_id. Ueber die Anfrage oder die
  -- Empfaengeradresse laesst er sich finden — dieselbe Identitaetsregel wie
  -- ueberall, ueber find_customer_by_identity.
  SELECT customer_id INTO v_kunde FROM public.leads WHERE id = NEW.lead_id;
  IF v_kunde IS NULL THEN
    -- find_customer_by_identity liefert eine TABELLE (customer_id, matched_on),
    -- keinen skalaren Wert — deshalb als Unterabfrage.
    SELECT f.customer_id INTO v_kunde
    FROM public.find_customer_by_identity(NEW.company_id, NEW.recipient_email, NULL) f
    LIMIT 1;
  END IF;

  v_thread := public.resolve_or_create_thread(
    NEW.company_id, v_kunde, 'email', NEW.subject, NEW.lead_id);
  IF v_thread IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.communication_messages
    (company_id, thread_id, direction, channel, to_address, subject,
     occurred_at, source_table, source_id)
  VALUES (NEW.company_id, v_thread, 'outbound', 'email', NEW.recipient_email,
          NEW.subject, COALESCE(NEW.created_at, NOW()), 'email_logs', NEW.id)
  ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Posteingang: ausgehende Mail nicht eingeordnet: %', SQLERRM;
  RETURN NULL;
END;
$$;


--
-- Name: execute_sql(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.execute_sql(query text, read_only boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
        DECLARE
          result jsonb;
        BEGIN
          -- Note: SET TRANSACTION READ ONLY might not behave as expected within a function
          -- depending on the outer transaction state. Handle read-only logic outside if needed.

          -- Execute the dynamic query and aggregate results into a JSONB array
          EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || query || ') t' INTO result;

          RETURN result;
        EXCEPTION
          WHEN others THEN
            -- Rethrow the error with context, including the original SQLSTATE
            RAISE EXCEPTION 'Error executing SQL (SQLSTATE: %): % ', SQLSTATE, SQLERRM;
        END;
        $$;


--
-- Name: expire_unconfirmed_risky_leads(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_unconfirmed_risky_leads() RETURNS TABLE(expired_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE public.leads
       SET status       = 'unconfirmed_risky',
           updated_at   = NOW()
     WHERE status = 'awaiting_customer_confirmation'
       AND ai_validated_at IS NOT NULL
       AND ai_validated_at < (NOW() - INTERVAL '48 hours')
     RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM expired;

  RAISE LOG '[expire_unconfirmed_risky_leads] % leads moved to unconfirmed_risky', v_count;

  RETURN QUERY SELECT v_count;
END;
$$;


--
-- Name: FUNCTION expire_unconfirmed_risky_leads(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.expire_unconfirmed_risky_leads() IS '48 saat icinde cifte onay e-postasina yanit vermeyen leadleri unconfirmed_risky statusune tasir. pg_cron tarafindan her 30 dakikada bir tetiklenir.';


--
-- Name: expire_unverified_leads(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_unverified_leads(p_hours_threshold integer DEFAULT 48, p_spam_score_max integer DEFAULT 3) RETURNS TABLE(expired_count integer, lead_ids uuid[])
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ids UUID[];
  v_count INTEGER;
BEGIN
  UPDATE public.leads
  SET
    status     = 'expired_unverified',
    updated_at = NOW()
  WHERE status    = 'pending_verification'
    AND created_at < NOW() - (p_hours_threshold || ' hours')::INTERVAL
    AND COALESCE(spam_score, 0) <= p_spam_score_max
  RETURNING id INTO v_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count, v_ids;
END;
$$;


--
-- Name: FUNCTION expire_unverified_leads(p_hours_threshold integer, p_spam_score_max integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.expire_unverified_leads(p_hours_threshold integer, p_spam_score_max integer) IS 'p_hours_threshold saati geçen ve spam_score <= p_spam_score_max olan pending_verification leadleri expired_unverified statüsüne alır. Yüksek spam-score leadler admin değerlendirmesinde kalır.';


--
-- Name: extend_subscription(uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extend_subscription(p_company_id uuid, p_months integer, p_confirmed_by uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_expires TIMESTAMPTZ;
  v_new_expires TIMESTAMPTZ;
BEGIN
  -- Get current expiry date
  SELECT subscription_expires_at INTO v_current_expires
  FROM public.companies
  WHERE id = p_company_id;
  
  -- Calculate new expiry date
  IF v_current_expires IS NULL OR v_current_expires < NOW() THEN
    v_new_expires := NOW() + (p_months || ' months')::INTERVAL;
  ELSE
    v_new_expires := v_current_expires + (p_months || ' months')::INTERVAL;
  END IF;
  
  -- Update company
  UPDATE public.companies
  SET 
    crm_enabled = TRUE,
    subscription_type = 'crm',
    subscription_expires_at = v_new_expires,
    crm_enabled_at = COALESCE(crm_enabled_at, NOW()),
    crm_enabled_by = COALESCE(crm_enabled_by, p_confirmed_by),
    last_reminder_sent_at = NULL,
    last_reminder_type = NULL
  WHERE id = p_company_id;
  
  RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION extend_subscription(p_company_id uuid, p_months integer, p_confirmed_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.extend_subscription(p_company_id uuid, p_months integer, p_confirmed_by uuid) IS 'Extends a company subscription by N months';


--
-- Name: finance_overview(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finance_overview(p_company_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ergebnis JSONB;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
    -- Die einzige Umsatzzahl des Systems. Stornos sind negativ und rechnen
    -- sich von selbst heraus.
    'kassiert_total', COALESCE((SELECT SUM(amount) FROM public.payments
                                WHERE company_id = p_company_id), 0),
    'kassiert_30t',   COALESCE((SELECT SUM(amount) FROM public.payments
                                WHERE company_id = p_company_id
                                  AND payment_date >= CURRENT_DATE - 30), 0),
    'nicht_abgeglichen', COALESCE((SELECT COUNT(*) FROM public.payments
                                WHERE company_id = p_company_id
                                  AND reconciliation_status = 'unreconciled'), 0),
    'offen_total',    COALESCE((SELECT SUM(open_amount) FROM public.rechnungen
                                WHERE company_id = p_company_id
                                  AND status <> 'entwurf' AND open_amount > 0), 0),
    'offen_anzahl',   COALESCE((SELECT COUNT(*) FROM public.rechnungen
                                WHERE company_id = p_company_id
                                  AND status <> 'entwurf' AND open_amount > 0), 0),
    'ueberfaellig_total', COALESCE((SELECT SUM(open_amount) FROM public.rechnungen
                                WHERE company_id = p_company_id
                                  AND status <> 'entwurf' AND open_amount > 0
                                  AND faellig_am < CURRENT_DATE), 0),
    'ueberfaellig_anzahl', COALESCE((SELECT COUNT(*) FROM public.rechnungen
                                WHERE company_id = p_company_id
                                  AND status <> 'entwurf' AND open_amount > 0
                                  AND faellig_am < CURRENT_DATE), 0),
    'entwurf_total',  COALESCE((SELECT SUM(COALESCE(gesamttotal, total, 0))
                                FROM public.rechnungen
                                WHERE company_id = p_company_id AND status = 'entwurf'), 0),
    'gutschriften_total', COALESCE((SELECT SUM(amount) FROM public.credit_notes
                                WHERE company_id = p_company_id AND status = 'versendet'), 0)
  ) INTO v_ergebnis;

  RETURN v_ergebnis;
END;
$$;


--
-- Name: FUNCTION finance_overview(p_company_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.finance_overview(p_company_id uuid) IS 'Eine Umsatzzahl statt zweier: kassiert_total ist die Summe der Zahlungseingaenge — Rechnung und Quittung zaehlen darin je einmal.';


--
-- Name: find_companies_fallback(character varying, character varying, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_companies_fallback(target_plz character varying, service_type_filter character varying, fallback_radius_km numeric DEFAULT 30, max_results integer DEFAULT 10) RETURNS TABLE(company_id uuid, company_name character varying, email character varying, notification_email character varying, distance_km numeric, coverage_plz character varying, coverage_radius_km integer)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  target_coords RECORD;
BEGIN
  SELECT latitude, longitude INTO target_coords
  FROM public.swiss_plz
  WHERE plz = target_plz
  LIMIT 1;

  IF target_coords IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH company_distances AS (
    -- For each company, find the closest coverage PLZ to the lead PLZ
    SELECT
      c.id                        AS cmp_id,
      c.company_name              AS cmp_name,
      c.email                     AS cmp_email,
      c.notification_email        AS cmp_notification_email,
      cpc.plz                     AS cov_plz,
      cpc.radius_km               AS cov_radius_km,
      public.calculate_distance_km(
        target_coords.latitude,
        target_coords.longitude,
        sp.latitude,
        sp.longitude
      )                           AS dist_km
    FROM public.companies c
    INNER JOIN public.company_services cs  ON cs.company_id  = c.id
    INNER JOIN public.company_plz_coverage cpc ON cpc.company_id = c.id
    INNER JOIN public.swiss_plz sp         ON sp.plz = cpc.plz
    WHERE c.is_active  = true
      AND c.is_verified = true
      AND cs.is_active  = true
      AND cpc.is_active = true
      AND sp.latitude IS NOT NULL
      -- Same service type matching logic as find_companies_in_radius
      AND (
        cs.service_type = service_type_filter
        OR CASE service_type_filter
          WHEN 'umzug' THEN
            cs.service_type IN ('umzug_privat','umzug_firma','umzug_buero','umzug_international',
                                'privatumzug','firmenumzug','bueroumzug','seniorenumzug','studentenumzug')
          WHEN 'reinigung' THEN
            cs.service_type IN ('reinigung_end','reinigung_grund','reinigung_fenster','reinigung_bau',
                                'endreinigung','grundreinigung','unterhaltsreinigung','uebergabereinigung',
                                'baureinigung','buroreinigung','fensterreinigung')
          WHEN 'raeumung' THEN
            cs.service_type IN ('raeumung_wohnung','raeumung_haus','raeumung_keller','raeumung_dachboden',
                                'raeumung_estrich','raeumung_buero','kellerraeumung','wohnungsraeumung',
                                'hausraeumung','estrichraeumung','nachlassraeumung','messieraeumung')
          WHEN 'moebeltransport' THEN
            cs.service_type IN ('transport_moebel','usm_transport','wasserbett_transport',
                                'einzeltransport','schwertransport','kunsttransport')
          WHEN 'malerarbeiten' THEN
            cs.service_type IN ('malerarbeit','malerarbeiten','maler','anstrich','tapezieren')
          WHEN 'klaviertransport' THEN
            cs.service_type IN ('klaviertransport_transport','klaviertransport_storage',
                                'klaviertransport_disposal','klaviertransport_internal_move',
                                'klaviertransport_tuning','fluegeltransport','piano_transport')
          WHEN 'moebellift' THEN
            cs.service_type IN ('moebellift_mieten','moebellift_service','moebellift_miete',
                                'aussenlift','moebelaufzug')
          WHEN 'entsorgung' THEN
            cs.service_type IN ('entsorgung_moebel','entsorgung_elektro','entsorgung_sperrgut',
                                'entsorgung_bauschutt','moebelentsorgung','sperrmuell','elektroentsorgung')
          WHEN 'lagerung' THEN
            cs.service_type IN ('lagerung_kurz','lagerung_lang','lagerung_einlagerung',
                                'lagerung_zwischenlagerung','lagerung_selfstorage',
                                'einlagerung','zwischenlagerung','moebeleinlagerung','selfstorage')
          WHEN 'renovation' THEN
            cs.service_type IN ('renovierung','sanierung')
          ELSE FALSE
        END
      )
  ),
  best_per_company AS (
    -- Pick the closest coverage PLZ per company
    SELECT DISTINCT ON (cmp_id)
      cmp_id, cmp_name, cmp_email, cmp_notification_email,
      cov_plz, cov_radius_km, dist_km
    FROM company_distances
    WHERE dist_km <= fallback_radius_km
    ORDER BY cmp_id, dist_km ASC
  )
  SELECT
    b.cmp_id            AS company_id,
    b.cmp_name          AS company_name,
    b.cmp_email         AS email,
    b.cmp_notification_email AS notification_email,
    b.dist_km           AS distance_km,
    b.cov_plz           AS coverage_plz,
    b.cov_radius_km     AS coverage_radius_km
  FROM best_per_company b
  ORDER BY b.dist_km ASC
  LIMIT max_results;
END;
$$;


--
-- Name: FUNCTION find_companies_fallback(target_plz character varying, service_type_filter character varying, fallback_radius_km numeric, max_results integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_companies_fallback(target_plz character varying, service_type_filter character varying, fallback_radius_km numeric, max_results integer) IS 'Fallback company finder: ignores declared coverage radius and finds companies
   whose nearest coverage PLZ is within fallback_radius_km of the lead PLZ.
   Called when find_companies_in_radius returns no results.';


--
-- Name: find_companies_in_radius(character varying, character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_companies_in_radius(target_plz character varying, service_type_filter character varying, max_results integer DEFAULT 10) RETURNS TABLE(company_id uuid, company_name character varying, email character varying, notification_email character varying, distance_km numeric, coverage_plz character varying, coverage_radius_km integer)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  target_coords RECORD;
BEGIN
  -- Get coordinates for target PLZ
  SELECT latitude, longitude INTO target_coords
  FROM public.swiss_plz
  WHERE plz = target_plz
  LIMIT 1;
  
  IF target_coords IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH all_coverages AS (
    SELECT 
      c.id AS cmp_id,
      c.company_name AS cmp_name,
      c.email AS cmp_email,
      c.notification_email AS cmp_notification_email,
      cpc.plz AS cov_plz,
      cpc.radius_km AS cov_radius_km,
      sp.latitude AS coverage_lat,
      sp.longitude AS coverage_lon,
      CASE 
        WHEN cpc.plz = target_plz THEN 0::DECIMAL
        WHEN sp.latitude IS NOT NULL THEN
          public.calculate_distance_km(
            target_coords.latitude,
            target_coords.longitude,
            sp.latitude,
            sp.longitude
          )
        ELSE NULL
      END AS calc_distance,
      CASE 
        WHEN cpc.plz = target_plz THEN true
        WHEN sp.latitude IS NOT NULL 
          AND cpc.radius_km > 0
          AND public.calculate_distance_km(
            target_coords.latitude,
            target_coords.longitude,
            sp.latitude,
            sp.longitude
          ) <= cpc.radius_km THEN true
        ELSE false
      END AS is_valid_coverage
    FROM public.companies c
    INNER JOIN public.company_services cs ON cs.company_id = c.id
    INNER JOIN public.company_plz_coverage cpc ON cpc.company_id = c.id
    LEFT JOIN public.swiss_plz sp ON sp.plz = cpc.plz
    WHERE c.is_active = true
      AND c.is_verified = true
      AND cs.is_active = true
      AND cpc.is_active = true
      -- Match either exact type OR known granular sub-types for base category filters
      AND (
        cs.service_type = service_type_filter
        OR CASE service_type_filter
          WHEN 'umzug' THEN
            cs.service_type IN (
              'umzug_privat', 'umzug_firma', 'umzug_buero', 'umzug_international',
              'privatumzug', 'firmenumzug', 'bueroumzug', 'seniorenumzug', 'studentenumzug'
            )
          WHEN 'reinigung' THEN
            cs.service_type IN (
              'reinigung_end', 'reinigung_grund', 'reinigung_fenster', 'reinigung_bau',
              'endreinigung', 'grundreinigung', 'unterhaltsreinigung', 'uebergabereinigung',
              'baureinigung', 'buroreinigung', 'fensterreinigung'
            )
          WHEN 'raeumung' THEN
            cs.service_type IN (
              'raeumung_wohnung', 'raeumung_haus', 'raeumung_keller', 'raeumung_dachboden',
              'raeumung_estrich', 'raeumung_buero',
              'kellerraeumung', 'wohnungsraeumung', 'hausraeumung', 'estrichraeumung',
              'nachlassraeumung', 'messieraeumung'
            )
          WHEN 'moebeltransport' THEN
            cs.service_type IN (
              'transport_moebel', 'usm_transport', 'wasserbett_transport',
              'einzeltransport', 'schwertransport', 'kunsttransport'
            )
          WHEN 'malerarbeiten' THEN
            cs.service_type IN ('malerarbeit', 'malerarbeiten', 'maler', 'anstrich', 'tapezieren')
          WHEN 'klaviertransport' THEN
            cs.service_type IN (
              'klaviertransport_transport', 'klaviertransport_storage',
              'klaviertransport_disposal', 'klaviertransport_internal_move',
              'klaviertransport_tuning', 'fluegeltransport', 'piano_transport'
            )
          WHEN 'moebellift' THEN
            cs.service_type IN ('moebellift_mieten', 'moebellift_service', 'moebellift_miete', 'aussenlift', 'moebelaufzug')
          WHEN 'entsorgung' THEN
            cs.service_type IN (
              'entsorgung_moebel', 'entsorgung_elektro', 'entsorgung_sperrgut', 'entsorgung_bauschutt',
              'moebelentsorgung', 'sperrmuell', 'elektroentsorgung'
            )
          WHEN 'lagerung' THEN
            cs.service_type IN (
              'lagerung_kurz', 'lagerung_lang', 'lagerung_einlagerung', 'lagerung_zwischenlagerung', 'lagerung_selfstorage',
              'einlagerung', 'zwischenlagerung', 'moebeleinlagerung', 'selfstorage'
            )
          WHEN 'renovation' THEN
            cs.service_type IN ('renovierung', 'sanierung')
          ELSE FALSE
        END
      )
  ),
  valid_coverages AS (
    SELECT * FROM all_coverages WHERE is_valid_coverage = true
  ),
  best_coverage_per_company AS (
    SELECT DISTINCT ON (cmp_id)
      cmp_id,
      cmp_name,
      cmp_email,
      cmp_notification_email,
      cov_plz,
      cov_radius_km,
      calc_distance
    FROM valid_coverages
    ORDER BY 
      cmp_id,
      calc_distance ASC NULLS LAST
  )
  SELECT 
    bc.cmp_id AS company_id,
    bc.cmp_name AS company_name,
    bc.cmp_email AS email,
    bc.cmp_notification_email AS notification_email,
    bc.calc_distance AS distance_km,
    bc.cov_plz AS coverage_plz,
    bc.cov_radius_km AS coverage_radius_km
  FROM best_coverage_per_company bc
  ORDER BY 
    CASE WHEN bc.calc_distance = 0 THEN 0 ELSE 1 END,
    bc.calc_distance ASC NULLS LAST
  LIMIT max_results;
END;
$$;


--
-- Name: FUNCTION find_companies_in_radius(target_plz character varying, service_type_filter character varying, max_results integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_companies_in_radius(target_plz character varying, service_type_filter character varying, max_results integer) IS 'Finds companies that can serve a given PLZ based on their coverage settings.
A company matches if:
1. They have an exact PLZ match (coverage_plz = target_plz), OR
2. They have a radius coverage where the distance from coverage_plz to target_plz is within radius_km

The function returns the best coverage entry for each company (preferring exact matches, then shortest distance).';


--
-- Name: find_customer_by_identity(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_customer_by_identity(p_company_id uuid, p_email text, p_phone text) RETURNS TABLE(customer_id uuid, matched_on text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH k AS (
    SELECT public.normalize_customer_email(p_email) AS e,
           public.normalize_customer_phone(p_phone) AS p
  )
  SELECT c.id,
         CASE
           WHEN k.e IS NOT NULL AND c.email_normalized = k.e
            AND k.p IS NOT NULL AND c.phone_normalized = k.p THEN 'email_and_phone'
           WHEN k.e IS NOT NULL AND c.email_normalized = k.e THEN 'email'
           ELSE 'phone'
         END
  FROM public.customers c, k
  WHERE c.company_id = p_company_id
    AND c.merged_into_customer_id IS NULL
    AND (   (k.e IS NOT NULL AND c.email_normalized = k.e)
         OR (k.p IS NOT NULL AND c.phone_normalized = k.p))
  ORDER BY
    -- Der beste Treffer zuerst: beide Merkmale schlagen ein einzelnes.
    ((k.e IS NOT NULL AND c.email_normalized = k.e)::INT
   + (k.p IS NOT NULL AND c.phone_normalized = k.p)::INT) DESC,
    c.created_at ASC
  LIMIT 1;
$$;


--
-- Name: FUNCTION find_customer_by_identity(p_company_id uuid, p_email text, p_phone text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_customer_by_identity(p_company_id uuid, p_email text, p_phone text) IS 'Einzige Stelle, an der die Zuordnungsregel steht. Liefert den besten Treffer und woran er haengt (email_and_phone | email | phone). Legt NICHTS an.';


--
-- Name: generate_auftrag_nummer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_auftrag_nummer() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  year_prefix TEXT;
  next_number INTEGER;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Acquire an advisory lock per company to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('auftrag_nummer_' || NEW.company_id::text));

  SELECT COALESCE(MAX(CAST(SUBSTRING(auftrag_nummer FROM 6) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.auftraege
  WHERE company_id = NEW.company_id
    AND auftrag_nummer LIKE year_prefix || '-%';

  NEW.auftrag_nummer := year_prefix || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generate_fall_nr(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_fall_nr() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  next_nr  INTEGER;
  jahr_int INTEGER;
BEGIN
  IF NEW.case_number IS NULL THEN
    jahr_int := EXTRACT(YEAR FROM COALESCE(NEW.reported_at, NOW()))::INTEGER;

    INSERT INTO public.fall_nr_counter AS c (company_id, jahr, letzte_nr)
    VALUES (NEW.company_id, jahr_int, 1)
    ON CONFLICT (company_id, jahr) DO UPDATE SET letzte_nr = c.letzte_nr + 1
    RETURNING c.letzte_nr INTO next_nr;

    NEW.case_number := 'FA-' || jahr_int::TEXT || '-' || LPAD(next_nr::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: generate_gutschrift_nr(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_gutschrift_nr() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  next_nr  INTEGER;
  jahr_int INTEGER;
BEGIN
  IF NEW.gutschrift_nr IS NULL THEN
    jahr_int := EXTRACT(YEAR FROM COALESCE(NEW.datum, CURRENT_DATE))::INTEGER;

    INSERT INTO public.gutschrift_nr_counter AS c (company_id, jahr, letzte_nr)
    VALUES (NEW.company_id, jahr_int, 1)
    ON CONFLICT (company_id, jahr)
      DO UPDATE SET letzte_nr = c.letzte_nr + 1
    RETURNING c.letzte_nr INTO next_nr;

    NEW.gutschrift_nr := 'GS-' || jahr_int::TEXT || '-' || LPAD(next_nr::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: generate_klavier_nummer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_klavier_nummer() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.anfrage_nummer := 'KLV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('klavier_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generate_moebellift_nummer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_moebellift_nummer() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.anfrage_nummer := 'MLF-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('moebellift_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generate_offer_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_offer_number() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- Get next number for this company
  SELECT COALESCE(MAX(offer_number), 10000) + 1 INTO next_number
  FROM offers
  WHERE company_id = NEW.company_id;
  
  NEW.offer_number := next_number;
  RETURN NEW;
END;
$$;


--
-- Name: generate_quittung_nr(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quittung_nr() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  next_nr  INTEGER;
  year_str TEXT;
BEGIN
  IF NEW.quittung_nr IS NULL THEN
    year_str := to_char(NOW(), 'YYYY');

    -- Count how many quittungen this company already has in the current year
    -- and take the next number (MAX existing + 1)
    SELECT COALESCE(
      MAX(
        CASE
          WHEN quittung_nr ~ ('^QU-' || year_str || '-[0-9]+$')
          THEN CAST(SPLIT_PART(quittung_nr, '-', 3) AS INTEGER)
          ELSE 0
        END
      ), 0
    ) + 1
    INTO next_nr
    FROM quittungen
    WHERE company_id = NEW.company_id;

    NEW.quittung_nr := 'QU-' || year_str || '-' || LPAD(next_nr::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$_$;


--
-- Name: generate_raeumung_nummer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_raeumung_nummer() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.anfrage_nummer := 'RAE-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('raeumung_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generate_rechnung_nr(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_rechnung_nr() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  next_nr  INTEGER;
  jahr_int INTEGER;
BEGIN
  IF NEW.rechnung_nr IS NULL THEN
    jahr_int := EXTRACT(YEAR FROM COALESCE(NEW.datum, CURRENT_DATE))::INTEGER;

    INSERT INTO public.rechnung_nr_counter AS c (company_id, jahr, letzte_nr)
    VALUES (NEW.company_id, jahr_int, 1)
    ON CONFLICT (company_id, jahr)
      DO UPDATE SET letzte_nr = c.letzte_nr + 1
    RETURNING c.letzte_nr INTO next_nr;

    NEW.rechnung_nr := 'RE-' || jahr_int::TEXT || '-' || LPAD(next_nr::TEXT, 4, '0');
  END IF;

  IF NEW.faellig_am IS NULL THEN
    NEW.faellig_am := NEW.datum + 30;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: generate_recurring_appointments(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_recurring_appointments(p_parent_id uuid, p_end_date date DEFAULT NULL::date) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_parent RECORD;
  v_next_date DATE;
  v_count INTEGER := 0;
  v_end_date DATE;
  v_interval INTERVAL;
BEGIN
  -- Get parent appointment
  SELECT * INTO v_parent
  FROM appointments
  WHERE id = p_parent_id AND is_recurring = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent appointment not found or not recurring';
  END IF;
  
  -- Determine end date (max 1 year ahead)
  v_end_date := COALESCE(p_end_date, v_parent.recurrence_end_date, v_parent.appointment_date + INTERVAL '1 year');
  
  -- Determine interval based on pattern
  v_interval := CASE v_parent.recurrence_pattern
    WHEN 'daily' THEN INTERVAL '1 day'
    WHEN 'weekly' THEN INTERVAL '1 week'
    WHEN 'biweekly' THEN INTERVAL '2 weeks'
    WHEN 'monthly' THEN INTERVAL '1 month'
    ELSE INTERVAL '1 week'
  END;
  
  v_next_date := v_parent.appointment_date + v_interval;
  
  -- Generate recurring appointments
  WHILE v_next_date <= v_end_date LOOP
    -- Check if appointment already exists for this date
    IF NOT EXISTS (
      SELECT 1 FROM appointments
      WHERE parent_appointment_id = p_parent_id
        AND appointment_date = v_next_date
    ) THEN
      INSERT INTO appointments (
        company_id,
        lead_id,
        offer_id,
        appointment_type,
        status,
        appointment_date,
        start_time,
        end_time,
        title,
        description,
        location_address,
        location_plz,
        location_city,
        location_notes,
        customer_first_name,
        customer_last_name,
        customer_email,
        customer_phone,
        assigned_team_member_ids,
        required_vehicles,
        required_equipment,
        is_recurring,
        recurrence_pattern,
        parent_appointment_id
      )
      SELECT
        company_id,
        lead_id,
        offer_id,
        appointment_type,
        'pending', -- New appointments start as pending
        v_next_date,
        start_time,
        end_time,
        title,
        description,
        location_address,
        location_plz,
        location_city,
        location_notes,
        customer_first_name,
        customer_last_name,
        customer_email,
        customer_phone,
        assigned_team_member_ids,
        required_vehicles,
        required_equipment,
        false, -- Child appointments are not recurring themselves
        recurrence_pattern,
        p_parent_id
      FROM appointments
      WHERE id = p_parent_id;
      
      v_count := v_count + 1;
    END IF;
    
    v_next_date := v_next_date + v_interval;
  END LOOP;
  
  RETURN v_count;
END;
$$;


--
-- Name: generate_umzug_nummer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_umzug_nummer() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.anfrage_nummer := 'UMZ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('umzug_anfrage_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generate_unique_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_unique_slug(prefix text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$;


--
-- Name: get_admin_activity_log(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_activity_log(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, user_id uuid, user_email text, action text, entity_type text, entity_id text, details jsonb, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() 
    AND u.email = 'test@test.invalid'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Owner access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    a.user_email,
    a.action,
    a.entity_type,
    a.entity_id,
    a.details,
    a.created_at
  FROM admin_activity_log a
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


--
-- Name: get_agb_sections_by_offer_token(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_agb_sections_by_offer_token(p_access_token text, p_service_type text DEFAULT NULL::text) RETURNS TABLE(id uuid, company_id uuid, title text, content text, service_type text, display_order integer, is_active boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    a.id,
    a.company_id,
    public.i18n_text(a.title, a.translations, o.language, 'title')     AS title,
    public.i18n_text(a.content, a.translations, o.language, 'content') AS content,
    a.service_type::text,
    a.display_order,
    a.is_active
  FROM public.agb_sections a
  INNER JOIN public.offers o ON o.company_id = a.company_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
    AND a.is_active = true
    AND (p_service_type IS NULL OR a.service_type = p_service_type OR a.service_type IS NULL)
  ORDER BY a.display_order;
$$;


--
-- Name: get_amendment_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_amendment_by_token(p_token text) RETURNS TABLE(id uuid, amendment_number integer, title text, reason text, status text, subtotal numeric, vat_rate numeric, vat_amount numeric, total numeric, language text, sent_at timestamp with time zone, accepted_at timestamp with time zone, rejected_at timestamp with time zone, offer_title text, offer_number integer, company_name text, positionen jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    a.id, a.amendment_number, a.title, a.reason, a.status,
    a.subtotal, a.vat_rate, a.vat_amount, a.total, a.language,
    a.sent_at, a.accepted_at, a.rejected_at,
    o.title::TEXT, o.offer_number, c.company_name::TEXT,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'position', i.position, 'description', i.description,
               'quantity', i.quantity, 'unit', i.unit, 'unit_price', i.unit_price)
             ORDER BY i.position)
      FROM public.offer_amendment_items i WHERE i.amendment_id = a.id
    ), '[]'::jsonb)
  FROM public.offer_amendments a
  JOIN public.offers o    ON o.id = a.offer_id
  JOIN public.companies c ON c.id = a.company_id
  WHERE a.access_token = p_token
    AND a.status IN ('sent', 'viewed', 'accepted', 'rejected');
$$;


--
-- Name: FUNCTION get_amendment_by_token(p_token text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_amendment_by_token(p_token text) IS 'Oeffentliche Sicht auf einen Nachtrag. Entwuerfe sind bewusst nicht dabei — was nicht versendet wurde, hat der Kunde nie bekommen.';


--
-- Name: get_archivable_leads(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_archivable_leads(retention_days integer DEFAULT 90) RETURNS TABLE(id uuid, created_at timestamp with time zone, status text, service_type text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.created_at, l.status, l.service_type
  FROM public.leads l
  WHERE l.created_at < (now() - (retention_days || ' days')::INTERVAL)
    AND l.status IN ('completed', 'cancelled', 'expired', 'rejected')
  ORDER BY l.created_at ASC;
END;
$$;


--
-- Name: get_archivable_offers(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_archivable_offers(retention_days integer DEFAULT 90) RETURNS TABLE(id uuid, created_at timestamp with time zone, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.created_at, o.status
  FROM public.offers o
  WHERE o.created_at < (now() - (retention_days || ' days')::INTERVAL)
    AND o.status IN ('sent', 'accepted', 'rejected', 'expired')
  ORDER BY o.created_at ASC;
END;
$$;


--
-- Name: get_archive_statistics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_archive_statistics() RETURNS TABLE(table_name text, total_records bigint, archivable_records bigint, oldest_record_date timestamp with time zone, estimated_size_mb numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Leads
  RETURN QUERY
  SELECT 
    'leads'::TEXT,
    (SELECT COUNT(*) FROM public.leads)::BIGINT,
    (SELECT COUNT(*) FROM public.leads WHERE created_at < (now() - '90 days'::INTERVAL) AND status IN ('completed', 'cancelled', 'expired', 'rejected'))::BIGINT,
    (SELECT MIN(created_at) FROM public.leads),
    (SELECT pg_total_relation_size('public.leads') / 1024.0 / 1024.0);
    
  -- Offers
  RETURN QUERY
  SELECT 
    'offers'::TEXT,
    (SELECT COUNT(*) FROM public.offers)::BIGINT,
    (SELECT COUNT(*) FROM public.offers WHERE created_at < (now() - '90 days'::INTERVAL) AND status IN ('sent', 'accepted', 'rejected', 'expired'))::BIGINT,
    (SELECT MIN(created_at) FROM public.offers),
    (SELECT pg_total_relation_size('public.offers') / 1024.0 / 1024.0);
    
  -- Email Logs
  RETURN QUERY
  SELECT 
    'email_logs'::TEXT,
    (SELECT COUNT(*) FROM public.email_logs)::BIGINT,
    (SELECT COUNT(*) FROM public.email_logs WHERE created_at < (now() - '90 days'::INTERVAL))::BIGINT,
    (SELECT MIN(created_at) FROM public.email_logs),
    (SELECT pg_total_relation_size('public.email_logs') / 1024.0 / 1024.0);
    
  -- Notifications
  RETURN QUERY
  SELECT 
    'notifications'::TEXT,
    (SELECT COUNT(*) FROM public.notifications)::BIGINT,
    (SELECT COUNT(*) FROM public.notifications WHERE created_at < (now() - '30 days'::INTERVAL) AND read = true)::BIGINT,
    (SELECT MIN(created_at) FROM public.notifications),
    (SELECT pg_total_relation_size('public.notifications') / 1024.0 / 1024.0);
END;
$$;


--
-- Name: get_auftraege_needing_customer_reminders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_auftraege_needing_customer_reminders() RETURNS TABLE(auftrag_id uuid, company_id uuid, company_name character varying, auftrag_nummer character varying, title character varying, customer_name character varying, customer_email character varying, customer_phone character varying, from_address text, to_address text, scheduled_date date, scheduled_time time without time zone, estimated_duration_minutes integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS auftrag_id,
    a.company_id,
    c.company_name,
    a.auftrag_nummer,
    a.title,
    a.customer_name,
    a.customer_email,
    a.customer_phone,
    a.from_address,
    a.to_address,
    a.scheduled_date,
    a.scheduled_time,
    a.estimated_duration_minutes
  FROM public.auftraege a
  JOIN public.companies c ON c.id = a.company_id
  WHERE a.status IN ('geplant', 'bestaetigt')
    AND a.deleted_at IS NULL
    AND a.customer_email IS NOT NULL
    AND a.customer_email <> ''
    AND a.customer_reminder_sent = FALSE
    AND a.scheduled_date = CURRENT_DATE + INTERVAL '1 day' * a.reminder_days_before;
END;
$$;


--
-- Name: FUNCTION get_auftraege_needing_customer_reminders(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_auftraege_needing_customer_reminders() IS 'Yaklaşan işler için müşteriye gönderilecek hatırlatmaları döndürür. Ekip lideri atanmış olması şart değildir; müşteri e-postası olması yeterlidir.';


--
-- Name: get_auftraege_needing_reminders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_auftraege_needing_reminders() RETURNS TABLE(auftrag_id uuid, company_id uuid, company_name character varying, company_email character varying, auftrag_nummer character varying, title character varying, customer_name character varying, customer_email character varying, customer_phone character varying, from_address text, to_address text, scheduled_date date, scheduled_time time without time zone, estimated_duration_minutes integer, description text, special_instructions text, team_leader_id uuid, team_leader_name character varying, team_leader_email character varying, assigned_team_members uuid[])
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS auftrag_id,
    a.company_id,
    c.company_name,
    c.email AS company_email,
    a.auftrag_nummer,
    a.title,
    a.customer_name,
    a.customer_email,
    a.customer_phone,
    a.from_address,
    a.to_address,
    a.scheduled_date,
    a.scheduled_time,
    a.estimated_duration_minutes,
    a.description,
    a.special_instructions,
    a.team_leader_id,
    CONCAT(tm.first_name, ' ', tm.last_name)::VARCHAR AS team_leader_name,
    tm.email::character varying AS team_leader_email,   -- was TEXT → varchar mismatch
    a.assigned_team_members
  FROM public.auftraege a
  JOIN public.companies c ON c.id = a.company_id
  LEFT JOIN public.team_members tm ON tm.id = a.team_leader_id
  WHERE a.status IN ('geplant', 'bestaetigt')
    AND a.deleted_at IS NULL
    AND a.team_leader_id IS NOT NULL
    AND a.team_reminder_sent = FALSE
    AND a.scheduled_date = CURRENT_DATE + INTERVAL '1 day' * a.reminder_days_before;
END;
$$;


--
-- Name: get_auth_audit_log(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_auth_audit_log(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, payload jsonb, ip_address text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'auth', 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() 
    AND u.email = 'test@test.invalid'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Owner access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id, 
    a.payload::jsonb, 
    a.ip_address::text, 
    a.created_at
  FROM auth.audit_log_entries a
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


--
-- Name: get_besichtigung_analysis(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_besichtigung_analysis(p_session_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id', a.id,
    'session_id', a.session_id,
    'estimated_volume_m3', a.estimated_volume_m3,
    'estimated_time_hours', a.estimated_time_hours,
    'recommended_workers', a.recommended_workers,
    'recommended_truck', a.recommended_truck,
    'room_breakdown', a.room_breakdown,
    'detected_items', a.detected_items,
    'special_items', a.special_items,
    'special_requirements', a.special_requirements,
    'from_access_difficulty', a.from_access_difficulty,
    'from_floor', a.from_floor,
    'from_has_lift', a.from_has_lift,
    'from_parking_distance', a.from_parking_distance,
    'confidence', a.confidence,
    'analyzed_at', a.analyzed_at
  )
  INTO v_result
  FROM besichtigung.ai_analysis a
  WHERE a.session_id = p_session_id
  ORDER BY a.analyzed_at DESC
  LIMIT 1;

  RETURN v_result;
END;
$$;


--
-- Name: get_besichtigung_photos(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_besichtigung_photos(p_session_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', p.id,
      'room_type', p.room_type,
      'filename', p.filename,
      'storage_path', p.storage_path,
      'uploaded_at', p.uploaded_at
    ) ORDER BY p.uploaded_at ASC
  ), '[]'::json) INTO v_result
  FROM besichtigung.photos p
  WHERE p.session_id = p_session_id;

  RETURN v_result;
END;
$$;


--
-- Name: get_besichtigung_session_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_besichtigung_session_by_token(p_token text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id', s.id,
    'status', s.status,
    'customer_name', s.customer_name,
    'from_address', s.from_address,
    'from_plz', s.from_plz,
    'from_city', s.from_city,
    'expires_at', s.expires_at,
    'company_id', s.company_id,
    'customer_notes', s.customer_notes
  ) INTO v_result
  FROM besichtigung.sessions s
  WHERE s.token = p_token;

  RETURN v_result;
END;
$$;


--
-- Name: get_besichtigung_videos(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_besichtigung_videos(p_session_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', v.id,
      'filename', v.filename,
      'storage_path', v.storage_path,
      'uploaded_at', v.uploaded_at
    ) ORDER BY v.uploaded_at ASC
  ), '[]'::json) INTO v_result
  FROM besichtigung.videos v
  WHERE v.session_id = p_session_id;

  RETURN v_result;
END;
$$;


--
-- Name: get_box_rental_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_box_rental_stats(p_company_id uuid) RETURNS TABLE(total_active integer, overdue integer, urgent integer, pickup_today integer, pickup_this_week integer, total_boxes_out integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE expected_return_date < CURRENT_DATE)::INTEGER,
    -- Dieselbe Bedingung wie das Band auf der Boxenseite: heute oder frueher
    -- faellig. Schliesst `overdue` mit ein.
    COUNT(*) FILTER (WHERE expected_return_date <= CURRENT_DATE)::INTEGER,
    COUNT(*) FILTER (WHERE expected_return_date = CURRENT_DATE
                        OR pickup_scheduled_date = CURRENT_DATE)::INTEGER,
    COUNT(*) FILTER (WHERE expected_return_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::INTEGER,
    COALESCE(SUM(get_total_box_quantity(box_items)), 0)::INTEGER
  FROM public.umzugsbox_rentals
  WHERE company_id = p_company_id
    AND status IN ('delivered', 'in_use', 'pickup_requested', 'pickup_scheduled')
    AND is_rental = true
    AND archived_at IS NULL;
END;
$$;


--
-- Name: FUNCTION get_box_rental_stats(p_company_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_box_rental_stats(p_company_id uuid) IS 'Kennzahlen der Boxenvermietung. `urgent` (heute oder frueher faellig) ist die Zahl, die das Abzeichen in der Seitenleiste und das Band auf der Boxenseite gemeinsam benutzen — damit beide dasselbe meinen.';


--
-- Name: get_checklist_by_offer_token(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_checklist_by_offer_token(p_access_token text, p_service_type text DEFAULT NULL::text) RETURNS TABLE(id uuid, title text, subtitle text, sections jsonb, service_type text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    ct.id,
    public.i18n_text(ct.title, ct.translations, o.language, 'title')        AS title,
    public.i18n_text(ct.subtitle, ct.translations, o.language, 'subtitle')  AS subtitle,
    public.i18n_jsonb(ct.sections, ct.translations, o.language, 'sections') AS sections,
    ct.service_type::text
  FROM public.checklist_templates ct
  INNER JOIN public.offers o ON o.company_id = ct.company_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
    AND ct.is_active = true
    AND ct.include_in_offerte = true
    AND (p_service_type IS NULL OR ct.service_type = p_service_type)
  LIMIT 1;
$$;


--
-- Name: get_companies_needing_reminders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_companies_needing_reminders() RETURNS TABLE(company_id uuid, company_name text, email text, notification_email text, expires_at timestamp with time zone, days_until_expiry integer, reminder_type text, last_reminder_type text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS company_id,
    c.company_name,
    c.email,
    c.notification_email,
    c.subscription_expires_at AS expires_at,
    EXTRACT(DAY FROM (c.subscription_expires_at - NOW()))::INTEGER AS days_until_expiry,
    CASE
      WHEN c.subscription_expires_at <= NOW() THEN 'expired'
      WHEN c.subscription_expires_at <= NOW() + INTERVAL '1 day' THEN 'expiry_1_day'
      WHEN c.subscription_expires_at <= NOW() + INTERVAL '3 days' THEN 'expiry_3_days'
      WHEN c.subscription_expires_at <= NOW() + INTERVAL '7 days' THEN 'expiry_7_days'
      WHEN c.subscription_expires_at <= NOW() + INTERVAL '14 days' THEN 'expiry_14_days'
      WHEN c.subscription_expires_at <= NOW() + INTERVAL '30 days' THEN 'expiry_30_days'
      ELSE NULL
    END AS reminder_type,
    c.last_reminder_type
  FROM public.companies c
  WHERE 
    c.crm_enabled = TRUE
    AND c.subscription_expires_at IS NOT NULL
    AND c.subscription_expires_at <= NOW() + INTERVAL '30 days';
END;
$$;


--
-- Name: FUNCTION get_companies_needing_reminders(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_companies_needing_reminders() IS 'Returns companies that need expiry reminder emails';


--
-- Name: get_company_besichtigung_sessions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_company_besichtigung_sessions(p_company_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_to_json(s_row) ORDER BY s_row.created_at DESC)
  INTO v_result
  FROM (
    SELECT
      s.id,
      s.token,
      s.status,
      s.customer_name,
      s.customer_email,
      s.customer_phone,
      s.from_address,
      s.from_plz,
      s.from_city,
      s.expires_at,
      s.created_at,
      s.uploaded_at,
      s.customer_notes,
      (SELECT COUNT(*)::int FROM besichtigung.photos p WHERE p.session_id = s.id) AS photo_count,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', p.id,
              'room_type', p.room_type,
              'filename', p.filename,
              'storage_path', p.storage_path,
              'uploaded_at', p.uploaded_at
            )
            ORDER BY p.uploaded_at ASC
          )
          FROM besichtigung.photos p
          WHERE p.session_id = s.id
        ),
        '[]'::json
      ) AS photos
    FROM besichtigung.sessions s
    WHERE s.company_id = p_company_id
  ) s_row;

  -- Return empty array instead of null
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;


--
-- Name: get_company_id_from_offer_token(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_company_id_from_offer_token(offer_id uuid, token text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT company_id
  FROM public.offers
  WHERE id = offer_id
    AND access_token = token
$$;


--
-- Name: get_company_pricing_config(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_company_pricing_config(p_company_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_config JSONB;
  v_has_access BOOLEAN;
BEGIN
  -- Input validation
  IF p_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check authorization (even though SECURITY DEFINER bypasses RLS)
  SELECT EXISTS(
    SELECT 1 FROM public.companies WHERE id = p_company_id AND user_id = auth.uid()
    UNION
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ) INTO v_has_access;
  
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied to company pricing config'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- Get config
  SELECT jsonb_build_object(
    'id', id,
    'companyId', company_id,
    'currency', currency,
    'vatRate', vat_rate,
    'minimumHours', minimum_hours,
    'minimumCharge', minimum_charge,
    'teamRates', team_rates,
    'hourlyRate', hourly_rate,
    'vehiclePrices', vehicle_prices,
    'distanceSurchargeRate', distance_surcharge_rate,
    'distanceSurchargeThreshold', distance_surcharge_threshold,
    'surcharges', surcharges,
    'floorSurcharges', floor_surcharges,
    'equipment', equipment,
    'packingServiceRate', packing_service_rate,
    'externalLiftCost', external_lift_cost,
    'disposalCost', disposal_cost,
    'pianoTransportCost', piano_transport_cost,
    'storageCostPerM3', storage_cost_per_m3,
    'multipliers', multipliers,
    'templateId', template_id,
    'templateName', template_name,
    'isActive', is_active,
    'updatedAt', updated_at
  ) INTO v_config
  FROM public.company_pricing_configs
  WHERE company_id = p_company_id
    AND is_active = true
  LIMIT 1;
  
  RETURN v_config;
END;
$$;


--
-- Name: FUNCTION get_company_pricing_config(p_company_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_company_pricing_config(p_company_id uuid) IS 'Securely retrieves company pricing configuration with proper authorization checks.';


--
-- Name: get_company_pricing_history(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_company_pricing_history(p_company_id uuid, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, action text, old_values jsonb, new_values jsonb, changed_by uuid, changed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Check authorization
  IF NOT EXISTS(
    SELECT 1 FROM public.companies WHERE id = p_company_id AND user_id = auth.uid()
    UNION
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Access denied'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.old_values,
    al.new_values,
    al.changed_by,
    al.changed_at
  FROM public.company_pricing_audit_log al
  WHERE al.company_id = p_company_id
  ORDER BY al.changed_at DESC
  LIMIT p_limit;
END;
$$;


--
-- Name: FUNCTION get_company_pricing_history(p_company_id uuid, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_company_pricing_history(p_company_id uuid, p_limit integer) IS 'Returns the history of pricing changes for a company.';


--
-- Name: get_offer_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_offer_by_token(offer_access_token text) RETURNS TABLE(id uuid, title character varying, description text, customer_first_name character varying, customer_last_name character varying, customer_email character varying, customer_phone character varying, service_date date, valid_until date, subtotal numeric, vat_rate numeric, vat_amount numeric, total numeric, status character varying, created_at timestamp with time zone, sent_at timestamp with time zone, viewed_at timestamp with time zone, accepted_at timestamp with time zone, rejected_at timestamp with time zone, company_id uuid, lead_id uuid, agb_accepted_at timestamp with time zone, service_type character varying, is_expired boolean, from_street character varying, from_house_number character varying, from_plz character varying, from_city character varying, from_floor integer, from_has_lift boolean, to_street character varying, to_house_number character varying, to_plz character varying, to_city character varying, to_floor integer, to_has_lift boolean, surcharges jsonb, price_model text, hourly_rate numeric, kostendach_max numeric, offerte_type text, discount_percent numeric, from_has_estrich boolean, from_has_keller boolean, language text, is_superseded boolean, version_number integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: get_offer_items_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_offer_items_by_token(p_access_token text) RETURNS TABLE(id uuid, offer_id uuid, description text, quantity numeric, unit text, unit_price numeric, total numeric, price_type text, "position" integer, is_optional boolean, is_highlighted boolean, time_estimate jsonb, service_type text, scheduled_date date, scheduled_start_time time without time zone, scheduled_end_time time without time zone, amount_basis text, kostendach_max numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    oi.id,
    oi.offer_id,
    oi.description,
    oi.quantity,
    oi.unit,
    oi.unit_price,
    oi.total,
    oi.price_type::text,
    oi."position",
    COALESCE(oi.is_optional, false),
    COALESCE(oi.is_highlighted, false),
    oi.time_estimate,
    oi.service_type,
    oi.scheduled_date,
    oi.scheduled_start_time,
    oi.scheduled_end_time,
    oi.amount_basis,
    oi.kostendach_max
  FROM public.offer_items oi
  INNER JOIN public.offers o ON o.id = oi.offer_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
  ORDER BY oi.position;
$$;


--
-- Name: get_plz_distance_km(character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_plz_distance_km(plz1 character varying, plz2 character varying) RETURNS numeric
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  coords1 RECORD;
  coords2 RECORD;
BEGIN
  SELECT latitude, longitude INTO coords1
  FROM public.swiss_plz
  WHERE plz = plz1
  LIMIT 1;
  
  SELECT latitude, longitude INTO coords2
  FROM public.swiss_plz
  WHERE plz = plz2
  LIMIT 1;
  
  IF coords1 IS NULL OR coords2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN public.calculate_distance_km(
    coords1.latitude,
    coords1.longitude,
    coords2.latitude,
    coords2.longitude
  );
END;
$$;


--
-- Name: get_public_company_info(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_company_info(company_uuid uuid) RETURNS TABLE(id uuid, company_name character varying, street character varying, house_number character varying, city character varying, plz character varying, phone character varying, email character varying, website text, logo_url text, primary_color character varying, slogan text, pdf_template text, default_language text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    c.id,
    c.company_name,
    c.street,
    c.house_number,
    c.city,
    c.plz,
    c.phone,
    c.email,
    c.website,
    c.logo_url,
    c.primary_color,
    c.slogan,
    c.pdf_template,
    c.default_language
  FROM public.companies c
  WHERE c.id = company_uuid;
$$;


--
-- Name: get_role_level(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_role_level(role_name text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE role_name
    WHEN 'super_admin' THEN 100
    WHEN 'admin' THEN 50
    WHEN 'moderator' THEN 10
    WHEN 'user' THEN 1
    ELSE 0
  END
$$;


--
-- Name: get_total_box_quantity(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_total_box_quantity(box_items_json jsonb) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  total INTEGER := 0;
  item JSONB;
BEGIN
  IF box_items_json IS NULL OR jsonb_array_length(box_items_json) = 0 THEN
    RETURN 0;
  END IF;
  
  FOR item IN SELECT * FROM jsonb_array_elements(box_items_json)
  LOOP
    total := total + COALESCE((item->>'quantity')::INTEGER, 0);
  END LOOP;
  
  RETURN total;
END;
$$;


--
-- Name: get_user_company_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_company_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
$$;


--
-- Name: get_user_overview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_overview() RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, role text, user_type text, last_sign_in_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'auth', 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() 
    AND u.email = 'test@test.invalid'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Owner access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email::text,
    p.first_name,
    p.last_name,
    COALESCE(ur.role::text, 'user') as role,
    CASE 
      WHEN ur.role IS NOT NULL THEN 'staff'
      WHEN c.id IS NOT NULL THEN 'company'
      ELSE 'unknown'
    END as user_type,
    u.last_sign_in_at,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.companies c ON c.user_id = u.id
  WHERE u.email != 'test@test.invalid'
  ORDER BY u.last_sign_in_at DESC NULLS LAST;
END;
$$;


--
-- Name: grant_trial(uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_trial(p_company_id uuid, p_days integer DEFAULT 14, p_granted_by uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_new_expires TIMESTAMPTZ;
BEGIN
  v_new_expires := NOW() + (p_days || ' days')::INTERVAL;

  UPDATE public.companies
  SET
    crm_enabled          = TRUE,
    subscription_type    = 'trial',
    subscription_expires_at = v_new_expires,
    trial_used           = TRUE,
    trial_granted_by     = p_granted_by,
    trial_granted_at     = NOW(),
    crm_enabled_at       = COALESCE(crm_enabled_at, NOW()),
    last_reminder_sent_at = NULL,
    last_reminder_type    = NULL
  WHERE id = p_company_id;

  RETURN FOUND;
END;
$$;


--
-- Name: FUNCTION grant_trial(p_company_id uuid, p_days integer, p_granted_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.grant_trial(p_company_id uuid, p_days integer, p_granted_by uuid) IS 'Admin: grants a free CRM trial to a company (can be called multiple times)';


--
-- Name: guard_allocation_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_allocation_immutable() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.amount      IS DISTINCT FROM OLD.amount
  OR NEW.payment_id  IS DISTINCT FROM OLD.payment_id
  OR NEW.rechnung_id IS DISTINCT FROM OLD.rechnung_id
  OR NEW.company_id  IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION
      'Anrechnung %: Betrag und Bezug sind nicht aenderbar. Loeschen und neu buchen.',
      OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: guard_allocation_within_payment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_allocation_within_payment() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_payment  RECORD;
  v_gebucht  NUMERIC(12,2);
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id)
  FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_gebucht
  FROM public.payment_allocations
  WHERE payment_id = v_payment.id;

  -- Vorzeichenrichtig vergleichen: eine Stornozahlung ist negativ, ihre
  -- Anrechnungen sind es auch. ABS macht beide Faelle zu derselben Frage.
  IF ABS(v_gebucht) > ABS(v_payment.amount) THEN
    RAISE EXCEPTION
      'Anrechnung uebersteigt die Zahlung: % von % bereits gebucht.',
      ABS(v_gebucht), ABS(v_payment.amount)
      USING ERRCODE = 'check_violation';
  END IF;

  IF sign(v_gebucht) <> 0 AND sign(v_gebucht) <> sign(v_payment.amount) THEN
    RAISE EXCEPTION 'Anrechnung und Zahlung haben verschiedene Vorzeichen.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: guard_amendment_after_send(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_amendment_after_send() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  erlaubt CONSTANT TEXT[] := ARRAY[
    'status', 'sent_at', 'viewed_at', 'accepted_at', 'rejected_at',
    'customer_response_note', 'accepted_ip',
    'updated_at', 'customer_id', 'auftrag_id', 'locked_at'
  ];
  alt_j JSONB; neu_j JSONB; spalte TEXT;
BEGIN
  IF NEW.status = 'sent' AND OLD.status IS DISTINCT FROM 'sent' AND NEW.locked_at IS NULL THEN
    NEW.locked_at := NOW();
  END IF;

  IF OLD.locked_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- BEWUSST SECURITY INVOKER: in DEFINER waere current_user immer der
  -- Eigentuemer und die Ausnahme wuerde stets greifen.
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  alt_j := to_jsonb(OLD);
  neu_j := to_jsonb(NEW);

  FOR spalte IN
    SELECT a.attname FROM pg_attribute a
    WHERE a.attrelid = TG_RELID AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attgenerated = ''
  LOOP
    IF NOT (spalte = ANY(erlaubt))
       AND (alt_j -> spalte) IS DISTINCT FROM (neu_j -> spalte) THEN
      RAISE EXCEPTION
        'Nachtrag % wurde versendet und ist inhaltlich gesperrt (Feld "%")',
        OLD.amendment_number, spalte
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


--
-- Name: guard_case_events_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_case_events_append_only() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RAISE EXCEPTION 'Der Fallverlauf ist ein Nachweis und wird nicht veraendert.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;


--
-- Name: guard_company_ownership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_company_ownership() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
       AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Eigentuemerwechsel ist ueber die Anwendung nicht erlaubt'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION guard_company_ownership(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.guard_company_ownership() IS 'Verhindert UPDATE companies SET user_id = … aus der Anwendung heraus. companies.user_id ist der Anker mehrerer Alt-Policies (rechnungen, api_keys); ein Wechsel waere eine Rechteausweitung.';


--
-- Name: guard_customer_merge_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_customer_merge_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- BEWUSST SECURITY INVOKER (Default). In einer DEFINER-Funktion waere
  -- current_user immer der Funktionseigentuemer und die Ausnahme wuerde stets
  -- greifen — derselbe Fallstrick, der in guard_company_ownership dokumentiert ist.
  -- merge_customers() laeuft als SECURITY DEFINER und faellt daher in die Ausnahme.
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.merged_into_customer_id IS DISTINCT FROM OLD.merged_into_customer_id
     OR NEW.merged_at IS DISTINCT FROM OLD.merged_at THEN
    RAISE EXCEPTION
      'Zusammenfuehrung laeuft ausschliesslich ueber merge_customers()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_customer_merges_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_customer_merges_append_only() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION 'customer_merges ist ein Nachweis und wird nicht veraendert'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;


--
-- Name: guard_gutschrift_hoehe(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_gutschrift_hoehe() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_rechnungswert NUMERIC(12,2);
  v_gutgeschrieben NUMERIC(12,2);
BEGIN
  SELECT COALESCE(gesamttotal, total, 0) INTO v_rechnungswert
  FROM public.rechnungen WHERE id = NEW.rechnung_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_gutgeschrieben
  FROM public.credit_notes
  WHERE rechnung_id = NEW.rechnung_id AND status = 'versendet';

  IF v_gutgeschrieben > v_rechnungswert THEN
    RAISE EXCEPTION
      'Gutschriften (%) uebersteigen den Rechnungsbetrag (%).',
      v_gutgeschrieben, v_rechnungswert
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: guard_mahnstufe_reihenfolge(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_mahnstufe_reihenfolge() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.level > 1 AND NOT EXISTS (
    SELECT 1 FROM public.invoice_reminders
    WHERE rechnung_id = NEW.rechnung_id AND level = NEW.level - 1
  ) THEN
    RAISE EXCEPTION 'Mahnstufe % setzt Stufe % voraus.', NEW.level, NEW.level - 1
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: guard_offer_content_after_send(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_offer_content_after_send() RETURNS trigger
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


--
-- Name: guard_payment_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_payment_append_only() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  erlaubt TEXT[] := ARRAY['reconciliation_status','reference','note'];
  spalte  TEXT;
  alt_j   JSONB := to_jsonb(OLD);
  neu_j   JSONB := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Zahlungen werden nicht geloescht, sondern storniert (Gegenbuchung).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR spalte IN
    SELECT a.attname FROM pg_attribute a
    WHERE a.attrelid = TG_RELID AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attgenerated = ''
  LOOP
    IF NOT (spalte = ANY(erlaubt))
       AND (alt_j -> spalte) IS DISTINCT FROM (neu_j -> spalte) THEN
      RAISE EXCEPTION
        'Zahlung %: "%" ist nicht nachtraeglich aenderbar. Korrektur nur per Storno.',
        OLD.id, spalte
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


--
-- Name: guard_quittung_bezahlt_braucht_buchung(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_quittung_bezahlt_braucht_buchung() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF COALESCE(NEW.betrag_noch_offen, TRUE) = TRUE
     OR COALESCE(OLD.betrag_noch_offen, TRUE) = FALSE THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_id IS NULL THEN
    RAISE EXCEPTION
      'Quittung % kann nicht als bezahlt gefuehrt werden: kein Zahlungseingang erfasst.',
      NEW.quittung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_quittung_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_quittung_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN OLD;
  END IF;

  IF OLD.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION
      'Quittung % ist im Status "%" und darf nicht geloescht werden.',
      OLD.quittung_nr, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN OLD;
END;
$$;


--
-- Name: guard_quittung_status_regression(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_quittung_status_regression() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('signed', 'sent', 'paid') AND NEW.status = 'draft' THEN
    RAISE EXCEPTION
      'Quittung % kann nicht in den Entwurf zurueckgesetzt werden (Status "%").',
      OLD.quittung_nr, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_rechnung_bezahlt_braucht_deckung(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_rechnung_bezahlt_braucht_deckung() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_offen NUMERIC(12,2);
BEGIN
  IF NEW.status <> 'bezahlt' OR OLD.status = 'bezahlt' THEN
    RETURN NEW;
  END IF;

  v_offen := COALESCE(NEW.gesamttotal, NEW.total, 0) - NEW.paid_total - NEW.credited_total;

  IF v_offen > 0 THEN
    RAISE EXCEPTION
      'Rechnung % kann nicht als bezahlt gefuehrt werden: % offen. Zahlung erfassen statt Status setzen.',
      NEW.rechnung_nr, v_offen
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_rechnung_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_rechnung_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- SECURITY INVOKER (Default): current_user muss der echte Aufrufer sein.
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN OLD;
  END IF;

  IF OLD.status IS DISTINCT FROM 'entwurf' THEN
    RAISE EXCEPTION
      'Rechnung % ist im Status "%" und darf nicht geloescht werden. Bitte stornieren.',
      OLD.rechnung_nr, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN OLD;
END;
$$;


--
-- Name: guard_rechnung_status_regression(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_rechnung_status_regression() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('versendet', 'bezahlt') AND NEW.status = 'entwurf' THEN
    RAISE EXCEPTION
      'Rechnung % kann nicht in den Entwurf zurueckgesetzt werden (Status "%").',
      OLD.rechnung_nr, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_stage_history_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_stage_history_append_only() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF current_user IN ('postgres','supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'sales_stage_history ist ein Verlauf und wird nicht veraendert'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: i18n_jsonb(jsonb, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.i18n_jsonb(p_base jsonb, p_translations jsonb, p_locale text, p_field text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT COALESCE(
    NULLIF(p_translations -> p_locale -> p_field, 'null'::jsonb),
    p_base
  );
$$;


--
-- Name: i18n_text(text, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.i18n_text(p_base text, p_translations jsonb, p_locale text, p_field text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT COALESCE(
    NULLIF(p_translations -> p_locale ->> p_field, ''),
    p_base
  );
$$;


--
-- Name: FUNCTION i18n_text(p_base text, p_translations jsonb, p_locale text, p_field text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.i18n_text(p_base text, p_translations jsonb, p_locale text, p_field text) IS 'Löst ein übersetztes Textfeld auf. Leere oder fehlende Übersetzung fällt auf die deutsche Basisspalte zurück — ein Kunde sieht nie einen leeren Text.';


--
-- Name: inbound_email_in_faden(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inbound_email_in_faden() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_thread UUID;
BEGIN
  v_thread := public.resolve_or_create_thread(
    NEW.company_id, NEW.customer_id, 'email', NEW.subject, NEW.lead_id);
  IF v_thread IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.communication_messages
    (company_id, thread_id, direction, channel, from_address, subject, preview,
     occurred_at, source_table, source_id, external_id)
  VALUES (NEW.company_id, v_thread, 'inbound', 'email', NEW.from_email, NEW.subject,
          NEW.body_preview, COALESCE(NEW.received_at, NOW()),
          'inbound_emails', NEW.id, NEW.provider_message_id)
  ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Posteingang: eingehende Mail nicht eingeordnet: %', SQLERRM;
  RETURN NULL;
END;
$$;


--
-- Name: inbound_emails_set_customer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inbound_emails_set_customer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT f.customer_id INTO NEW.customer_id
  FROM public.find_customer_by_identity(
    NEW.company_id,
    COALESCE(NULLIF(NEW.extracted_data ->> 'email', ''), NEW.from_email),
    NEW.extracted_data ->> 'phone') f;

  IF NEW.customer_id IS NULL THEN
    SELECT f.customer_id INTO NEW.customer_id
    FROM public.find_customer_by_identity(NEW.company_id, NEW.from_email, NULL) f;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'inbound_emails_set_customer: % (E-Mail wird trotzdem gespeichert)', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: increment_blog_view_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_blog_view_count(post_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.blog_posts
  SET view_count = view_count + 1,
      last_viewed_at = NOW()
  WHERE id = post_id;
END;
$$;


--
-- Name: increment_manual_import_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_manual_import_count(p_company_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.manual_import_subscriptions
  SET total_imports_count = total_imports_count + 1
  WHERE company_id = p_company_id AND status = 'active';
END;
$$;


--
-- Name: insert_besichtigung_photo(uuid, text, text, bigint, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_besichtigung_photo(p_session_id uuid, p_storage_path text, p_filename text, p_file_size bigint DEFAULT NULL::bigint, p_mime_type text DEFAULT NULL::text, p_room_type text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  INSERT INTO besichtigung.photos (
    session_id, storage_path, filename, file_size, mime_type, room_type
  ) VALUES (
    p_session_id, p_storage_path, p_filename, p_file_size, p_mime_type, p_room_type
  )
  RETURNING json_build_object(
    'id', id,
    'session_id', session_id,
    'storage_path', storage_path,
    'filename', filename,
    'room_type', room_type,
    'uploaded_at', uploaded_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;


--
-- Name: invoice_reminders_sprache_erben(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invoice_reminders_sprache_erben() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_r RECORD;
BEGIN
  SELECT language, faellig_am, open_amount INTO v_r
  FROM public.rechnungen WHERE id = NEW.rechnung_id;

  NEW.language := COALESCE(NEW.language, v_r.language, 'de');
  NEW.due_date_snapshot := COALESCE(NEW.due_date_snapshot, v_r.faellig_am);
  IF NEW.open_amount_snapshot IS NULL THEN
    NEW.open_amount_snapshot := v_r.open_amount;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: invoke_appointment_reminder(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invoke_appointment_reminder() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT public.invoke_edge_function('notify-appointment-reminder'); $$;


--
-- Name: invoke_edge_function(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invoke_edge_function(p_fn text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ BEGIN RETURN; END; $$;


--
-- Name: invoke_team_reminder(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invoke_team_reminder() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT public.invoke_edge_function('notify-team-reminder'); $$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('super_admin', 'admin', 'moderator')
  )
$$;


--
-- Name: is_company_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_company_member(_company_id uuid, _user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id
      AND user_id    = _user_id
  );
$$;


--
-- Name: FUNCTION is_company_member(_company_id uuid, _user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_company_member(_company_id uuid, _user_id uuid) IS 'Bir kullanıcının belirli bir firmaya üye olup olmadığını kontrol eder. Adım 5 RLS politikalarında kullanılır.';


--
-- Name: is_company_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_company_owner(_company_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND c.user_id = _user_id
  );
$$;


--
-- Name: is_company_role(uuid, text[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_company_role(_company_id uuid, _roles text[], _user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id
      AND user_id    = _user_id
      AND role       = ANY(_roles)
  );
$$;


--
-- Name: FUNCTION is_company_role(_company_id uuid, _roles text[], _user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_company_role(_company_id uuid, _roles text[], _user_id uuid) IS 'Ist der Benutzer Mitglied dieser Firma MIT einer der genannten Rollen? Gegenstück zu is_company_member(), das jede Rolle akzeptiert.';


--
-- Name: is_company_visible_via_offer(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_company_visible_via_offer(company_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.offers
    WHERE company_id = company_uuid
  )
$$;


--
-- Name: is_crm_enabled(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_crm_enabled(p_company_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_crm_enabled BOOLEAN;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT crm_enabled, subscription_expires_at
  INTO v_crm_enabled, v_expires_at
  FROM public.companies
  WHERE id = p_company_id;
  
  -- If not found, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- If CRM is not enabled, return false
  IF NOT v_crm_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- If there's an expiry date, check if it's still valid
  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;


--
-- Name: is_staff(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('super_admin', 'admin', 'moderator')
  )
$$;


--
-- Name: is_super_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'super_admin'
  )
$$;


--
-- Name: is_support_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_support_admin() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'moderator')
  );
END;
$$;


--
-- Name: leads_record_stage_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leads_record_stage_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.sales_stage IS DISTINCT FROM OLD.sales_stage AND NEW.company_id IS NOT NULL THEN
    INSERT INTO public.sales_stage_history (company_id, lead_id, from_stage, to_stage, changed_by,
                                            source)
    VALUES (NEW.company_id, NEW.id, OLD.sales_stage, NEW.sales_stage, auth.uid(),
            COALESCE(current_setting('crm.stage_source', true), 'manual'));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'leads_record_stage_change: %', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: leads_set_customer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leads_set_customer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_res JSONB;
BEGIN
  IF NEW.customer_id IS NOT NULL OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_res := public.resolve_or_create_customer(
    NEW.company_id, NEW.customer_email, NEW.customer_phone,
    NEW.customer_first_name, NEW.customer_last_name, NULL,
    NEW.customer_salutation, NEW.language, COALESCE(NEW.source, 'lead'),
    COALESCE(NEW.created_at, NOW()));

  NEW.customer_id := NULLIF(v_res ->> 'customer_id', '')::UUID;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'leads_set_customer: % (Anfrage wird trotzdem gespeichert)', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: lifecycle_kpis(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lifecycle_kpis(p_company_id uuid, p_von date DEFAULT NULL::date, p_bis date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_von DATE := COALESCE(p_von, CURRENT_DATE - 365);
  v_bis DATE := COALESCE(p_bis, CURRENT_DATE);
  v_erg JSONB;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  WITH
  -- Kohorte 1: Anfragen, die IM ZEITRAUM entstanden sind.
  anfragen AS (
    SELECT l.* FROM public.leads l
    WHERE l.company_id = p_company_id
      AND l.created_at::DATE BETWEEN v_von AND v_bis
  ),
  -- Serien statt Zeilen. Eine Serie gilt als versendet, sobald irgendeine
  -- ihrer Fassungen versendet wurde.
  serien AS (
    SELECT o.offer_series_id,
           MIN(o.lead_id::TEXT)::UUID          AS lead_id,
           MIN(o.customer_id::TEXT)::UUID      AS customer_id,
           MIN(o.sent_at)                      AS erst_versand,
           BOOL_OR(o.status <> 'draft')        AS je_heraus,
           BOOL_OR(o.status = 'accepted')      AS angenommen,
           MIN(o.viewed_at)  FILTER (WHERE o.status = 'accepted')   AS angesehen_am,
           MIN(o.accepted_at) FILTER (WHERE o.status = 'accepted')  AS angenommen_am
    FROM public.offers o
    WHERE o.company_id = p_company_id AND o.offer_series_id IS NOT NULL
    GROUP BY o.offer_series_id
  ),
  -- Kohorte 2: Serien, die IM ZEITRAUM zum ersten Mal hinausgingen.
  serien_im_zeitraum AS (
    SELECT * FROM serien WHERE erst_versand::DATE BETWEEN v_von AND v_bis
  ),
  erstkontakt AS (
    SELECT a.id,
           a.created_at,
           LEAST(
             (SELECT MIN(m.occurred_at) FROM public.communication_messages m
              JOIN public.communication_threads t ON t.id = m.thread_id
              WHERE m.direction = 'outbound'
                AND (t.lead_id = a.id OR (a.customer_id IS NOT NULL AND t.customer_id = a.customer_id))
                AND m.occurred_at >= a.created_at),
             (SELECT MIN(s.erst_versand) FROM serien s WHERE s.lead_id = a.id)
           ) AS erste_reaktion
    FROM anfragen a
  ),
  zahlung_je_kunde AS (
    SELECT p.customer_id, SUM(p.amount) AS summe
    FROM public.payments p
    WHERE p.company_id = p_company_id AND p.customer_id IS NOT NULL
    GROUP BY p.customer_id
  ),
  -- Vollstaendig bezahlte Rechnungen: Datum der letzten Anrechnung.
  tilgung AS (
    SELECT r.id, r.datum,
           (SELECT MAX(z.payment_date) FROM public.payment_allocations al
            JOIN public.payments z ON z.id = al.payment_id
            WHERE al.rechnung_id = r.id) AS getilgt_am
    FROM public.rechnungen r
    WHERE r.company_id = p_company_id
      AND r.status <> 'entwurf'
      AND r.open_amount <= 0
      AND r.datum BETWEEN v_von AND v_bis
  ),
  abgeschlossene_auftraege AS (
    SELECT g.* FROM public.auftraege g
    WHERE g.company_id = p_company_id AND g.deleted_at IS NULL
      AND g.status = 'abgeschlossen'
      AND COALESCE(g.completed_at::DATE, g.scheduled_date) BETWEEN v_von AND v_bis
  )
  SELECT jsonb_build_object(
    'zeitraum', jsonb_build_object('von', v_von, 'bis', v_bis),

    'trichter', jsonb_build_object(
      -- Nenner ausgeschrieben, damit die Zahl lesbar bleibt.
      'anfragen',            (SELECT COUNT(*) FROM anfragen),
      'anfragen_mit_offerte', (SELECT COUNT(*) FROM anfragen a
                               WHERE EXISTS (SELECT 1 FROM serien s
                                             WHERE s.lead_id = a.id AND s.je_heraus)),
      'serien_versendet',    (SELECT COUNT(*) FROM serien_im_zeitraum),
      'serien_angenommen',   (SELECT COUNT(*) FROM serien_im_zeitraum WHERE angenommen)
    ),

    'dauer_tage', jsonb_build_object(
      'erste_reaktion', (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (erste_reaktion - created_at)) / 86400)::NUMERIC, 2)
                         FROM erstkontakt WHERE erste_reaktion IS NOT NULL),
      'bis_offerte',    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (s.erst_versand - l.created_at)) / 86400)::NUMERIC, 2)
                         FROM serien s JOIN public.leads l ON l.id = s.lead_id
                         WHERE l.company_id = p_company_id
                           AND s.erst_versand::DATE BETWEEN v_von AND v_bis),
      'ansicht_bis_annahme', (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (angenommen_am - angesehen_am)) / 86400)::NUMERIC, 2)
                         FROM serien_im_zeitraum
                         WHERE angesehen_am IS NOT NULL AND angenommen_am IS NOT NULL),
      'bis_tilgung',    (SELECT ROUND(AVG(getilgt_am - datum)::NUMERIC, 2)
                         FROM tilgung WHERE getilgt_am IS NOT NULL)
    ),

    'verlustgruende', COALESCE((
      SELECT jsonb_object_agg(grund, n) FROM (
        SELECT COALESCE(lost_reason_code, 'ohne_angabe') AS grund, COUNT(*) AS n
        FROM anfragen WHERE sales_stage = 'lost' GROUP BY 1
      ) x), '{}'::jsonb),

    'kunden', jsonb_build_object(
      'gesamt',        (SELECT COUNT(*) FROM public.customers
                        WHERE company_id = p_company_id AND merged_into_customer_id IS NULL),
      -- Ueber ALLE Zeitraeume: ein Lebenswert, der nur den Zeitraum kennt,
      -- ist kein Lebenswert.
      'ltv_schnitt',   (SELECT ROUND(AVG(summe), 2) FROM zahlung_je_kunde),
      'ltv_summe',     (SELECT COALESCE(SUM(summe), 0) FROM zahlung_je_kunde),
      'wiederkehrend', (SELECT COUNT(*) FROM (
                          SELECT customer_id FROM public.leads
                          WHERE company_id = p_company_id AND customer_id IS NOT NULL
                            AND sales_stage = 'won'
                          GROUP BY customer_id HAVING COUNT(*) > 1) x),
      'cross_sell',    (SELECT COUNT(*) FROM (
                          SELECT customer_id FROM public.leads
                          WHERE company_id = p_company_id AND customer_id IS NOT NULL
                          GROUP BY customer_id HAVING COUNT(DISTINCT service_type) > 1) x)
    ),

    'geld', jsonb_build_object(
      'kassiert',      (SELECT COALESCE(SUM(amount), 0) FROM public.payments
                        WHERE company_id = p_company_id AND payment_date BETWEEN v_von AND v_bis),
      'offen',         (SELECT COALESCE(SUM(open_amount), 0) FROM public.rechnungen
                        WHERE company_id = p_company_id AND status <> 'entwurf' AND open_amount > 0),
      'gutschriften',  (SELECT COALESCE(SUM(amount), 0) FROM public.credit_notes
                        WHERE company_id = p_company_id AND status = 'versendet'
                          AND datum BETWEEN v_von AND v_bis)
    ),

    'qualitaet', jsonb_build_object(
      'auftraege_abgeschlossen', (SELECT COUNT(*) FROM abgeschlossene_auftraege),
      'faelle',        (SELECT COUNT(*) FROM public.customer_cases c
                        WHERE c.company_id = p_company_id
                          AND c.reported_at::DATE BETWEEN v_von AND v_bis),
      'schaeden',      (SELECT COUNT(*) FROM public.customer_cases c
                        WHERE c.company_id = p_company_id AND c.case_type = 'damage'
                          AND c.reported_at::DATE BETWEEN v_von AND v_bis),
      'reklamationen', (SELECT COUNT(*) FROM public.customer_cases c
                        WHERE c.company_id = p_company_id AND c.case_type = 'complaint'
                          AND c.reported_at::DATE BETWEEN v_von AND v_bis),
      'nachreinigungen', (SELECT COUNT(*) FROM public.customer_cases c
                        WHERE c.company_id = p_company_id AND c.case_type = 'recleaning'
                          AND c.reported_at::DATE BETWEEN v_von AND v_bis)
    ),

    'posteingang', jsonb_build_object(
      'faeden_offen',  (SELECT COUNT(*) FROM public.communication_threads
                        WHERE company_id = p_company_id AND status <> 'erledigt'),
      'unbeantwortet', (SELECT COUNT(*) FROM public.communication_threads
                        WHERE company_id = p_company_id AND first_unanswered_at IS NOT NULL),
      'aeltester_unbeantwortet_tage', (SELECT ROUND(EXTRACT(EPOCH FROM (NOW() - MIN(first_unanswered_at))) / 86400)
                        FROM public.communication_threads
                        WHERE company_id = p_company_id AND first_unanswered_at IS NOT NULL)
    )
  ) INTO v_erg;

  RETURN v_erg;
END;
$$;


--
-- Name: FUNCTION lifecycle_kpis(p_company_id uuid, p_von date, p_bis date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.lifecycle_kpis(p_company_id uuid, p_von date, p_bis date) IS 'Kennzahlen des Kundenlebenszyklus. Gezaehlt wird die offer_series_id, nicht die Offertenzeile — sonst senkt jede Ueberarbeitung die Annahmequote. Jeder Quotient traegt Zaehler UND Nenner, damit die Zahl lesbar bleibt.';


--
-- Name: log_appointment_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_appointment_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO appointment_history (appointment_id, change_type, new_data, changed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO appointment_history (appointment_id, change_type, old_data, new_data, changed_by)
    VALUES (NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: map_auftrag_to_appointment_status(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.map_auftrag_to_appointment_status(p_status text) RETURNS public.appointment_status
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE p_status
    WHEN 'geplant'        THEN 'pending'::public.appointment_status
    WHEN 'bestaetigt'     THEN 'confirmed'::public.appointment_status
    WHEN 'in_bearbeitung' THEN 'confirmed'::public.appointment_status
    WHEN 'abgeschlossen'  THEN 'completed'::public.appointment_status
    WHEN 'storniert'      THEN 'cancelled'::public.appointment_status
    ELSE 'pending'::public.appointment_status
  END;
$$;


--
-- Name: merge_customers(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_customers(p_company_id uuid, p_source_customer_id uuid, p_target_customer_id uuid, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_src   public.customers;
  v_tgt   public.customers;
  v_moved JSONB := '{}'::JSONB;
  v_n     INTEGER;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Zusammenfuehren ist owner und admin vorbehalten'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_source_customer_id = p_target_customer_id THEN
    RAISE EXCEPTION 'Quelle und Ziel sind identisch'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Nach id sortiert sperren, sonst verklemmen sich zwei gegenlaeufige Merges.
  PERFORM 1 FROM public.customers
   WHERE id IN (p_source_customer_id, p_target_customer_id)
   ORDER BY id FOR UPDATE;

  SELECT * INTO v_src FROM public.customers WHERE id = p_source_customer_id;
  SELECT * INTO v_tgt FROM public.customers WHERE id = p_target_customer_id;

  IF v_src.id IS NULL OR v_tgt.id IS NULL
     OR v_src.company_id <> p_company_id OR v_tgt.company_id <> p_company_id THEN
    RAISE EXCEPTION 'Kunde gehoert nicht zu dieser Firma'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_src.merged_into_customer_id IS NOT NULL OR v_tgt.merged_into_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bereits zusammengefuehrte Kunden'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.leads SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('leads', v_n);

  UPDATE public.offers SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('offers', v_n);

  UPDATE public.auftraege SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('auftraege', v_n);

  UPDATE public.appointments SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('appointments', v_n);

  UPDATE public.rechnungen SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('rechnungen', v_n);

  UPDATE public.quittungen SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('quittungen', v_n);

  UPDATE public.inbound_emails SET customer_id = v_tgt.id WHERE customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('inbound_emails', v_n);

  -- Nur Luecken im Ziel fuellen, NIE ueberschreiben.
  UPDATE public.customers SET
    first_name               = COALESCE(first_name,               v_src.first_name),
    last_name                = COALESCE(last_name,                v_src.last_name),
    company_name             = COALESCE(company_name,             v_src.company_name),
    primary_email            = COALESCE(primary_email,            v_src.primary_email),
    primary_phone            = COALESCE(primary_phone,            v_src.primary_phone),
    salutation               = COALESCE(salutation,               v_src.salutation),
    external_customer_number = COALESCE(external_customer_number, v_src.external_customer_number),
    notes                    = COALESCE(notes,                    v_src.notes),
    source                   = COALESCE(source,                   v_src.source),
    first_seen_at            = LEAST(first_seen_at, v_src.first_seen_at),
    possible_duplicate       = FALSE
  WHERE id = v_tgt.id;

  INSERT INTO public.customer_merges (
    company_id, source_customer_id, target_customer_id, merged_by,
    reason, moved_counts, source_snapshot)
  VALUES (p_company_id, v_src.id, v_tgt.id, auth.uid(),
          NULLIF(TRIM(COALESCE(p_reason, '')), ''), v_moved, to_jsonb(v_src));

  -- Die Quellzeile bleibt als Weiterleitung stehen. Der partielle UNIQUE-Index
  -- auf customers greift nur bei merged_into_customer_id IS NULL — die E-Mail
  -- gibt den Index in diesem Moment frei, es entsteht kein Konflikt.
  UPDATE public.customers
  SET merged_into_customer_id = v_tgt.id,
      merged_at               = NOW(),
      status                  = 'inactive'
  WHERE id = v_src.id;

  RETURN jsonb_build_object('target_customer_id', v_tgt.id, 'moved', v_moved);
END;
$$;


--
-- Name: FUNCTION merge_customers(p_company_id uuid, p_source_customer_id uuid, p_target_customer_id uuid, p_reason text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.merge_customers(p_company_id uuid, p_source_customer_id uuid, p_target_customer_id uuid, p_reason text) IS 'Fuehrt zwei Kunden zusammen. Die Quellzeile wird NICHT geloescht, sondern zur Weiterleitung — alte Links loesen weiter auf. Nicht ruecknehmbar; der Nachweis inklusive vollstaendiger Quellzeile steht in customer_merges.';


--
-- Name: normalize_customer_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_customer_email(p_email text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT NULLIF(LOWER(TRIM(p_email)), '');
$$;


--
-- Name: FUNCTION normalize_customer_email(p_email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.normalize_customer_email(p_email text) IS 'Kanonische Form einer E-Mail fuer den Kundenabgleich: trim + lower, Leerstring wird NULL. BEWUSST OHNE anbieterspezifische Regeln (Gmail-Punkte, Plus-Adressen) — bei anderen Anbietern sind das verschiedene Personen.';


--
-- Name: normalize_customer_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_customer_phone(p_phone text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    AS $$
DECLARE
  v TEXT;
  d TEXT;
BEGIN
  IF p_phone IS NULL THEN
    RETURN NULL;
  END IF;

  v := regexp_replace(p_phone, '[[:space:]\-\(\)\./]', '', 'g');
  IF v = '' THEN
    RETURN NULL;
  END IF;

  IF v LIKE '+%' THEN
    d := regexp_replace(substr(v, 2), '\D', '', 'g');
    RETURN CASE WHEN length(d) >= 7 THEN '+' || d END;
  ELSIF v LIKE '0041%' THEN
    d := regexp_replace(substr(v, 5), '\D', '', 'g');
    RETURN CASE WHEN length(d) >= 7 THEN '+41' || d END;
  ELSIF v LIKE '00%' THEN
    d := regexp_replace(substr(v, 3), '\D', '', 'g');
    RETURN CASE WHEN length(d) >= 9 THEN '+' || d END;
  ELSIF v LIKE '0%' THEN
    d := regexp_replace(substr(v, 2), '\D', '', 'g');
    RETURN CASE WHEN length(d) >= 8 THEN '+41' || d END;
  END IF;

  -- Kein erkennbares Praefix ("79 123 45 67") — mehrdeutig, wird verworfen.
  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION normalize_customer_phone(p_phone text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.normalize_customer_phone(p_phone text) IS 'E.164 mit Schweizer Vorgabe. SQL-Gegenstueck zu normalizePhoneToE164() in notify-appointment-reminder. Nummern ohne erkennbares Praefix werden verworfen, nicht geraten.';


--
-- Name: notify_offer_response(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_offer_response() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Only trigger when status changes to accepted or rejected
    IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status IN ('accepted', 'rejected')) THEN
        INSERT INTO public.notifications (company_id, type, title, body, metadata)
        VALUES (
            NEW.company_id,
            'offer_response',
            CASE 
                WHEN NEW.status = 'accepted' THEN 'Offerte angenommen!'
                ELSE 'Offerte abgelehnt'
            END,
            CASE 
                WHEN NEW.status = 'accepted' THEN NEW.customer_first_name || ' ' || NEW.customer_last_name || ' hat Ihre Offerte angenommen.'
                ELSE NEW.customer_first_name || ' ' || NEW.customer_last_name || ' hat Ihre Offerte abgelehnt.'
            END,
            jsonb_build_object(
                'offer_id', NEW.id,
                'offer_title', NEW.title,
                'customer_name', NEW.customer_first_name || ' ' || NEW.customer_last_name,
                'status', NEW.status,
                'total', NEW.total
            )
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: offer_amendments_inherit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.offer_amendments_inherit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_offer public.offers;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = NEW.offer_id;

  -- Kunde und Sprache kommen von der Offerte, nicht vom Aufrufer.
  NEW.customer_id := COALESCE(NEW.customer_id, v_offer.customer_id);
  NEW.language    := COALESCE(NULLIF(NEW.language, ''), v_offer.language, 'de');
  -- NOT NULL wird erst nach dem Trigger geprueft; ein NULL kommt hier also an
  -- und wird hier gefuellt.
  NEW.auftrag_id  := COALESCE(NEW.auftrag_id,
                              (SELECT a.id FROM public.auftraege a
                               WHERE a.offer_id = NEW.offer_id AND a.deleted_at IS NULL
                               LIMIT 1));

  IF NEW.amendment_number IS NULL OR NEW.amendment_number = 0 THEN
    SELECT COALESCE(MAX(amendment_number), 0) + 1 INTO NEW.amendment_number
    FROM public.offer_amendments WHERE offer_id = NEW.offer_id;
  END IF;

  IF NEW.locked_at IS NULL AND NEW.status IN ('sent','viewed','accepted','rejected') THEN
    NEW.locked_at := COALESCE(NEW.sent_at, NOW());
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'offer_amendments_inherit: %', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: offers_advance_lead_stage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.offers_advance_lead_stage() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ziel TEXT;
  v_ist  TEXT;
  -- Reihenfolge der Stufen; Rueckschritte gibt es nicht.
  rang CONSTANT TEXT[] := ARRAY['new','qualifying','inspection','offer_draft',
                                'offer_sent','negotiating','won','lost'];
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_ziel := CASE NEW.status
              WHEN 'accepted' THEN 'won'
              WHEN 'rejected' THEN 'lost'
              WHEN 'sent'     THEN 'offer_sent'
              WHEN 'viewed'   THEN 'offer_sent'
              WHEN 'draft'    THEN 'offer_draft'
            END;
  IF v_ziel IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sales_stage INTO v_ist FROM public.leads WHERE id = NEW.lead_id;
  IF v_ist IS NULL THEN
    RETURN NEW;
  END IF;

  -- `lost` braucht einen Grund (CHECK). Den kann der Trigger nicht erfinden —
  -- eine abgelehnte Offerte setzt deshalb nur den Grund 'no_response' als
  -- Vorschlag, den der Bediener korrigieren kann.
  IF v_ziel = 'lost' THEN
    UPDATE public.leads
    SET sales_stage      = 'lost',
        lost_reason_code = COALESCE(lost_reason_code, 'no_response')
    WHERE id = NEW.lead_id AND sales_stage <> 'lost';
    RETURN NEW;
  END IF;

  IF array_position(rang, v_ziel) > array_position(rang, v_ist)
     AND v_ist NOT IN ('won','lost') THEN
    UPDATE public.leads SET sales_stage = v_ziel WHERE id = NEW.lead_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'offers_advance_lead_stage: %', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: offers_set_customer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.offers_set_customer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_res JSONB;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_id IS NOT NULL THEN
    SELECT l.customer_id INTO NEW.customer_id
    FROM public.leads l WHERE l.id = NEW.lead_id AND l.company_id = NEW.company_id;
  END IF;

  IF NEW.customer_id IS NULL THEN
    v_res := public.resolve_or_create_customer(
      NEW.company_id, NEW.customer_email, NEW.customer_phone,
      NEW.customer_first_name, NEW.customer_last_name, NULL,
      NEW.customer_salutation, NEW.language, 'offer',
      COALESCE(NEW.created_at, NOW()));
    NEW.customer_id := NULLIF(v_res ->> 'customer_id', '')::UUID;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'offers_set_customer: % (Offerte wird trotzdem gespeichert)', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: offers_set_series(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.offers_set_series() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.offer_series_id IS NULL THEN
    -- Version 1 einer neuen Serie. Eine Revision setzt beides selbst
    -- (create_offer_revision) und laeuft hier vorbei.
    NEW.offer_series_id := NEW.id;
    NEW.version_number  := COALESCE(NEW.version_number, 1);
  END IF;

  -- Wird eine Zeile gleich in einem versendeten Status angelegt (Import, ein
  -- kuenftiger Codepfad), muss sie ebenso gesperrt sein. Ohne das haengt die
  -- Sperre allein am UPDATE-Uebergang und eine solche Offerte bliebe fuer immer
  -- frei aenderbar.
  IF NEW.locked_at IS NULL AND NEW.status IN ('sent', 'viewed', 'accepted', 'rejected') THEN
    NEW.locked_at := COALESCE(NEW.sent_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: open_receivables(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_receivables(p_company_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(rechnung_id uuid, rechnung_nr text, customer_id uuid, customer_name text, datum date, faellig_am date, tage_ueberfaellig integer, gesamt numeric, bezahlt numeric, offen numeric, mahnstufe smallint, total_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH offen AS (
    SELECT r.id, r.rechnung_nr, r.customer_id, r.customer_name, r.datum, r.faellig_am,
           COALESCE(r.gesamttotal, r.total, 0)::NUMERIC(12,2) AS gesamt,
           r.paid_total, r.open_amount
    FROM public.rechnungen r
    WHERE r.company_id = p_company_id
      AND r.status <> 'entwurf'
      AND r.open_amount > 0
  )
  SELECT o.id, o.rechnung_nr, o.customer_id, o.customer_name, o.datum, o.faellig_am,
         GREATEST(0, CURRENT_DATE - o.faellig_am)::INTEGER,
         o.gesamt, o.paid_total, o.open_amount,
         COALESCE((SELECT MAX(m.level) FROM public.invoice_reminders m
                   WHERE m.rechnung_id = o.id), 0::SMALLINT),
         (SELECT COUNT(*) FROM offen)
  FROM offen o
  ORDER BY o.faellig_am NULLS LAST, o.rechnung_nr
  LIMIT GREATEST(1, LEAST(p_limit, 200)) OFFSET GREATEST(0, p_offset);
END;
$$;


--
-- Name: portal_cleanup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_cleanup() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_s INTEGER; v_l INTEGER;
BEGIN
  DELETE FROM public.portal_sessions
  WHERE expires_at < NOW() - INTERVAL '30 days'
     OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days');
  GET DIAGNOSTICS v_s = ROW_COUNT;

  DELETE FROM public.portal_magic_links
  WHERE expires_at < NOW() - INTERVAL '30 days'
    AND NOT EXISTS (SELECT 1 FROM public.portal_sessions s WHERE s.magic_link_id = portal_magic_links.id);
  GET DIAGNOSTICS v_l = ROW_COUNT;

  RETURN jsonb_build_object('sitzungen', v_s, 'links', v_l);
END;
$$;


--
-- Name: portal_create_magic_link(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_create_magic_link(p_customer_id uuid, p_gueltig_tage integer DEFAULT 14) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_kunde  RECORD;
  v_token  TEXT;
  v_id     UUID;
BEGIN
  SELECT * INTO v_kunde FROM public.customers WHERE id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kunde nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_company_role(v_kunde.company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen Portalzugaenge erstellen.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_kunde.merged_into_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Dieser Kunde wurde zusammengefuehrt — Zugang beim aktuellen Kunden erstellen.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 32 zufaellige Bytes, hex. Nicht aus der Kunden-ID abgeleitet und nicht
  -- ratbar; gen_random_bytes kommt aus pgcrypto und nicht aus random().
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.portal_magic_links
    (company_id, customer_id, token_hash, expires_at, created_by)
  VALUES (
    v_kunde.company_id, p_customer_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    NOW() + (GREATEST(1, LEAST(p_gueltig_tage, 90)) || ' days')::INTERVAL,
    auth.uid()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',         v_id,
    'token',      v_token,
    'expires_at', (SELECT expires_at FROM public.portal_magic_links WHERE id = v_id),
    'sprache',    v_kunde.language
  );
END;
$$;


--
-- Name: portal_overview(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_overview(p_session text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_kunde_id UUID;
  v_kunde    RECORD;
BEGIN
  v_kunde_id := public.portal_session_customer(p_session);
  IF v_kunde_id IS NULL THEN
    RAISE EXCEPTION 'Zugang ungueltig oder abgelaufen.'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  PERFORM public.portal_touch_session(p_session);

  SELECT * INTO v_kunde FROM public.customers WHERE id = v_kunde_id;

  RETURN jsonb_build_object(
    'kunde', jsonb_build_object(
      'anzeigename', v_kunde.display_name,
      'vorname',     v_kunde.first_name,
      'nachname',    v_kunde.last_name,
      'firma',       v_kunde.company_name,
      'email',       v_kunde.primary_email,
      'telefon',     v_kunde.primary_phone,
      'sprache',     v_kunde.language
    ),
    'firma', (SELECT jsonb_build_object(
                'name',  c.company_name,
                'email', c.email,
                'telefon', c.phone)
              FROM public.companies c WHERE c.id = v_kunde.company_id),

    'offerten', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',          o.id,
               'nummer',      o.offer_number,
               'titel',       o.title,
               'status',      o.status,
               'total',       o.total,
               'gueltig_bis', o.valid_until,
               'leistungsdatum', o.service_date,
               'ueberholt',   (o.superseded_at IS NOT NULL),
               'fassung',     o.version_number,
               'token',       o.access_token)
             ORDER BY o.created_at DESC)
      FROM public.offers o WHERE o.customer_id = v_kunde_id), '[]'::jsonb),

    'nachtraege', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',     a.id,
               'nummer', a.amendment_number,
               'titel',  a.title,
               'status', a.status,
               'total',  a.total,
               'token',  a.access_token)
             ORDER BY a.created_at DESC)
      FROM public.offer_amendments a
      WHERE a.customer_id = v_kunde_id AND a.status <> 'entwurf'), '[]'::jsonb),

    'termine', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',     t.id,
               'datum',  t.appointment_date,
               'start',  t.start_time,
               'ende',   t.end_time,
               'art',    t.appointment_type,
               'status', t.status,
               'titel',  t.title,
               'ort',    NULLIF(TRIM(CONCAT_WS(' ', t.location_address, t.location_plz, t.location_city)), ''))
             ORDER BY t.appointment_date DESC, t.start_time DESC)
      FROM public.appointments t
      WHERE t.customer_id = v_kunde_id AND t.status <> 'cancelled'), '[]'::jsonb),

    'auftraege', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',     g.id,
               'nummer', g.auftrag_nummer,
               'titel',  g.title,
               'status', g.status,
               'datum',  g.scheduled_date,
               'total',  g.total)
             ORDER BY g.scheduled_date DESC NULLS LAST)
      FROM public.auftraege g
      WHERE g.customer_id = v_kunde_id AND g.deleted_at IS NULL), '[]'::jsonb),

    'rechnungen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',        r.id,
               'nummer',    r.rechnung_nr,
               'datum',     r.datum,
               'faellig',   r.faellig_am,
               'total',     COALESCE(r.gesamttotal, r.total, 0),
               'bezahlt',   r.paid_total,
               'offen',     r.open_amount,
               'status',    r.status)
             ORDER BY r.datum DESC)
      FROM public.rechnungen r
      WHERE r.customer_id = v_kunde_id AND r.status <> 'entwurf'), '[]'::jsonb),

    -- Nur lesen. Eine Zahlung ausloesen kann das Portal nicht: dafuer braeuchte
    -- es einen Zahlungsanbieter, und Zahlungslogik gehoert laut CLAUDE.md
    -- ausdruecklich nicht in dieses Projekt.
    'zahlungen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'datum',  z.payment_date,
               'betrag', z.amount,
               'weg',    z.method)
             ORDER BY z.payment_date DESC)
      FROM public.payments z WHERE z.customer_id = v_kunde_id), '[]'::jsonb),

    'offener_betrag', COALESCE((
      SELECT SUM(r.open_amount) FROM public.rechnungen r
      WHERE r.customer_id = v_kunde_id AND r.status <> 'entwurf' AND r.open_amount > 0), 0)
  );
END;
$$;


--
-- Name: FUNCTION portal_overview(p_session text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.portal_overview(p_session text) IS 'Portalansicht eines Kunden. Der Kunde ergibt sich aus dem Sitzungstoken, nie aus einem Argument. Spalten sind einzeln aufgezaehlt — internal_notes und die Kalkulationsfelder duerfen nicht mitwandern.';


--
-- Name: portal_redeem_magic_link(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_redeem_magic_link(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_link    RECORD;
  v_session TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) <> 64 THEN
    RAISE EXCEPTION 'Zugang ungueltig oder abgelaufen.' USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  SELECT * INTO v_link
  FROM public.portal_magic_links
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
  FOR UPDATE;

  IF NOT FOUND
     OR v_link.used_at IS NOT NULL
     OR v_link.revoked_at IS NOT NULL
     OR v_link.expires_at < NOW() THEN
    RAISE EXCEPTION 'Zugang ungueltig oder abgelaufen.'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  UPDATE public.portal_magic_links SET used_at = NOW() WHERE id = v_link.id;

  v_session := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.portal_sessions
    (company_id, customer_id, magic_link_id, token_hash, expires_at, last_seen_at)
  VALUES (
    v_link.company_id, v_link.customer_id, v_link.id,
    encode(digest(v_session, 'sha256'), 'hex'),
    NOW() + INTERVAL '30 days', NOW()
  );

  RETURN jsonb_build_object(
    'session',  v_session,
    'sprache',  (SELECT language FROM public.customers WHERE id = v_link.customer_id)
  );
END;
$$;


--
-- Name: portal_report_case(text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_report_case(p_session text, p_case_type text, p_title text, p_description text DEFAULT NULL::text, p_auftrag_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_kunde_id UUID;
  v_company  UUID;
  v_id       UUID;
BEGIN
  v_kunde_id := public.portal_session_customer(p_session);
  IF v_kunde_id IS NULL THEN
    RAISE EXCEPTION 'Zugang ungueltig oder abgelaufen.'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  SELECT company_id INTO v_company FROM public.customers WHERE id = v_kunde_id;

  -- Der Auftrag muss dem meldenden Kunden gehoeren. Ohne diese Pruefung waere
  -- die ID ein Weg, einen Fall an einen fremden Auftrag zu haengen.
  IF p_auftrag_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.auftraege
    WHERE id = p_auftrag_id AND customer_id = v_kunde_id
  ) THEN
    RAISE EXCEPTION 'Auftrag gehoert nicht zu diesem Kunden.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.customer_cases
    (company_id, customer_id, case_type, title, description,
     auftrag_id, reported_by, priority)
  VALUES (v_company, v_kunde_id, p_case_type, TRIM(p_title), p_description,
          p_auftrag_id, 'kunde', 'high')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$$;


--
-- Name: portal_request_change(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_request_change(p_session text, p_feld text, p_neu_wert text, p_bemerkung text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_kunde_id UUID;
  v_kunde    RECORD;
  v_alt      TEXT;
  v_id       UUID;
BEGIN
  v_kunde_id := public.portal_session_customer(p_session);
  IF v_kunde_id IS NULL THEN
    RAISE EXCEPTION 'Zugang ungueltig oder abgelaufen.'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  SELECT * INTO v_kunde FROM public.customers WHERE id = v_kunde_id;

  v_alt := CASE p_feld
             WHEN 'first_name'    THEN v_kunde.first_name
             WHEN 'last_name'     THEN v_kunde.last_name
             WHEN 'company_name'  THEN v_kunde.company_name
             WHEN 'primary_email' THEN v_kunde.primary_email
             WHEN 'primary_phone' THEN v_kunde.primary_phone
           END;

  IF TRIM(COALESCE(p_neu_wert, '')) = '' THEN
    RAISE EXCEPTION 'Der neue Wert fehlt.' USING ERRCODE = 'check_violation';
  END IF;
  IF TRIM(p_neu_wert) IS NOT DISTINCT FROM v_alt THEN
    RAISE EXCEPTION 'Der Wert ist unveraendert.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.customer_change_requests
    (company_id, customer_id, feld, alt_wert, neu_wert, bemerkung)
  VALUES (v_kunde.company_id, v_kunde_id, p_feld, v_alt, TRIM(p_neu_wert), p_bemerkung)
  ON CONFLICT (customer_id, feld) WHERE status = 'offen'
  DO UPDATE SET neu_wert = EXCLUDED.neu_wert,
                bemerkung = EXCLUDED.bemerkung,
                created_at = NOW()
  RETURNING id INTO v_id;

  -- Die Firma erfaehrt davon ueber die Wiedervorlage und nicht dadurch, dass
  -- jemand zufaellig in die Tabelle schaut.
  INSERT INTO public.crm_tasks (company_id, title, description, task_type, priority,
                                due_at, customer_id)
  VALUES (
    v_kunde.company_id,
    'Aenderungswunsch: ' || COALESCE(v_kunde.display_name, ''),
    p_feld || ': „' || COALESCE(v_alt, '—') || '" → „' || TRIM(p_neu_wert) || '"',
    'admin', 'normal', NOW(), v_kunde_id
  );

  RETURN jsonb_build_object('id', v_id, 'status', 'offen');
END;
$$;


--
-- Name: portal_revoke_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_revoke_access(p_customer_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_company UUID;
  v_links   INTEGER;
  v_sess    INTEGER;
BEGIN
  SELECT company_id INTO v_company FROM public.customers WHERE id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kunde nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_company_role(v_company, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen Zugaenge widerrufen.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.portal_magic_links SET revoked_at = NOW()
  WHERE customer_id = p_customer_id AND revoked_at IS NULL AND used_at IS NULL;
  GET DIAGNOSTICS v_links = ROW_COUNT;

  UPDATE public.portal_sessions SET revoked_at = NOW()
  WHERE customer_id = p_customer_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_sess = ROW_COUNT;

  RETURN jsonb_build_object('links', v_links, 'sitzungen', v_sess);
END;
$$;


--
-- Name: portal_session_customer(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_session_customer(p_session text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT s.customer_id
  FROM public.portal_sessions s
  WHERE p_session IS NOT NULL
    AND length(p_session) = 64
    AND s.token_hash = encode(digest(p_session, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > NOW();
$$;


--
-- Name: portal_touch_session(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_touch_session(p_session text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  UPDATE public.portal_sessions
  SET last_seen_at = NOW()
  WHERE token_hash = encode(digest(p_session, 'sha256'), 'hex')
    AND revoked_at IS NULL AND expires_at > NOW();
$$;


--
-- Name: preview_customer_backfill(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_customer_backfill(p_company_id uuid) RETURNS TABLE(identitaet text, identitaet_art text, quelle_tabelle text, quelle_id uuid, erstellt_am timestamp with time zone, email_roh text, email_norm text, telefon_roh text, telefon_norm text, vorname text, nachname text, ganzer_name text, sprache text, zeilen_je_identitaet integer, bestehender_kunde uuid, flag_namenskonflikt boolean, flag_telefonkonflikt boolean, flag_sprachkonflikt boolean, flag_telefon_quer boolean, flag_platzhalter boolean, flag_ohne_firma boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH q AS (
    SELECT s.*,
           public.normalize_customer_email(s.email_roh)   AS e_norm,
           public.normalize_customer_phone(s.telefon_roh) AS p_norm,
           NULLIF(NULLIF(TRIM(COALESCE(s.vorname,  '')), ''), 'Unbekannt') AS v_clean,
           NULLIF(NULLIF(TRIM(COALESCE(s.nachname, '')), ''), 'Unbekannt') AS n_clean
    FROM public.customer_backfill_quellen(p_company_id) s
  ),
  k AS (
    SELECT q.*,
           CASE WHEN q.e_norm IS NOT NULL THEN 'e:' || q.e_norm
                WHEN q.p_norm IS NOT NULL THEN 'p:' || q.p_norm END AS ident,
           CASE WHEN q.e_norm IS NOT NULL THEN 'email'
                WHEN q.p_norm IS NOT NULL THEN 'phone_only'
                ELSE 'none' END AS art
    FROM q
  ),
  -- Eine Telefonnummer, die unter MEHREREN Identitaeten auftaucht, ist genau
  -- der Fall, den resolve_or_create_customer als Duplikat-Verdacht markiert.
  -- Alle Spalten qualifiziert: die Namen der RETURNS-TABLE-Parameter kollidieren
  -- sonst mit den CTE-Spalten (sprache, vorname, nachname, …).
  quer AS (
    SELECT k.p_norm FROM k
    WHERE k.p_norm IS NOT NULL AND k.ident IS NOT NULL
    GROUP BY k.p_norm HAVING count(DISTINCT k.ident) > 1
  ),
  agg AS (
    SELECT k.ident AS a_ident,
           count(*)::INTEGER                                AS n,
           count(DISTINCT lower(TRIM(COALESCE(k.n_clean, ''))))
             FILTER (WHERE k.n_clean IS NOT NULL)           AS n_namen,
           count(DISTINCT k.p_norm) FILTER (WHERE k.p_norm IS NOT NULL)   AS n_tel,
           count(DISTINCT k.sprache) FILTER (WHERE k.sprache IS NOT NULL) AS n_sprachen,
           max(k.customer_id::TEXT)                         AS vorhandener
    FROM k WHERE k.ident IS NOT NULL GROUP BY k.ident
  )
  SELECT
    k.ident, k.art, k.quelle_tabelle, k.quelle_id, k.erstellt_am,
    k.email_roh, k.e_norm, k.telefon_roh, k.p_norm,
    k.v_clean, k.n_clean, k.ganzer_name, k.sprache,
    COALESCE(agg.n, 1),
    agg.vorhandener::UUID,
    COALESCE(agg.n_namen, 0)    > 1,
    COALESCE(agg.n_tel, 0)      > 1,
    COALESCE(agg.n_sprachen, 0) > 1,
    k.p_norm IN (SELECT quer.p_norm FROM quer),
    -- Platzhalter aus _shared/leadMapping.ts
    (TRIM(COALESCE(k.vorname, '')) = 'Unbekannt' OR TRIM(COALESCE(k.nachname, '')) = 'Unbekannt'),
    k.company_id IS NULL
  FROM k LEFT JOIN agg ON agg.a_ident = k.ident
  ORDER BY (k.ident IS NULL) DESC, k.ident, k.erstellt_am;
END;
$$;


--
-- Name: FUNCTION preview_customer_backfill(p_company_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.preview_customer_backfill(p_company_id uuid) IS 'Bericht VOR dem Backfill. STABLE — Postgres verhindert jedes Schreiben zur Laufzeit, die Zusage steht nicht nur im Kommentar. Zeilen mit identitaet = NULL stehen oben: sie tragen weder E-Mail noch Telefon und bekommen keinen Kunden.';


--
-- Name: preview_finance_backfill(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_finance_backfill(p_company_id uuid) RETURNS TABLE(quelle text, beleg_nr text, beleg_datum date, betrag numeric, hinweis text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT 'rechnung'::TEXT,
         r.rechnung_nr,
         r.datum,
         COALESCE(r.gesamttotal, r.total, 0)::NUMERIC(12,2),
         'Status bezahlt, keine Buchung — Datum aus dem Beleg, Weg unbekannt'::TEXT
  FROM public.rechnungen r
  WHERE r.company_id = p_company_id
    AND r.status = 'bezahlt'
    AND r.paid_total = 0
    AND COALESCE(r.gesamttotal, r.total, 0) > 0

  UNION ALL

  SELECT 'quittung'::TEXT,
         q.quittung_nr,
         q.datum,
         COALESCE(q.gesamttotal, q.total, 0)::NUMERIC(12,2),
         'ausgestellt und nicht mehr offen, keine Buchung'::TEXT
  FROM public.quittungen q
  WHERE q.company_id = p_company_id
    AND q.payment_id IS NULL
    AND q.status <> 'draft'
    AND COALESCE(q.betrag_noch_offen, TRUE) = FALSE
    AND COALESCE(q.gesamttotal, q.total, 0) > 0

  ORDER BY 1, 3;
END;
$$;


--
-- Name: reap_stuck_inbound_emails(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reap_stuck_inbound_emails(p_minutes integer DEFAULT 15) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION reap_stuck_inbound_emails(p_minutes integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.reap_stuck_inbound_emails(p_minutes integer) IS 'Setzt Zeilen, die länger als p_minutes auf processing stehen, auf failed — damit werden sie in der Review-Oberfläche sichtbar und wiederholbar.';


--
-- Name: reap_stuck_sending_offers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reap_stuck_sending_offers() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sent    integer;
  v_revert  integer;
BEGIN
  -- Email verifiably delivered → finish the transition to 'sent'.
  UPDATE public.offers o
  SET status = 'sent', sent_at = COALESCE(o.sent_at, now())
  WHERE o.status = 'sending'
    AND o.updated_at < now() - interval '15 minutes'
    AND EXISTS (
      SELECT 1 FROM public.email_logs el
      WHERE el.metadata->>'offer_id' = o.id::text
        AND el.email_type = 'offer_sent'
        AND el.status = 'sent'
    );
  GET DIAGNOSTICS v_sent = ROW_COUNT;

  -- No delivery record → the send never completed → revert so it can be resent.
  UPDATE public.offers
  SET status = 'viewed'
  WHERE status = 'sending'
    AND updated_at < now() - interval '15 minutes';
  GET DIAGNOSTICS v_revert = ROW_COUNT;

  IF v_sent + v_revert > 0 THEN
    RAISE LOG '[reap_stuck_sending_offers] recovered % (sent=% revert=%)', v_sent + v_revert, v_sent, v_revert;
  END IF;
  RETURN v_sent + v_revert;
END;
$$;


--
-- Name: rechnung_gutschriften_fortschreiben(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rechnung_gutschriften_fortschreiben() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_rechnung UUID := COALESCE(NEW.rechnung_id, OLD.rechnung_id);
  v_summe    NUMERIC(12,2);
  v_zeile    RECORD;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_summe
  FROM public.credit_notes
  WHERE rechnung_id = v_rechnung AND status = 'versendet';

  UPDATE public.rechnungen
  SET credited_total = v_summe
  WHERE id = v_rechnung
  RETURNING * INTO v_zeile;

  IF v_zeile.status <> 'entwurf' AND v_zeile.open_amount <= 0
     AND v_zeile.status <> 'bezahlt' THEN
    UPDATE public.rechnungen SET status = 'bezahlt' WHERE id = v_rechnung;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: rechnung_zahlungsstand_fortschreiben(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rechnung_zahlungsstand_fortschreiben() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_rechnung UUID := COALESCE(NEW.rechnung_id, OLD.rechnung_id);
  v_summe    NUMERIC(12,2);
  v_zeile    RECORD;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_summe
  FROM public.payment_allocations
  WHERE rechnung_id = v_rechnung;

  UPDATE public.rechnungen
  SET paid_total = v_summe
  WHERE id = v_rechnung
  RETURNING * INTO v_zeile;

  IF v_zeile.status = 'entwurf' THEN
    RETURN NULL;
  END IF;

  IF v_zeile.open_amount <= 0 AND v_zeile.status <> 'bezahlt' THEN
    UPDATE public.rechnungen SET status = 'bezahlt' WHERE id = v_rechnung;
  ELSIF v_zeile.open_amount > 0 AND v_zeile.status = 'bezahlt' THEN
    UPDATE public.rechnungen
    SET status = CASE
                   WHEN v_zeile.faellig_am IS NOT NULL
                    AND v_zeile.faellig_am < CURRENT_DATE THEN 'ueberfaellig'
                   ELSE 'versendet'
                 END
    WHERE id = v_rechnung;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION rechnung_zahlungsstand_fortschreiben(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.rechnung_zahlungsstand_fortschreiben() IS 'Schreibt paid_total und den Status einer Rechnung aus den Anrechnungen fort.';


--
-- Name: record_payment(uuid, numeric, date, text, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_payment(p_company_id uuid, p_amount numeric, p_payment_date date, p_method text DEFAULT 'bank'::text, p_customer_id uuid DEFAULT NULL::uuid, p_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_allocations jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_payment  UUID;
  v_zeile    JSONB;
  v_summe    NUMERIC(12,2) := 0;
  v_rechnung UUID;
  v_betrag   NUMERIC(12,2);
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen Zahlungen erfassen.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Der Zahlbetrag muss groesser als null sein.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.payments (
    company_id, customer_id, payment_date, amount, method, reference, note,
    created_via, created_by
  ) VALUES (
    p_company_id, p_customer_id, COALESCE(p_payment_date, CURRENT_DATE),
    p_amount, p_method, p_reference, p_note, 'manual', auth.uid()
  ) RETURNING id INTO v_payment;

  FOR v_zeile IN SELECT * FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb))
  LOOP
    v_rechnung := (v_zeile ->> 'rechnung_id')::UUID;
    v_betrag   := (v_zeile ->> 'amount')::NUMERIC(12,2);

    IF v_betrag IS NULL OR v_betrag <= 0 THEN
      RAISE EXCEPTION 'Anrechnung ohne gueltigen Betrag.' USING ERRCODE = 'check_violation';
    END IF;

    -- Der mehrspaltige Fremdschluessel faengt eine fremde Rechnung ohnehin ab.
    -- Die Pruefung hier existiert, damit die Meldung verstaendlich ist statt
    -- einer Constraint-Verletzung.
    IF NOT EXISTS (
      SELECT 1 FROM public.rechnungen
      WHERE id = v_rechnung AND company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'Rechnung gehoert nicht zu dieser Firma.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.payment_allocations
      (company_id, payment_id, rechnung_id, amount, created_by)
    VALUES (p_company_id, v_payment, v_rechnung, v_betrag, auth.uid());

    v_summe := v_summe + v_betrag;
  END LOOP;

  RETURN jsonb_build_object(
    'payment_id',     v_payment,
    'amount',         p_amount,
    'allocated',      v_summe,
    -- Was ueberzaehlig hereinkam, bleibt sichtbar offen statt still zu
    -- verschwinden.
    'unallocated',    p_amount - v_summe
  );
END;
$$;


--
-- Name: record_quittung_payment(uuid, text, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_quittung_payment(p_quittung_id uuid, p_method text DEFAULT 'cash'::text, p_payment_date date DEFAULT NULL::date, p_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_q       RECORD;
  v_payment UUID;
  v_warnung TEXT := NULL;
BEGIN
  SELECT * INTO v_q FROM public.quittungen WHERE id = p_quittung_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quittung nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_company_role(v_q.company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen Zahlungen erfassen.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_q.payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Quittung % ist bereits gebucht.', v_q.quittung_nr
      USING ERRCODE = 'unique_violation';
  END IF;

  IF v_q.status = 'draft' THEN
    RAISE EXCEPTION 'Ein Entwurf kann nichts bescheinigen — Quittung zuerst ausstellen.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_q.offer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rechnungen r
    WHERE r.offer_id = v_q.offer_id AND r.paid_total > 0
  ) THEN
    v_warnung := 'Zu dieser Offerte ist bereits eine Zahlung auf eine Rechnung gebucht.';
  END IF;

  INSERT INTO public.payments (
    company_id, customer_id, payment_date, amount, method, reference,
    note, created_via, created_by
  ) VALUES (
    v_q.company_id, v_q.customer_id,
    COALESCE(p_payment_date, v_q.datum, CURRENT_DATE),
    COALESCE(v_q.gesamttotal, v_q.total),
    p_method, p_reference,
    COALESCE(p_note, 'Quittung ' || COALESCE(v_q.quittung_nr, '')),
    'quittung', auth.uid()
  ) RETURNING id INTO v_payment;

  UPDATE public.quittungen
  SET payment_id = v_payment, betrag_noch_offen = FALSE
  WHERE id = p_quittung_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment,
    'amount',     COALESCE(v_q.gesamttotal, v_q.total),
    'warnung',    v_warnung
  );
END;
$$;


--
-- Name: replace_offer_items(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_offer_items(p_offer_id uuid, p_items jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.offers o
    JOIN public.companies c ON c.id = o.company_id
    WHERE o.id = p_offer_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Offerte'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.offers
    WHERE id = p_offer_id AND status IN ('accepted', 'rejected')
  ) THEN
    RAISE EXCEPTION 'Offerte ist bereits abgeschlossen und kann nicht bearbeitet werden'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  DELETE FROM public.offer_items WHERE offer_id = p_offer_id;

  INSERT INTO public.offer_items (
    offer_id,
    position,
    description,
    quantity,
    unit,
    unit_price,
    price_type,
    is_highlighted,
    is_optional,
    time_estimate,
    service_type,
    scheduled_date,
    scheduled_start_time,
    scheduled_end_time,
    amount_basis,
    kostendach_max
  )
  SELECT
    p_offer_id,
    (item ->> 'position')::integer,
    item ->> 'description',
    COALESCE((item ->> 'quantity')::numeric, 1),
    item ->> 'unit',
    COALESCE((item ->> 'unit_price')::numeric, 0),
    item ->> 'price_type',
    COALESCE((item ->> 'is_highlighted')::boolean, false),
    COALESCE((item ->> 'is_optional')::boolean, false),
    CASE
      WHEN item -> 'time_estimate' IS NOT NULL AND item ->> 'time_estimate' != 'null'
      THEN (item -> 'time_estimate')::jsonb
      ELSE NULL
    END,
    item ->> 'service_type',
    (item ->> 'scheduled_date')::date,
    (item ->> 'scheduled_start_time')::time,
    (item ->> 'scheduled_end_time')::time,
    COALESCE(NULLIF(item ->> 'amount_basis', ''), 'fixed'),
    (item ->> 'kostendach_max')::numeric
  FROM jsonb_array_elements(p_items) AS item;

  INSERT INTO public.offer_item_effort_meta (
    offer_item_id, crew, vehicles, vehicle_type, hourly_rate, aufwand_min_h, aufwand_max_h
  )
  SELECT
    oi.id,
    (m ->> 'crew')::integer,
    (m ->> 'vehicles')::integer,
    NULLIF(m ->> 'vehicle_type', ''),
    (m ->> 'hourly_rate')::numeric,
    (m ->> 'aufwand_min_h')::numeric,
    (m ->> 'aufwand_max_h')::numeric
  FROM jsonb_array_elements(p_items) AS item
  JOIN public.offer_items oi
    ON oi.offer_id = p_offer_id AND oi.position = (item ->> 'position')::integer
  CROSS JOIN LATERAL (SELECT item -> 'effort_meta' AS m) x
  WHERE jsonb_typeof(item -> 'effort_meta') = 'object';

  INSERT INTO public.offer_item_volume_meta (
    offer_item_id, volume_m3, volume_min_m3, volume_max_m3, rate, rate_unit, location
  )
  SELECT
    oi.id,
    (m ->> 'volume_m3')::numeric,
    (m ->> 'volume_min_m3')::numeric,
    (m ->> 'volume_max_m3')::numeric,
    (m ->> 'rate')::numeric,
    NULLIF(m ->> 'rate_unit', ''),
    NULLIF(m ->> 'location', '')
  FROM jsonb_array_elements(p_items) AS item
  JOIN public.offer_items oi
    ON oi.offer_id = p_offer_id AND oi.position = (item ->> 'position')::integer
  CROSS JOIN LATERAL (SELECT item -> 'volume_meta' AS m) x
  WHERE jsonb_typeof(item -> 'volume_meta') = 'object';

  INSERT INTO public.offer_item_area_meta (
    offer_item_id, object_type, area_m2, abgabe, abnahmegarantie
  )
  SELECT
    oi.id,
    NULLIF(m ->> 'object_type', ''),
    (m ->> 'area_m2')::numeric,
    NULLIF(m ->> 'abgabe', ''),
    (m ->> 'abnahmegarantie')::boolean
  FROM jsonb_array_elements(p_items) AS item
  JOIN public.offer_items oi
    ON oi.offer_id = p_offer_id AND oi.position = (item ->> 'position')::integer
  CROSS JOIN LATERAL (SELECT item -> 'area_meta' AS m) x
  WHERE jsonb_typeof(item -> 'area_meta') = 'object';

END;
$$;


--
-- Name: FUNCTION replace_offer_items(p_offer_id uuid, p_items jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.replace_offer_items(p_offer_id uuid, p_items jsonb) IS 'offer_items tablosunu atomik olarak yeniler. Delete + insert tek transaction içinde — insert başarısız olursa delete de geri alınır. Çağıran kullanıcı offer company_id''sine üye olmalı.';


--
-- Name: resolve_or_create_customer(uuid, text, text, text, text, text, text, text, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_or_create_customer(p_company_id uuid, p_email text, p_phone text, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_company_name text DEFAULT NULL::text, p_salutation text DEFAULT NULL::text, p_language text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_seen_at timestamp with time zone DEFAULT now()) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_email   TEXT;
  v_phone   TEXT;
  v_first   TEXT;
  v_last    TEXT;
  v_salut   TEXT;
  v_lang    TEXT;
  v_id      UUID;
  v_matched TEXT;
  v_dup     BOOLEAN := FALSE;
  v_created BOOLEAN := FALSE;
BEGIN
  -- Ein angemeldeter Benutzer muss Mitglied der Firma sein. Edge Functions
  -- laufen mit dem Service-Role-Key ohne auth.uid() — sie umgehen RLS ohnehin,
  -- eine zweite Huerde brauchte es dort nicht. anon bekommt kein Ausfuehrungsrecht.
  IF auth.uid() IS NOT NULL AND NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_email := public.normalize_customer_email(p_email);
  v_phone := public.normalize_customer_phone(p_phone);

  -- Die Platzhalter aus supabase/functions/_shared/leadMapping.ts sind kein Name.
  v_first := NULLIF(NULLIF(TRIM(COALESCE(p_first_name, '')), ''), 'Unbekannt');
  v_last  := NULLIF(NULLIF(TRIM(COALESCE(p_last_name,  '')), ''), 'Unbekannt');
  v_salut := NULLIF(TRIM(COALESCE(p_salutation, '')), '');
  IF v_salut IS NOT NULL AND v_salut NOT IN ('Herr', 'Frau', 'Firma') THEN
    v_salut := NULL;
  END IF;
  v_lang := NULLIF(TRIM(COALESCE(p_language, '')), '');
  IF v_lang IS NULL OR v_lang NOT IN ('de', 'fr', 'en') THEN
    v_lang := 'de';
  END IF;

  IF v_email IS NULL AND v_phone IS NULL THEN
    RETURN jsonb_build_object(
      'customer_id', NULL, 'matched_on', 'none', 'created', FALSE,
      'possible_duplicate', FALSE, 'reason', 'no_identity');
  END IF;

  -- Serialisiert zwei gleichzeitig eintreffende Datensaetze derselben Identitaet
  -- — auch dort, wo kein UNIQUE-Index greift (Treffer nur ueber Telefon).
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_company_id::TEXT || '|' || COALESCE('e:' || v_email, 'p:' || v_phone), 0));

  SELECT f.customer_id, f.matched_on INTO v_id, v_matched
  FROM public.find_customer_by_identity(p_company_id, p_email, p_phone) f;

  IF v_matched = 'phone' THEN
    UPDATE public.customers SET possible_duplicate = TRUE WHERE id = v_id;
    v_dup := TRUE;
    v_id  := NULL;
  END IF;

  IF v_id IS NULL THEN
    BEGIN
      INSERT INTO public.customers (
        company_id, customer_type, salutation, first_name, last_name, company_name,
        display_name, primary_email, primary_phone, language, source,
        first_seen_at, possible_duplicate, created_via
      ) VALUES (
        p_company_id,
        CASE WHEN v_salut = 'Firma' OR NULLIF(TRIM(COALESCE(p_company_name, '')), '') IS NOT NULL
             THEN 'company' ELSE 'person' END,
        v_salut, v_first, v_last, NULLIF(TRIM(COALESCE(p_company_name, '')), ''),
        '',                                   -- der Trigger fuellt display_name
        v_email,
        -- Rohwert behalten, wenn er nicht normalisierbar war: der Bediener soll
        -- sehen, was tatsaechlich erfasst wurde.
        COALESCE(v_phone, NULLIF(TRIM(COALESCE(p_phone, '')), '')),
        v_lang, NULLIF(TRIM(COALESCE(p_source, '')), ''),
        COALESCE(p_seen_at, NOW()), v_dup, 'resolve_rpc'
      )
      RETURNING id INTO v_id;

      v_created := TRUE;
      v_matched := COALESCE(v_matched, 'none');
    EXCEPTION WHEN unique_violation THEN
      -- Dritte Verteidigungslinie: eine parallele Transaktion war schneller.
      SELECT f.customer_id, f.matched_on INTO v_id, v_matched
      FROM public.find_customer_by_identity(p_company_id, p_email, p_phone) f;
      IF v_id IS NULL THEN
        RAISE;
      END IF;
    END;
  ELSE
    -- Einen bestehenden Kunden NIE ueberschreiben, nur Luecken fuellen.
    UPDATE public.customers c
    SET first_name    = COALESCE(c.first_name,    v_first),
        last_name     = COALESCE(c.last_name,     v_last),
        salutation    = COALESCE(c.salutation,    v_salut),
        primary_phone = COALESCE(c.primary_phone, NULLIF(TRIM(COALESCE(p_phone, '')), '')),
        primary_email = COALESCE(c.primary_email, v_email),
        first_seen_at = LEAST(c.first_seen_at, COALESCE(p_seen_at, NOW()))
    WHERE c.id = v_id;
  END IF;

  RETURN jsonb_build_object(
    'customer_id', v_id, 'matched_on', v_matched,
    'created', v_created, 'possible_duplicate', v_dup);
END;
$$;


--
-- Name: FUNCTION resolve_or_create_customer(p_company_id uuid, p_email text, p_phone text, p_first_name text, p_last_name text, p_company_name text, p_salutation text, p_language text, p_source text, p_seen_at timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.resolve_or_create_customer(p_company_id uuid, p_email text, p_phone text, p_first_name text, p_last_name text, p_company_name text, p_salutation text, p_language text, p_source text, p_seen_at timestamp with time zone) IS 'Ordnet einen eingehenden Datensatz der kanonischen Kundenidentitaet zu. Ein E-Mail-Treffer bindet; ein reiner Telefon-Treffer erzeugt einen zweiten Kunden und markiert beide als Duplikat-Verdacht. Ohne jedes Identitaetsmerkmal wird KEIN Kunde angelegt (customer_id = null).';


--
-- Name: resolve_or_create_location(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_or_create_location(p_company_id uuid, p_customer_id uuid, p_address_raw text, p_kind text DEFAULT 'object'::text, p_created_via text DEFAULT 'manual'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_customer_id IS NULL OR NULLIF(TRIM(COALESCE(p_address_raw, '')), '') IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id FROM public.service_locations
  WHERE customer_id = p_customer_id
    AND LOWER(TRIM(address_raw)) = LOWER(TRIM(p_address_raw));
  IF FOUND THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.service_locations
    (company_id, customer_id, kind, address_raw, created_via)
  VALUES (p_company_id, p_customer_id, p_kind, TRIM(p_address_raw), p_created_via)
  -- Zwei gleichzeitige Auftraege auf dieselbe Adresse: der Index entscheidet,
  -- nicht das SELECT oben.
  ON CONFLICT (customer_id, (LOWER(TRIM(address_raw)))) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.service_locations
    WHERE customer_id = p_customer_id
      AND LOWER(TRIM(address_raw)) = LOWER(TRIM(p_address_raw));
  END IF;

  RETURN v_id;
END;
$$;


--
-- Name: resolve_or_create_thread(uuid, uuid, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_or_create_thread(p_company_id uuid, p_customer_id uuid, p_channel text DEFAULT 'email'::text, p_subject text DEFAULT NULL::text, p_lead_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_customer_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.communication_threads
    WHERE customer_id = p_customer_id AND channel = p_channel
    ORDER BY created_at LIMIT 1;
    IF FOUND THEN RETURN v_id; END IF;
  ELSIF p_lead_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.communication_threads
    WHERE lead_id = p_lead_id AND channel = p_channel
    ORDER BY created_at LIMIT 1;
    IF FOUND THEN RETURN v_id; END IF;
  ELSE
    -- Ohne Kunde und ohne Anfrage gibt es nichts, woran ein Faden haengen
    -- koennte. Lieber keine Zeile als eine, die nirgends auftaucht.
    RETURN NULL;
  END IF;

  INSERT INTO public.communication_threads
    (company_id, customer_id, lead_id, channel, subject)
  VALUES (p_company_id, p_customer_id, p_lead_id, p_channel, p_subject)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: reverse_payment(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reverse_payment(p_payment_id uuid, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_p      RECORD;
  v_storno UUID;
BEGIN
  SELECT * INTO v_p FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zahlung nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_company_role(v_p.company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen stornieren.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_p.reverses_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Eine Stornobuchung wird nicht storniert.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payments WHERE reverses_payment_id = p_payment_id) THEN
    RAISE EXCEPTION 'Diese Zahlung ist bereits storniert.'
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.payments (
    company_id, customer_id, payment_date, amount, method, reference,
    reconciliation_status, reverses_payment_id, note, created_via, created_by
  ) VALUES (
    v_p.company_id, v_p.customer_id, CURRENT_DATE, -v_p.amount, v_p.method,
    v_p.reference, 'reconciled', p_payment_id,
    COALESCE(p_reason, 'Storno'), v_p.created_via, auth.uid()
  ) RETURNING id INTO v_storno;

  INSERT INTO public.payment_allocations
    (company_id, payment_id, rechnung_id, amount, note)
  SELECT company_id, v_storno, rechnung_id, -amount, 'Storno'
  FROM public.payment_allocations
  WHERE payment_id = p_payment_id;

  -- Eine Quittung, deren Eingang storniert ist, ist wieder offen.
  UPDATE public.quittungen
  SET betrag_noch_offen = TRUE
  WHERE payment_id = p_payment_id;

  RETURN jsonb_build_object('storno_payment_id', v_storno, 'amount', -v_p.amount);
END;
$$;


--
-- Name: run_communication_backfill(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_communication_backfill(p_company_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_r RECORD;
  v_thread UUID;
  v_ein INTEGER := 0;
  v_aus INTEGER := 0;
  v_n   INTEGER;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR v_r IN
    SELECT * FROM public.inbound_emails
    WHERE company_id = p_company_id
      AND NOT EXISTS (SELECT 1 FROM public.communication_messages m
                      WHERE m.source_table = 'inbound_emails' AND m.source_id = inbound_emails.id)
    ORDER BY received_at
  LOOP
    v_thread := public.resolve_or_create_thread(
      v_r.company_id, v_r.customer_id, 'email', v_r.subject, v_r.lead_id);
    CONTINUE WHEN v_thread IS NULL;

    INSERT INTO public.communication_messages
      (company_id, thread_id, direction, channel, from_address, subject, preview,
       occurred_at, source_table, source_id, external_id)
    VALUES (v_r.company_id, v_thread, 'inbound', 'email', v_r.from_email, v_r.subject,
            v_r.body_preview, COALESCE(v_r.received_at, v_r.created_at),
            'inbound_emails', v_r.id, v_r.provider_message_id)
    ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ein := v_ein + v_n;
  END LOOP;

  FOR v_r IN
    SELECT * FROM public.email_logs
    WHERE company_id = p_company_id
      AND NOT EXISTS (SELECT 1 FROM public.communication_messages m
                      WHERE m.source_table = 'email_logs' AND m.source_id = email_logs.id)
    ORDER BY created_at
  LOOP
    v_thread := public.resolve_or_create_thread(
      v_r.company_id,
      COALESCE(
        (SELECT l.customer_id FROM public.leads l WHERE l.id = v_r.lead_id),
        (SELECT f.customer_id
         FROM public.find_customer_by_identity(v_r.company_id, v_r.recipient_email, NULL) f
         LIMIT 1)),
      'email', v_r.subject, v_r.lead_id);
    CONTINUE WHEN v_thread IS NULL;

    INSERT INTO public.communication_messages
      (company_id, thread_id, direction, channel, to_address, subject,
       occurred_at, source_table, source_id)
    VALUES (v_r.company_id, v_thread, 'outbound', 'email', v_r.recipient_email,
            v_r.subject, v_r.created_at, 'email_logs', v_r.id)
    ON CONFLICT (source_table, source_id) WHERE source_id IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_aus := v_aus + v_n;
  END LOOP;

  RETURN jsonb_build_object('eingehend', v_ein, 'ausgehend', v_aus,
    'faeden', (SELECT COUNT(*) FROM public.communication_threads WHERE company_id = p_company_id));
END;
$$;


--
-- Name: run_customer_backfill(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_customer_backfill(p_company_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ident      RECORD;
  v_id         UUID;
  v_angelegt   INTEGER := 0;
  v_verknuepft JSONB   := '{}'::JSONB;
  v_n          INTEGER;
  v_summe      INTEGER := 0;
  v_offen      INTEGER;
  v_mails      INTEGER := 0;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Der Backfill ist dem Eigentuemer vorbehalten'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- IF NOT EXISTS + leeren, damit zwei Firmen in derselben Transaktion
  -- nacheinander laufen koennen (ON COMMIT DROP raeumt erst beim Commit auf).
  CREATE TEMP TABLE IF NOT EXISTS _bf_zuordnung (ident TEXT PRIMARY KEY, kunde UUID) ON COMMIT DROP;
  DELETE FROM _bf_zuordnung;

  FOR v_ident IN
    WITH q AS (
      SELECT s.*,
             public.normalize_customer_email(s.email_roh)   AS e_norm,
             public.normalize_customer_phone(s.telefon_roh) AS p_norm,
             NULLIF(NULLIF(TRIM(COALESCE(s.vorname,  '')), ''), 'Unbekannt') AS v_clean,
             NULLIF(NULLIF(TRIM(COALESCE(s.nachname, '')), ''), 'Unbekannt') AS n_clean
      FROM public.customer_backfill_quellen(p_company_id) s
      WHERE s.company_id IS NOT NULL
    ),
    k AS (
      SELECT q.*,
             CASE WHEN q.e_norm IS NOT NULL THEN 'e:' || q.e_norm
                  WHEN q.p_norm IS NOT NULL THEN 'p:' || q.p_norm END AS ident
      FROM q
    )
    SELECT
      k.ident,
      -- Name: offers vor leads vor appointments, je das neueste.
      (SELECT x.v_clean FROM k x WHERE x.ident = k.ident AND x.v_clean IS NOT NULL
         AND x.quelle_tabelle IN ('offers','leads','appointments')
       ORDER BY CASE x.quelle_tabelle WHEN 'offers' THEN 1 WHEN 'leads' THEN 2 ELSE 3 END,
                x.erstellt_am DESC LIMIT 1) AS vorname,
      (SELECT x.n_clean FROM k x WHERE x.ident = k.ident AND x.n_clean IS NOT NULL
         AND x.quelle_tabelle IN ('offers','leads','appointments')
       ORDER BY CASE x.quelle_tabelle WHEN 'offers' THEN 1 WHEN 'leads' THEN 2 ELSE 3 END,
                x.erstellt_am DESC LIMIT 1) AS nachname,
      -- Anzeigename aus einem Beleg, falls es keine getrennte Quelle gibt. UNZERLEGT.
      (SELECT NULLIF(TRIM(x.ganzer_name), '') FROM k x WHERE x.ident = k.ident
         AND NULLIF(TRIM(COALESCE(x.ganzer_name, '')), '') IS NOT NULL
       ORDER BY x.erstellt_am DESC LIMIT 1) AS ganzer_name,
      (SELECT x.anrede FROM k x WHERE x.ident = k.ident AND x.anrede IS NOT NULL
         AND x.anrede IN ('Herr','Frau','Firma')
       ORDER BY CASE x.quelle_tabelle WHEN 'offers' THEN 1 WHEN 'leads' THEN 2 ELSE 3 END,
                x.erstellt_am DESC LIMIT 1) AS anrede,
      (SELECT x.email_roh FROM k x WHERE x.ident = k.ident AND x.e_norm IS NOT NULL
       ORDER BY x.erstellt_am DESC LIMIT 1) AS email,
      (SELECT x.telefon_roh FROM k x WHERE x.ident = k.ident AND x.p_norm IS NOT NULL
       ORDER BY x.erstellt_am DESC LIMIT 1) AS telefon,
      (SELECT x.sprache FROM k x WHERE x.ident = k.ident AND x.sprache IS NOT NULL
         AND x.quelle_tabelle IN ('leads','offers')
       ORDER BY CASE x.quelle_tabelle WHEN 'leads' THEN 1 ELSE 2 END,
                x.erstellt_am DESC LIMIT 1) AS sprache,
      -- Herkunft: die AELTESTE Zeile, nicht die neueste.
      (SELECT x.herkunft FROM k x WHERE x.ident = k.ident AND x.herkunft IS NOT NULL
       ORDER BY x.erstellt_am ASC LIMIT 1) AS herkunft,
      (SELECT x.kundennummer FROM k x WHERE x.ident = k.ident
         AND NULLIF(TRIM(COALESCE(x.kundennummer, '')), '') IS NOT NULL
       ORDER BY x.erstellt_am DESC LIMIT 1) AS kundennummer,
      min(k.erstellt_am) AS erster_kontakt
    FROM k
    WHERE k.ident IS NOT NULL
    GROUP BY k.ident
    ORDER BY min(k.erstellt_am)
  LOOP
    -- BEWUSST NICHT find_customer_by_identity(): die bindet auch bei einem
    -- reinen Telefon-Treffer. Im Backfill waere das eine stille Verschmelzung
    -- zweier Menschen, die sich einen Anschluss teilen (Ehepaar, Verwaltung) —
    -- und sie waere unpruefbar, weil der Bericht dann eine andere Zahl nennt
    -- als der Lauf. Hier wird auf den Identitaetsschluessel selbst gebunden:
    -- E-Mail-Identitaet auf die E-Mail, Telefon-Identitaet nur auf einen Kunden,
    -- der selbst keine E-Mail hat. Ueberschneidungen landen unten im
    -- Duplikat-Verdacht und werden von Hand entschieden.
    IF v_ident.ident LIKE 'e:%' THEN
      SELECT c.id INTO v_id FROM public.customers c
      WHERE c.company_id = p_company_id
        AND c.merged_into_customer_id IS NULL
        AND c.email_normalized = substr(v_ident.ident, 3)
      LIMIT 1;
    ELSE
      SELECT c.id INTO v_id FROM public.customers c
      WHERE c.company_id = p_company_id
        AND c.merged_into_customer_id IS NULL
        AND c.email_normalized IS NULL
        AND c.phone_normalized = substr(v_ident.ident, 3)
      LIMIT 1;
    END IF;

    IF v_id IS NULL THEN
      INSERT INTO public.customers (
        company_id, customer_type, salutation, first_name, last_name,
        display_name, primary_email, primary_phone, language, source,
        first_seen_at, created_via
      ) VALUES (
        p_company_id,
        CASE WHEN v_ident.anrede = 'Firma' THEN 'company' ELSE 'person' END,
        v_ident.anrede, v_ident.vorname, v_ident.nachname,
        -- Getrennte Namen zuerst; sonst der Belegname, unveraendert.
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', v_ident.vorname, v_ident.nachname)), ''),
          v_ident.ganzer_name,
          ''),
        v_ident.email, v_ident.telefon,
        COALESCE(NULLIF(v_ident.sprache, ''), 'de'),
        v_ident.herkunft, v_ident.erster_kontakt, 'backfill'
      )
      RETURNING id INTO v_id;
      v_angelegt := v_angelegt + 1;
    END IF;

    -- Kundennummer aus der Offerte nachtragen, ohne Bestehendes zu ueberschreiben.
    IF v_ident.kundennummer IS NOT NULL THEN
      UPDATE public.customers
      SET external_customer_number = COALESCE(external_customer_number, v_ident.kundennummer)
      WHERE id = v_id;
    END IF;

    INSERT INTO _bf_zuordnung (ident, kunde) VALUES (v_ident.ident, v_id)
    ON CONFLICT (ident) DO NOTHING;
  END LOOP;

  -- Zeilen verknuepfen. Nur was noch offen ist.
  WITH z AS (
    SELECT l.id,
           COALESCE('e:' || public.normalize_customer_email(l.customer_email),
                    'p:' || public.normalize_customer_phone(l.customer_phone)) AS ident
    FROM public.leads l WHERE l.company_id = p_company_id AND l.customer_id IS NULL
  )
  UPDATE public.leads t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('leads', v_n); v_summe := v_summe + v_n;

  WITH z AS (
    SELECT o.id,
           COALESCE('e:' || public.normalize_customer_email(o.customer_email),
                    'p:' || public.normalize_customer_phone(o.customer_phone)) AS ident
    FROM public.offers o WHERE o.company_id = p_company_id AND o.customer_id IS NULL
  )
  UPDATE public.offers t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('offers', v_n); v_summe := v_summe + v_n;

  WITH z AS (
    SELECT a.id,
           COALESCE('e:' || public.normalize_customer_email(a.customer_email),
                    'p:' || public.normalize_customer_phone(a.customer_phone)) AS ident
    FROM public.auftraege a WHERE a.company_id = p_company_id AND a.customer_id IS NULL
  )
  UPDATE public.auftraege t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('auftraege', v_n); v_summe := v_summe + v_n;

  WITH z AS (
    SELECT t.id,
           COALESCE('e:' || public.normalize_customer_email(t.customer_email),
                    'p:' || public.normalize_customer_phone(t.customer_phone)) AS ident
    FROM public.appointments t WHERE t.company_id = p_company_id AND t.customer_id IS NULL
  )
  UPDATE public.appointments t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('appointments', v_n); v_summe := v_summe + v_n;

  WITH z AS (
    SELECT r.id,
           COALESCE('e:' || public.normalize_customer_email(r.customer_email),
                    'p:' || public.normalize_customer_phone(r.customer_phone)) AS ident
    FROM public.rechnungen r WHERE r.company_id = p_company_id AND r.customer_id IS NULL
  )
  UPDATE public.rechnungen t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('rechnungen', v_n); v_summe := v_summe + v_n;

  WITH z AS (
    SELECT q.id,
           COALESCE('e:' || public.normalize_customer_email(q.customer_email),
                    'p:' || public.normalize_customer_phone(q.customer_phone)) AS ident
    FROM public.quittungen q WHERE q.company_id = p_company_id AND q.customer_id IS NULL
  )
  UPDATE public.quittungen t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('quittungen', v_n); v_summe := v_summe + v_n;

  -- Posteingang zuletzt und NUR zuordnend: aus einer Mail entsteht kein Kunde.
  -- Das LATERAL steht im CTE, nicht in der FROM-Liste des UPDATE: dort darf die
  -- Zieltabelle nicht seitwaerts referenziert werden.
  WITH z AS (
    SELECT i.id, f.customer_id AS kunde
    FROM public.inbound_emails i
    CROSS JOIN LATERAL public.find_customer_by_identity(
      i.company_id,
      COALESCE(NULLIF(i.extracted_data ->> 'email', ''), i.from_email),
      i.extracted_data ->> 'phone') f
    WHERE i.company_id = p_company_id AND i.customer_id IS NULL
  )
  UPDATE public.inbound_emails t SET customer_id = z.kunde
  FROM z WHERE t.id = z.id AND z.kunde IS NOT NULL;
  GET DIAGNOSTICS v_mails = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('inbound_emails', v_mails);

  -- Telefon-Duplikate markieren, damit die Oberflaeche sie zur Pruefung anbietet.
  UPDATE public.customers c SET possible_duplicate = TRUE
  WHERE c.company_id = p_company_id
    AND c.merged_into_customer_id IS NULL
    AND c.phone_normalized IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.customers d
      WHERE d.company_id = c.company_id AND d.id <> c.id
        AND d.merged_into_customer_id IS NULL
        AND d.phone_normalized = c.phone_normalized);

  SELECT
    (SELECT count(*) FROM public.leads        WHERE company_id = p_company_id AND customer_id IS NULL)
  + (SELECT count(*) FROM public.offers       WHERE company_id = p_company_id AND customer_id IS NULL)
  + (SELECT count(*) FROM public.auftraege    WHERE company_id = p_company_id AND customer_id IS NULL)
  + (SELECT count(*) FROM public.appointments WHERE company_id = p_company_id AND customer_id IS NULL)
  + (SELECT count(*) FROM public.rechnungen   WHERE company_id = p_company_id AND customer_id IS NULL)
  + (SELECT count(*) FROM public.quittungen   WHERE company_id = p_company_id AND customer_id IS NULL)
  INTO v_offen;

  RETURN jsonb_build_object(
    'kunden_angelegt',    v_angelegt,
    'zeilen_verknuepft',  v_verknuepft,
    'zeilen_gesamt',      v_summe,
    'ohne_zuordnung',     v_offen,
    'duplikat_verdacht',  (SELECT count(*) FROM public.customers
                           WHERE company_id = p_company_id AND possible_duplicate
                             AND merged_into_customer_id IS NULL));
END;
$$;


--
-- Name: FUNCTION run_customer_backfill(p_company_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.run_customer_backfill(p_company_id uuid) IS 'Ordnet Bestandszeilen der kanonischen Kundenidentitaet zu. Idempotent: ruehrt nur customer_id IS NULL an. Wird NICHT aus einer Migration heraus aufgerufen — erst nachdem preview_customer_backfill() gelesen wurde. Ruecknahme: ROLLBACK_20260728140000_kunden_backfill.sql.';


--
-- Name: run_finance_backfill(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_finance_backfill(p_company_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_r          RECORD;
  v_payment    UUID;
  v_rechnungen INTEGER := 0;
  v_quittungen INTEGER := 0;
  v_summe      NUMERIC(12,2) := 0;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Nur der Eigentuemer kann den Finanz-Backfill ausfuehren.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR v_r IN
    SELECT id, company_id, customer_id, rechnung_nr, datum,
           COALESCE(gesamttotal, total, 0)::NUMERIC(12,2) AS betrag
    FROM public.rechnungen
    WHERE company_id = p_company_id
      AND status = 'bezahlt'
      AND paid_total = 0
      AND COALESCE(gesamttotal, total, 0) > 0
    ORDER BY datum
  LOOP
    INSERT INTO public.payments (
      company_id, customer_id, payment_date, amount, method,
      reconciliation_status, note, created_via
    ) VALUES (
      v_r.company_id, v_r.customer_id, v_r.datum, v_r.betrag, 'other',
      'unreconciled',
      'Backfill aus Status "bezahlt" — echtes Zahlungsdatum und Zahlungsweg unbekannt.',
      'backfill'
    ) RETURNING id INTO v_payment;

    INSERT INTO public.payment_allocations (company_id, payment_id, rechnung_id, amount)
    VALUES (v_r.company_id, v_payment, v_r.id, v_r.betrag);

    v_rechnungen := v_rechnungen + 1;
    v_summe := v_summe + v_r.betrag;
  END LOOP;

  FOR v_r IN
    SELECT id, company_id, customer_id, quittung_nr, datum,
           COALESCE(gesamttotal, total, 0)::NUMERIC(12,2) AS betrag
    FROM public.quittungen
    WHERE company_id = p_company_id
      AND payment_id IS NULL
      AND status <> 'draft'
      AND COALESCE(betrag_noch_offen, TRUE) = FALSE
      AND COALESCE(gesamttotal, total, 0) > 0
    ORDER BY datum
  LOOP
    INSERT INTO public.payments (
      company_id, customer_id, payment_date, amount, method,
      reconciliation_status, note, created_via
    ) VALUES (
      v_r.company_id, v_r.customer_id, v_r.datum, v_r.betrag, 'other',
      'unreconciled',
      'Backfill aus Quittung ' || COALESCE(v_r.quittung_nr, '') ||
      ' — Zahlungsweg unbekannt.',
      'backfill'
    ) RETURNING id INTO v_payment;

    -- Keine Anrechnung: eine Quittung steht fuer sich, es gibt keine Rechnung,
    -- auf die gebucht werden koennte.
    UPDATE public.quittungen SET payment_id = v_payment WHERE id = v_r.id;

    v_quittungen := v_quittungen + 1;
    v_summe := v_summe + v_r.betrag;
  END LOOP;

  RETURN jsonb_build_object(
    'rechnungen', v_rechnungen,
    'quittungen', v_quittungen,
    'summe',      v_summe
  );
END;
$$;


--
-- Name: run_invoice_automations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_invoice_automations() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: run_location_backfill(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_location_backfill(p_company_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_a RECORD;
  v_orte INTEGER := 0;
  v_auftraege INTEGER := 0;
  v_von UUID; v_nach UUID;
  v_n INTEGER;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR v_a IN
    SELECT id, company_id, customer_id, from_address, to_address
    FROM public.auftraege
    WHERE company_id = p_company_id
      AND customer_id IS NOT NULL
      AND deleted_at IS NULL
      AND (from_location_id IS NULL OR to_location_id IS NULL)
    ORDER BY created_at
  LOOP
    v_von  := public.resolve_or_create_location(v_a.company_id, v_a.customer_id,
                                                v_a.from_address, 'from', 'backfill');
    v_nach := public.resolve_or_create_location(v_a.company_id, v_a.customer_id,
                                                v_a.to_address, 'to', 'backfill');
    -- Gezaehlt wird nur, was sich TATSAECHLICH aendert. Zwei Auftraege tragen
    -- nur eine der beiden Adressen; ihre zweite Spalte bleibt fuer immer NULL
    -- und die Zeile taucht in jedem Lauf wieder auf. Sie deshalb als
    -- "verarbeitet" zu melden hiesse, Arbeit zu behaupten, die nicht
    -- stattgefunden hat — der zweite Lauf muss 0 sagen koennen.
    UPDATE public.auftraege
    SET from_location_id = COALESCE(from_location_id, v_von),
        to_location_id   = COALESCE(to_location_id, v_nach)
    WHERE id = v_a.id
      AND (   (from_location_id IS NULL AND v_von  IS NOT NULL)
           OR (to_location_id   IS NULL AND v_nach IS NOT NULL));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_auftraege := v_auftraege + v_n;
  END LOOP;

  SELECT COUNT(*) INTO v_orte FROM public.service_locations
  WHERE company_id = p_company_id AND created_via = 'backfill';

  RETURN jsonb_build_object('orte', v_orte, 'auftraege', v_auftraege);
END;
$$;


--
-- Name: run_pipeline_automations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_pipeline_automations() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: FUNCTION run_pipeline_automations(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.run_pipeline_automations() IS 'Fuellt die Wiedervorlage. Idempotent ueber automation_deliveries — darf beliebig oft laufen. Laeuft als Cron ueber alle Firmen; kein Ausfuehrungsrecht fuer authenticated.';


--
-- Name: save_besichtigung_analysis(uuid, numeric, numeric, integer, text, jsonb, jsonb, text[], text[], text, integer, boolean, text, numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_besichtigung_analysis(p_session_id uuid, p_estimated_volume_m3 numeric DEFAULT NULL::numeric, p_estimated_time_hours numeric DEFAULT NULL::numeric, p_recommended_workers integer DEFAULT NULL::integer, p_recommended_truck text DEFAULT NULL::text, p_room_breakdown jsonb DEFAULT '[]'::jsonb, p_detected_items jsonb DEFAULT '[]'::jsonb, p_special_items text[] DEFAULT '{}'::text[], p_special_requirements text[] DEFAULT '{}'::text[], p_from_access_difficulty text DEFAULT NULL::text, p_from_floor integer DEFAULT NULL::integer, p_from_has_lift boolean DEFAULT NULL::boolean, p_from_parking_distance text DEFAULT NULL::text, p_confidence numeric DEFAULT NULL::numeric, p_raw_response jsonb DEFAULT NULL::jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Delete previous analysis for this session (re-analyze)
  DELETE FROM besichtigung.ai_analysis WHERE session_id = p_session_id;

  INSERT INTO besichtigung.ai_analysis (
    session_id,
    estimated_volume_m3,
    estimated_time_hours,
    recommended_workers,
    recommended_truck,
    room_breakdown,
    detected_items,
    special_items,
    special_requirements,
    from_access_difficulty,
    from_floor,
    from_has_lift,
    from_parking_distance,
    confidence,
    raw_response
  ) VALUES (
    p_session_id,
    p_estimated_volume_m3,
    p_estimated_time_hours,
    p_recommended_workers,
    p_recommended_truck,
    p_room_breakdown,
    p_detected_items,
    p_special_items,
    p_special_requirements,
    p_from_access_difficulty,
    p_from_floor,
    p_from_has_lift,
    p_from_parking_distance,
    p_confidence,
    p_raw_response
  )
  RETURNING json_build_object(
    'id', id,
    'session_id', session_id,
    'analyzed_at', analyzed_at
  ) INTO v_result;

  -- Update session status to 'analyzed'
  UPDATE besichtigung.sessions
  SET status = 'analyzed', analyzed_at = NOW()
  WHERE id = p_session_id;

  RETURN v_result;
END;
$$;


--
-- Name: save_moving_calculation(uuid, jsonb, jsonb, jsonb, numeric, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_moving_calculation(p_offer_id uuid, p_calculation_data jsonb, p_origin_building_info jsonb, p_destination_building_info jsonb, p_distance_km numeric, p_driving_time_minutes integer, p_additional_stops integer, p_inventory_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_item JSONB;
  v_position INTEGER := 0;
BEGIN
  -- Update offer with calculation data
  UPDATE offers SET
    calculation_data = p_calculation_data,
    origin_building_info = p_origin_building_info,
    destination_building_info = p_destination_building_info,
    moving_distance_km = p_distance_km,
    moving_driving_time_minutes = p_driving_time_minutes,
    moving_additional_stops = p_additional_stops,
    -- Also update service_details for compatibility
    service_details = COALESCE(service_details, '{}'::JSONB) || jsonb_build_object(
      'volume_m3', (p_calculation_data->>'netVolume')::NUMERIC,
      'truck_volume_m3', (p_calculation_data->>'truckVolume')::NUMERIC,
      'distance_km', p_distance_km,
      'driving_time_minutes', p_driving_time_minutes
    ),
    -- Update resources
    resources = COALESCE(resources, '{}'::JSONB) || jsonb_build_object(
      'vehicles', jsonb_build_array(jsonb_build_object(
        'type', p_calculation_data->>'recommendedVehicle',
        'count', 1
      )),
      'personnel', jsonb_build_object(
        'count', (p_calculation_data->>'recommendedCrew')::INTEGER
      )
    ),
    updated_at = NOW()
  WHERE id = p_offer_id;

  -- Clear existing inventory items for this offer
  DELETE FROM offer_inventory_items WHERE offer_id = p_offer_id;

  -- Insert new inventory items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_inventory_items)
  LOOP
    v_position := v_position + 1;
    INSERT INTO offer_inventory_items (
      offer_id,
      item_id,
      category_id,
      name_de,
      volume_m3,
      assembly_time_minutes,
      quantity,
      position
    ) VALUES (
      p_offer_id,
      v_item->'item'->>'id',
      v_item->>'category_id',
      v_item->'item'->>'name_de',
      (v_item->'item'->>'volume_m3')::NUMERIC,
      (v_item->'item'->>'assembly_time_minutes')::INTEGER,
      (v_item->>'quantity')::INTEGER,
      v_position
    );
  END LOOP;

  RETURN p_offer_id;
END;
$$;


--
-- Name: FUNCTION save_moving_calculation(p_offer_id uuid, p_calculation_data jsonb, p_origin_building_info jsonb, p_destination_building_info jsonb, p_distance_km numeric, p_driving_time_minutes integer, p_additional_stops integer, p_inventory_items jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.save_moving_calculation(p_offer_id uuid, p_calculation_data jsonb, p_origin_building_info jsonb, p_destination_building_info jsonb, p_distance_km numeric, p_driving_time_minutes integer, p_additional_stops integer, p_inventory_items jsonb) IS 'Saves moving calculator results to an offer including inventory items';


--
-- Name: schedule_besichtigung_cleanup(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_besichtigung_cleanup(p_company_id uuid, p_lead_id uuid DEFAULT NULL::uuid, p_days integer DEFAULT 3) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER := 0;
  v_cleanup_at TIMESTAMPTZ := NOW() + (p_days || ' days')::INTERVAL;
BEGIN
  -- Update sessions that match company + lead
  IF p_lead_id IS NOT NULL THEN
    UPDATE besichtigung.sessions
    SET data_expires_at = v_cleanup_at
    WHERE company_id = p_company_id
      AND lead_id = p_lead_id
      AND (data_expires_at IS NULL OR data_expires_at > v_cleanup_at);
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  -- Also update sessions matching company without lead_id (general cleanup)
  IF v_count = 0 THEN
    UPDATE besichtigung.sessions
    SET data_expires_at = v_cleanup_at
    WHERE company_id = p_company_id
      AND lead_id IS NULL
      AND status IN ('analyzed', 'completed', 'uploaded')
      AND (data_expires_at IS NULL OR data_expires_at > v_cleanup_at);
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN json_build_object(
    'updated', v_count,
    'cleanup_at', v_cleanup_at
  );
END;
$$;


--
-- Name: search_customers(uuid, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_customers(p_company_id uuid, p_query text DEFAULT NULL::text, p_filter text DEFAULT 'alle'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, display_name text, customer_type text, first_name text, last_name text, company_name text, primary_email text, primary_phone text, language text, status text, possible_duplicate boolean, first_seen_at timestamp with time zone, letzte_aktion timestamp with time zone, offerten_offen integer, auftraege_gesamt integer, offener_betrag numeric, bezahlter_betrag numeric, ort text, gesamt bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
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


--
-- Name: FUNCTION search_customers(p_company_id uuid, p_query text, p_filter text, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.search_customers(p_company_id uuid, p_query text, p_filter text, p_limit integer, p_offset integer) IS 'Kundenliste mit Suche, Filter und Seitenzahl. Die abgeleiteten Werte (letzte Aktion, offene Offerten, offener Betrag) entstehen hier per LATERAL statt als gespeicherte Spalten, die veralten wuerden. gesamt traegt die Trefferzahl fuer die Blaetterleiste. Ab etwa 10 000 Kunden braucht die ILIKE-Suche pg_trgm + GIN; heute nicht.';


--
-- Name: set_api_keys_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_api_keys_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_company_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_company_slug() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := LOWER(REGEXP_REPLACE(NEW.company_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_lead_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_lead_slug() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_unique_slug('ANF');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_offer_acceptance_evidence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_offer_acceptance_evidence() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: FUNCTION set_offer_acceptance_evidence(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_offer_acceptance_evidence() IS 'Setzt accepted_at, agb_version (Wortlaut-Hash) und agb_ip_address beim Uebergang nach accepted — serverseitig, unabhaengig davon, was der Aufrufer schickt.';


--
-- Name: submit_lead(text, text, text, text, text, text, text, text, text, date, text, text, numeric, integer, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_lead(p_service_type text, p_from_plz text DEFAULT NULL::text, p_from_city text DEFAULT NULL::text, p_from_street text DEFAULT NULL::text, p_from_house_number text DEFAULT NULL::text, p_customer_first_name text DEFAULT NULL::text, p_customer_last_name text DEFAULT NULL::text, p_customer_email text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_preferred_date date DEFAULT NULL::date, p_description text DEFAULT NULL::text, p_property_type text DEFAULT NULL::text, p_from_rooms numeric DEFAULT NULL::numeric, p_from_living_space_m2 integer DEFAULT NULL::integer, p_detailed_form_data jsonb DEFAULT NULL::jsonb, p_form_version integer DEFAULT 2) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_lead_id UUID;
BEGIN
  INSERT INTO public.leads (
    service_type,
    from_plz,
    from_city,
    from_street,
    from_house_number,
    customer_first_name,
    customer_last_name,
    customer_email,
    customer_phone,
    preferred_date,
    description,
    property_type,
    from_rooms,
    from_living_space_m2,
    detailed_form_data,
    form_version,
    status,
    max_companies
  ) VALUES (
    p_service_type,
    p_from_plz,
    p_from_city,
    p_from_street,
    p_from_house_number,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_email,
    p_customer_phone,
    p_preferred_date,
    p_description,
    p_property_type,
    p_from_rooms,
    p_from_living_space_m2,
    p_detailed_form_data,
    p_form_version,
    'new',
    5
  )
  RETURNING id INTO new_lead_id;
  
  RETURN new_lead_id;
END;
$$;


--
-- Name: FUNCTION submit_lead(p_service_type text, p_from_plz text, p_from_city text, p_from_street text, p_from_house_number text, p_customer_first_name text, p_customer_last_name text, p_customer_email text, p_customer_phone text, p_preferred_date date, p_description text, p_property_type text, p_from_rooms numeric, p_from_living_space_m2 integer, p_detailed_form_data jsonb, p_form_version integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.submit_lead(p_service_type text, p_from_plz text, p_from_city text, p_from_street text, p_from_house_number text, p_customer_first_name text, p_customer_last_name text, p_customer_email text, p_customer_phone text, p_preferred_date date, p_description text, p_property_type text, p_from_rooms numeric, p_from_living_space_m2 integer, p_detailed_form_data jsonb, p_form_version integer) IS 'Securely insert a new lead. Uses SECURITY DEFINER to bypass RLS, allowing anonymous form submissions.';


--
-- Name: submit_lead_json(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_lead_json(lead_data jsonb) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  new_lead_id   UUID;
  new_lead_slug TEXT;
  v_service_type TEXT;
  v_base_cost NUMERIC;
  v_rooms NUMERIC;
  v_m2 INTEGER;
  v_max_companies INTEGER;
  v_size_mult NUMERIC := 1.0;
  v_offerten_mult NUMERIC := 1.0;
  v_min_tokens NUMERIC := 10;
  v_max_tokens NUMERIC := 200;
  v_size_multipliers JSONB;
  v_offerten_multipliers JSONB;
  v_token_cost NUMERIC;
  v_effective_rooms NUMERIC;
  v_rec RECORD;
  -- A2: dedup
  v_existing_slug TEXT;
  -- A1: validated fields
  v_customer_email TEXT;
  v_customer_phone TEXT;
  v_customer_first_name TEXT;
  v_customer_last_name TEXT;
  v_from_plz TEXT;
  v_from_city TEXT;
BEGIN
  -- =========================================================================
  -- A1: ZORUNLU ALAN DOĞRULAMASI
  -- =========================================================================
  v_service_type        := NULLIF(TRIM(lead_data->>'service_type'), '');
  v_customer_email      := NULLIF(TRIM(lead_data->>'customer_email'), '');
  v_customer_phone      := NULLIF(TRIM(lead_data->>'customer_phone'), '');
  v_customer_first_name := NULLIF(TRIM(lead_data->>'customer_first_name'), '');
  v_customer_last_name  := NULLIF(TRIM(lead_data->>'customer_last_name'), '');
  v_from_plz            := NULLIF(TRIM(lead_data->>'from_plz'), '');
  v_from_city           := NULLIF(TRIM(lead_data->>'from_city'), '');

  IF v_service_type IS NULL THEN
    RAISE EXCEPTION 'Pflichtfeld fehlt: service_type' USING ERRCODE = 'P0001';
  END IF;

  IF v_customer_first_name IS NULL THEN
    RAISE EXCEPTION 'Pflichtfeld fehlt: customer_first_name' USING ERRCODE = 'P0001';
  END IF;

  IF v_customer_last_name IS NULL THEN
    RAISE EXCEPTION 'Pflichtfeld fehlt: customer_last_name' USING ERRCODE = 'P0001';
  END IF;

  IF v_customer_email IS NULL THEN
    RAISE EXCEPTION 'Pflichtfeld fehlt: customer_email' USING ERRCODE = 'P0001';
  END IF;

  -- E-posta format kontrolü
  IF v_customer_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
    RAISE EXCEPTION 'Ungültige E-Mail-Adresse: %', v_customer_email USING ERRCODE = 'P0001';
  END IF;

  IF v_customer_phone IS NULL THEN
    RAISE EXCEPTION 'Pflichtfeld fehlt: customer_phone' USING ERRCODE = 'P0001';
  END IF;

  -- Telefon: en az 7 hane (uluslararası formatları dahil)
  IF v_customer_phone !~ '^[+\d\s\-\(\)]{7,}$' THEN
    RAISE EXCEPTION 'Ungültige Telefonnummer: %', v_customer_phone USING ERRCODE = 'P0001';
  END IF;

  IF v_from_plz IS NULL THEN
    RAISE EXCEPTION 'Pflichtfeld fehlt: from_plz' USING ERRCODE = 'P0001';
  END IF;

  IF v_from_city IS NULL THEN
    RAISE EXCEPTION 'Pflichtfeld fehlt: from_city' USING ERRCODE = 'P0001';
  END IF;

  -- =========================================================================
  -- A2: TEKRAR GÖNDERIM KONTROLÜ (aynı email+service_type+from_plz, son 1 saat)
  -- =========================================================================
  SELECT slug INTO v_existing_slug
  FROM public.leads
  WHERE customer_email = v_customer_email
    AND service_type   = v_service_type
    AND from_plz       = v_from_plz
    AND status NOT IN ('rejected', 'expired_unverified')
    AND created_at > NOW() - INTERVAL '1 hour'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_slug IS NOT NULL THEN
    -- Mevcut slug'ı döndür, yeni lead oluşturma
    RETURN v_existing_slug;
  END IF;

  -- =========================================================================
  -- FİYATLANDIRMA HESAPLAMASI (değişmedi)
  -- =========================================================================
  v_rooms        := NULLIF(lead_data->>'from_rooms', '')::NUMERIC;
  v_m2           := NULLIF(lead_data->>'from_living_space_m2', '')::INTEGER;
  v_max_companies := COALESCE(NULLIF(lead_data->>'max_companies', '')::INTEGER, 5);

  SELECT base_token_cost INTO v_base_cost
  FROM public.service_catalog
  WHERE service_type = v_service_type AND is_active = true
  LIMIT 1;

  IF v_base_cost IS NULL THEN
    SELECT base_token_cost INTO v_base_cost
    FROM public.service_catalog
    WHERE service_type LIKE (split_part(v_service_type, '_', 1) || '%') AND is_active = true
    ORDER BY sort_order ASC LIMIT 1;
  END IF;

  v_base_cost := COALESCE(v_base_cost, 15);

  SELECT
    COALESCE(size_multipliers,      '{"1-2":1.0,"3":1.2,"4-5":1.4,"6+":1.6}'::JSONB),
    COALESCE(offerten_multipliers,  '{"3":1.3,"4":1.15,"5":1.0}'::JSONB),
    COALESCE(min_lead_price_tokens, 10),
    COALESCE(max_lead_price_tokens, 200)
  INTO v_size_multipliers, v_offerten_multipliers, v_min_tokens, v_max_tokens
  FROM public.pricing_settings LIMIT 1;

  v_size_multipliers     := COALESCE(v_size_multipliers,     '{"1-2":1.0,"3":1.2,"4-5":1.4,"6+":1.6}'::JSONB);
  v_offerten_multipliers := COALESCE(v_offerten_multipliers, '{"3":1.3,"4":1.15,"5":1.0}'::JSONB);

  v_effective_rooms := v_rooms;
  IF v_effective_rooms IS NULL AND v_m2 IS NOT NULL THEN
    v_effective_rooms := CASE
      WHEN v_m2 >= 150 THEN 6
      WHEN v_m2 >= 100 THEN 4
      WHEN v_m2 >= 60  THEN 3
      ELSE 2
    END;
  END IF;

  IF v_effective_rooms IS NOT NULL AND v_effective_rooms > 0 THEN
    FOR v_rec IN SELECT key, value::NUMERIC AS mult FROM jsonb_each_text(v_size_multipliers) LOOP
      IF v_rec.key LIKE '%+' THEN
        IF v_effective_rooms >= replace(v_rec.key, '+', '')::NUMERIC THEN
          v_size_mult := v_rec.mult;
        END IF;
      ELSIF v_rec.key LIKE '%-%' THEN
        IF v_effective_rooms >= split_part(v_rec.key, '-', 1)::NUMERIC
           AND v_effective_rooms <= split_part(v_rec.key, '-', 2)::NUMERIC THEN
          v_size_mult := v_rec.mult;
        END IF;
      ELSE
        IF ABS(v_effective_rooms - v_rec.key::NUMERIC) < 0.5 THEN
          v_size_mult := v_rec.mult;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_offerten_multipliers ? (v_max_companies::TEXT) THEN
    v_offerten_mult := (v_offerten_multipliers->>(v_max_companies::TEXT))::NUMERIC;
  END IF;

  v_token_cost := GREATEST(LEAST(ROUND(v_base_cost * v_size_mult * v_offerten_mult), v_max_tokens), v_min_tokens);

  -- =========================================================================
  -- INSERT — A4: expires_at = NOW() + 30 gün
  -- =========================================================================
  INSERT INTO public.leads (
    service_type,
    source,
    from_plz,
    from_city,
    from_street,
    from_house_number,
    from_floor,
    from_has_lift,
    from_rooms,
    from_living_space_m2,
    to_plz,
    to_city,
    to_street,
    to_house_number,
    to_floor,
    to_has_lift,
    preferred_date,
    moving_date,
    preferred_time_slot,
    is_flexible_date,
    moving_flexibility,
    description,
    special_items,
    packing_service_needed,
    cleaning_service_needed,
    storage_needed,
    additional_services_umzug,
    piano_type,
    piano_brand,
    piano_weight_kg,
    staircase_type,
    staircase_width_cm,
    staircase_turns,
    window_access_possible,
    moebellift_floor,
    moebellift_item_description,
    moebellift_item_dimensions,
    property_type,
    bathroom_count,
    has_balcony,
    has_garage,
    has_basement,
    has_attic,
    clearing_type,
    estimated_volume,
    has_heavy_items,
    heavy_items_description,
    disposal_type,
    items_description,
    storage_duration,
    storage_volume,
    access_frequency,
    needs_climate_control,
    storage_items_description,
    pickup_street,
    pickup_house_number,
    pickup_floor,
    pickup_has_lift,
    distance_km,
    estimated_duration_minutes,
    customer_first_name,
    customer_last_name,
    customer_email,
    customer_phone,
    customer_salutation,
    customer_contact_time,
    max_companies,
    source_form_id,
    ip_address,
    status,
    form_version,
    detailed_form_data,
    token_cost,
    expires_at
  ) VALUES (
    v_service_type,
    COALESCE(lead_data->>'source', 'web_form'),
    v_from_plz,
    v_from_city,
    lead_data->>'from_street',
    lead_data->>'from_house_number',
    NULLIF(lead_data->>'from_floor', '')::INTEGER,
    (lead_data->>'from_has_lift')::BOOLEAN,
    NULLIF(lead_data->>'from_rooms', '')::NUMERIC,
    NULLIF(lead_data->>'from_living_space_m2', '')::INTEGER,
    lead_data->>'to_plz',
    lead_data->>'to_city',
    lead_data->>'to_street',
    lead_data->>'to_house_number',
    NULLIF(lead_data->>'to_floor', '')::INTEGER,
    (lead_data->>'to_has_lift')::BOOLEAN,
    NULLIF(lead_data->>'preferred_date', '')::DATE,
    NULLIF(lead_data->>'preferred_date', '')::DATE,
    lead_data->>'preferred_time_slot',
    COALESCE((lead_data->>'is_flexible_date')::BOOLEAN, false),
    lead_data->>'moving_flexibility',
    lead_data->>'description',
    CASE
      WHEN jsonb_typeof(lead_data->'special_items') = 'array'
      THEN (SELECT ARRAY_AGG(elem::text) FROM jsonb_array_elements_text(lead_data->'special_items') AS elem)
      ELSE NULL
    END,
    COALESCE((lead_data->>'packing_service_needed')::BOOLEAN, false),
    COALESCE((lead_data->>'cleaning_service_needed')::BOOLEAN, false),
    COALESCE((lead_data->>'storage_needed')::BOOLEAN, false),
    CASE
      WHEN jsonb_typeof(lead_data->'additional_services_umzug') = 'object'
      THEN lead_data->'additional_services_umzug'
      ELSE '{}'::jsonb
    END,
    lead_data->>'piano_type',
    lead_data->>'piano_brand',
    NULLIF(lead_data->>'piano_weight_kg', '')::INTEGER,
    lead_data->>'staircase_type',
    NULLIF(lead_data->>'staircase_width_cm', '')::INTEGER,
    NULLIF(lead_data->>'staircase_turns', '')::INTEGER,
    (lead_data->>'window_access_possible')::BOOLEAN,
    NULLIF(lead_data->>'moebellift_floor', '')::INTEGER,
    lead_data->>'moebellift_item_description',
    lead_data->>'moebellift_item_dimensions',
    lead_data->>'property_type',
    NULLIF(lead_data->>'bathroom_count', '')::INTEGER,
    COALESCE((lead_data->>'has_balcony')::BOOLEAN, false),
    COALESCE((lead_data->>'has_garage')::BOOLEAN, false),
    COALESCE((lead_data->>'has_basement')::BOOLEAN, false),
    COALESCE((lead_data->>'has_attic')::BOOLEAN, false),
    lead_data->>'clearing_type',
    lead_data->>'estimated_volume',
    COALESCE((lead_data->>'has_heavy_items')::BOOLEAN, false),
    lead_data->>'heavy_items_description',
    lead_data->>'disposal_type',
    lead_data->>'items_description',
    lead_data->>'storage_duration',
    lead_data->>'storage_volume',
    lead_data->>'access_frequency',
    COALESCE((lead_data->>'needs_climate_control')::BOOLEAN, false),
    lead_data->>'storage_items_description',
    lead_data->>'pickup_street',
    lead_data->>'pickup_house_number',
    NULLIF(lead_data->>'pickup_floor', '')::INTEGER,
    COALESCE((lead_data->>'pickup_has_lift')::BOOLEAN, false),
    NULLIF(lead_data->>'distance_km', '')::NUMERIC,
    NULLIF(lead_data->>'estimated_duration_minutes', '')::INTEGER,
    v_customer_first_name,
    v_customer_last_name,
    v_customer_email,
    v_customer_phone,
    lead_data->>'customer_salutation',
    lead_data->>'customer_contact_time',
    COALESCE(NULLIF(lead_data->>'max_companies', '')::INTEGER, 5),
    NULLIF(lead_data->>'source_form_id', '')::UUID,
    lead_data->>'ip_address',
    'pending_verification',
    COALESCE(NULLIF(lead_data->>'form_version', '')::INTEGER, 1),
    lead_data->'detailed_form_data',
    v_token_cost,
    NOW() + INTERVAL '30 days'   -- A4: expires_at otomatik
  )
  RETURNING id, slug INTO new_lead_id, new_lead_slug;

  RETURN new_lead_slug;
END;
$_$;


--
-- Name: FUNCTION submit_lead_json(lead_data jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.submit_lead_json(lead_data jsonb) IS 'Altlast aus dem Marktplatz-Fork. KEIN Aufrufer im Repo. Ausfuehrungsrecht fuer anon 2026-07-28 entzogen — Leads entstehen ausschliesslich serverseitig.';


--
-- Name: sync_appointment_cancel_to_auftrag(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_appointment_cancel_to_auftrag() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.auftraege a
  SET status = 'storniert'::public.auftrag_status
  WHERE a.appointment_id = NEW.id
    AND a.deleted_at IS NULL
    AND a.status NOT IN ('abgeschlossen', 'storniert');
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION sync_appointment_cancel_to_auftrag(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_appointment_cancel_to_auftrag() IS 'Service randevusu iptal edilince linkli auftrag storniert olur (terminal auftraglar hariç).';


--
-- Name: sync_appointment_schedule_to_auftrag(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_appointment_schedule_to_auftrag() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_datetime_changed boolean := (
    OLD.appointment_date IS DISTINCT FROM NEW.appointment_date
    OR OLD.start_time IS DISTINCT FROM NEW.start_time
  );
BEGIN
  UPDATE public.auftraege a
  SET
    scheduled_date              = NEW.appointment_date,
    scheduled_time              = NEW.start_time,
    estimated_duration_minutes  = COALESCE(NEW.duration_minutes, a.estimated_duration_minutes),
    -- Tarih/saat değişince hatırlatmaları sıfırla (yeni tarih için tekrar gönderilmeli).
    -- Sadece zaman değiştiğinde; duration-only değişimde bayraklar korunur.
    team_reminder_sent          = CASE WHEN v_datetime_changed THEN FALSE ELSE a.team_reminder_sent END,
    reminder_sent_at            = CASE WHEN v_datetime_changed THEN NULL  ELSE a.reminder_sent_at END,
    customer_reminder_sent      = CASE WHEN v_datetime_changed THEN FALSE ELSE a.customer_reminder_sent END,
    customer_reminder_sent_at   = CASE WHEN v_datetime_changed THEN NULL  ELSE a.customer_reminder_sent_at END
  WHERE a.appointment_id = NEW.id
    AND a.deleted_at IS NULL
    AND (
      a.scheduled_date IS DISTINCT FROM NEW.appointment_date
      OR a.scheduled_time IS DISTINCT FROM NEW.start_time
      OR a.estimated_duration_minutes IS DISTINCT FROM COALESCE(NEW.duration_minutes, a.estimated_duration_minutes)
    );
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION sync_appointment_schedule_to_auftrag(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_appointment_schedule_to_auftrag() IS 'Takvim randevusu (service) tarih/saat değişince linkli auftrag scheduled_* aynalanır. Tarih/saat değiştiğinde reminder bayrakları (team + customer) sıfırlanır.';


--
-- Name: sync_auftrag_status_to_appointment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_auftrag_status_to_appointment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_target public.appointment_status;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    v_target := 'cancelled'::public.appointment_status;
  ELSE
    v_target := public.map_auftrag_to_appointment_status(NEW.status::text);
  END IF;

  IF NEW.offer_id IS NOT NULL THEN
    -- Multi-service: every service appointment of this offer.
    UPDATE public.appointments
    SET status = v_target
    WHERE offer_id = NEW.offer_id
      AND appointment_type = 'service'
      AND status IS DISTINCT FROM v_target
      -- Don't revive an already-cancelled group unless this IS a cancel.
      AND (v_target = 'cancelled' OR status <> 'cancelled');
  ELSIF NEW.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET status = v_target
    WHERE id = NEW.appointment_id
      AND status IS DISTINCT FROM v_target;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION sync_auftrag_status_to_appointment(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_auftrag_status_to_appointment() IS 'Auftrag status/deleted_at değişince linkli appointment.status aynalanır.';


--
-- Name: trigger_notify_admin_high_spam(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_notify_admin_high_spam() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ BEGIN RETURN NEW; END; $$;


--
-- Name: trigger_subscription_manager(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_subscription_manager() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$ BEGIN RETURN; END; $$;


--
-- Name: FUNCTION trigger_subscription_manager(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_subscription_manager() IS 'Triggers the subscription-manager Edge Function to send reminders and deactivate expired subscriptions';


--
-- Name: trigger_team_reminder_for_appointment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_team_reminder_for_appointment(p_appointment_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ BEGIN RETURN false; END; $$;


--
-- Name: FUNCTION trigger_team_reminder_for_appointment(p_appointment_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_team_reminder_for_appointment(p_appointment_id uuid) IS 'Manually trigger a team reminder for a specific appointment';


--
-- Name: update_amendment_by_token(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_amendment_by_token(p_token text, p_new_status text, p_note text DEFAULT NULL::text, p_ip text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_a         public.offer_amendments;
  v_positionen JSONB;
BEGIN
  IF p_new_status NOT IN ('viewed', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Ungueltiger Status: %', p_new_status USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_a FROM public.offer_amendments WHERE access_token = p_token;
  IF v_a.id IS NULL THEN
    RETURN false;
  END IF;

  -- Einmal entschieden bleibt entschieden.
  IF v_a.status IN ('accepted', 'rejected') AND p_new_status <> 'viewed' THEN
    RETURN false;
  END IF;
  IF v_a.status = 'draft' THEN
    RETURN false;
  END IF;

  UPDATE public.offer_amendments SET
    status      = p_new_status,
    viewed_at   = COALESCE(viewed_at, CASE WHEN p_new_status = 'viewed'   THEN NOW() END),
    accepted_at = COALESCE(accepted_at, CASE WHEN p_new_status = 'accepted' THEN NOW() END),
    rejected_at = COALESCE(rejected_at, CASE WHEN p_new_status = 'rejected' THEN NOW() END),
    customer_response_note = COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), customer_response_note),
    -- Zeitpunkt aus der Datenbank, IP aus dem Aufruf der Edge Function. Der
    -- Browser liefert hier nichts, was zaehlt.
    accepted_ip = CASE WHEN p_new_status = 'accepted'
                       THEN COALESCE(NULLIF(TRIM(COALESCE(p_ip, '')), ''), accepted_ip)
                       ELSE accepted_ip END
  WHERE id = v_a.id;

  -- Zustimmung wirkt auf den AUFTRAG: der zeigt, was auszufuehren und zu
  -- verrechnen ist. Offerte und Nachtrag bleiben als Beleg unveraendert.
  IF p_new_status = 'accepted' AND v_a.auftrag_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'description',  i.description,
             'quantity',     i.quantity,
             'unit',         i.unit,
             'unit_price',   i.unit_price,
             'total',        i.quantity * i.unit_price,
             'price_type',   'fixed',
             'from_amendment', v_a.amendment_number)
           ORDER BY i.position), '[]'::jsonb)
    INTO v_positionen
    FROM public.offer_amendment_items i WHERE i.amendment_id = v_a.id;

    UPDATE public.auftraege a SET
      items      = COALESCE(a.items, '[]'::jsonb) || v_positionen,
      subtotal   = COALESCE(a.subtotal, 0)   + v_a.subtotal,
      vat_amount = COALESCE(a.vat_amount, 0) + v_a.vat_amount,
      total      = COALESCE(a.total, 0)      + v_a.total
    WHERE a.id = v_a.auftrag_id;
  END IF;

  RETURN true;
END;
$$;


--
-- Name: FUNCTION update_amendment_by_token(p_token text, p_new_status text, p_note text, p_ip text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_amendment_by_token(p_token text, p_new_status text, p_note text, p_ip text) IS 'Zustimmung oder Ablehnung eines Nachtrags durch den Kunden. Bei Zustimmung wird der Auftrag fortgeschrieben (Positionen und Betraege kommen dazu); Offerte und Nachtrag bleiben als Beleg unveraendert.';


--
-- Name: update_archive_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_archive_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_besichtigung_session_status(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_besichtigung_session_status(p_session_id uuid, p_status text, p_customer_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  UPDATE besichtigung.sessions
  SET 
    status = p_status,
    customer_notes = COALESCE(p_customer_notes, customer_notes),
    uploaded_at = CASE WHEN p_status = 'uploaded' THEN NOW() ELSE uploaded_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END
  WHERE id = p_session_id
  RETURNING json_build_object('id', id, 'status', status) INTO v_result;

  RETURN v_result;
END;
$$;


--
-- Name: update_company_pricing_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_company_pricing_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_klaviertransport_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_klaviertransport_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_landing_pages_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_landing_pages_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_manual_import_sub_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_manual_import_sub_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_moebellift_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_moebellift_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_offer_by_token(text, text, timestamp with time zone, timestamp with time zone, timestamp with time zone, text, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_offer_by_token(offer_access_token text, new_status text DEFAULT NULL::text, new_viewed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_accepted_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_rejected_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_customer_response_note text DEFAULT NULL::text, new_agb_accepted_at timestamp with time zone DEFAULT NULL::timestamp with time zone, new_agb_version text DEFAULT NULL::text, new_agb_ip_address text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: FUNCTION update_offer_by_token(offer_access_token text, new_status text, new_viewed_at timestamp with time zone, new_accepted_at timestamp with time zone, new_rejected_at timestamp with time zone, new_customer_response_note text, new_agb_accepted_at timestamp with time zone, new_agb_version text, new_agb_ip_address text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_offer_by_token(offer_access_token text, new_status text, new_viewed_at timestamp with time zone, new_accepted_at timestamp with time zone, new_rejected_at timestamp with time zone, new_customer_response_note text, new_agb_accepted_at timestamp with time zone, new_agb_version text, new_agb_ip_address text) IS 'Updates offer status/metadata via customer access token. new_status validated against allowed values (viewed/accepted/rejected). Terminal statuses (accepted/rejected) block further status changes. new_agb_ip_address is ignored — must be set by Edge Function from request headers.';


--
-- Name: update_quittungen_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_quittungen_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_raeumung_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_raeumung_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_rechnungen_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_rechnungen_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_ticket_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ticket_timestamp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.support_tickets
  SET updated_at = NOW()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_umzug_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_umzug_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_umzugsbox_rentals_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_umzugsbox_rentals_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_website_settings_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_website_settings_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: upsert_company_pricing_config(uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_company_pricing_config(p_company_id uuid, p_config jsonb, p_user_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_config_id UUID;
  v_old_config_id UUID;
  v_old_values JSONB;
  v_has_access BOOLEAN;
  v_actual_user_id UUID;
BEGIN
  -- Input validation
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id cannot be null'
      USING ERRCODE = '22023';  -- invalid_parameter_value
  END IF;
  
  IF p_config IS NULL THEN
    RAISE EXCEPTION 'config cannot be null'
      USING ERRCODE = '22023';
  END IF;

  -- Get actual user ID (prefer auth.uid() over parameter for security)
  v_actual_user_id := COALESCE(auth.uid(), p_user_id);

  -- Check authorization
  SELECT EXISTS(
    SELECT 1 FROM public.companies WHERE id = p_company_id AND user_id = auth.uid()
    UNION
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ) INTO v_has_access;
  
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied to modify company pricing config'
      USING ERRCODE = '42501';
  END IF;

  -- Validate team_rates structure
  IF p_config ? 'teamRates' THEN
    IF jsonb_typeof(p_config->'teamRates') != 'array' THEN
      RAISE EXCEPTION 'teamRates must be an array'
        USING ERRCODE = '22023';
    END IF;
    
    IF jsonb_array_length(p_config->'teamRates') = 0 THEN
      RAISE EXCEPTION 'teamRates cannot be empty'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Get existing config for audit log
  SELECT id, jsonb_build_object(
    'teamRates', team_rates,
    'vatRate', vat_rate,
    'minimumHours', minimum_hours,
    'minimumCharge', minimum_charge
  )
  INTO v_old_config_id, v_old_values
  FROM public.company_pricing_configs
  WHERE company_id = p_company_id AND is_active = true;

  -- BEGIN ATOMIC OPERATION
  -- Note: PL/pgSQL functions are already atomic - if any statement fails,
  -- all changes are rolled back automatically
  
  -- Deactivate existing config (if any)
  IF v_old_config_id IS NOT NULL THEN
    UPDATE public.company_pricing_configs
    SET 
      is_active = false, 
      updated_at = NOW(), 
      updated_by = v_actual_user_id
    WHERE id = v_old_config_id;
    
    -- Log deactivation
    INSERT INTO public.company_pricing_audit_log (
      company_id, config_id, action, old_values, changed_by
    ) VALUES (
      p_company_id, v_old_config_id, 'deactivate', v_old_values, v_actual_user_id
    );
  END IF;
  
  -- Insert new config
  INSERT INTO public.company_pricing_configs (
    company_id,
    template_id,
    template_name,
    currency,
    vat_rate,
    minimum_hours,
    minimum_charge,
    team_rates,
    hourly_rate,
    vehicle_prices,
    distance_surcharge_rate,
    distance_surcharge_threshold,
    surcharges,
    floor_surcharges,
    equipment,
    packing_service_rate,
    external_lift_cost,
    disposal_cost,
    piano_transport_cost,
    storage_cost_per_m3,
    multipliers,
    is_active,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    COALESCE(p_config->>'templateId', 'custom'),
    COALESCE(p_config->>'templateName', 'Benutzerdefiniert'),
    COALESCE(p_config->>'currency', 'CHF'),
    COALESCE((p_config->>'vatRate')::NUMERIC, 8.1),
    COALESCE((p_config->>'minimumHours')::INTEGER, 4),
    COALESCE((p_config->>'minimumCharge')::NUMERIC, 480),
    COALESCE(p_config->'teamRates', '[{"trucks":1,"workers":2,"hourlyRate":180,"label":"1 LKW + 2 Helfer"}]'::jsonb),
    COALESCE((p_config->>'hourlyRate')::NUMERIC, 60),
    COALESCE(p_config->'vehiclePrices', '{"transporter":80,"truck_3_5t":120,"truck_7_5t":180,"truck_18t":250}'::jsonb),
    COALESCE((p_config->>'distanceSurchargeRate')::NUMERIC, 2.50),
    COALESCE((p_config->>'distanceSurchargeThreshold')::INTEGER, 20),
    COALESCE(p_config->'surcharges', '{}'::jsonb),
    COALESCE(p_config->'floorSurcharges', '{}'::jsonb),
    COALESCE(p_config->'equipment', '{}'::jsonb),
    COALESCE((p_config->>'packingServiceRate')::NUMERIC, 45),
    COALESCE((p_config->>'externalLiftCost')::NUMERIC, 550),
    COALESCE((p_config->>'disposalCost')::NUMERIC, 35),
    COALESCE((p_config->>'pianoTransportCost')::NUMERIC, 350),
    COALESCE((p_config->>'storageCostPerM3')::NUMERIC, 45),
    COALESCE(p_config->'multipliers', '{"weekend":1.25,"evening":1.15,"holiday":1.50,"express":1.30}'::jsonb),
    true,
    v_actual_user_id,
    v_actual_user_id
  )
  RETURNING id INTO v_config_id;
  
  -- Log creation
  INSERT INTO public.company_pricing_audit_log (
    company_id, config_id, action, new_values, changed_by
  ) VALUES (
    p_company_id, 
    v_config_id, 
    CASE WHEN v_old_config_id IS NULL THEN 'create' ELSE 'update' END,
    jsonb_build_object(
      'teamRates', p_config->'teamRates',
      'vatRate', p_config->>'vatRate',
      'minimumHours', p_config->>'minimumHours',
      'minimumCharge', p_config->>'minimumCharge'
    ),
    v_actual_user_id
  );
  
  -- END ATOMIC OPERATION
  
  RETURN v_config_id;

EXCEPTION 
  WHEN unique_violation THEN
    RAISE EXCEPTION 'A pricing configuration already exists for this company'
      USING ERRCODE = '23505';
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE WARNING 'upsert_company_pricing_config failed for company %: % (SQLSTATE: %)', 
      p_company_id, SQLERRM, SQLSTATE;
    RAISE;  -- Re-raise to ensure rollback
END;
$$;


--
-- Name: FUNCTION upsert_company_pricing_config(p_company_id uuid, p_config jsonb, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.upsert_company_pricing_config(p_company_id uuid, p_config jsonb, p_user_id uuid) IS 'Atomically updates company pricing configuration with audit logging. Rolls back on any error.';


--
-- Name: validate_offer_access_token(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_offer_access_token(offer_id uuid, token text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.offers
    WHERE id = offer_id
      AND access_token = token
  )
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_email text,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: agb_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agb_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    service_type character varying NOT NULL,
    title character varying NOT NULL,
    content text NOT NULL,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    translations jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    key_name text NOT NULL,
    key_value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    changed_by uuid,
    change_type text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: appointment_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    recipient_type text NOT NULL,
    recipient_id uuid,
    recipient_email text,
    recipient_phone text,
    reminder_type text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'sent'::text,
    error_message text
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    lead_id uuid,
    offer_id uuid,
    appointment_type public.appointment_type NOT NULL,
    status public.appointment_status DEFAULT 'pending'::public.appointment_status,
    appointment_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration_minutes integer,
    all_day boolean DEFAULT false,
    location_address text,
    location_plz text,
    location_city text,
    location_notes text,
    customer_first_name text,
    customer_last_name text,
    customer_email text,
    customer_phone text,
    title text NOT NULL,
    description text,
    internal_notes text,
    assigned_team_member_ids uuid[],
    required_vehicles text[],
    required_equipment text[],
    reminder_sent_firma boolean DEFAULT false,
    reminder_sent_customer boolean DEFAULT false,
    reminder_sent_at timestamp with time zone,
    confirmed_by_firma boolean DEFAULT false,
    confirmed_by_customer boolean DEFAULT false,
    confirmed_at timestamp with time zone,
    completed_at timestamp with time zone,
    completion_notes text,
    cancelled_by text,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    rescheduled_from_id uuid,
    rescheduled_to_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_recurring boolean DEFAULT false,
    recurrence_pattern character varying(50),
    recurrence_end_date date,
    parent_appointment_id uuid,
    reminder_sent_team boolean DEFAULT false,
    language text DEFAULT 'de'::text NOT NULL,
    customer_id uuid,
    location_id uuid,
    CONSTRAINT appointments_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text])))
);

ALTER TABLE ONLY public.appointments REPLICA IDENTITY FULL;


--
-- Name: COLUMN appointments.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.appointments.customer_id IS 'Kanonischer Kunde, vom Auftrag bzw. Lead geerbt.';


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    user_id uuid,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    role text,
    skills text[],
    is_active boolean DEFAULT true,
    color_code character varying(7) DEFAULT '#3B82F6'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: appointment_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.appointment_summary WITH (security_invoker='on') AS
 SELECT a.company_id,
    a.appointment_date,
    a.appointment_type,
    count(*) AS total_appointments,
    count(*) FILTER (WHERE (a.status = 'pending'::public.appointment_status)) AS pending_count,
    count(*) FILTER (WHERE (a.status = 'confirmed'::public.appointment_status)) AS confirmed_count,
    count(*) FILTER (WHERE (a.status = 'completed'::public.appointment_status)) AS completed_count,
    count(*) FILTER (WHERE (a.status = 'cancelled'::public.appointment_status)) AS cancelled_count,
    array_agg(DISTINCT tm.id) FILTER (WHERE (tm.id IS NOT NULL)) AS team_member_ids
   FROM ((public.appointments a
     LEFT JOIN LATERAL unnest(a.assigned_team_member_ids) tm_id(tm_id) ON (true))
     LEFT JOIN public.team_members tm ON ((tm.id = tm_id.tm_id)))
  WHERE (a.appointment_date >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY a.company_id, a.appointment_date, a.appointment_type;


--
-- Name: VIEW appointment_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.appointment_summary IS 'Appointment summary view with SECURITY INVOKER - respects RLS policies';


--
-- Name: archive_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archive_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_name text NOT NULL,
    archive_type text NOT NULL,
    records_archived integer DEFAULT 0,
    file_size_bytes bigint DEFAULT 0,
    compression_ratio numeric(5,2),
    data_from_date timestamp with time zone,
    data_to_date timestamp with time zone,
    storage_type text NOT NULL,
    storage_path text,
    storage_url text,
    export_format text DEFAULT 'json'::text,
    status text DEFAULT 'pending'::text,
    error_message text,
    triggered_by text DEFAULT 'manual'::text,
    triggered_by_user_id uuid,
    source_data_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    is_restorable boolean DEFAULT true,
    restored_at timestamp with time zone,
    restored_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT archive_logs_archive_type_check CHECK ((archive_type = ANY (ARRAY['leads'::text, 'offers'::text, 'email_logs'::text, 'notifications'::text, 'analytics'::text, 'appointments'::text, 'full_backup'::text, 'custom'::text]))),
    CONSTRAINT archive_logs_export_format_check CHECK ((export_format = ANY (ARRAY['json'::text, 'csv'::text, 'parquet'::text]))),
    CONSTRAINT archive_logs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'restored'::text]))),
    CONSTRAINT archive_logs_storage_type_check CHECK ((storage_type = ANY (ARRAY['local'::text, 'google_drive'::text, 'dropbox'::text, 's3'::text, 'supabase_storage'::text]))),
    CONSTRAINT archive_logs_triggered_by_check CHECK ((triggered_by = ANY (ARRAY['manual'::text, 'auto'::text, 'scheduled'::text])))
);


--
-- Name: archive_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archive_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_enabled boolean DEFAULT true,
    auto_archive_day integer DEFAULT 1,
    leads_retention_days integer DEFAULT 90,
    offers_retention_days integer DEFAULT 90,
    email_logs_retention_days integer DEFAULT 90,
    notifications_retention_days integer DEFAULT 30,
    analytics_retention_days integer DEFAULT 180,
    appointments_retention_days integer DEFAULT 90,
    default_export_format text DEFAULT 'json'::text,
    compress_archives boolean DEFAULT true,
    google_drive_enabled boolean DEFAULT false,
    google_drive_folder_id text,
    dropbox_enabled boolean DEFAULT false,
    dropbox_folder_path text,
    s3_enabled boolean DEFAULT false,
    s3_bucket_name text,
    s3_region text,
    notify_on_archive boolean DEFAULT true,
    notify_email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT archive_settings_auto_archive_day_check CHECK (((auto_archive_day >= 1) AND (auto_archive_day <= 28))),
    CONSTRAINT archive_settings_default_export_format_check CHECK ((default_export_format = ANY (ARRAY['json'::text, 'csv'::text])))
);


--
-- Name: archive_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archive_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_log_id uuid,
    chunk_number integer DEFAULT 1,
    total_chunks integer DEFAULT 1,
    data jsonb NOT NULL,
    record_count integer DEFAULT 0,
    checksum text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: auftraege; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auftraege (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    offer_id uuid,
    lead_id uuid,
    auftrag_nummer character varying(50) NOT NULL,
    team_leader_id uuid,
    assigned_team_members uuid[] DEFAULT '{}'::uuid[],
    scheduled_date date NOT NULL,
    scheduled_time time without time zone,
    estimated_duration_minutes integer DEFAULT 120,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_phone character varying(50),
    from_address text,
    to_address text,
    title character varying(255) NOT NULL,
    description text,
    internal_notes text,
    special_instructions text,
    status public.auftrag_status DEFAULT 'geplant'::public.auftrag_status,
    reminder_days_before integer DEFAULT 1,
    reminder_sent_at timestamp with time zone,
    team_reminder_sent boolean DEFAULT false,
    completed_at timestamp with time zone,
    completion_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    service_type character varying(100),
    subtotal numeric(12,2) DEFAULT 0,
    vat_rate numeric(5,2) DEFAULT 8.1,
    vat_amount numeric(12,2) DEFAULT 0,
    total numeric(12,2) DEFAULT 0,
    items jsonb DEFAULT '[]'::jsonb,
    extra_services jsonb DEFAULT '[]'::jsonb,
    service_details jsonb DEFAULT '{}'::jsonb,
    pricing_type character varying(20) DEFAULT 'fixed'::character varying,
    hourly_rate numeric(10,2),
    deleted_at timestamp with time zone,
    customer_reminder_sent boolean DEFAULT false,
    customer_reminder_sent_at timestamp with time zone,
    appointment_id uuid,
    language text DEFAULT 'de'::text NOT NULL,
    customer_id uuid,
    customer_first_name text,
    customer_last_name text,
    from_location_id uuid,
    to_location_id uuid,
    CONSTRAINT auftraege_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT auftraege_pricing_type_check CHECK (((pricing_type)::text = ANY ((ARRAY['fixed'::character varying, 'hourly'::character varying, 'estimate'::character varying])::text[])))
);


--
-- Name: TABLE auftraege; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.auftraege IS 'Work orders/jobs created from accepted offers';


--
-- Name: COLUMN auftraege.offer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.offer_id IS 'Optional reference to the offer this auftrag was created from';


--
-- Name: COLUMN auftraege.team_leader_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.team_leader_id IS 'Optional - can be assigned later before the job date';


--
-- Name: COLUMN auftraege.customer_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.customer_name IS 'Anzeigename fuer Beleg und PDF, eingefroren. Bleibt fuehrend fuer die Darstellung; die strukturierte Form steht in customer_first_name/last_name.';


--
-- Name: COLUMN auftraege.reminder_days_before; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.reminder_days_before IS 'How many days before scheduled_date to send team reminder (default: 1)';


--
-- Name: COLUMN auftraege.service_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.service_type IS 'Service type from the lead (umzug, reinigung, klaviertransport, etc.)';


--
-- Name: COLUMN auftraege.subtotal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.subtotal IS 'Subtotal from the offer (before VAT)';


--
-- Name: COLUMN auftraege.vat_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.vat_rate IS 'VAT rate percentage';


--
-- Name: COLUMN auftraege.vat_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.vat_amount IS 'VAT amount';


--
-- Name: COLUMN auftraege.total; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.total IS 'Total price including VAT';


--
-- Name: COLUMN auftraege.items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.items IS 'Line items from the offer as JSON array';


--
-- Name: COLUMN auftraege.extra_services; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.extra_services IS 'Additional services added to the auftrag';


--
-- Name: COLUMN auftraege.service_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.service_details IS 'Service-specific details from the lead (rooms, floor, lift, piano_type, etc.)';


--
-- Name: COLUMN auftraege.pricing_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.pricing_type IS 'Pricing type: fixed (fixed price), hourly (per hour), estimate (approximate)';


--
-- Name: COLUMN auftraege.hourly_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.hourly_rate IS 'Hourly rate for hourly-priced jobs (CHF/hour)';


--
-- Name: COLUMN auftraege.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.deleted_at IS 'Soft-delete zaman damgası. NULL = aktif. Dolu = arşivlenmiş/silinmiş, listede gizlenir.';


--
-- Name: COLUMN auftraege.customer_reminder_sent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.customer_reminder_sent IS 'Müşteriye yaklaşan iş hatırlatması gönderildi mi. Yeniden planlamada (reschedule) FALSE yapılır.';


--
-- Name: COLUMN auftraege.appointment_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.appointment_id IS 'Kanonik takvim randevusu (service). Zaman/saat bu randevuda sahiplenir, auftraege.scheduled_* trigger ile aynalanır.';


--
-- Name: COLUMN auftraege.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.customer_id IS 'Kanonischer Kunde, von der Offerte geerbt.';


--
-- Name: COLUMN auftraege.customer_first_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.customer_first_name IS 'Vorname zum Zeitpunkt des Auftrags. NULL bei Zeilen von vor 2026-07-28 — dort steht nur der zusammengesetzte customer_name.';


--
-- Name: COLUMN auftraege.customer_last_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auftraege.customer_last_name IS 'Nachname zum Zeitpunkt des Auftrags. Siehe customer_first_name.';


--
-- Name: automation_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    rule_key text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    schedule_window date NOT NULL,
    delivered_at timestamp with time zone DEFAULT now() NOT NULL,
    result text
);


--
-- Name: TABLE automation_deliveries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.automation_deliveries IS 'Was eine Regel bereits erledigt hat. Der eindeutige Schluessel macht jede Regel idempotent: sie darf beliebig oft laufen, ohne zu wiederholen.';


--
-- Name: blog_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(20),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    meta_description text,
    content text NOT NULL,
    excerpt text,
    featured_image_url text,
    focus_keyword character varying(255),
    seo_title character varying(255),
    seo_description text,
    canonical_url text,
    category_id uuid,
    category_name character varying(100),
    tags text[] DEFAULT '{}'::text[],
    target_city character varying(100),
    target_canton character varying(50),
    target_service character varying(100),
    status character varying(50) DEFAULT 'draft'::character varying,
    published_at timestamp with time zone,
    scheduled_for timestamp with time zone,
    author_id uuid,
    author_name character varying(100) DEFAULT 'Offerio Team'::character varying,
    view_count integer DEFAULT 0,
    last_viewed_at timestamp with time zone,
    generated_by_ai boolean DEFAULT false,
    ai_model_used character varying(50),
    generation_prompt text,
    faq_schema jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    gallery_images jsonb DEFAULT '[]'::jsonb,
    featured_image_alt text
);


--
-- Name: blog_seo_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_seo_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid,
    date date NOT NULL,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    average_position numeric(5,2),
    ctr numeric(5,2),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    title text NOT NULL,
    subtitle text,
    service_type character varying NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    include_in_offerte boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    translations jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: communication_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    thread_id uuid NOT NULL,
    direction text NOT NULL,
    channel text DEFAULT 'email'::text NOT NULL,
    from_address text,
    to_address text,
    subject text,
    preview text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    source_table text,
    source_id uuid,
    external_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT communication_messages_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text, 'phone'::text, 'note'::text]))),
    CONSTRAINT communication_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);


--
-- Name: COLUMN communication_messages.preview; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.communication_messages.preview IS 'Ausschnitt, NICHT der volle Text. Der bestehende Inbound-Ablauf speichert bewusst keinen Rohtext; diese Schicht kippt das nicht. Nach 24 Monaten leer.';


--
-- Name: communication_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid,
    subject text,
    channel text DEFAULT 'email'::text NOT NULL,
    status text DEFAULT 'offen'::text NOT NULL,
    lead_id uuid,
    offer_id uuid,
    auftrag_id uuid,
    case_id uuid,
    last_message_at timestamp with time zone,
    last_direction text,
    first_unanswered_at timestamp with time zone,
    assigned_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT communication_threads_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text, 'phone'::text, 'note'::text]))),
    CONSTRAINT communication_threads_direction_check CHECK (((last_direction IS NULL) OR (last_direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))),
    CONSTRAINT communication_threads_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'wartet_auf_kunde'::text, 'erledigt'::text])))
);


--
-- Name: TABLE communication_threads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.communication_threads IS 'Gespraechsfaeden. Liegt UEBER inbound_emails und email_logs — beide bleiben, was sie sind, und fuellen diese Schicht per Trigger.';


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    slug character varying(100),
    company_name character varying(255) NOT NULL,
    legal_name character varying(255),
    logo_url text,
    email character varying(255) NOT NULL,
    phone character varying(50),
    website character varying(255),
    street character varying(255),
    house_number character varying(20),
    plz character varying(10) NOT NULL,
    city character varying(100) NOT NULL,
    canton character varying(50),
    uid_number character varying(50),
    mwst_number character varying(50),
    iban character varying(50),
    is_active boolean DEFAULT true,
    is_verified boolean DEFAULT false,
    notification_email character varying(255),
    notification_phone character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    default_terms_and_conditions text,
    default_payment_terms text,
    primary_color character varying(7) DEFAULT '#3b82f6'::character varying,
    signature_url text,
    twilio_enabled boolean DEFAULT false,
    twilio_phone_number text,
    sms_reminders_enabled boolean DEFAULT false,
    resend_enabled boolean DEFAULT false,
    resend_from_email text,
    resend_from_name text,
    slogan text,
    manual_import_activated_at timestamp with time zone,
    manual_import_monthly_fee integer DEFAULT 20,
    manual_import_next_billing_at timestamp with time zone,
    lead_sharing_preference public.lead_sharing_preference DEFAULT 'both'::public.lead_sharing_preference,
    crm_enabled boolean DEFAULT false,
    crm_enabled_at timestamp with time zone,
    crm_enabled_by uuid,
    subscription_notes text,
    last_reminder_sent_at timestamp with time zone,
    last_reminder_type text,
    trial_granted_by uuid,
    trial_granted_at timestamp with time zone,
    bank_name text,
    bewertungs_url text,
    pdf_template text DEFAULT 'classic'::text NOT NULL,
    default_language text DEFAULT 'de'::text NOT NULL,
    translations jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT companies_default_language_check CHECK ((default_language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT companies_pdf_template_check CHECK ((pdf_template = ANY (ARRAY['classic'::text, 'modern'::text])))
);

ALTER TABLE ONLY public.companies REPLICA IDENTITY FULL;


--
-- Name: COLUMN companies.primary_color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.primary_color IS 'Primary brand color for offers (hex format e.g. #3b82f6)';


--
-- Name: COLUMN companies.lead_sharing_preference; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.lead_sharing_preference IS 'Company preference for lead sharing: only_1 (exclusive leads - 1 company), only_3 (premium leads - 3 companies), only_5 (standard leads - 5 companies), both (all leads)';


--
-- Name: COLUMN companies.crm_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.crm_enabled IS 'Whether CRM features are enabled for this company';


--
-- Name: COLUMN companies.crm_enabled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.crm_enabled_at IS 'When CRM was enabled';


--
-- Name: COLUMN companies.crm_enabled_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.crm_enabled_by IS 'Admin who enabled CRM';


--
-- Name: COLUMN companies.subscription_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.subscription_notes IS 'Internal notes about the subscription';


--
-- Name: COLUMN companies.trial_granted_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.trial_granted_by IS 'Admin user who granted the trial (NULL for self-serve)';


--
-- Name: COLUMN companies.trial_granted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.trial_granted_at IS 'Timestamp when the trial was activated';


--
-- Name: COLUMN companies.pdf_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.pdf_template IS 'Offerte-PDF Vorlage: classic (Standard-Layout) | modern (v2-Design). Firmenweite Einstellung.';


--
-- Name: COLUMN companies.default_language; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.default_language IS 'Sprache des Firmen-Dashboards UND Fallback-Sprache für Leads, die ohne Sprache eintreffen.';


--
-- Name: COLUMN companies.translations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.companies.translations IS 'Übersetzte Firmen-Textbausteine: slogan, default_payment_terms, default_terms_and_conditions.';


--
-- Name: company_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'owner'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT company_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
);


--
-- Name: TABLE company_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.company_members IS 'Firma-kullanıcı üyelikleri. INSERT/DELETE yalnızca service_role (admin panel) tarafından yapılabilir.';


--
-- Name: COLUMN company_members.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_members.role IS 'owner: tam yetki (sahip), admin: yönetim yetkisi, member: salt okuma/standart erişim';


--
-- Name: company_offer_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_offer_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    offer_number_prefix character varying(20) DEFAULT ''::character varying,
    offer_number_start integer DEFAULT 10000,
    default_vat_rate numeric DEFAULT 8.1,
    default_payment_method character varying(100) DEFAULT 'bar'::character varying,
    default_payment_due_days integer DEFAULT 30,
    default_validity_days integer DEFAULT 14,
    show_company_reference boolean DEFAULT true,
    show_mwst_separately boolean DEFAULT true,
    show_item_numbers boolean DEFAULT true,
    highlight_inclusions boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: company_offer_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_offer_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    service_type character varying NOT NULL,
    terms_and_conditions text,
    payment_terms text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: company_plz_coverage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_plz_coverage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    plz character varying(10) NOT NULL,
    radius_km integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: company_pricing_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_pricing_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    config_id uuid,
    action text NOT NULL,
    old_values jsonb,
    new_values jsonb,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now(),
    ip_address inet,
    user_agent text,
    CONSTRAINT company_pricing_audit_log_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'deactivate'::text])))
);


--
-- Name: TABLE company_pricing_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.company_pricing_audit_log IS 'Audit trail for all pricing configuration changes. Stores before/after values for debugging and rollback.';


--
-- Name: company_pricing_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_pricing_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    template_id text DEFAULT 'custom'::text,
    template_name text DEFAULT 'Benutzerdefiniert'::text,
    currency text DEFAULT 'CHF'::text,
    vat_rate numeric(4,2) DEFAULT 8.1,
    minimum_hours integer DEFAULT 4,
    minimum_charge numeric(10,2) DEFAULT 480,
    team_rates jsonb DEFAULT '[{"label": "1 LKW + 1 Helfer", "trucks": 1, "workers": 1, "hourlyRate": 120}, {"label": "1 LKW + 2 Helfer", "trucks": 1, "workers": 2, "hourlyRate": 180}, {"label": "1 LKW + 3 Helfer", "trucks": 1, "workers": 3, "hourlyRate": 230}, {"label": "2 LKW + 4 Helfer", "trucks": 2, "workers": 4, "hourlyRate": 290}, {"label": "2 LKW + 5 Helfer", "trucks": 2, "workers": 5, "hourlyRate": 350}, {"label": "2 LKW + 6 Helfer", "trucks": 2, "workers": 6, "hourlyRate": 420}]'::jsonb,
    hourly_rate numeric(10,2) DEFAULT 60,
    vehicle_prices jsonb DEFAULT '{"truck_18t": 250, "truck_3_5t": 120, "truck_7_5t": 180, "transporter": 80}'::jsonb,
    distance_surcharge_rate numeric(6,2) DEFAULT 2.50,
    distance_surcharge_threshold integer DEFAULT 20,
    surcharges jsonb DEFAULT '{"aquarium": 200, "poolTable": 450, "safeLarge": 350, "safeSmall": 150, "pianoGrand": 650, "pianoUpright": 350, "heavyItemOver100kg": 50}'::jsonb,
    floor_surcharges jsonb DEFAULT '{"groundFloorBase": 0, "perFloorWithElevator": 10, "perFloorWithoutElevator": 30}'::jsonb,
    equipment jsonb DEFAULT '{"packingMaterialPerM3": 25, "moebelliftBothLocations": 550, "moebelliftSingleLocation": 350}'::jsonb,
    packing_service_rate numeric(6,2) DEFAULT 45,
    external_lift_cost numeric(8,2) DEFAULT 550,
    disposal_cost numeric(6,2) DEFAULT 35,
    piano_transport_cost numeric(8,2) DEFAULT 350,
    storage_cost_per_m3 numeric(6,2) DEFAULT 45,
    multipliers jsonb DEFAULT '{"evening": 1.15, "express": 1.30, "holiday": 1.50, "weekend": 1.25}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT company_pricing_configs_currency_check CHECK ((currency = ANY (ARRAY['CHF'::text, 'EUR'::text]))),
    CONSTRAINT company_pricing_configs_minimum_charge_check CHECK ((minimum_charge >= (0)::numeric)),
    CONSTRAINT company_pricing_configs_minimum_hours_check CHECK (((minimum_hours >= 1) AND (minimum_hours <= 24))),
    CONSTRAINT company_pricing_configs_vat_rate_check CHECK (((vat_rate >= (0)::numeric) AND (vat_rate <= (30)::numeric)))
);


--
-- Name: TABLE company_pricing_configs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.company_pricing_configs IS 'Company-specific pricing configurations for the moving calculator. Each company can have their own rates based on Swiss market standards (Delta Umzug reference).';


--
-- Name: COLUMN company_pricing_configs.team_rates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_pricing_configs.team_rates IS 'Array of team configurations with combined hourly rates (truck + workers). Format: [{"trucks": 1, "workers": 2, "hourlyRate": 180, "label": "1 LKW + 2 Helfer"}]';


--
-- Name: COLUMN company_pricing_configs.multipliers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_pricing_configs.multipliers IS 'Time-based price multipliers. Format: {"weekend": 1.25, "evening": 1.15, "holiday": 1.50, "express": 1.30}';


--
-- Name: company_reminder_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_reminder_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    team_reminder_hours integer DEFAULT 12,
    customer_reminder_hours integer DEFAULT 24,
    team_reminders_enabled boolean DEFAULT true,
    customer_reminders_enabled boolean DEFAULT true,
    include_customer_phone boolean DEFAULT true,
    include_customer_email boolean DEFAULT true,
    include_lead_details boolean DEFAULT true,
    include_offer_details boolean DEFAULT true,
    custom_footer_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: company_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_secrets (
    company_id uuid NOT NULL,
    resend_api_key text,
    twilio_account_sid text,
    twilio_auth_token text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE company_secrets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.company_secrets IS 'Zugangsdaten Dritter (Resend, Twilio) je Firma. Bewusst ohne RLS-Policy: nur serverseitiger Zugriff ueber den Service-Role-Key. Niemals an den Browser.';


--
-- Name: company_service_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_service_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    service_type character varying NOT NULL,
    category character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    unit character varying DEFAULT 'Pauschal'::character varying,
    default_price numeric(10,2) DEFAULT 0,
    is_default_included boolean DEFAULT false,
    is_optional boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    translations jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: COLUMN company_service_items.translations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.company_service_items.translations IS 'Form: {"fr": {"name": "…", "description": "…"}, "en": {…}}. Deutsche Basisspalten bleiben Quelle der Wahrheit.';


--
-- Name: company_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    service_type character varying(100) NOT NULL,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cookie_consent_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cookie_consent_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_id text NOT NULL,
    consent_given boolean DEFAULT false,
    consent_categories jsonb DEFAULT '{"analytics": false, "essential": true, "marketing": false, "preferences": false}'::jsonb,
    ip_address_hash text,
    user_agent text,
    consent_timestamp timestamp with time zone DEFAULT now(),
    withdrawal_timestamp timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    rechnung_id uuid NOT NULL,
    customer_id uuid,
    gutschrift_nr text,
    datum date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text,
    positionen jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'entwurf'::text NOT NULL,
    language text NOT NULL,
    pdf_url text,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT credit_notes_amount_positive CHECK ((amount > (0)::numeric)),
    CONSTRAINT credit_notes_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT credit_notes_status_check CHECK ((status = ANY (ARRAY['entwurf'::text, 'versendet'::text, 'storniert'::text])))
);


--
-- Name: TABLE credit_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.credit_notes IS 'Gutschriften. Ein eigener Beleg gegen eine Rechnung — die Rechnung selbst bleibt unveraendert, ihr offener Betrag sinkt.';


--
-- Name: crm_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    task_type text DEFAULT 'follow_up'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    due_at timestamp with time zone,
    done_at timestamp with time zone,
    assigned_user_id uuid,
    lead_id uuid,
    offer_id uuid,
    auftrag_id uuid,
    customer_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_tasks_done_needs_time CHECK (((status <> 'done'::text) OR (done_at IS NOT NULL))),
    CONSTRAINT crm_tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text]))),
    CONSTRAINT crm_tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'cancelled'::text]))),
    CONSTRAINT crm_tasks_title_present CHECK ((length(TRIM(BOTH FROM title)) > 0)),
    CONSTRAINT crm_tasks_type_check CHECK ((task_type = ANY (ARRAY['follow_up'::text, 'call'::text, 'offer'::text, 'inspection'::text, 'admin'::text, 'lost_reason'::text, 'cross_sell'::text])))
);


--
-- Name: TABLE crm_tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crm_tasks IS 'Wiedervorlage: was als naechstes zu tun ist. Wird von Hand oder von den Regeln in run_pipeline_automations() erzeugt.';


--
-- Name: customer_case_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_case_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    company_id uuid NOT NULL,
    event_type text NOT NULL,
    alt_wert text,
    neu_wert text,
    note text,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_case_events_type_check CHECK ((event_type = ANY (ARRAY['angelegt'::text, 'status'::text, 'zuweisung'::text, 'notiz'::text, 'abschluss'::text])))
);


--
-- Name: customer_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid,
    case_number text,
    case_type text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'offen'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    auftrag_id uuid,
    appointment_id uuid,
    rechnung_id uuid,
    location_id uuid,
    reported_by text DEFAULT 'firma'::text NOT NULL,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_user_id uuid,
    due_at timestamp with time zone,
    resolution text,
    resolution_type text,
    credit_note_id uuid,
    closed_at timestamp with time zone,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_cases_abschluss_vollstaendig CHECK (((status <> ALL (ARRAY['geloest'::text, 'abgelehnt'::text])) OR ((closed_at IS NOT NULL) AND (resolution_type IS NOT NULL)))),
    CONSTRAINT customer_cases_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT customer_cases_reported_by_check CHECK ((reported_by = ANY (ARRAY['firma'::text, 'kunde'::text]))),
    CONSTRAINT customer_cases_resolution_type_check CHECK (((resolution_type IS NULL) OR (resolution_type = ANY (ARRAY['repariert'::text, 'ersetzt'::text, 'gutschrift'::text, 'nachgeholt'::text, 'kulanz'::text, 'abgelehnt'::text, 'sonstiges'::text])))),
    CONSTRAINT customer_cases_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'in_arbeit'::text, 'wartet_auf_kunde'::text, 'geloest'::text, 'abgelehnt'::text]))),
    CONSTRAINT customer_cases_titel_da CHECK ((length(TRIM(BOTH FROM title)) > 0)),
    CONSTRAINT customer_cases_type_check CHECK ((case_type = ANY (ARRAY['damage'::text, 'complaint'::text, 'recleaning'::text, 'service_change'::text])))
);


--
-- Name: TABLE customer_cases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_cases IS 'Schaden, Reklamation, Nachreinigung, Serviceaenderung — EINE Tabelle mit Typfeld. Die vier unterscheiden sich im Anlass, nicht im Ablauf.';


--
-- Name: customer_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    feld text NOT NULL,
    alt_wert text,
    neu_wert text NOT NULL,
    bemerkung text,
    status text DEFAULT 'offen'::text NOT NULL,
    entschieden_von uuid,
    entschieden_am timestamp with time zone,
    entscheid_notiz text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_change_requests_entscheid_vollstaendig CHECK (((status = 'offen'::text) OR (entschieden_am IS NOT NULL))),
    CONSTRAINT customer_change_requests_feld_check CHECK ((feld = ANY (ARRAY['first_name'::text, 'last_name'::text, 'company_name'::text, 'primary_email'::text, 'primary_phone'::text]))),
    CONSTRAINT customer_change_requests_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'angenommen'::text, 'abgelehnt'::text]))),
    CONSTRAINT customer_change_requests_wert_da CHECK ((length(TRIM(BOTH FROM neu_wert)) > 0))
);


--
-- Name: TABLE customer_change_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_change_requests IS 'Aenderungswuensche aus dem Kundenportal. Der Kunde schreibt NIE direkt in customers — erst die Annahme durch die Firma uebernimmt den Wert.';


--
-- Name: customer_merges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_merges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    source_customer_id uuid NOT NULL,
    target_customer_id uuid NOT NULL,
    merged_by uuid,
    merged_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    moved_counts jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_snapshot jsonb NOT NULL,
    CONSTRAINT customer_merges_distinct CHECK ((source_customer_id <> target_customer_id))
);


--
-- Name: TABLE customer_merges; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_merges IS 'Nachweis jeder Zusammenfuehrung. source_snapshot enthaelt die vollstaendige Quellzeile — damit laesst sich eine Zusammenfuehrung von Hand rueckgaengig machen. Eine unmerge-Funktion gibt es bewusst NICHT.';


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_type text DEFAULT 'person'::text NOT NULL,
    salutation text,
    first_name text,
    last_name text,
    company_name text,
    display_name text NOT NULL,
    primary_email text,
    primary_phone text,
    email_normalized text GENERATED ALWAYS AS (public.normalize_customer_email(primary_email)) STORED,
    phone_normalized text GENERATED ALWAYS AS (public.normalize_customer_phone(primary_phone)) STORED,
    language text DEFAULT 'de'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    source text,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    external_customer_number text,
    merged_into_customer_id uuid,
    merged_at timestamp with time zone,
    possible_duplicate boolean DEFAULT false NOT NULL,
    created_via text DEFAULT 'manual'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customers_created_via_check CHECK ((created_via = ANY (ARRAY['manual'::text, 'resolve_rpc'::text, 'backfill'::text, 'merge'::text]))),
    CONSTRAINT customers_display_name_present CHECK ((length(TRIM(BOTH FROM display_name)) > 0)),
    CONSTRAINT customers_identity_required CHECK (((public.normalize_customer_email(primary_email) IS NOT NULL) OR (public.normalize_customer_phone(primary_phone) IS NOT NULL))),
    CONSTRAINT customers_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT customers_merge_consistency CHECK ((((merged_into_customer_id IS NULL) AND (merged_at IS NULL)) OR ((merged_into_customer_id IS NOT NULL) AND (merged_at IS NOT NULL)))),
    CONSTRAINT customers_merge_not_self CHECK ((merged_into_customer_id IS DISTINCT FROM id)),
    CONSTRAINT customers_salutation_check CHECK (((salutation IS NULL) OR (salutation = ANY (ARRAY['Herr'::text, 'Frau'::text, 'Firma'::text])))),
    CONSTRAINT customers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'blocked'::text, 'anonymized'::text]))),
    CONSTRAINT customers_type_check CHECK ((customer_type = ANY (ARRAY['person'::text, 'company'::text])))
);


--
-- Name: TABLE customers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customers IS 'Kanonische Kundenidentitaet je Firma. Die customer_*-Felder auf Lead, Offerte, Auftrag, Rechnung und Quittung bleiben unberuehrt: sie sind der Snapshot zum Zeitpunkt des Dokuments, diese Tabelle ist der aktuelle Stand.';


--
-- Name: COLUMN customers.display_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.display_name IS 'Anzeigename. Wird vom Trigger aus Vor-/Nachname bzw. Firmenname gefuellt, kann aber vom Bediener ueberschrieben werden ("Familie Mueller") — deshalb keine generierte Spalte.';


--
-- Name: COLUMN customers.email_normalized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.email_normalized IS 'Abgleichschluessel (generated, stored). ACHTUNG: aendert sich der Rumpf von normalize_customer_email(), berechnet Postgres bestehende Zeilen NICHT neu — in derselben Migration UPDATE customers SET primary_email = primary_email nachziehen und den UNIQUE-Index neu pruefen.';


--
-- Name: COLUMN customers.phone_normalized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.phone_normalized IS 'Wie email_normalized. BEWUSST NICHT unique: der Festnetzanschluss eines Haushalts oder einer Verwaltung gehoert regelmaessig mehreren Personen.';


--
-- Name: COLUMN customers.first_seen_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.first_seen_at IS 'Erster Kontakt. Beim Backfill das MIN(created_at) aller Quellzeilen — created_at waere dort der Zeitpunkt des Backfills und damit wertlos.';


--
-- Name: COLUMN customers.external_customer_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.external_customer_number IS 'Uebernommen aus offers.customer_number — dort ein Freitextfeld, das der Bediener je Offerte selbst tippt. BEWUSST NICHT unique: in der Vergangenheit vergebene Nummern koennen sich doppeln.';


--
-- Name: COLUMN customers.merged_into_customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.merged_into_customer_id IS 'Zusammengefuehrt nach. Die Quellzeile wird NIE geloescht, sondern bleibt als Weiterleitung stehen, damit alte Links und Audit-Eintraege weiterhin aufloesen.';


--
-- Name: COLUMN customers.created_via; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.created_via IS 'Entstehungsweg. Traegt die Ruecknahme des Backfills: DELETE … WHERE created_via = ''backfill'' entfernt genau die dort entstandenen Zeilen.';


--
-- Name: edge_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edge_rate_limits (
    key text NOT NULL,
    window_started_at timestamp with time zone NOT NULL,
    request_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_email character varying NOT NULL,
    recipient_name character varying,
    subject character varying NOT NULL,
    email_type character varying NOT NULL,
    status character varying DEFAULT 'sent'::character varying NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    company_id uuid,
    lead_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    language text,
    CONSTRAINT email_logs_language_check CHECK (((language IS NULL) OR (language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))))
);


--
-- Name: fall_nr_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fall_nr_counter (
    company_id uuid NOT NULL,
    jahr integer NOT NULL,
    letzte_nr integer DEFAULT 0 NOT NULL
);


--
-- Name: firma_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.firma_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    resource_type text NOT NULL,
    name text NOT NULL,
    description text,
    license_plate text,
    capacity_m3 numeric(10,2),
    quantity integer DEFAULT 1,
    is_available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: gutschrift_nr_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gutschrift_nr_counter (
    company_id uuid NOT NULL,
    jahr integer NOT NULL,
    letzte_nr integer DEFAULT 0 NOT NULL
);


--
-- Name: inbound_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    provider text DEFAULT 'resend'::text NOT NULL,
    provider_message_id text NOT NULL,
    from_email text NOT NULL,
    from_name text,
    to_emails text[] DEFAULT '{}'::text[] NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    body_preview text,
    processing_status text DEFAULT 'received'::text NOT NULL,
    classification text,
    confidence_score numeric(5,4),
    rejection_reason text,
    missing_critical_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    extracted_data jsonb,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    lead_id uuid,
    processing_attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    received_at timestamp with time zone NOT NULL,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    opened_at timestamp with time zone,
    customer_id uuid,
    CONSTRAINT inbound_emails_attempts_check CHECK ((processing_attempts >= 0)),
    CONSTRAINT inbound_emails_body_preview_len CHECK (((body_preview IS NULL) OR (length(body_preview) <= 2000))),
    CONSTRAINT inbound_emails_confidence_range CHECK (((confidence_score IS NULL) OR ((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric)))),
    CONSTRAINT inbound_emails_status_check CHECK ((processing_status = ANY (ARRAY['received'::text, 'processing'::text, 'needs_review'::text, 'lead_created'::text, 'rejected'::text, 'failed'::text])))
);


--
-- Name: TABLE inbound_emails; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.inbound_emails IS 'Eingehende E-Mails aus dem Resend-Inbound-Webhook: Idempotenz, Review-Queue und Audit. Enthält bewusst weder den vollen Body noch Anhang-Binärdaten.';


--
-- Name: COLUMN inbound_emails.provider_message_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inbound_emails.provider_message_id IS 'Message-ID des Providers (Resend: email.id). Idempotenz-Schlüssel — eine erneute Zustellung desselben Webhooks darf keinen zweiten Lead erzeugen.';


--
-- Name: COLUMN inbound_emails.body_preview; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inbound_emails.body_preview IS 'Gekappte Klartext-Vorschau (max. 2000 Zeichen). Kein HTML, kein vollständiger Body.';


--
-- Name: COLUMN inbound_emails.attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inbound_emails.attachments IS 'Nur Metadaten: [{id, filename, content_type, size}]. Binärdaten gehören nicht in Postgres.';


--
-- Name: COLUMN inbound_emails.opened_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inbound_emails.opened_at IS 'Wann die Mail zum ersten Mal in der Review-Oberfläche geöffnet wurde. NULL = von niemandem angeschaut.';


--
-- Name: COLUMN inbound_emails.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inbound_emails.customer_id IS 'Kanonischer Kunde — NUR gesetzt, wenn die Absenderadresse einen BESTEHENDEN Kunden trifft. Aus einer eingehenden Mail entsteht nie ein Kunde, sonst legte jede Werbemail einen an.';


--
-- Name: invoice_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    rechnung_id uuid NOT NULL,
    level smallint NOT NULL,
    sent_at timestamp with time zone,
    open_amount_snapshot numeric(12,2) NOT NULL,
    due_date_snapshot date,
    fee numeric(12,2) DEFAULT 0 NOT NULL,
    interest numeric(12,2) DEFAULT 0 NOT NULL,
    language text NOT NULL,
    pdf_url text,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoice_reminders_fee_check CHECK (((fee >= (0)::numeric) AND (interest >= (0)::numeric))),
    CONSTRAINT invoice_reminders_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT invoice_reminders_level_check CHECK (((level >= 1) AND (level <= 3)))
);


--
-- Name: TABLE invoice_reminders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.invoice_reminders IS 'Mahnungen je Rechnung und Stufe. Eine Zeile ist ein Beleg, kein Zaehler — der Stand zum Mahnzeitpunkt ist mitgeschrieben.';


--
-- Name: ip_blacklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_blacklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address text NOT NULL,
    reason text,
    added_by uuid,
    blocked_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE ip_blacklist; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ip_blacklist IS 'Stores blocked IP addresses for spam prevention. Leads from these IPs are automatically rejected.';


--
-- Name: job_price_estimates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_price_estimates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_type text NOT NULL,
    room_count text NOT NULL,
    min_price_chf integer NOT NULL,
    max_price_chf integer NOT NULL,
    avg_price_chf integer NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE job_price_estimates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.job_price_estimates IS 'Swiss market job price estimates for ROI display to companies';


--
-- Name: klavier_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.klavier_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: klaviertransport_anfragen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.klaviertransport_anfragen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anfrage_nummer text,
    service_type text DEFAULT 'transport'::text NOT NULL,
    instrument_type text NOT NULL,
    instrument_brand text,
    instrument_model text,
    instrument_age text,
    instrument_value text,
    instrument_notes text,
    instrument_photos text[],
    abholort_adresse jsonb DEFAULT '{}'::jsonb,
    abholort_stockwerk text,
    abholort_lift jsonb DEFAULT '{}'::jsonb,
    abholort_treppenhaus text,
    abholort_hindernisse jsonb DEFAULT '{}'::jsonb,
    lieferort_adresse jsonb,
    lieferort_stockwerk text,
    lieferort_lift jsonb,
    lieferort_treppenhaus text,
    lieferort_hindernisse jsonb,
    equipment_required text,
    demontage text,
    zusatzleistungen jsonb DEFAULT '{}'::jsonb,
    wunschdatum date,
    flexibilitaet text,
    uhrzeit text,
    kunde_anrede text,
    kunde_vorname text,
    kunde_nachname text,
    kunde_email text,
    kunde_telefon text,
    kunde_kontaktzeit text,
    kontakt_vor_ort jsonb,
    agb_akzeptiert boolean DEFAULT false,
    transportfaehig_bestaetigt boolean DEFAULT false,
    berechtigung_bestaetigt boolean DEFAULT false,
    bemerkungen text,
    geschaetzte_distanz_km numeric(6,1),
    geschaetzter_preis_chf numeric(10,2),
    status text DEFAULT 'neu'::text,
    form_version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE klaviertransport_anfragen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.klaviertransport_anfragen IS 'Piano transport requests with detailed instrument and location information';


--
-- Name: landing_page_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_page_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    landing_page_id uuid,
    views integer DEFAULT 0,
    unique_visitors integer DEFAULT 0,
    conversions integer DEFAULT 0,
    avg_time_on_page integer,
    date date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: landing_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    service_type text NOT NULL,
    seo_title text NOT NULL,
    seo_description text NOT NULL,
    seo_keywords text[] DEFAULT '{}'::text[],
    canonical_url text,
    og_image_url text,
    hero_title text NOT NULL,
    hero_subtitle text,
    hero_description text,
    hero_image_url text NOT NULL,
    hero_cta_text text DEFAULT 'Jetzt Anfrage stellen'::text,
    hero_cta_link text DEFAULT '/anfrage'::text,
    content_sections jsonb DEFAULT '[]'::jsonb,
    use_shared_content boolean DEFAULT true,
    faq_source text DEFAULT 'global_faq'::text,
    custom_faq jsonb,
    side_section_config jsonb DEFAULT '{}'::jsonb,
    is_published boolean DEFAULT false,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid
);


--
-- Name: lead_confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_confirmations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    sent_to_email text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '48:00:00'::interval) NOT NULL,
    confirmed_at timestamp with time zone
);


--
-- Name: TABLE lead_confirmations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.lead_confirmations IS 'Çifte onay (double opt-in) tokenları. Şüpheli leadler için kullanıcıya giden e-posta linkini doğrular.';


--
-- Name: lead_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    slug character varying NOT NULL,
    description text,
    service_types text[] DEFAULT '{}'::text[],
    primary_color character varying DEFAULT '#6366f1'::character varying,
    show_header boolean DEFAULT true,
    header_title character varying,
    header_subtitle text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(100),
    customer_first_name character varying(100) NOT NULL,
    customer_last_name character varying(100) NOT NULL,
    customer_email character varying(255) NOT NULL,
    customer_phone character varying(50) NOT NULL,
    service_type character varying(100) NOT NULL,
    from_street character varying(255),
    from_house_number character varying(20),
    from_plz character varying(10) NOT NULL,
    from_city character varying(100) NOT NULL,
    from_floor integer,
    from_has_lift boolean DEFAULT false,
    from_rooms numeric,
    from_living_space_m2 integer,
    to_street character varying(255),
    to_house_number character varying(20),
    to_plz character varying(10),
    to_city character varying(100),
    to_floor integer,
    to_has_lift boolean DEFAULT false,
    preferred_date date,
    preferred_time_slot character varying(50),
    is_flexible_date boolean DEFAULT true,
    description text,
    special_items text[],
    packing_service_needed boolean DEFAULT false,
    cleaning_service_needed boolean DEFAULT false,
    storage_needed boolean DEFAULT false,
    status character varying(50) DEFAULT 'pending_verification'::character varying,
    source character varying(100) DEFAULT 'web_form'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '48:00:00'::interval),
    source_form_id uuid,
    piano_type character varying,
    piano_brand character varying,
    piano_weight_kg integer,
    staircase_type character varying,
    staircase_width_cm integer,
    staircase_turns integer,
    window_access_possible boolean DEFAULT false,
    moebellift_floor integer,
    moebellift_item_description text,
    moebellift_item_dimensions character varying,
    property_type character varying,
    bathroom_count integer,
    kitchen_type character varying,
    has_balcony boolean DEFAULT false,
    has_garage boolean DEFAULT false,
    has_basement boolean DEFAULT false,
    has_attic boolean DEFAULT false,
    clearing_type character varying,
    estimated_volume character varying,
    has_heavy_items boolean DEFAULT false,
    heavy_items_description text,
    disposal_type character varying,
    items_description text,
    storage_duration character varying,
    storage_volume character varying,
    access_frequency character varying,
    needs_climate_control boolean DEFAULT false,
    storage_items_description text,
    pickup_street character varying,
    pickup_house_number character varying,
    pickup_floor integer,
    pickup_has_lift boolean DEFAULT false,
    distance_km numeric,
    estimated_duration_minutes integer,
    verified_by uuid,
    verified_at timestamp with time zone,
    rejection_reason text,
    admin_notes text,
    spam_score integer DEFAULT 0,
    ip_address text,
    estimated_job_price_min numeric,
    estimated_job_price_max numeric,
    estimated_job_price_confidence character varying(20),
    cleaning_windows boolean DEFAULT false,
    detailed_form_data jsonb,
    form_version integer DEFAULT 1,
    from_lift_type text,
    from_distance_to_parking integer,
    from_steps_to_entrance text,
    from_path_obstruction boolean DEFAULT false,
    to_rooms numeric(3,1),
    to_living_space_m2 integer,
    to_lift_type text,
    to_distance_to_parking integer,
    to_steps_to_entrance text,
    to_path_obstruction boolean DEFAULT false,
    moving_date date,
    moving_flexibility text,
    moving_start_time text,
    inventory_items jsonb DEFAULT '[]'::jsonb,
    additional_services_umzug jsonb DEFAULT '{}'::jsonb,
    customer_salutation text,
    customer_contact_time text,
    raeumungs_art text,
    zustand_allgemein text,
    zustand_besonderheiten jsonb DEFAULT '{}'::jsonb,
    umfang_scope text,
    umfang_bereiche jsonb DEFAULT '[]'::jsonb,
    umfang_inventar jsonb DEFAULT '{}'::jsonb,
    zugang_hindernisse jsonb DEFAULT '{}'::jsonb,
    anfragender_rolle text,
    berechtigung_bestaetigt boolean DEFAULT false,
    gerichtsbefehl_vorhanden boolean,
    conversation_transcript text,
    conversation_duration integer,
    lead_score integer,
    ai_confidence_score numeric(5,2),
    vapi_call_id character varying(100),
    ai_quality_score integer,
    ai_validation_signals jsonb,
    ai_validated_at timestamp with time zone,
    ai_rejected_reason text,
    company_id uuid,
    from_has_estrich boolean,
    from_has_keller boolean,
    language text DEFAULT 'de'::text NOT NULL,
    customer_id uuid,
    sales_stage text DEFAULT 'new'::text NOT NULL,
    owner_user_id uuid,
    next_action_at timestamp with time zone,
    lost_reason_code text,
    lost_reason_note text,
    CONSTRAINT chk_leads_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'pending_verification'::character varying, 'awaiting_customer_confirmation'::character varying, 'unconfirmed_risky'::character varying, 'verified'::character varying, 'in_progress'::character varying, 'distributed'::character varying, 'no_matches'::character varying, 'unknown_plz'::character varying, 'completed'::character varying, 'rejected'::character varying, 'expired_unverified'::character varying, 'job_confirmed'::character varying])::text[]))),
    CONSTRAINT leads_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT leads_lost_needs_reason CHECK (((sales_stage <> 'lost'::text) OR (lost_reason_code IS NOT NULL))),
    CONSTRAINT leads_lost_reason_check CHECK (((lost_reason_code IS NULL) OR (lost_reason_code = ANY (ARRAY['price'::text, 'timing'::text, 'competitor'::text, 'no_response'::text, 'out_of_area'::text, 'scope'::text, 'other'::text])))),
    CONSTRAINT leads_sales_stage_check CHECK ((sales_stage = ANY (ARRAY['new'::text, 'qualifying'::text, 'inspection'::text, 'offer_draft'::text, 'offer_sent'::text, 'negotiating'::text, 'won'::text, 'lost'::text]))),
    CONSTRAINT leads_source_check CHECK (((source)::text = ANY ((ARRAY['web_form'::character varying, 'ai_voice'::character varying, 'manual'::character varying, 'import'::character varying, 'widget'::character varying, 'api'::character varying, 'email'::character varying])::text[])))
);

ALTER TABLE ONLY public.leads REPLICA IDENTITY FULL;


--
-- Name: COLUMN leads.from_has_lift; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.from_has_lift IS 'Whether from property has elevator';


--
-- Name: COLUMN leads.from_rooms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.from_rooms IS 'Number of rooms in the from (auszug) property';


--
-- Name: COLUMN leads.from_living_space_m2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.from_living_space_m2 IS 'Living space in m2 of from property';


--
-- Name: COLUMN leads.to_plz; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.to_plz IS 'Postal code of destination (einzug) property';


--
-- Name: COLUMN leads.to_city; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.to_city IS 'City of destination property';


--
-- Name: COLUMN leads.to_has_lift; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.to_has_lift IS 'Whether destination property has elevator';


--
-- Name: COLUMN leads.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.status IS 'pending_verification: Admin onayı bekliyor | verified: Onaylandı | distributed: Firmalara dağıtıldı | fallback_distributed: Coğrafi fallback ile dağıtıldı | no_matches: Uygun firma bulunamadı | unknown_plz: PLZ veritabanında yok | rejected: Admin tarafından reddedildi | expired_unverified: 48 saat içinde admin onaylanmadı | job_confirmed: Müşteri teklifi kabul etti, iş teyitlendi | completed: İş tamamlandı';


--
-- Name: COLUMN leads.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.source IS 'Herkunft der Anfrage. Wertebereich siehe leads_source_check. Der Standardwert lautet web_form; bis 2026-07-28 stand hier website, was die Pruefregel ablehnte und jedes INSERT ohne ausdruecklichen Wert scheitern liess.';


--
-- Name: COLUMN leads.piano_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.piano_type IS 'Piano type: klavier, fluegel, e_piano, keyboard';


--
-- Name: COLUMN leads.staircase_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.staircase_type IS 'Staircase type: gerade, kurvig, wendel, keine';


--
-- Name: COLUMN leads.staircase_width_cm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.staircase_width_cm IS 'Staircase width in centimeters';


--
-- Name: COLUMN leads.property_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.property_type IS 'Type of property: haus, wohnung, wg_zimmer, lager, buero';


--
-- Name: COLUMN leads.estimated_job_price_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.estimated_job_price_min IS 'Minimum estimated job price in CHF for the company';


--
-- Name: COLUMN leads.estimated_job_price_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.estimated_job_price_max IS 'Maximum estimated job price in CHF for the company';


--
-- Name: COLUMN leads.estimated_job_price_confidence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.estimated_job_price_confidence IS 'Confidence level: high, medium, low';


--
-- Name: COLUMN leads.cleaning_windows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.cleaning_windows IS 'Whether window cleaning is requested';


--
-- Name: COLUMN leads.detailed_form_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.detailed_form_data IS 'Complete form data from detailed wizard as JSON';


--
-- Name: COLUMN leads.form_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.form_version IS 'Version of the form used to submit (1=basic, 2=detailed wizard)';


--
-- Name: COLUMN leads.moving_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.moving_date IS 'Preferred moving date';


--
-- Name: COLUMN leads.moving_flexibility; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.moving_flexibility IS 'Flexibility for moving date (fixed, flex_3_days, flex_1_week, flex_2_weeks)';


--
-- Name: COLUMN leads.inventory_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.inventory_items IS 'JSON array of inventory items with counts';


--
-- Name: COLUMN leads.additional_services_umzug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.additional_services_umzug IS 'JSON object with additional service selections';


--
-- Name: COLUMN leads.conversation_transcript; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.conversation_transcript IS 'Full transcript of AI voice conversation (Vapi.ai)';


--
-- Name: COLUMN leads.conversation_duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.conversation_duration IS 'Duration of AI voice conversation in seconds';


--
-- Name: COLUMN leads.lead_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.lead_score IS 'Calculated lead quality score (0-100)';


--
-- Name: COLUMN leads.ai_confidence_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.ai_confidence_score IS 'AI confidence in extracted data (0-100)';


--
-- Name: COLUMN leads.vapi_call_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.vapi_call_id IS 'Unique call ID from Vapi.ai for reference';


--
-- Name: COLUMN leads.ai_quality_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.ai_quality_score IS '0-100 arası AI + deterministik doğrulama skoru. <25 = sahte, 25-39 = şüpheli (double opt-in), >=40 = geçerli.';


--
-- Name: COLUMN leads.ai_validation_signals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.ai_validation_signals IS 'AI veya deterministik validator tarafından bulunan şüphe sinyallerinin dizisi (string[]).';


--
-- Name: COLUMN leads.ai_validated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.ai_validated_at IS 'AI doğrulamasının tamamlandığı zaman. NULL ise henüz doğrulanmamış.';


--
-- Name: COLUMN leads.ai_rejected_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.ai_rejected_reason IS 'AI veya deterministik kurallar reddettiyse nedeni (Almanca kısa metin).';


--
-- Name: COLUMN leads.language; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.language IS 'Sprache, in der die Anfrage gestellt wurde. Ursprung der gesamten Kundenkommunikation.';


--
-- Name: COLUMN leads.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.customer_id IS 'Kanonischer Kunde. Wird beim INSERT per Trigger gesetzt; die customer_*-Felder daneben bleiben der Stand zum Zeitpunkt der Anfrage.';


--
-- Name: COLUMN leads.sales_stage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.sales_stage IS 'Verkaufsstufe. Zweite Achse neben `status`: der beschreibt den Lebenszyklus des Datensatzes (grossteils Marktplatz-Erbe), diese die Arbeit daran.';


--
-- Name: COLUMN leads.owner_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.owner_user_id IS 'Wer sich um diese Anfrage kuemmert. Bewusst auf auth.users statt auf company_members: eine geloeschte Mitgliedschaft soll die Zuordnung nicht mitnehmen, und der Name steht ohnehin dort.';


--
-- Name: COLUMN leads.next_action_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.next_action_at IS 'Wann als naechstes nachgefasst wird. Grundlage der Wiedervorlage.';


--
-- Name: CONSTRAINT chk_leads_status ON leads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT chk_leads_status ON public.leads IS 'İzin verilen lead durum değerleri. Double opt-in için: awaiting_customer_confirmation, unconfirmed_risky.';


--
-- Name: leistungsuebersicht_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leistungsuebersicht_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name character varying NOT NULL,
    service_type character varying NOT NULL,
    description text,
    included_service_ids uuid[],
    excluded_services text[],
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    translations jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: manual_imported_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_imported_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    lead_id uuid,
    raw_import_text text NOT NULL,
    ai_confidence_score integer,
    imported_by uuid,
    imported_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: moebellift_anfragen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moebellift_anfragen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anfrage_nummer text,
    service_type text DEFAULT 'with_operator'::text NOT NULL,
    zweck text DEFAULT 'umzug'::text NOT NULL,
    richtung text DEFAULT 'both'::text,
    einsatzort_adresse jsonb DEFAULT '{}'::jsonb,
    stockwerk text,
    geschaetzte_hoehe_m numeric(4,1),
    zugang text,
    oeffnung_breite_cm integer,
    oeffnung_hoehe_cm integer,
    stellflaeche text,
    hindernisse jsonb DEFAULT '{}'::jsonb,
    parkplatz text,
    strom text,
    transport_details jsonb DEFAULT '{}'::jsonb,
    wunschdatum date,
    wunschzeit text,
    dauer text,
    flexibilitaet text,
    zusatzleistungen jsonb DEFAULT '{}'::jsonb,
    kunde_anrede text,
    kunde_vorname text,
    kunde_nachname text,
    kunde_firma text,
    kunde_email text,
    kunde_telefon text,
    kunde_kontakt_art text,
    kontakt_vor_ort jsonb,
    fotos text[],
    bemerkungen text,
    agb_akzeptiert boolean DEFAULT false,
    stellflaeche_bestaetigt boolean DEFAULT false,
    berechtigung_bestaetigt boolean DEFAULT false,
    geschaetzter_preis_chf numeric(10,2),
    empfohlener_lift_typ text,
    status text DEFAULT 'neu'::text,
    form_version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE moebellift_anfragen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.moebellift_anfragen IS 'Möbellift (furniture lift) rental requests with detailed form data';


--
-- Name: moebellift_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.moebellift_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: moving_calculation_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moving_calculation_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    pricing_config jsonb DEFAULT '{"vatRate": 8.1, "hourlyRate": 150, "disposalCost": 300, "vehiclePrices": {"truck_18t": 600, "truck_3_5t": 250, "truck_7_5t": 400, "transporter": 150}, "externalLiftCost": 600, "storageCostPerM3": 80, "packingServiceRate": 50, "pianoTransportCost": 400, "distanceSurchargeRate": 2, "distanceSurchargeThreshold": 30}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    type character varying NOT NULL,
    title character varying NOT NULL,
    body text,
    metadata jsonb DEFAULT '{}'::jsonb,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;


--
-- Name: offer_amendment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_amendment_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    description text NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit text,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    service_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: offer_amendments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_amendments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    offer_id uuid NOT NULL,
    auftrag_id uuid,
    amendment_number integer NOT NULL,
    title text NOT NULL,
    reason text,
    status text DEFAULT 'draft'::text NOT NULL,
    access_token text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text) NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    vat_rate numeric(5,2) DEFAULT 8.1 NOT NULL,
    vat_amount numeric GENERATED ALWAYS AS (((subtotal * vat_rate) / (100)::numeric)) STORED,
    total numeric GENERATED ALWAYS AS ((subtotal + ((subtotal * vat_rate) / (100)::numeric))) STORED,
    sent_at timestamp with time zone,
    viewed_at timestamp with time zone,
    accepted_at timestamp with time zone,
    rejected_at timestamp with time zone,
    customer_response_note text,
    accepted_ip text,
    language text NOT NULL,
    customer_id uuid,
    locked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT offer_amendments_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT offer_amendments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'viewed'::text, 'accepted'::text, 'rejected'::text]))),
    CONSTRAINT offer_amendments_title_present CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: TABLE offer_amendments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offer_amendments IS 'Nachtrag zu einer angenommenen Offerte: eigener Beleg, eigener Link, eigene Zustimmung. Die Offerte bleibt unberuehrt — sie belegt die urspruengliche Vereinbarung. Bei Zustimmung wird der AUFTRAG fortgeschrieben.';


--
-- Name: COLUMN offer_amendments.language; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offer_amendments.language IS 'Sprache des Kunden, aus der Offerte eingefroren. NICHT die Dashboard-Sprache des Bedieners — der Nachtrag geht an den Kunden.';


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    lead_id uuid,
    customer_first_name character varying NOT NULL,
    customer_last_name character varying NOT NULL,
    customer_email character varying NOT NULL,
    customer_phone character varying,
    title character varying NOT NULL,
    description text,
    service_date date,
    valid_until date,
    subtotal numeric DEFAULT 0 NOT NULL,
    vat_rate numeric DEFAULT 8.1 NOT NULL,
    vat_amount numeric GENERATED ALWAYS AS (((subtotal * vat_rate) / (100)::numeric)) STORED,
    total numeric GENERATED ALWAYS AS ((subtotal + ((subtotal * vat_rate) / (100)::numeric))) STORED,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    sent_at timestamp with time zone,
    viewed_at timestamp with time zone,
    accepted_at timestamp with time zone,
    rejected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    access_token character varying DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text) NOT NULL,
    customer_response_note text,
    checklist_url text,
    leistungsuebersicht_url text,
    agb_accepted_at timestamp with time zone,
    agb_version text,
    agb_ip_address text,
    offer_number integer,
    company_reference text,
    customer_salutation character varying(10),
    service_start_time time without time zone,
    service_end_time time without time zone,
    secondary_service_date date,
    secondary_service_type character varying(100),
    service_details jsonb DEFAULT '{}'::jsonb,
    resources jsonb DEFAULT '{}'::jsonb,
    highlighted_items text[],
    payment_method character varying(100),
    payment_due_days integer DEFAULT 30,
    internal_notes text,
    assigned_team_member_id uuid,
    calculation_data jsonb,
    origin_building_info jsonb,
    destination_building_info jsonb,
    moving_distance_km numeric,
    moving_driving_time_minutes integer,
    moving_additional_stops integer DEFAULT 0,
    price_model text DEFAULT 'pauschal'::text NOT NULL,
    hourly_rate numeric(10,2),
    kostendach_max numeric(10,2),
    payment_terms text,
    brief_layout boolean DEFAULT false NOT NULL,
    offerte_type text DEFAULT 'normal'::text NOT NULL,
    time_estimate jsonb,
    surcharges jsonb,
    frozen_from_street text,
    frozen_from_house_number text,
    frozen_from_plz text,
    frozen_from_city text,
    frozen_from_floor integer,
    frozen_from_has_lift boolean,
    frozen_from_rooms numeric,
    frozen_from_living_space_m2 integer,
    frozen_from_lift_type text,
    frozen_from_steps_to_entrance text,
    frozen_from_distance_to_parking integer,
    frozen_from_path_obstruction boolean,
    frozen_to_street text,
    frozen_to_house_number text,
    frozen_to_plz text,
    frozen_to_city text,
    frozen_to_floor integer,
    frozen_to_has_lift boolean,
    frozen_to_rooms numeric,
    frozen_to_living_space_m2 integer,
    frozen_to_lift_type text,
    frozen_to_steps_to_entrance text,
    frozen_to_distance_to_parking integer,
    frozen_to_path_obstruction boolean,
    frozen_address_at timestamp with time zone,
    customer_number text,
    frozen_has_keller boolean,
    frozen_has_estrich boolean,
    frozen_has_garage boolean,
    frozen_has_lagerung boolean,
    frozen_has_schwer_colli boolean,
    frozen_has_klavier boolean,
    frozen_checklist_at timestamp with time zone,
    frozen_zwischenlager_street text,
    frozen_zwischenlager_house_number text,
    frozen_zwischenlager_plz text,
    frozen_zwischenlager_city text,
    discount_percent numeric(5,2),
    language text DEFAULT 'de'::text NOT NULL,
    customer_id uuid,
    offer_series_id uuid NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    supersedes_offer_id uuid,
    superseded_at timestamp with time zone,
    locked_at timestamp with time zone,
    revision_reason text,
    CONSTRAINT chk_offers_status CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('sending'::character varying)::text, ('sent'::character varying)::text, ('viewed'::character varying)::text, ('accepted'::character varying)::text, ('rejected'::character varying)::text, ('expired'::character varying)::text, ('job_confirmed'::character varying)::text, ('completed'::character varying)::text]))),
    CONSTRAINT kostendach_requires_hourly_rate CHECK (((price_model <> 'kostendach'::text) OR ((hourly_rate IS NOT NULL) AND (kostendach_max IS NOT NULL)))),
    CONSTRAINT offers_discount_percent_range CHECK (((discount_percent IS NULL) OR ((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric)))),
    CONSTRAINT offers_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT offers_offerte_type_check CHECK ((offerte_type = ANY (ARRAY['normal'::text, 'blind'::text]))),
    CONSTRAINT offers_price_model_check CHECK ((price_model = ANY (ARRAY['pauschal'::text, 'stundenansatz'::text, 'kostendach'::text])))
);


--
-- Name: TABLE offers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offers IS 'Offers table - Title naming convention updated 2025-12-30';


--
-- Name: COLUMN offers.lead_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.lead_id IS 'Reference to source lead. SET NULL on lead delete — offer/auftrag history preserved.';


--
-- Name: COLUMN offers.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.status IS 'Offer lifecycle: draft → sent → viewed → accepted/rejected. expired (vade geçti, şu an computed is_expired), job_confirmed (auftrag oluştu), completed (iş bitti).';


--
-- Name: COLUMN offers.agb_accepted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.agb_accepted_at IS 'Timestamp when customer accepted the AGB';


--
-- Name: COLUMN offers.agb_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.agb_version IS 'Version/hash of AGB sections at time of acceptance';


--
-- Name: COLUMN offers.agb_ip_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.agb_ip_address IS 'IP address of customer when accepting AGB';


--
-- Name: COLUMN offers.price_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.price_model IS 'pauschal = fixed total price | stundenansatz = hourly rate only | kostendach = hourly rate with a maximum price ceiling';


--
-- Name: COLUMN offers.hourly_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.hourly_rate IS 'CHF per hour — used when price_model is stundenansatz or kostendach';


--
-- Name: COLUMN offers.kostendach_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.kostendach_max IS 'Maximum price ceiling in CHF — used only when price_model is kostendach';


--
-- Name: COLUMN offers.brief_layout; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.brief_layout IS 'When true, PDF is generated in SN 010 130 Swiss letter standard format (Briefversand)';


--
-- Name: COLUMN offers.offerte_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.offerte_type IS 'Type of offer: normal = created after on-site visit | blind = created without visit based on customer info only';


--
-- Name: COLUMN offers.surcharges; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.surcharges IS 'Zuschläge dizisi: [{label, type(percent|fixed|per_km), value, amount}]. amount kaydetme anı snapshot; vergi tabanı subtotal''e dahildir.';


--
-- Name: COLUMN offers.frozen_address_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.frozen_address_at IS 'Adresin teklife dondurulduğu an. Backfill veya create-time ayrımı için. NULL = henüz dondurulmadı.';


--
-- Name: COLUMN offers.customer_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.customer_number IS 'Kundennummer (manuel giriş). Emsal yoktu — yeni kavram.';


--
-- Name: COLUMN offers.frozen_checklist_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.frozen_checklist_at IS 'Aufnahme checklist''in teklife dondurulduğu an. NULL = henüz dondurulmadı.';


--
-- Name: COLUMN offers.discount_percent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.discount_percent IS 'Teklif-seviyesi indirim yüzdesi (nullable, sunum/hesap katmanı — new_offer.png Zwischensumme üstü Rabatt deseni). computeOfferTotals bunu Zwischensumme sonrası TEK ÇARPAN olarak uygular, pozisyon-seviyesi list_price/discount_percent (offer_items, Katman 1c) ile bağımsız/paralel.';


--
-- Name: COLUMN offers.language; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.language IS 'Eingefroren aus leads.language beim Erstellen — die Offerte bleibt korrekt, auch wenn der Lead gelöscht wird.';


--
-- Name: COLUMN offers.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.customer_id IS 'Kanonischer Kunde, vom Lead geerbt. Die eingefrorenen customer_*- und frozen_*-Felder bleiben unberuehrt.';


--
-- Name: COLUMN offers.offer_series_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.offer_series_id IS 'Die Offerte ueber alle Versionen hinweg. Version 1 traegt hier ihre eigene id.';


--
-- Name: COLUMN offers.superseded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.superseded_at IS 'Gesetzt, sobald eine neuere Version existiert. Der alte Link bleibt gueltig und zeigt weiterhin DIESE Fassung, aber die Annahme ist darueber gesperrt.';


--
-- Name: COLUMN offers.locked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offers.locked_at IS 'Gesetzt beim Uebergang nach `sent`. Ab da sind Inhaltsaenderungen gesperrt — Aenderungen laufen ueber create_offer_revision().';


--
-- Name: offer_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.offer_details WITH (security_invoker='on') AS
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
   FROM (((public.offers o
     LEFT JOIN public.companies c ON ((o.company_id = c.id)))
     LEFT JOIN public.leads l ON ((o.lead_id = l.id)))
     LEFT JOIN public.team_members tm ON ((o.assigned_team_member_id = tm.id)));


--
-- Name: VIEW offer_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.offer_details IS 'Offerte mit Firma, Lead und Betreuer. security_invoker = on — ohne das laeuft die View als postgres und umgeht RLS. anon hat hier nichts verloren.';


--
-- Name: offer_inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid NOT NULL,
    item_id character varying(100) NOT NULL,
    category_id character varying(100) NOT NULL,
    name_de character varying(255) NOT NULL,
    volume_m3 numeric DEFAULT 0 NOT NULL,
    assembly_time_minutes integer DEFAULT 0 NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    total_volume_m3 numeric GENERATED ALWAYS AS ((volume_m3 * (quantity)::numeric)) STORED,
    total_assembly_time_minutes integer GENERATED ALWAYS AS ((assembly_time_minutes * quantity)) STORED,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: offer_item_area_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_item_area_meta (
    offer_item_id uuid NOT NULL,
    object_type text,
    area_m2 numeric(10,2),
    abgabe text,
    abnahmegarantie boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE offer_item_area_meta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offer_item_area_meta IS 'Arketip AREA: reinigung pozisyonları için obje tipi + alan (m²) + abgabe + abnahmegarantie. offer_item_id (PK=FK) ile offer_items''e 1:1.';


--
-- Name: offer_item_breakdown; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_item_breakdown (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_item_id uuid NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE offer_item_breakdown; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offer_item_breakdown IS 'Pozisyon başına maliyet dökümü satırları (label/value, 1:N). 7 hizmetin hepsinde geçerli. offer_item_id FK ON DELETE CASCADE; position ile sıralanır.';


--
-- Name: offer_item_effort_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_item_effort_meta (
    offer_item_id uuid NOT NULL,
    crew integer,
    vehicles integer,
    vehicle_type text,
    hourly_rate numeric(10,2),
    aufwand_min_h numeric(5,2),
    aufwand_max_h numeric(5,2),
    CONSTRAINT effort_aufwand_range CHECK (((aufwand_min_h IS NULL) OR (aufwand_max_h IS NULL) OR (aufwand_min_h <= aufwand_max_h)))
);


--
-- Name: TABLE offer_item_effort_meta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offer_item_effort_meta IS 'Arketip EFFORT: umzug/transport/moebellift/klaviertransport pozisyonları için crew/araç/saatlik ücret + aufwand aralığı. offer_item_id (PK=FK) ile offer_items''e 1:1.';


--
-- Name: offer_item_leistung; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_item_leistung (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_item_id uuid NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE offer_item_leistung; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offer_item_leistung IS 'Pozisyon başına Leistungsumfang/kapsam maddeleri (tek metin, 1:N). 7 hizmetin hepsinde geçerli. offer_item_id FK ON DELETE CASCADE; position ile sıralanır.';


--
-- Name: offer_item_volume_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_item_volume_meta (
    offer_item_id uuid NOT NULL,
    volume_m3 numeric(10,2),
    volume_min_m3 numeric(10,2),
    volume_max_m3 numeric(10,2),
    rate numeric(10,2),
    rate_unit text,
    location text,
    CONSTRAINT volume_range CHECK (((volume_min_m3 IS NULL) OR (volume_max_m3 IS NULL) OR (volume_min_m3 <= volume_max_m3))),
    CONSTRAINT volume_rate_unit CHECK (((rate_unit IS NULL) OR (rate_unit = ANY (ARRAY['monthly'::text, 'once'::text]))))
);


--
-- Name: TABLE offer_item_volume_meta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offer_item_volume_meta IS 'Arketip VOLUME: lagerung/entsorgung/raeumung pozisyonları için hacim (nokta/aralık) + rate (monthly/once) + konum. offer_item_id (PK=FK) ile offer_items''e 1:1.';


--
-- Name: offer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    description character varying NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    unit character varying DEFAULT 'Stk.'::character varying,
    unit_price numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    total numeric GENERATED ALWAYS AS ((quantity * unit_price)) STORED,
    price_type character varying(20) DEFAULT 'pauschale'::character varying,
    is_highlighted boolean DEFAULT false,
    is_optional boolean DEFAULT false,
    time_estimate jsonb,
    service_type text,
    list_price numeric(10,2),
    discount_percent numeric(5,2),
    discount_amount numeric(10,2),
    scheduled_date date,
    scheduled_start_time time without time zone,
    scheduled_end_time time without time zone,
    amount_basis text DEFAULT 'fixed'::text NOT NULL,
    kostendach_max numeric(10,2),
    CONSTRAINT chk_offer_items_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_offer_items_unit_price CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT chk_price_type CHECK (((price_type IS NULL) OR ((price_type)::text = ANY ((ARRAY['pauschale'::character varying, 'per_unit'::character varying, 'per_hour'::character varying, 'inkl'::character varying, 'optional'::character varying])::text[])))),
    CONSTRAINT offer_items_amount_basis_check CHECK ((amount_basis = ANY (ARRAY['fixed'::text, 'rate'::text, 'range'::text]))),
    CONSTRAINT offer_items_discount_exclusive_check CHECK (((discount_percent IS NULL) OR (discount_amount IS NULL))),
    CONSTRAINT offer_items_discount_percent_range CHECK (((discount_percent IS NULL) OR ((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric)))),
    CONSTRAINT offer_items_kostendach_max_check CHECK (((kostendach_max IS NULL) OR (kostendach_max >= (0)::numeric))),
    CONSTRAINT offer_items_list_price_check CHECK (((list_price IS NULL) OR (list_price >= unit_price)))
);


--
-- Name: COLUMN offer_items.price_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offer_items.price_type IS 'Pricing model: pauschale (flat rate), per_unit (per piece), per_hour (hourly), inkl (included), optional';


--
-- Name: COLUMN offer_items.is_highlighted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offer_items.is_highlighted IS 'Whether this item should be visually highlighted in the offer';


--
-- Name: COLUMN offer_items.is_optional; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offer_items.is_optional IS 'Whether this item is optional (not included in total calculation)';


--
-- Name: COLUMN offer_items.list_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offer_items.list_price IS 'Sunum: indirim öncesi liste fiyatı (üstü çizili gösterim). Hesaplamaya girmez. >= unit_price.';


--
-- Name: COLUMN offer_items.discount_percent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offer_items.discount_percent IS 'Sunum: yüzde indirim rozeti (0-100). Hesaplamaya girmez. discount_amount ile aynı anda dolamaz.';


--
-- Name: COLUMN offer_items.discount_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offer_items.discount_amount IS 'Sunum: tutar indirim rozeti. Hesaplamaya girmez. discount_percent ile aynı anda dolamaz.';


--
-- Name: COLUMN offer_items.amount_basis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offer_items.amount_basis IS 'Betrags-Achse: fixed = bestimmter Betrag (zaehlt zur Summe) | rate = nur Einheitspreis, Menge/Dauer unbestimmt (NIE in Summe) | range = bestimmte Min/Max-Spanne (in Summe). Orthogonal zu price_type und offers.price_model. Default fixed erhaelt Bestandsverhalten.';


--
-- Name: COLUMN offer_items.kostendach_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offer_items.kostendach_max IS 'Item-/Service-level Kostendach (max. CHF) fuer rate-Posten; im PDF unter dem Service-Block. NULL = kein Item-Cap → Fallback auf offers.kostendach_max (offer-level, Altofferten).';


--
-- Name: CONSTRAINT chk_price_type ON offer_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT chk_price_type ON public.offer_items IS 'Geçerli fiyat tipi değerleri. types.ts ile senkronize tutulmalı.';


--
-- Name: offer_leistungsuebersicht; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_leistungsuebersicht (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid NOT NULL,
    included_services jsonb DEFAULT '[]'::jsonb NOT NULL,
    excluded_services text[] DEFAULT '{}'::text[],
    special_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: offer_moving_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.offer_moving_details WITH (security_invoker='on') AS
 SELECT o.id AS offer_id,
    o.offer_number,
    o.company_id,
    o.lead_id,
    o.customer_first_name,
    o.customer_last_name,
    o.title,
    o.status,
    o.subtotal,
    o.total,
    o.calculation_data,
    o.origin_building_info,
    o.destination_building_info,
    o.moving_distance_km,
    o.moving_driving_time_minutes,
    o.moving_additional_stops,
    ((o.calculation_data ->> 'netVolume'::text))::numeric AS net_volume_m3,
    ((o.calculation_data ->> 'truckVolume'::text))::numeric AS truck_volume_m3,
    (o.calculation_data ->> 'recommendedVehicle'::text) AS recommended_vehicle,
    ((o.calculation_data ->> 'recommendedCrew'::text))::integer AS recommended_crew,
    (((o.calculation_data -> 'timeBreakdown'::text) ->> 'totalTime'::text))::integer AS total_time_minutes,
    ( SELECT count(*) AS count
           FROM public.offer_inventory_items
          WHERE (offer_inventory_items.offer_id = o.id)) AS inventory_item_count,
    ( SELECT sum(offer_inventory_items.total_volume_m3) AS sum
           FROM public.offer_inventory_items
          WHERE (offer_inventory_items.offer_id = o.id)) AS inventory_total_volume,
    o.created_at,
    o.updated_at
   FROM public.offers o
  WHERE (o.calculation_data IS NOT NULL);


--
-- Name: VIEW offer_moving_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.offer_moving_details IS 'Offer moving details view with SECURITY INVOKER - respects RLS policies';


--
-- Name: offer_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.offer_number_seq
    START WITH 10000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    rechnung_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_allocations_amount_not_zero CHECK ((amount <> (0)::numeric))
);


--
-- Name: TABLE payment_allocations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_allocations IS 'Worauf ein Zahlungseingang angerechnet wird. n:m — eine Ueberweisung kann mehrere Rechnungen decken, eine Rechnung mehrere Raten haben.';


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid,
    payment_date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'CHF'::text NOT NULL,
    method text DEFAULT 'bank'::text NOT NULL,
    reference text,
    reconciliation_status text DEFAULT 'unreconciled'::text NOT NULL,
    reverses_payment_id uuid,
    note text,
    created_via text DEFAULT 'manual'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_not_zero CHECK ((amount <> (0)::numeric)),
    CONSTRAINT payments_created_via_check CHECK ((created_via = ANY (ARRAY['manual'::text, 'backfill'::text, 'quittung'::text, 'portal'::text]))),
    CONSTRAINT payments_currency_chf_only CHECK ((currency = 'CHF'::text)),
    CONSTRAINT payments_method_check CHECK ((method = ANY (ARRAY['bank'::text, 'qr'::text, 'cash'::text, 'twint'::text, 'card'::text, 'other'::text]))),
    CONSTRAINT payments_negative_only_reversal CHECK (((amount > (0)::numeric) OR (reverses_payment_id IS NOT NULL))),
    CONSTRAINT payments_no_self_reversal CHECK (((reverses_payment_id IS NULL) OR (reverses_payment_id <> id))),
    CONSTRAINT payments_reconciliation_check CHECK ((reconciliation_status = ANY (ARRAY['unreconciled'::text, 'reconciled'::text, 'disputed'::text])))
);


--
-- Name: TABLE payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payments IS 'Zahlungseingaenge. Append-only: Korrekturen laufen ueber eine Stornozeile mit umgekehrtem Vorzeichen (reverses_payment_id), nicht ueber ein UPDATE.';


--
-- Name: COLUMN payments.payment_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payments.payment_date IS 'Wertstellung. Beim Backfill aus Belegdaten uebernommen — dann steht reconciliation_status auf unreconciled, weil das echte Datum unbekannt ist.';


--
-- Name: umzugsbox_rentals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.umzugsbox_rentals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    lead_id uuid,
    offer_id uuid,
    appointment_id uuid,
    customer_first_name text NOT NULL,
    customer_last_name text NOT NULL,
    customer_email text,
    customer_phone text,
    delivery_address text,
    delivery_plz text,
    delivery_city text,
    box_type public.umzugsbox_type DEFAULT 'standard'::public.umzugsbox_type,
    box_quantity integer DEFAULT 1 NOT NULL,
    box_description text,
    is_rental boolean DEFAULT true,
    rental_price_per_day numeric(10,2),
    deposit_amount numeric(10,2),
    deposit_paid boolean DEFAULT false,
    delivery_date date NOT NULL,
    expected_return_date date,
    actual_return_date date,
    pickup_scheduled_date date,
    pickup_scheduled_time time without time zone,
    status public.box_rental_status DEFAULT 'delivered'::public.box_rental_status,
    assigned_team_member_id uuid,
    delivered_by_team_member_id uuid,
    picked_up_by_team_member_id uuid,
    reminder_days_before integer DEFAULT 3,
    reminder_sent boolean DEFAULT false,
    reminder_sent_at timestamp with time zone,
    second_reminder_sent boolean DEFAULT false,
    second_reminder_sent_at timestamp with time zone,
    customer_notified boolean DEFAULT false,
    customer_notified_at timestamp with time zone,
    customer_pickup_request_at timestamp with time zone,
    internal_notes text,
    customer_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    box_items jsonb DEFAULT '[{"type": "standard", "quantity": 1}]'::jsonb,
    archived_at timestamp with time zone,
    pickup_address text,
    pickup_plz character varying(10),
    pickup_city character varying(100)
);


--
-- Name: TABLE umzugsbox_rentals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.umzugsbox_rentals IS 'Tracks rental moving boxes sent to customers, their return status, and pickup scheduling';


--
-- Name: COLUMN umzugsbox_rentals.delivery_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.umzugsbox_rentals.delivery_address IS 'Address where boxes are delivered to (usually old home before moving)';


--
-- Name: COLUMN umzugsbox_rentals.expected_return_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.umzugsbox_rentals.expected_return_date IS 'The date when boxes should be returned/picked up';


--
-- Name: COLUMN umzugsbox_rentals.reminder_days_before; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.umzugsbox_rentals.reminder_days_before IS 'How many days before expected return to send reminder (default 3)';


--
-- Name: COLUMN umzugsbox_rentals.box_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.umzugsbox_rentals.box_items IS 'Array of box items: [{"type": "standard", "quantity": 20}, {"type": "wardrobe", "quantity": 5}]';


--
-- Name: COLUMN umzugsbox_rentals.archived_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.umzugsbox_rentals.archived_at IS 'Timestamp when box was archived. Archived boxes are deleted after 3 months.';


--
-- Name: COLUMN umzugsbox_rentals.pickup_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.umzugsbox_rentals.pickup_address IS 'Address where boxes will be picked up from (usually new home after moving)';


--
-- Name: COLUMN umzugsbox_rentals.pickup_plz; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.umzugsbox_rentals.pickup_plz IS 'PLZ of pickup location';


--
-- Name: COLUMN umzugsbox_rentals.pickup_city; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.umzugsbox_rentals.pickup_city IS 'City of pickup location';


--
-- Name: pending_box_pickups; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pending_box_pickups WITH (security_invoker='on') AS
 SELECT ubr.id,
    ubr.company_id,
    ubr.lead_id,
    ubr.offer_id,
    ubr.appointment_id,
    ubr.customer_first_name,
    ubr.customer_last_name,
    ubr.customer_email,
    ubr.customer_phone,
    ubr.delivery_address,
    ubr.delivery_plz,
    ubr.delivery_city,
    ubr.box_type,
    ubr.box_quantity,
    ubr.box_description,
    ubr.is_rental,
    ubr.rental_price_per_day,
    ubr.deposit_amount,
    ubr.deposit_paid,
    ubr.delivery_date,
    ubr.expected_return_date,
    ubr.actual_return_date,
    ubr.pickup_scheduled_date,
    ubr.pickup_scheduled_time,
    ubr.status,
    ubr.assigned_team_member_id,
    ubr.delivered_by_team_member_id,
    ubr.picked_up_by_team_member_id,
    ubr.reminder_days_before,
    ubr.reminder_sent,
    ubr.reminder_sent_at,
    ubr.second_reminder_sent,
    ubr.second_reminder_sent_at,
    ubr.customer_notified,
    ubr.customer_notified_at,
    ubr.customer_pickup_request_at,
    ubr.internal_notes,
    ubr.customer_notes,
    ubr.created_at,
    ubr.updated_at,
    ubr.created_by,
    ubr.box_items,
    ubr.archived_at,
    c.company_name,
    tm.first_name AS assigned_first_name,
    tm.last_name AS assigned_last_name,
    tm.color_code AS assigned_color,
    public.get_total_box_quantity(ubr.box_items) AS total_box_quantity,
        CASE
            WHEN (ubr.expected_return_date < CURRENT_DATE) THEN 'overdue'::text
            WHEN (ubr.expected_return_date = CURRENT_DATE) THEN 'today'::text
            WHEN (ubr.expected_return_date = (CURRENT_DATE + 1)) THEN 'tomorrow'::text
            WHEN (ubr.expected_return_date <= (CURRENT_DATE + 3)) THEN 'soon'::text
            ELSE 'upcoming'::text
        END AS urgency
   FROM ((public.umzugsbox_rentals ubr
     JOIN public.companies c ON ((ubr.company_id = c.id)))
     LEFT JOIN public.team_members tm ON ((ubr.assigned_team_member_id = tm.id)))
  WHERE ((ubr.status = ANY (ARRAY['delivered'::public.box_rental_status, 'in_use'::public.box_rental_status, 'pickup_requested'::public.box_rental_status, 'pickup_scheduled'::public.box_rental_status])) AND (ubr.is_rental = true) AND (ubr.archived_at IS NULL))
  ORDER BY ubr.expected_return_date;


--
-- Name: VIEW pending_box_pickups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.pending_box_pickups IS 'Pending box pickups view with SECURITY INVOKER - respects RLS policies';


--
-- Name: pending_team_reminders; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pending_team_reminders WITH (security_invoker='on') AS
 SELECT a.id AS appointment_id,
    a.company_id,
    a.appointment_date,
    a.start_time,
    a.end_time,
    a.title,
    a.appointment_type,
    a.status,
    a.customer_first_name,
    a.customer_last_name,
    a.location_address,
    a.location_plz,
    a.location_city,
    a.assigned_team_member_ids,
    array_agg(DISTINCT tm.email) FILTER (WHERE (tm.email IS NOT NULL)) AS team_emails,
    array_agg(DISTINCT concat(tm.first_name, ' ', tm.last_name)) AS team_names,
    (a.appointment_date + (a.start_time)::interval) AS appointment_datetime,
    ((a.appointment_date + (a.start_time)::interval) - '12:00:00'::interval) AS reminder_time
   FROM ((public.appointments a
     LEFT JOIN LATERAL unnest(a.assigned_team_member_ids) tm_id(tm_id) ON (true))
     LEFT JOIN public.team_members tm ON (((tm.id = tm_id.tm_id) AND (tm.is_active = true))))
  WHERE ((a.status = ANY (ARRAY['confirmed'::public.appointment_status, 'pending'::public.appointment_status])) AND (a.appointment_date >= CURRENT_DATE) AND ((a.reminder_sent_team IS NULL) OR (a.reminder_sent_team = false)) AND (a.assigned_team_member_ids IS NOT NULL) AND (array_length(a.assigned_team_member_ids, 1) > 0))
  GROUP BY a.id, a.company_id, a.appointment_date, a.start_time, a.end_time, a.title, a.appointment_type, a.status, a.customer_first_name, a.customer_last_name, a.location_address, a.location_plz, a.location_city, a.assigned_team_member_ids
  ORDER BY (a.appointment_date + (a.start_time)::interval);


--
-- Name: VIEW pending_team_reminders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.pending_team_reminders IS 'Pending team reminders view with SECURITY INVOKER - respects RLS policies';


--
-- Name: portal_magic_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_magic_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT portal_magic_links_hash_laenge CHECK ((length(token_hash) = 64))
);


--
-- Name: TABLE portal_magic_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.portal_magic_links IS 'Einmal-Links fuer das Kundenportal. Enthaelt NUR den sha256-Abdruck; der Klartext verlaesst die DB einmalig als Rueckgabewert und wird nie abgelegt.';


--
-- Name: portal_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    magic_link_id uuid,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT portal_sessions_hash_laenge CHECK ((length(token_hash) = 64))
);


--
-- Name: TABLE portal_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.portal_sessions IS 'Portal-Sitzungen. Wie die Links nur als Abdruck gespeichert. Widerruf durch revoked_at — die Sitzung ist damit sofort tot, ohne dass jemand einen Browser erreichen muesste.';


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying DEFAULT 'default'::character varying NOT NULL,
    base_price numeric DEFAULT 20 NOT NULL,
    service_multipliers jsonb DEFAULT '{}'::jsonb,
    urgency_multipliers jsonb DEFAULT '{"normal": 1.0, "urgent": 1.5}'::jsonb,
    size_tiers jsonb DEFAULT '{}'::jsonb,
    location_multipliers jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    room_tiers jsonb DEFAULT '{"1": 0.6, "2": 0.8, "3": 1.0, "4": 1.2, "5": 1.4, "6": 1.6}'::jsonb,
    distance_tiers jsonb DEFAULT '{"0-10": 1.0, "100+": 2.0, "10-25": 1.2, "25-50": 1.4, "50-100": 1.6}'::jsonb,
    extra_services jsonb DEFAULT '{"packing": 0.3, "storage": 0.25, "cleaning": 0.2}'::jsonb,
    living_space_tiers jsonb DEFAULT '{"0-50": 0.8, "180+": 2.0, "50-80": 1.0, "80-120": 1.2, "120-180": 1.5}'::jsonb,
    token_to_chf_rate numeric DEFAULT 1.0,
    exclusivity_multipliers jsonb DEFAULT '{"1": 2.5, "3": 1.5, "5": 1.0}'::jsonb,
    job_value_factor_enabled boolean DEFAULT true,
    job_value_min_factor numeric DEFAULT 0.8,
    job_value_max_factor numeric DEFAULT 2.5,
    job_value_base_chf numeric DEFAULT 1000
);


--
-- Name: TABLE pricing_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pricing_rules IS 'Dynamic pricing rules for lead token costs based on Swiss market data';


--
-- Name: pricing_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_value_chf numeric DEFAULT 1.0 NOT NULL,
    min_lead_price_tokens numeric DEFAULT 5,
    max_lead_price_tokens numeric DEFAULT 200,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    size_multipliers jsonb DEFAULT '{"3": 1.2, "6+": 1.6, "1-2": 1.0, "4-5": 1.4}'::jsonb NOT NULL,
    offerten_multipliers jsonb DEFAULT '{"3": 1.3, "4": 1.15, "5": 1.0}'::jsonb NOT NULL
);


--
-- Name: TABLE pricing_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pricing_settings IS 'Global pricing configuration settings';


--
-- Name: COLUMN pricing_settings.size_multipliers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pricing_settings.size_multipliers IS 'Room-based size multipliers for token pricing. Keys: room ranges, Values: multiplier';


--
-- Name: COLUMN pricing_settings.offerten_multipliers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pricing_settings.offerten_multipliers IS 'Multiplier based on number of companies receiving the lead. Fewer = higher price.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email character varying(255),
    first_name character varying(255),
    last_name character varying(255),
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: quittungen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quittungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    offer_id uuid,
    quittung_nr text,
    datum date DEFAULT CURRENT_DATE NOT NULL,
    customer_name text DEFAULT ''::text NOT NULL,
    customer_address text,
    customer_destination text,
    customer_email text,
    customer_phone text,
    positionen jsonb DEFAULT '[]'::jsonb NOT NULL,
    zwischensumme numeric(10,2) DEFAULT 0 NOT NULL,
    mwst_satz numeric(4,2) DEFAULT 8.1 NOT NULL,
    mwst_betrag numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    rabatt numeric(10,2) DEFAULT 0 NOT NULL,
    gesamttotal numeric(10,2) DEFAULT 0 NOT NULL,
    kunde_unterschrift text,
    teamchef_unterschrift text,
    kunde_signed_at timestamp with time zone,
    teamchef_signed_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    betrag_noch_offen boolean DEFAULT false NOT NULL,
    pdf_url text,
    notiz text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auftrag_id uuid,
    language text DEFAULT 'de'::text NOT NULL,
    customer_id uuid,
    payment_id uuid,
    CONSTRAINT chk_quittung_gesamt CHECK ((round(gesamttotal, 2) = round((total + mwst_betrag), 2))),
    CONSTRAINT chk_quittung_mwst CHECK ((round(mwst_betrag, 2) = round(((total * mwst_satz) / (100)::numeric), 2))),
    CONSTRAINT chk_quittung_total_from_rabatt CHECK ((round(total, 2) = round(GREATEST((zwischensumme - rabatt), (0)::numeric), 2))),
    CONSTRAINT quittungen_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT quittungen_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'signed'::text, 'sent'::text, 'paid'::text])))
);


--
-- Name: COLUMN quittungen.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quittungen.customer_id IS 'Kanonischer Kunde, vom Auftrag geerbt.';


--
-- Name: COLUMN quittungen.payment_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quittungen.payment_id IS 'Der Zahlungseingang, den diese Quittung bescheinigt. Umsatz wird ueber payments gezaehlt, damit Quittung und Rechnung nicht doppelt zaehlen.';


--
-- Name: raeumung_anfragen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raeumung_anfragen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anfrage_nummer text,
    raeumungs_art text DEFAULT 'apartment_clearance'::text NOT NULL,
    property_type text,
    zimmer_anzahl integer,
    flaeche_m2 integer,
    stockwerke integer,
    fuellgrad integer,
    adresse_land text DEFAULT 'CH'::text,
    adresse_strasse text,
    adresse_hausnummer text,
    adresse_plz text,
    adresse_ort text,
    adresse_kanton text,
    zugang_stockwerk text,
    zugang_lift_vorhanden boolean DEFAULT false,
    zugang_lift_typ text,
    zugang_parkplatz_distanz_m integer,
    zugang_stufen text,
    zugang_hindernisse jsonb DEFAULT '{}'::jsonb,
    umfang_scope text DEFAULT 'complete'::text,
    umfang_bereiche jsonb DEFAULT '[]'::jsonb,
    umfang_inventar jsonb DEFAULT '{}'::jsonb,
    umfang_kartons_anzahl integer DEFAULT 0,
    umfang_volumen_m3 integer DEFAULT 10,
    zustand_allgemein text,
    zustand_besonderheiten jsonb DEFAULT '{}'::jsonb,
    zustand_fuellgrad_prozent integer,
    zustand_schutzausruestung text,
    zusatzleistungen jsonb DEFAULT '{}'::jsonb,
    termin_dringlichkeit text DEFAULT 'normal'::text,
    termin_wunschdatum date,
    termin_flexibilitaet text DEFAULT 'flex_1_week'::text,
    termin_besichtigung_gewuenscht boolean DEFAULT true,
    termin_besichtigung_termine jsonb DEFAULT '[]'::jsonb,
    anfragender_rolle text DEFAULT 'owner'::text,
    anfragender_anrede text,
    anfragender_vorname text,
    anfragender_nachname text,
    anfragender_firma text,
    anfragender_email text,
    anfragender_telefon text,
    anfragender_kontaktzeit text,
    bemerkungen text,
    agb_akzeptiert boolean DEFAULT false,
    berechtigung_bestaetigt boolean DEFAULT false,
    gerichtsbefehl_vorhanden boolean,
    status text DEFAULT 'neu'::text,
    form_version integer DEFAULT 2,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE raeumung_anfragen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.raeumung_anfragen IS 'Detailed clearance/disposal requests from the multi-step wizard form';


--
-- Name: raeumung_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.raeumung_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rechnung_nr_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rechnung_nr_counter (
    company_id uuid NOT NULL,
    jahr integer NOT NULL,
    letzte_nr integer DEFAULT 0 NOT NULL,
    CONSTRAINT rechnung_nr_counter_letzte_nr_check CHECK ((letzte_nr >= 0))
);


--
-- Name: TABLE rechnung_nr_counter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rechnung_nr_counter IS 'Laufende Rechnungsnummer je Firma und Jahr. Steigt nur; ein geloeschter Entwurf gibt seine Nummer nicht zurueck.';


--
-- Name: rechnungen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rechnungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    auftrag_id uuid,
    offer_id uuid,
    rechnung_nr text,
    datum date DEFAULT CURRENT_DATE NOT NULL,
    faellig_am date NOT NULL,
    customer_name text DEFAULT ''::text NOT NULL,
    customer_address text,
    customer_destination text,
    customer_email text,
    customer_phone text,
    positionen jsonb DEFAULT '[]'::jsonb NOT NULL,
    zwischensumme numeric(10,2) DEFAULT 0 NOT NULL,
    mwst_satz numeric(4,2) DEFAULT 8.1 NOT NULL,
    mwst_betrag numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    rabatt numeric(10,2) DEFAULT 0 NOT NULL,
    gesamttotal numeric(10,2) DEFAULT 0 NOT NULL,
    qr_referenz text,
    qr_iban text,
    status text DEFAULT 'entwurf'::text NOT NULL,
    pdf_url text,
    notiz text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    anrede text,
    einleitung text,
    schlusstext text,
    zahlungskonditionen text,
    language text DEFAULT 'de'::text NOT NULL,
    customer_id uuid,
    invoice_type text DEFAULT 'standard'::text NOT NULL,
    paid_total numeric(12,2) DEFAULT 0 NOT NULL,
    credited_total numeric(12,2) DEFAULT 0 NOT NULL,
    open_amount numeric(12,2) GENERATED ALWAYS AS (((COALESCE(gesamttotal, total, (0)::numeric) - paid_total) - credited_total)) STORED,
    CONSTRAINT rechnungen_anrede_check CHECK (((anrede IS NULL) OR (anrede = ANY (ARRAY['Herr'::text, 'Frau'::text])))),
    CONSTRAINT rechnungen_invoice_type_check CHECK ((invoice_type = ANY (ARRAY['standard'::text, 'deposit'::text, 'interim'::text, 'final'::text]))),
    CONSTRAINT rechnungen_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT rechnungen_status_check CHECK ((status = ANY (ARRAY['entwurf'::text, 'versendet'::text, 'bezahlt'::text, 'ueberfaellig'::text])))
);


--
-- Name: TABLE rechnungen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rechnungen IS 'Swiss QR-Bill faturaları. abgeschlossen Auftrag''tan üretilir (auftrag_id UNIQUE = mükerrer engel). Kalemler offer_items''tan snapshot. quittungen (makbuz) sisteminden bağımsız.';


--
-- Name: COLUMN rechnungen.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rechnungen.customer_id IS 'Kanonischer Kunde, vom Auftrag geerbt.';


--
-- Name: COLUMN rechnungen.invoice_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rechnungen.invoice_type IS 'standard | deposit (Anzahlung) | interim (Teilrechnung) | final (Schlussrechnung).';


--
-- Name: COLUMN rechnungen.paid_total; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rechnungen.paid_total IS 'Summe der angerechneten Zahlungen. Vom Trigger gepflegt — nicht von Hand setzen.';


--
-- Name: COLUMN rechnungen.open_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rechnungen.open_amount IS 'Was noch offen ist. Negativ heisst ueberzahlt.';


--
-- Name: sales_stage_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_stage_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    from_stage text,
    to_stage text NOT NULL,
    changed_by uuid,
    source text DEFAULT 'manual'::text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_stage_history_distinct CHECK ((from_stage IS DISTINCT FROM to_stage)),
    CONSTRAINT sales_stage_history_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'trigger'::text])))
);


--
-- Name: service_acquisition_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_acquisition_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_type text NOT NULL,
    service_label text NOT NULL,
    google_ads_cpc_chf numeric DEFAULT 20 NOT NULL,
    conversion_rate numeric DEFAULT 0.05 NOT NULL,
    organic_lead_ratio numeric DEFAULT 0.3 NOT NULL,
    min_profit_margin numeric DEFAULT 1.3 NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exclusivity_1_mult numeric DEFAULT 2.5,
    exclusivity_3_mult numeric DEFAULT 1.5,
    exclusivity_5_mult numeric DEFAULT 1.0,
    max_size_mult numeric DEFAULT 1.6
);


--
-- Name: TABLE service_acquisition_costs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.service_acquisition_costs IS 'Google Ads CPC and conversion data for calculating profitable lead prices';


--
-- Name: COLUMN service_acquisition_costs.google_ads_cpc_chf; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_acquisition_costs.google_ads_cpc_chf IS 'Google Ads Cost Per Click - Basis für Token-Preis';


--
-- Name: COLUMN service_acquisition_costs.exclusivity_1_mult; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_acquisition_costs.exclusivity_1_mult IS 'Multiplikator für Exklusiv (1 Firma)';


--
-- Name: COLUMN service_acquisition_costs.exclusivity_3_mult; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_acquisition_costs.exclusivity_3_mult IS 'Multiplikator für Standard (3 Firmen)';


--
-- Name: COLUMN service_acquisition_costs.exclusivity_5_mult; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_acquisition_costs.exclusivity_5_mult IS 'Multiplikator für Shared (5 Firmen)';


--
-- Name: COLUMN service_acquisition_costs.max_size_mult; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_acquisition_costs.max_size_mult IS 'Maximaler Größen-Multiplikator für große Jobs';


--
-- Name: service_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_type character varying(100) NOT NULL,
    name_de character varying(255) NOT NULL,
    name_fr character varying(255),
    name_en character varying(255),
    description_de text,
    category character varying(100),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE service_catalog; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.service_catalog IS 'Centralized service catalog - used for both company settings and lead matching';


--
-- Name: service_detail_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_detail_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_type character varying(100) NOT NULL,
    template_key character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    default_details jsonb DEFAULT '{}'::jsonb,
    default_resources jsonb DEFAULT '{}'::jsonb,
    default_highlighted_items text[],
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    kind text DEFAULT 'object'::text NOT NULL,
    label text,
    address_raw text NOT NULL,
    street text,
    house_number text,
    plz text,
    city text,
    floor text,
    has_elevator boolean,
    parking_note text,
    access_note text,
    rooms numeric(4,1),
    area_m2 numeric(8,2),
    notes text,
    created_via text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_locations_adresse_da CHECK ((length(TRIM(BOTH FROM address_raw)) > 0)),
    CONSTRAINT service_locations_created_via_check CHECK ((created_via = ANY (ARRAY['manual'::text, 'backfill'::text, 'portal'::text]))),
    CONSTRAINT service_locations_kind_check CHECK ((kind = ANY (ARRAY['from'::text, 'to'::text, 'object'::text, 'storage'::text])))
);


--
-- Name: TABLE service_locations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.service_locations IS 'Kanonische Orte je Kunde. address_raw bleibt unzerlegt — geraten waere schlimmer als roh. Die strukturierten Felder daneben sind alle optional.';


--
-- Name: COLUMN service_locations.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_locations.kind IS 'Die beim Anlegen beobachtete Rolle. Nicht bindend: eine Auszugsadresse kann beim naechsten Mal die Einzugsadresse sein.';


--
-- Name: shared_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_type text NOT NULL,
    component_key text NOT NULL,
    title text,
    content jsonb NOT NULL,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscription_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'CHF'::text,
    payment_method text,
    payment_reference text,
    subscription_months integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'pending'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    confirmed_at timestamp with time zone,
    confirmed_by uuid,
    invoice_number text,
    invoice_sent_at timestamp with time zone,
    CONSTRAINT subscription_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['invoice'::text, 'bank_transfer'::text, 'twint'::text, 'stripe'::text, 'paypal'::text, 'other'::text]))),
    CONSTRAINT subscription_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'failed'::text, 'refunded'::text, 'cancelled'::text])))
);


--
-- Name: TABLE subscription_payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_payments IS 'Tracks CRM subscription payments';


--
-- Name: subscription_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    reminder_type text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    email_sent_to text,
    success boolean DEFAULT true,
    error_message text,
    CONSTRAINT subscription_reminders_reminder_type_check CHECK ((reminder_type = ANY (ARRAY['expiry_30_days'::text, 'expiry_14_days'::text, 'expiry_7_days'::text, 'expiry_3_days'::text, 'expiry_1_day'::text, 'expired'::text, 'deactivated'::text])))
);


--
-- Name: TABLE subscription_reminders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_reminders IS 'Logs subscription expiry reminder emails';


--
-- Name: support_ticket_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    sender_id uuid,
    sender_type text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_internal boolean DEFAULT false,
    CONSTRAINT support_ticket_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['company'::text, 'admin'::text])))
);


--
-- Name: TABLE support_ticket_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.support_ticket_messages IS 'Messages/replies in support tickets';


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    user_id uuid,
    subject text NOT NULL,
    message text NOT NULL,
    category public.support_ticket_category DEFAULT 'general'::public.support_ticket_category,
    priority public.support_ticket_priority DEFAULT 'medium'::public.support_ticket_priority,
    status public.support_ticket_status DEFAULT 'open'::public.support_ticket_status,
    contact_name text,
    contact_email text,
    contact_phone text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    first_response_at timestamp with time zone,
    resolved_at timestamp with time zone,
    assigned_to uuid,
    browser_info text,
    page_url text
);


--
-- Name: TABLE support_tickets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.support_tickets IS 'Support tickets from companies to admin';


--
-- Name: swiss_plz; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swiss_plz (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plz character varying(10) NOT NULL,
    city character varying(255) NOT NULL,
    canton character varying(2),
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: team_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_member_id uuid NOT NULL,
    day_of_week integer,
    start_time time without time zone,
    end_time time without time zone,
    specific_date date,
    is_available boolean DEFAULT true,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: umzug_anfrage_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.umzug_anfrage_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: umzug_anfragen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.umzug_anfragen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anfrage_nummer text,
    service_type text DEFAULT 'umzug'::text NOT NULL,
    from_property_type text,
    from_rooms numeric(3,1),
    from_floors integer DEFAULT 1,
    from_living_space_m2 integer,
    from_country text DEFAULT 'CH'::text,
    from_street text,
    from_house_number text,
    from_plz text,
    from_city text,
    from_canton text,
    from_floor text,
    from_has_lift boolean DEFAULT false,
    from_lift_type text,
    from_lift_capacity_persons integer,
    from_lift_capacity_kg integer,
    from_lift_width_cm integer,
    from_lift_depth_cm integer,
    from_lift_height_cm integer,
    from_distance_to_parking integer DEFAULT 0,
    from_steps_to_entrance text,
    from_path_obstruction boolean DEFAULT false,
    from_path_obstruction_details text,
    from_extras jsonb DEFAULT '{}'::jsonb,
    to_property_type text,
    to_rooms numeric(3,1),
    to_floors integer DEFAULT 1,
    to_living_space_m2 integer,
    to_country text DEFAULT 'CH'::text,
    to_street text,
    to_house_number text,
    to_plz text,
    to_city text,
    to_canton text,
    to_floor text,
    to_has_lift boolean DEFAULT false,
    to_lift_type text,
    to_lift_capacity_persons integer,
    to_lift_capacity_kg integer,
    to_lift_width_cm integer,
    to_lift_depth_cm integer,
    to_lift_height_cm integer,
    to_distance_to_parking integer DEFAULT 0,
    to_steps_to_entrance text,
    to_path_obstruction boolean DEFAULT false,
    to_path_obstruction_details text,
    to_extras jsonb DEFAULT '{}'::jsonb,
    moving_date date,
    moving_flexibility text,
    moving_start_time text,
    inventory_items jsonb DEFAULT '[]'::jsonb,
    estimated_boxes integer DEFAULT 0,
    heavy_items jsonb DEFAULT '[]'::jsonb,
    additional_services_umzug jsonb DEFAULT '{}'::jsonb,
    customer_salutation text,
    customer_first_name text NOT NULL,
    customer_last_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    customer_contact_time text,
    customer_remarks text,
    estimated_duration_hours numeric(4,1),
    estimated_price_chf numeric(10,2),
    distance_km numeric(6,1),
    status text DEFAULT 'pending'::text,
    form_version integer DEFAULT 2,
    max_companies integer DEFAULT 3,
    token_cost numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT umzug_anfragen_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'pending_verification'::text, 'verified'::text, 'in_progress'::text, 'offers_sent'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE umzug_anfragen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.umzug_anfragen IS 'Detailed Umzug (Moving) inquiries from the multi-step wizard form';


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: virtual_besichtigung_sessions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.virtual_besichtigung_sessions WITH (security_invoker='on') AS
 SELECT sessions.id,
    sessions.token,
    sessions.company_id,
    sessions.lead_id,
    sessions.offer_id,
    sessions.customer_name,
    sessions.customer_email,
    sessions.customer_phone,
    sessions.from_address,
    sessions.from_plz,
    sessions.from_city,
    sessions.status,
    sessions.created_at,
    sessions.uploaded_at,
    sessions.analyzed_at,
    sessions.completed_at,
    sessions.expires_at,
    sessions.customer_notes,
    sessions.created_by,
    sessions.data_expires_at
   FROM besichtigung.sessions;


--
-- Name: VIEW virtual_besichtigung_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.virtual_besichtigung_sessions IS 'Oeffentliche Sicht auf besichtigung.sessions fuer die Firmenoberflaeche. security_invoker = on, damit die Policy is_company_member der Basistabelle greift.';


--
-- Name: website_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    setting_type text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT website_settings_setting_type_check CHECK ((setting_type = ANY (ARRAY['seo'::text, 'analytics'::text, 'google_ads'::text, 'social_ads'::text, 'cookie_consent'::text, 'general'::text])))
);


--
-- Name: admin_activity_log admin_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_pkey PRIMARY KEY (id);


--
-- Name: agb_sections agb_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agb_sections
    ADD CONSTRAINT agb_sections_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_company_id_key_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_company_id_key_name_key UNIQUE (company_id, key_name);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: appointment_history appointment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_history
    ADD CONSTRAINT appointment_history_pkey PRIMARY KEY (id);


--
-- Name: appointment_reminders appointment_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_reminders
    ADD CONSTRAINT appointment_reminders_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: archive_logs archive_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archive_logs
    ADD CONSTRAINT archive_logs_pkey PRIMARY KEY (id);


--
-- Name: archive_settings archive_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archive_settings
    ADD CONSTRAINT archive_settings_pkey PRIMARY KEY (id);


--
-- Name: archive_snapshots archive_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archive_snapshots
    ADD CONSTRAINT archive_snapshots_pkey PRIMARY KEY (id);


--
-- Name: auftraege auftraege_company_id_auftrag_nummer_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auftraege
    ADD CONSTRAINT auftraege_company_id_auftrag_nummer_key UNIQUE (company_id, auftrag_nummer);


--
-- Name: auftraege auftraege_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auftraege
    ADD CONSTRAINT auftraege_pkey PRIMARY KEY (id);


--
-- Name: automation_deliveries automation_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_deliveries
    ADD CONSTRAINT automation_deliveries_pkey PRIMARY KEY (id);


--
-- Name: automation_deliveries automation_deliveries_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_deliveries
    ADD CONSTRAINT automation_deliveries_uniq UNIQUE (rule_key, entity_type, entity_id, schedule_window);


--
-- Name: blog_categories blog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_pkey PRIMARY KEY (id);


--
-- Name: blog_categories blog_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_slug_key UNIQUE (slug);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: blog_seo_performance blog_seo_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_seo_performance
    ADD CONSTRAINT blog_seo_performance_pkey PRIMARY KEY (id);


--
-- Name: blog_seo_performance blog_seo_performance_post_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_seo_performance
    ADD CONSTRAINT blog_seo_performance_post_id_date_key UNIQUE (post_id, date);


--
-- Name: checklist_templates checklist_templates_company_id_service_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_company_id_service_type_key UNIQUE (company_id, service_type);


--
-- Name: checklist_templates checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: communication_messages communication_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_messages
    ADD CONSTRAINT communication_messages_pkey PRIMARY KEY (id);


--
-- Name: communication_threads communication_threads_id_company_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_threads
    ADD CONSTRAINT communication_threads_id_company_uniq UNIQUE (id, company_id);


--
-- Name: communication_threads communication_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_threads
    ADD CONSTRAINT communication_threads_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: companies companies_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_slug_key UNIQUE (slug);


--
-- Name: company_members company_members_company_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_company_id_user_id_key UNIQUE (company_id, user_id);


--
-- Name: company_members company_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_pkey PRIMARY KEY (id);


--
-- Name: company_offer_settings company_offer_settings_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_offer_settings
    ADD CONSTRAINT company_offer_settings_company_id_key UNIQUE (company_id);


--
-- Name: company_offer_settings company_offer_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_offer_settings
    ADD CONSTRAINT company_offer_settings_pkey PRIMARY KEY (id);


--
-- Name: company_offer_templates company_offer_templates_company_id_service_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_offer_templates
    ADD CONSTRAINT company_offer_templates_company_id_service_type_key UNIQUE (company_id, service_type);


--
-- Name: company_offer_templates company_offer_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_offer_templates
    ADD CONSTRAINT company_offer_templates_pkey PRIMARY KEY (id);


--
-- Name: company_plz_coverage company_plz_coverage_company_id_plz_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_plz_coverage
    ADD CONSTRAINT company_plz_coverage_company_id_plz_key UNIQUE (company_id, plz);


--
-- Name: company_plz_coverage company_plz_coverage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_plz_coverage
    ADD CONSTRAINT company_plz_coverage_pkey PRIMARY KEY (id);


--
-- Name: company_pricing_audit_log company_pricing_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_pricing_audit_log
    ADD CONSTRAINT company_pricing_audit_log_pkey PRIMARY KEY (id);


--
-- Name: company_pricing_configs company_pricing_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_pricing_configs
    ADD CONSTRAINT company_pricing_configs_pkey PRIMARY KEY (id);


--
-- Name: company_reminder_settings company_reminder_settings_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_reminder_settings
    ADD CONSTRAINT company_reminder_settings_company_id_key UNIQUE (company_id);


--
-- Name: company_reminder_settings company_reminder_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_reminder_settings
    ADD CONSTRAINT company_reminder_settings_pkey PRIMARY KEY (id);


--
-- Name: company_secrets company_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_secrets
    ADD CONSTRAINT company_secrets_pkey PRIMARY KEY (company_id);


--
-- Name: company_service_items company_service_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_service_items
    ADD CONSTRAINT company_service_items_pkey PRIMARY KEY (id);


--
-- Name: company_services company_services_company_id_service_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_services
    ADD CONSTRAINT company_services_company_id_service_type_key UNIQUE (company_id, service_type);


--
-- Name: company_services company_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_services
    ADD CONSTRAINT company_services_pkey PRIMARY KEY (id);


--
-- Name: cookie_consent_log cookie_consent_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cookie_consent_log
    ADD CONSTRAINT cookie_consent_log_pkey PRIMARY KEY (id);


--
-- Name: credit_notes credit_notes_gutschrift_nr_je_firma; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_gutschrift_nr_je_firma UNIQUE (company_id, gutschrift_nr);


--
-- Name: credit_notes credit_notes_id_company_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_id_company_uniq UNIQUE (id, company_id);


--
-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_pkey PRIMARY KEY (id);


--
-- Name: crm_tasks crm_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_pkey PRIMARY KEY (id);


--
-- Name: customer_case_events customer_case_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_case_events
    ADD CONSTRAINT customer_case_events_pkey PRIMARY KEY (id);


--
-- Name: customer_cases customer_cases_nr_je_firma; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_cases
    ADD CONSTRAINT customer_cases_nr_je_firma UNIQUE (company_id, case_number);


--
-- Name: customer_cases customer_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_cases
    ADD CONSTRAINT customer_cases_pkey PRIMARY KEY (id);


--
-- Name: customer_change_requests customer_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_change_requests
    ADD CONSTRAINT customer_change_requests_pkey PRIMARY KEY (id);


--
-- Name: customer_merges customer_merges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_merges
    ADD CONSTRAINT customer_merges_pkey PRIMARY KEY (id);


--
-- Name: customers customers_id_company_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_id_company_uniq UNIQUE (id, company_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: edge_rate_limits edge_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edge_rate_limits
    ADD CONSTRAINT edge_rate_limits_pkey PRIMARY KEY (key);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: fall_nr_counter fall_nr_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fall_nr_counter
    ADD CONSTRAINT fall_nr_counter_pkey PRIMARY KEY (company_id, jahr);


--
-- Name: firma_resources firma_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firma_resources
    ADD CONSTRAINT firma_resources_pkey PRIMARY KEY (id);


--
-- Name: gutschrift_nr_counter gutschrift_nr_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gutschrift_nr_counter
    ADD CONSTRAINT gutschrift_nr_counter_pkey PRIMARY KEY (company_id, jahr);


--
-- Name: inbound_emails inbound_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_emails
    ADD CONSTRAINT inbound_emails_pkey PRIMARY KEY (id);


--
-- Name: inbound_emails inbound_emails_provider_message_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_emails
    ADD CONSTRAINT inbound_emails_provider_message_key UNIQUE (provider, provider_message_id);


--
-- Name: invoice_reminders invoice_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_reminders
    ADD CONSTRAINT invoice_reminders_pkey PRIMARY KEY (id);


--
-- Name: invoice_reminders invoice_reminders_stufe_einmal; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_reminders
    ADD CONSTRAINT invoice_reminders_stufe_einmal UNIQUE (rechnung_id, level);


--
-- Name: ip_blacklist ip_blacklist_ip_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_ip_address_key UNIQUE (ip_address);


--
-- Name: ip_blacklist ip_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_pkey PRIMARY KEY (id);


--
-- Name: job_price_estimates job_price_estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_price_estimates
    ADD CONSTRAINT job_price_estimates_pkey PRIMARY KEY (id);


--
-- Name: klaviertransport_anfragen klaviertransport_anfragen_anfrage_nummer_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.klaviertransport_anfragen
    ADD CONSTRAINT klaviertransport_anfragen_anfrage_nummer_key UNIQUE (anfrage_nummer);


--
-- Name: klaviertransport_anfragen klaviertransport_anfragen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.klaviertransport_anfragen
    ADD CONSTRAINT klaviertransport_anfragen_pkey PRIMARY KEY (id);


--
-- Name: landing_page_analytics landing_page_analytics_landing_page_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_page_analytics
    ADD CONSTRAINT landing_page_analytics_landing_page_id_date_key UNIQUE (landing_page_id, date);


--
-- Name: landing_page_analytics landing_page_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_page_analytics
    ADD CONSTRAINT landing_page_analytics_pkey PRIMARY KEY (id);


--
-- Name: landing_pages landing_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_pages
    ADD CONSTRAINT landing_pages_pkey PRIMARY KEY (id);


--
-- Name: landing_pages landing_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_pages
    ADD CONSTRAINT landing_pages_slug_key UNIQUE (slug);


--
-- Name: lead_confirmations lead_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_confirmations
    ADD CONSTRAINT lead_confirmations_pkey PRIMARY KEY (id);


--
-- Name: lead_confirmations lead_confirmations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_confirmations
    ADD CONSTRAINT lead_confirmations_token_key UNIQUE (token);


--
-- Name: lead_forms lead_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_forms
    ADD CONSTRAINT lead_forms_pkey PRIMARY KEY (id);


--
-- Name: lead_forms lead_forms_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_forms
    ADD CONSTRAINT lead_forms_slug_key UNIQUE (slug);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: leads leads_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_slug_key UNIQUE (slug);


--
-- Name: leistungsuebersicht_templates leistungsuebersicht_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leistungsuebersicht_templates
    ADD CONSTRAINT leistungsuebersicht_templates_pkey PRIMARY KEY (id);


--
-- Name: manual_imported_leads manual_imported_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_imported_leads
    ADD CONSTRAINT manual_imported_leads_pkey PRIMARY KEY (id);


--
-- Name: moebellift_anfragen moebellift_anfragen_anfrage_nummer_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moebellift_anfragen
    ADD CONSTRAINT moebellift_anfragen_anfrage_nummer_key UNIQUE (anfrage_nummer);


--
-- Name: moebellift_anfragen moebellift_anfragen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moebellift_anfragen
    ADD CONSTRAINT moebellift_anfragen_pkey PRIMARY KEY (id);


--
-- Name: moving_calculation_presets moving_calculation_presets_company_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moving_calculation_presets
    ADD CONSTRAINT moving_calculation_presets_company_id_name_key UNIQUE (company_id, name);


--
-- Name: moving_calculation_presets moving_calculation_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moving_calculation_presets
    ADD CONSTRAINT moving_calculation_presets_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offer_amendment_items offer_amendment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_amendment_items
    ADD CONSTRAINT offer_amendment_items_pkey PRIMARY KEY (id);


--
-- Name: offer_amendments offer_amendments_id_company_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_amendments
    ADD CONSTRAINT offer_amendments_id_company_uniq UNIQUE (id, company_id);


--
-- Name: offer_amendments offer_amendments_number_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_amendments
    ADD CONSTRAINT offer_amendments_number_uniq UNIQUE (offer_id, amendment_number);


--
-- Name: offer_amendments offer_amendments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_amendments
    ADD CONSTRAINT offer_amendments_pkey PRIMARY KEY (id);


--
-- Name: offer_amendments offer_amendments_token_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_amendments
    ADD CONSTRAINT offer_amendments_token_uniq UNIQUE (access_token);


--
-- Name: offer_inventory_items offer_inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_inventory_items
    ADD CONSTRAINT offer_inventory_items_pkey PRIMARY KEY (id);


--
-- Name: offer_item_area_meta offer_item_area_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_item_area_meta
    ADD CONSTRAINT offer_item_area_meta_pkey PRIMARY KEY (offer_item_id);


--
-- Name: offer_item_breakdown offer_item_breakdown_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_item_breakdown
    ADD CONSTRAINT offer_item_breakdown_pkey PRIMARY KEY (id);


--
-- Name: offer_item_effort_meta offer_item_effort_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_item_effort_meta
    ADD CONSTRAINT offer_item_effort_meta_pkey PRIMARY KEY (offer_item_id);


--
-- Name: offer_item_leistung offer_item_leistung_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_item_leistung
    ADD CONSTRAINT offer_item_leistung_pkey PRIMARY KEY (id);


--
-- Name: offer_item_volume_meta offer_item_volume_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_item_volume_meta
    ADD CONSTRAINT offer_item_volume_meta_pkey PRIMARY KEY (offer_item_id);


--
-- Name: offer_items offer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_items
    ADD CONSTRAINT offer_items_pkey PRIMARY KEY (id);


--
-- Name: offer_leistungsuebersicht offer_leistungsuebersicht_offer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_leistungsuebersicht
    ADD CONSTRAINT offer_leistungsuebersicht_offer_id_key UNIQUE (offer_id);


--
-- Name: offer_leistungsuebersicht offer_leistungsuebersicht_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_leistungsuebersicht
    ADD CONSTRAINT offer_leistungsuebersicht_pkey PRIMARY KEY (id);


--
-- Name: offers offers_access_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_access_token_key UNIQUE (access_token);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: payment_allocations payment_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_pkey PRIMARY KEY (id);


--
-- Name: payments payments_id_company_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_id_company_uniq UNIQUE (id, company_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: portal_magic_links portal_magic_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_magic_links
    ADD CONSTRAINT portal_magic_links_pkey PRIMARY KEY (id);


--
-- Name: portal_magic_links portal_magic_links_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_magic_links
    ADD CONSTRAINT portal_magic_links_token_hash_key UNIQUE (token_hash);


--
-- Name: portal_sessions portal_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_pkey PRIMARY KEY (id);


--
-- Name: portal_sessions portal_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: pricing_settings pricing_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_settings
    ADD CONSTRAINT pricing_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: quittungen quittungen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quittungen
    ADD CONSTRAINT quittungen_pkey PRIMARY KEY (id);


--
-- Name: quittungen quittungen_quittung_nr_je_firma; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quittungen
    ADD CONSTRAINT quittungen_quittung_nr_je_firma UNIQUE (company_id, quittung_nr);


--
-- Name: raeumung_anfragen raeumung_anfragen_anfrage_nummer_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raeumung_anfragen
    ADD CONSTRAINT raeumung_anfragen_anfrage_nummer_key UNIQUE (anfrage_nummer);


--
-- Name: raeumung_anfragen raeumung_anfragen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raeumung_anfragen
    ADD CONSTRAINT raeumung_anfragen_pkey PRIMARY KEY (id);


--
-- Name: rechnung_nr_counter rechnung_nr_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnung_nr_counter
    ADD CONSTRAINT rechnung_nr_counter_pkey PRIMARY KEY (company_id, jahr);


--
-- Name: rechnungen rechnungen_auftrag_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_auftrag_id_key UNIQUE (auftrag_id);


--
-- Name: rechnungen rechnungen_id_company_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_id_company_uniq UNIQUE (id, company_id);


--
-- Name: rechnungen rechnungen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_pkey PRIMARY KEY (id);


--
-- Name: rechnungen rechnungen_rechnung_nr_je_firma; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_rechnung_nr_je_firma UNIQUE (company_id, rechnung_nr);


--
-- Name: CONSTRAINT rechnungen_rechnung_nr_je_firma ON rechnungen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT rechnungen_rechnung_nr_je_firma ON public.rechnungen IS 'Je Firma eindeutig — so, wie rechnung_nr_counter (company_id, jahr) zaehlt. Weltweit eindeutig war es, solange es eine Firma gab.';


--
-- Name: sales_stage_history sales_stage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_stage_history
    ADD CONSTRAINT sales_stage_history_pkey PRIMARY KEY (id);


--
-- Name: service_acquisition_costs service_acquisition_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_acquisition_costs
    ADD CONSTRAINT service_acquisition_costs_pkey PRIMARY KEY (id);


--
-- Name: service_acquisition_costs service_acquisition_costs_service_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_acquisition_costs
    ADD CONSTRAINT service_acquisition_costs_service_type_key UNIQUE (service_type);


--
-- Name: service_catalog service_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_catalog
    ADD CONSTRAINT service_catalog_pkey PRIMARY KEY (id);


--
-- Name: service_catalog service_catalog_service_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_catalog
    ADD CONSTRAINT service_catalog_service_type_key UNIQUE (service_type);


--
-- Name: service_detail_templates service_detail_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_detail_templates
    ADD CONSTRAINT service_detail_templates_pkey PRIMARY KEY (id);


--
-- Name: service_detail_templates service_detail_templates_service_type_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_detail_templates
    ADD CONSTRAINT service_detail_templates_service_type_template_key_key UNIQUE (service_type, template_key);


--
-- Name: service_locations service_locations_id_company_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_locations
    ADD CONSTRAINT service_locations_id_company_uniq UNIQUE (id, company_id);


--
-- Name: service_locations service_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_locations
    ADD CONSTRAINT service_locations_pkey PRIMARY KEY (id);


--
-- Name: shared_content shared_content_component_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_content
    ADD CONSTRAINT shared_content_component_key_key UNIQUE (component_key);


--
-- Name: shared_content shared_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_content
    ADD CONSTRAINT shared_content_pkey PRIMARY KEY (id);


--
-- Name: subscription_payments subscription_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_pkey PRIMARY KEY (id);


--
-- Name: subscription_reminders subscription_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_reminders
    ADD CONSTRAINT subscription_reminders_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_messages support_ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: swiss_plz swiss_plz_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swiss_plz
    ADD CONSTRAINT swiss_plz_pkey PRIMARY KEY (id);


--
-- Name: team_availability team_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_availability
    ADD CONSTRAINT team_availability_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: umzug_anfragen umzug_anfragen_anfrage_nummer_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzug_anfragen
    ADD CONSTRAINT umzug_anfragen_anfrage_nummer_key UNIQUE (anfrage_nummer);


--
-- Name: umzug_anfragen umzug_anfragen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzug_anfragen
    ADD CONSTRAINT umzug_anfragen_pkey PRIMARY KEY (id);


--
-- Name: umzugsbox_rentals umzugsbox_rentals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzugsbox_rentals
    ADD CONSTRAINT umzugsbox_rentals_pkey PRIMARY KEY (id);


--
-- Name: company_plz_coverage unique_company_plz; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_plz_coverage
    ADD CONSTRAINT unique_company_plz UNIQUE (company_id, plz);


--
-- Name: company_services unique_company_service; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_services
    ADD CONSTRAINT unique_company_service UNIQUE (company_id, service_type);


--
-- Name: subscription_payments uq_subscription_payment_reference; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT uq_subscription_payment_reference UNIQUE (payment_reference);


--
-- Name: CONSTRAINT uq_subscription_payment_reference ON subscription_payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT uq_subscription_payment_reference ON public.subscription_payments IS 'Stripe webhook retry idempotency: aynı payment_reference iki kez işlenemez.';


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: website_settings website_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_settings
    ADD CONSTRAINT website_settings_pkey PRIMARY KEY (id);


--
-- Name: website_settings website_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_settings
    ADD CONSTRAINT website_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: auftraege_appointment_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auftraege_appointment_id_unique ON public.auftraege USING btree (appointment_id) WHERE ((appointment_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: auftraege_offer_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auftraege_offer_id_unique ON public.auftraege USING btree (offer_id) WHERE ((offer_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: INDEX auftraege_offer_id_unique; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.auftraege_offer_id_unique IS 'Bir offer en fazla bir AKTİF auftrag ile ilişkilendirilebilir. Partial index: NULL offer_id (manuel) ve soft-delete edilmiş (deleted_at) satırlar hariç.';


--
-- Name: customers_company_email_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_company_email_uniq ON public.customers USING btree (company_id, email_normalized) WHERE ((email_normalized IS NOT NULL) AND (merged_into_customer_id IS NULL));


--
-- Name: idx_admin_activity_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_activity_log_action ON public.admin_activity_log USING btree (action);


--
-- Name: idx_admin_activity_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_activity_log_created_at ON public.admin_activity_log USING btree (created_at DESC);


--
-- Name: idx_admin_activity_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_activity_log_user_id ON public.admin_activity_log USING btree (user_id);


--
-- Name: idx_agb_sections_company_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agb_sections_company_service ON public.agb_sections USING btree (company_id, service_type);


--
-- Name: idx_api_keys_company_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_company_name ON public.api_keys USING btree (company_id, key_name);


--
-- Name: idx_appointments_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_company ON public.appointments USING btree (company_id);


--
-- Name: idx_appointments_company_date_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_company_date_status ON public.appointments USING btree (company_id, appointment_date, status);


--
-- Name: idx_appointments_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_company_status ON public.appointments USING btree (company_id, status);


--
-- Name: idx_appointments_company_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_company_type_status ON public.appointments USING btree (company_id, appointment_type, status);


--
-- Name: idx_appointments_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_customer ON public.appointments USING btree (customer_id, appointment_date DESC) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_date ON public.appointments USING btree (appointment_date);


--
-- Name: idx_appointments_datetime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_datetime ON public.appointments USING btree (appointment_date, start_time);


--
-- Name: idx_appointments_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_lead ON public.appointments USING btree (lead_id);


--
-- Name: idx_appointments_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_location ON public.appointments USING btree (location_id) WHERE (location_id IS NOT NULL);


--
-- Name: idx_appointments_offer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_offer ON public.appointments USING btree (offer_id);


--
-- Name: idx_appointments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_parent ON public.appointments USING btree (parent_appointment_id) WHERE (parent_appointment_id IS NOT NULL);


--
-- Name: idx_appointments_recurring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_recurring ON public.appointments USING btree (is_recurring) WHERE (is_recurring = true);


--
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);


--
-- Name: idx_appointments_team_reminder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_team_reminder ON public.appointments USING btree (appointment_date, status, reminder_sent_team) WHERE (reminder_sent_team = false);


--
-- Name: idx_appointments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_type ON public.appointments USING btree (appointment_type);


--
-- Name: idx_archive_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_logs_created ON public.archive_logs USING btree (created_at DESC);


--
-- Name: idx_archive_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_logs_status ON public.archive_logs USING btree (status);


--
-- Name: idx_archive_logs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_logs_type ON public.archive_logs USING btree (archive_type);


--
-- Name: idx_archive_snapshots_log; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_snapshots_log ON public.archive_snapshots USING btree (archive_log_id);


--
-- Name: idx_auftraege_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_active ON public.auftraege USING btree (company_id, scheduled_date) WHERE (deleted_at IS NULL);


--
-- Name: idx_auftraege_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_company_id ON public.auftraege USING btree (company_id);


--
-- Name: idx_auftraege_company_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_company_status_date ON public.auftraege USING btree (company_id, status, scheduled_date);


--
-- Name: idx_auftraege_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_customer ON public.auftraege USING btree (customer_id, created_at DESC) WHERE ((customer_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_auftraege_from_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_from_location ON public.auftraege USING btree (from_location_id) WHERE (from_location_id IS NOT NULL);


--
-- Name: idx_auftraege_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_offer_id ON public.auftraege USING btree (offer_id);


--
-- Name: idx_auftraege_reminder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_reminder ON public.auftraege USING btree (scheduled_date, team_reminder_sent) WHERE ((status = 'geplant'::public.auftrag_status) AND (team_leader_id IS NOT NULL));


--
-- Name: idx_auftraege_scheduled_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_scheduled_date ON public.auftraege USING btree (scheduled_date);


--
-- Name: idx_auftraege_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_status ON public.auftraege USING btree (status);


--
-- Name: idx_auftraege_team_leader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_team_leader ON public.auftraege USING btree (team_leader_id);


--
-- Name: idx_auftraege_to_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auftraege_to_location ON public.auftraege USING btree (to_location_id) WHERE (to_location_id IS NOT NULL);


--
-- Name: idx_automation_deliveries_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_deliveries_company ON public.automation_deliveries USING btree (company_id, delivered_at DESC);


--
-- Name: idx_case_events_fall; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_events_fall ON public.customer_case_events USING btree (case_id, created_at);


--
-- Name: idx_change_requests_ein_offener_je_feld; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_change_requests_ein_offener_je_feld ON public.customer_change_requests USING btree (customer_id, feld) WHERE (status = 'offen'::text);


--
-- Name: idx_change_requests_offen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_requests_offen ON public.customer_change_requests USING btree (company_id, created_at DESC) WHERE (status = 'offen'::text);


--
-- Name: idx_checklist_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_company ON public.checklist_templates USING btree (company_id);


--
-- Name: idx_checklist_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_service ON public.checklist_templates USING btree (service_type);


--
-- Name: idx_comm_messages_faden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_messages_faden ON public.communication_messages USING btree (thread_id, occurred_at);


--
-- Name: idx_comm_messages_quelle; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_comm_messages_quelle ON public.communication_messages USING btree (source_table, source_id) WHERE (source_id IS NOT NULL);


--
-- Name: idx_comm_threads_kunde; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_threads_kunde ON public.communication_threads USING btree (customer_id, last_message_at DESC);


--
-- Name: idx_comm_threads_offen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_threads_offen ON public.communication_threads USING btree (company_id, first_unanswered_at) WHERE (status <> 'erledigt'::text);


--
-- Name: idx_companies_crm_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_companies_crm_enabled ON public.companies USING btree (crm_enabled);


--
-- Name: idx_companies_user_id_null; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_companies_user_id_null ON public.companies USING btree (id) WHERE (user_id IS NULL);


--
-- Name: idx_company_members_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_members_company_id ON public.company_members USING btree (company_id);


--
-- Name: idx_company_members_company_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_members_company_user ON public.company_members USING btree (company_id, user_id);


--
-- Name: idx_company_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_members_user_id ON public.company_members USING btree (user_id);


--
-- Name: idx_company_plz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_plz ON public.company_plz_coverage USING btree (plz);


--
-- Name: idx_company_pricing_configs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_company_pricing_configs_active ON public.company_pricing_configs USING btree (company_id) WHERE (is_active = true);


--
-- Name: idx_company_pricing_configs_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_pricing_configs_company_id ON public.company_pricing_configs USING btree (company_id);


--
-- Name: idx_company_service_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_service_items_category ON public.company_service_items USING btree (category);


--
-- Name: idx_company_service_items_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_service_items_company ON public.company_service_items USING btree (company_id);


--
-- Name: idx_company_service_items_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_service_items_type ON public.company_service_items USING btree (service_type);


--
-- Name: idx_cookie_consent_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cookie_consent_timestamp ON public.cookie_consent_log USING btree (consent_timestamp);


--
-- Name: idx_cookie_consent_visitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cookie_consent_visitor ON public.cookie_consent_log USING btree (visitor_id);


--
-- Name: idx_credit_notes_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_notes_company ON public.credit_notes USING btree (company_id, datum DESC);


--
-- Name: idx_credit_notes_rechnung; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_notes_rechnung ON public.credit_notes USING btree (rechnung_id);


--
-- Name: idx_crm_tasks_kunde; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_tasks_kunde ON public.crm_tasks USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_crm_tasks_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_tasks_lead ON public.crm_tasks USING btree (lead_id) WHERE (lead_id IS NOT NULL);


--
-- Name: idx_crm_tasks_offen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_tasks_offen ON public.crm_tasks USING btree (company_id, due_at) WHERE (status = 'open'::text);


--
-- Name: idx_customer_cases_auftrag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_cases_auftrag ON public.customer_cases USING btree (auftrag_id) WHERE (auftrag_id IS NOT NULL);


--
-- Name: idx_customer_cases_kunde; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_cases_kunde ON public.customer_cases USING btree (customer_id, reported_at DESC);


--
-- Name: idx_customer_cases_offen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_cases_offen ON public.customer_cases USING btree (company_id, due_at) WHERE (status <> ALL (ARRAY['geloest'::text, 'abgelehnt'::text]));


--
-- Name: idx_customer_merges_company_merged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_merges_company_merged ON public.customer_merges USING btree (company_id, merged_at DESC);


--
-- Name: idx_customer_merges_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_merges_source ON public.customer_merges USING btree (source_customer_id);


--
-- Name: idx_customers_company_duplicates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_company_duplicates ON public.customers USING btree (company_id, created_at DESC) WHERE (possible_duplicate AND (merged_into_customer_id IS NULL));


--
-- Name: idx_customers_company_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_company_phone ON public.customers USING btree (company_id, phone_normalized) WHERE ((phone_normalized IS NOT NULL) AND (merged_into_customer_id IS NULL));


--
-- Name: idx_customers_company_status_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_company_status_name ON public.customers USING btree (company_id, status, display_name);


--
-- Name: idx_customers_merged_into; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_merged_into ON public.customers USING btree (merged_into_customer_id) WHERE (merged_into_customer_id IS NOT NULL);


--
-- Name: idx_email_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_created_at ON public.email_logs USING btree (created_at DESC);


--
-- Name: idx_email_logs_email_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_email_type ON public.email_logs USING btree (email_type);


--
-- Name: idx_email_logs_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_recipient ON public.email_logs USING btree (recipient_email);


--
-- Name: idx_history_appointment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_history_appointment ON public.appointment_history USING btree (appointment_id);


--
-- Name: idx_inbound_emails_company_status_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_company_status_received ON public.inbound_emails USING btree (company_id, processing_status, received_at DESC);


--
-- Name: idx_inbound_emails_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_customer ON public.inbound_emails USING btree (customer_id, received_at DESC) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_inbound_emails_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_lead ON public.inbound_emails USING btree (lead_id) WHERE (lead_id IS NOT NULL);


--
-- Name: idx_inbound_emails_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_status_created ON public.inbound_emails USING btree (processing_status, created_at);


--
-- Name: idx_inbound_emails_unopened; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_unopened ON public.inbound_emails USING btree (company_id, processing_status) WHERE (opened_at IS NULL);


--
-- Name: idx_invoice_reminders_rechnung; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_reminders_rechnung ON public.invoice_reminders USING btree (rechnung_id, level);


--
-- Name: idx_ip_blacklist_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ip_blacklist_ip ON public.ip_blacklist USING btree (ip_address);


--
-- Name: idx_job_price_estimates_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_price_estimates_service ON public.job_price_estimates USING btree (service_type);


--
-- Name: idx_klavier_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_klavier_created ON public.klaviertransport_anfragen USING btree (created_at DESC);


--
-- Name: idx_klavier_instrument; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_klavier_instrument ON public.klaviertransport_anfragen USING btree (instrument_type);


--
-- Name: idx_klavier_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_klavier_service ON public.klaviertransport_anfragen USING btree (service_type);


--
-- Name: idx_klavier_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_klavier_status ON public.klaviertransport_anfragen USING btree (status);


--
-- Name: idx_landing_page_analytics_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_page_analytics_date ON public.landing_page_analytics USING btree (date);


--
-- Name: idx_landing_page_analytics_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_page_analytics_page ON public.landing_page_analytics USING btree (landing_page_id);


--
-- Name: idx_landing_pages_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_pages_published ON public.landing_pages USING btree (is_published);


--
-- Name: idx_landing_pages_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_pages_service ON public.landing_pages USING btree (service_type);


--
-- Name: idx_landing_pages_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_pages_slug ON public.landing_pages USING btree (slug);


--
-- Name: idx_lead_confirmations_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_confirmations_expires_at ON public.lead_confirmations USING btree (expires_at) WHERE (confirmed_at IS NULL);


--
-- Name: idx_lead_confirmations_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_confirmations_lead_id ON public.lead_confirmations USING btree (lead_id);


--
-- Name: idx_leads_ai_quality_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_ai_quality_score ON public.leads USING btree (ai_quality_score) WHERE (ai_quality_score IS NOT NULL);


--
-- Name: idx_leads_ai_validated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_ai_validated_at ON public.leads USING btree (ai_validated_at DESC) WHERE (ai_validated_at IS NOT NULL);


--
-- Name: idx_leads_ai_voice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_ai_voice ON public.leads USING btree (source) WHERE ((source)::text = 'ai_voice'::text);


--
-- Name: idx_leads_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_company_id ON public.leads USING btree (company_id);


--
-- Name: idx_leads_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created ON public.leads USING btree (created_at DESC);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at DESC);


--
-- Name: idx_leads_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_customer ON public.leads USING btree (customer_id, created_at DESC) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_leads_customer_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_customer_email ON public.leads USING btree (lower((customer_email)::text));


--
-- Name: idx_leads_form_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_form_version ON public.leads USING btree (form_version);


--
-- Name: idx_leads_ip_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_ip_address ON public.leads USING btree (ip_address);


--
-- Name: idx_leads_moving_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_moving_date ON public.leads USING btree (moving_date);


--
-- Name: idx_leads_next_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_next_action ON public.leads USING btree (company_id, next_action_at) WHERE ((next_action_at IS NOT NULL) AND (sales_stage <> ALL (ARRAY['won'::text, 'lost'::text])));


--
-- Name: idx_leads_plz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_plz ON public.leads USING btree (from_plz);


--
-- Name: idx_leads_property_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_property_type ON public.leads USING btree (property_type);


--
-- Name: idx_leads_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_service ON public.leads USING btree (service_type);


--
-- Name: idx_leads_service_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_service_type ON public.leads USING btree (service_type);


--
-- Name: idx_leads_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_source ON public.leads USING btree (source);


--
-- Name: idx_leads_source_form_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_source_form_id ON public.leads USING btree (source_form_id);


--
-- Name: idx_leads_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_stage ON public.leads USING btree (company_id, sales_stage, created_at DESC);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_leads_status_service_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status_service_type ON public.leads USING btree (status, service_type);


--
-- Name: INDEX idx_leads_status_service_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_leads_status_service_type IS 'Admin dashboard: WHERE status = X AND service_type = Y sorgularını optimize eder.';


--
-- Name: idx_leads_to_plz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_to_plz ON public.leads USING btree (to_plz);


--
-- Name: idx_leistung_templates_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leistung_templates_company ON public.leistungsuebersicht_templates USING btree (company_id);


--
-- Name: idx_manual_imported_leads_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manual_imported_leads_company ON public.manual_imported_leads USING btree (company_id);


--
-- Name: idx_moebellift_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moebellift_created ON public.moebellift_anfragen USING btree (created_at DESC);


--
-- Name: idx_moebellift_datum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moebellift_datum ON public.moebellift_anfragen USING btree (wunschdatum);


--
-- Name: idx_moebellift_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moebellift_service ON public.moebellift_anfragen USING btree (service_type);


--
-- Name: idx_moebellift_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moebellift_status ON public.moebellift_anfragen USING btree (status);


--
-- Name: idx_moebellift_zweck; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moebellift_zweck ON public.moebellift_anfragen USING btree (zweck);


--
-- Name: idx_moving_presets_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moving_presets_company ON public.moving_calculation_presets USING btree (company_id);


--
-- Name: idx_notifications_company_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_company_type ON public.notifications USING btree (company_id, type);


--
-- Name: INDEX idx_notifications_company_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_notifications_company_type IS 'Optimizes dashboard besichtigung requests query';


--
-- Name: idx_notifications_company_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_company_type_created ON public.notifications USING btree (company_id, type, created_at DESC);


--
-- Name: idx_offer_amendment_items_amendment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_amendment_items_amendment ON public.offer_amendment_items USING btree (amendment_id, "position");


--
-- Name: idx_offer_amendments_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_amendments_company_status ON public.offer_amendments USING btree (company_id, status, created_at DESC);


--
-- Name: idx_offer_amendments_offer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_amendments_offer ON public.offer_amendments USING btree (offer_id, amendment_number);


--
-- Name: idx_offer_inventory_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_inventory_items_category ON public.offer_inventory_items USING btree (offer_id, category_id);


--
-- Name: idx_offer_inventory_items_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_inventory_items_offer_id ON public.offer_inventory_items USING btree (offer_id);


--
-- Name: idx_offer_item_breakdown_offer_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_item_breakdown_offer_item_id ON public.offer_item_breakdown USING btree (offer_item_id);


--
-- Name: idx_offer_item_leistung_offer_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_item_leistung_offer_item_id ON public.offer_item_leistung USING btree (offer_item_id);


--
-- Name: idx_offer_items_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_items_offer_id ON public.offer_items USING btree (offer_id);


--
-- Name: idx_offer_leistung; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_leistung ON public.offer_leistungsuebersicht USING btree (offer_id);


--
-- Name: idx_offer_settings_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_settings_company ON public.company_offer_settings USING btree (company_id);


--
-- Name: idx_offers_access_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_access_token ON public.offers USING btree (access_token);


--
-- Name: idx_offers_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_company_id ON public.offers USING btree (company_id);


--
-- Name: idx_offers_company_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_company_number ON public.offers USING btree (company_id, offer_number);


--
-- Name: idx_offers_company_status_rejected_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_company_status_rejected_at ON public.offers USING btree (company_id, status, rejected_at DESC NULLS LAST);


--
-- Name: INDEX idx_offers_company_status_rejected_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_offers_company_status_rejected_at IS 'Optimizes dashboard rejected offers query';


--
-- Name: idx_offers_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_customer ON public.offers USING btree (customer_id, created_at DESC) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_offers_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_lead_id ON public.offers USING btree (lead_id);


--
-- Name: idx_offers_series; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_series ON public.offers USING btree (offer_series_id, version_number DESC);


--
-- Name: idx_offers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_status ON public.offers USING btree (status);


--
-- Name: idx_payment_allocations_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_allocations_payment ON public.payment_allocations USING btree (payment_id);


--
-- Name: idx_payment_allocations_rechnung; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_allocations_rechnung ON public.payment_allocations USING btree (rechnung_id);


--
-- Name: idx_payments_company_datum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_company_datum ON public.payments USING btree (company_id, payment_date DESC);


--
-- Name: idx_payments_kunde; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_kunde ON public.payments USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_payments_offen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_offen ON public.payments USING btree (company_id) WHERE (reconciliation_status = 'unreconciled'::text);


--
-- Name: idx_payments_storno_einmalig; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_payments_storno_einmalig ON public.payments USING btree (reverses_payment_id) WHERE (reverses_payment_id IS NOT NULL);


--
-- Name: idx_portal_magic_links_kunde; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portal_magic_links_kunde ON public.portal_magic_links USING btree (customer_id, created_at DESC);


--
-- Name: idx_portal_sessions_gueltig; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portal_sessions_gueltig ON public.portal_sessions USING btree (expires_at) WHERE (revoked_at IS NULL);


--
-- Name: idx_portal_sessions_kunde; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portal_sessions_kunde ON public.portal_sessions USING btree (customer_id, created_at DESC);


--
-- Name: idx_pricing_audit_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_audit_changed_at ON public.company_pricing_audit_log USING btree (changed_at DESC);


--
-- Name: idx_pricing_audit_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_audit_company_id ON public.company_pricing_audit_log USING btree (company_id);


--
-- Name: idx_pricing_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_rules_active ON public.pricing_rules USING btree (is_active);


--
-- Name: idx_quittungen_auftrag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quittungen_auftrag_id ON public.quittungen USING btree (auftrag_id) WHERE (auftrag_id IS NOT NULL);


--
-- Name: idx_quittungen_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quittungen_company_id ON public.quittungen USING btree (company_id);


--
-- Name: idx_quittungen_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quittungen_customer ON public.quittungen USING btree (customer_id, datum DESC) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_quittungen_datum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quittungen_datum ON public.quittungen USING btree (datum DESC);


--
-- Name: idx_quittungen_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quittungen_offer_id ON public.quittungen USING btree (offer_id);


--
-- Name: idx_quittungen_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quittungen_payment ON public.quittungen USING btree (payment_id) WHERE (payment_id IS NOT NULL);


--
-- Name: idx_quittungen_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quittungen_status ON public.quittungen USING btree (status);


--
-- Name: idx_raeumung_art; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raeumung_art ON public.raeumung_anfragen USING btree (raeumungs_art);


--
-- Name: idx_raeumung_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raeumung_created ON public.raeumung_anfragen USING btree (created_at DESC);


--
-- Name: idx_raeumung_plz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raeumung_plz ON public.raeumung_anfragen USING btree (adresse_plz);


--
-- Name: idx_raeumung_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raeumung_status ON public.raeumung_anfragen USING btree (status);


--
-- Name: idx_rechnungen_auftrag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rechnungen_auftrag_id ON public.rechnungen USING btree (auftrag_id);


--
-- Name: idx_rechnungen_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rechnungen_company_id ON public.rechnungen USING btree (company_id);


--
-- Name: idx_rechnungen_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rechnungen_customer ON public.rechnungen USING btree (customer_id, datum DESC) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_rechnungen_offen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rechnungen_offen ON public.rechnungen USING btree (company_id, faellig_am) WHERE ((open_amount > (0)::numeric) AND (status <> 'entwurf'::text));


--
-- Name: idx_rechnungen_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rechnungen_offer_id ON public.rechnungen USING btree (offer_id);


--
-- Name: idx_rechnungen_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rechnungen_status ON public.rechnungen USING btree (status);


--
-- Name: idx_reminder_settings_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminder_settings_company ON public.company_reminder_settings USING btree (company_id);


--
-- Name: idx_reminders_appointment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminders_appointment ON public.appointment_reminders USING btree (appointment_id);


--
-- Name: idx_resources_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_company ON public.firma_resources USING btree (company_id);


--
-- Name: idx_sales_stage_history_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_stage_history_lead ON public.sales_stage_history USING btree (lead_id, changed_at DESC);


--
-- Name: idx_service_locations_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_locations_company ON public.service_locations USING btree (company_id, city);


--
-- Name: idx_service_locations_je_kunde; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_service_locations_je_kunde ON public.service_locations USING btree (customer_id, lower(TRIM(BOTH FROM address_raw)));


--
-- Name: idx_shared_content_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_content_key ON public.shared_content USING btree (component_key);


--
-- Name: idx_shared_content_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_content_type ON public.shared_content USING btree (component_type);


--
-- Name: idx_subscription_payments_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_payments_company_id ON public.subscription_payments USING btree (company_id);


--
-- Name: idx_subscription_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_payments_status ON public.subscription_payments USING btree (status);


--
-- Name: idx_subscription_reminders_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_reminders_company_id ON public.subscription_reminders USING btree (company_id);


--
-- Name: idx_subscription_reminders_reminder_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_reminders_reminder_type ON public.subscription_reminders USING btree (reminder_type);


--
-- Name: idx_support_ticket_messages_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_messages_ticket_id ON public.support_ticket_messages USING btree (ticket_id);


--
-- Name: idx_support_tickets_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_assigned_to ON public.support_tickets USING btree (assigned_to);


--
-- Name: idx_support_tickets_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_company_id ON public.support_tickets USING btree (company_id);


--
-- Name: idx_support_tickets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_created_at ON public.support_tickets USING btree (created_at DESC);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_swiss_plz_coords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_swiss_plz_coords ON public.swiss_plz USING btree (latitude, longitude);


--
-- Name: idx_swiss_plz_plz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_swiss_plz_plz ON public.swiss_plz USING btree (plz);


--
-- Name: idx_team_availability_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_availability_member ON public.team_availability USING btree (team_member_id);


--
-- Name: idx_team_members_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_company ON public.team_members USING btree (company_id);


--
-- Name: idx_umzug_anfragen_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzug_anfragen_created ON public.umzug_anfragen USING btree (created_at DESC);


--
-- Name: idx_umzug_anfragen_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzug_anfragen_email ON public.umzug_anfragen USING btree (customer_email);


--
-- Name: idx_umzug_anfragen_from_plz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzug_anfragen_from_plz ON public.umzug_anfragen USING btree (from_plz);


--
-- Name: idx_umzug_anfragen_moving_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzug_anfragen_moving_date ON public.umzug_anfragen USING btree (moving_date);


--
-- Name: idx_umzug_anfragen_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzug_anfragen_status ON public.umzug_anfragen USING btree (status);


--
-- Name: idx_umzug_anfragen_to_plz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzug_anfragen_to_plz ON public.umzug_anfragen USING btree (to_plz);


--
-- Name: idx_umzugsbox_rentals_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzugsbox_rentals_archived_at ON public.umzugsbox_rentals USING btree (archived_at) WHERE (archived_at IS NOT NULL);


--
-- Name: idx_umzugsbox_rentals_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzugsbox_rentals_assigned ON public.umzugsbox_rentals USING btree (assigned_team_member_id);


--
-- Name: idx_umzugsbox_rentals_box_items; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzugsbox_rentals_box_items ON public.umzugsbox_rentals USING gin (box_items);


--
-- Name: idx_umzugsbox_rentals_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzugsbox_rentals_company ON public.umzugsbox_rentals USING btree (company_id);


--
-- Name: idx_umzugsbox_rentals_company_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzugsbox_rentals_company_archived ON public.umzugsbox_rentals USING btree (company_id, archived_at) WHERE (archived_at IS NULL);


--
-- Name: idx_umzugsbox_rentals_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzugsbox_rentals_company_status ON public.umzugsbox_rentals USING btree (company_id, status);


--
-- Name: idx_umzugsbox_rentals_delivery_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzugsbox_rentals_delivery_date ON public.umzugsbox_rentals USING btree (delivery_date);


--
-- Name: idx_umzugsbox_rentals_expected_return; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzugsbox_rentals_expected_return ON public.umzugsbox_rentals USING btree (expected_return_date);


--
-- Name: idx_umzugsbox_rentals_pickup_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzugsbox_rentals_pickup_scheduled ON public.umzugsbox_rentals USING btree (pickup_scheduled_date);


--
-- Name: idx_umzugsbox_rentals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_umzugsbox_rentals_status ON public.umzugsbox_rentals USING btree (status);


--
-- Name: idx_website_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_settings_key ON public.website_settings USING btree (setting_key);


--
-- Name: idx_website_settings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_settings_type ON public.website_settings USING btree (setting_type);


--
-- Name: offers_series_version_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX offers_series_version_uniq ON public.offers USING btree (company_id, offer_series_id, version_number);


--
-- Name: uniq_confirmed_besichtigung_per_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_confirmed_besichtigung_per_lead ON public.appointments USING btree (lead_id) WHERE ((appointment_type = 'besichtigung'::public.appointment_type) AND (status = 'confirmed'::public.appointment_status) AND (lead_id IS NOT NULL));


--
-- Name: uniq_confirmed_besichtigung_per_offer; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_confirmed_besichtigung_per_offer ON public.appointments USING btree (offer_id) WHERE ((appointment_type = 'besichtigung'::public.appointment_type) AND (status = 'confirmed'::public.appointment_status) AND (offer_id IS NOT NULL));


--
-- Name: leads calculate_spam_score_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER calculate_spam_score_trigger BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.calculate_lead_spam_score();


--
-- Name: communication_threads communication_threads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER communication_threads_updated_at BEFORE UPDATE ON public.communication_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: credit_notes credit_notes_erben; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER credit_notes_erben BEFORE INSERT ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.credit_notes_von_rechnung_erben();


--
-- Name: credit_notes credit_notes_set_nr; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER credit_notes_set_nr BEFORE INSERT ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.generate_gutschrift_nr();


--
-- Name: credit_notes credit_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER credit_notes_updated_at BEFORE UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: customer_cases customer_cases_set_nr; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_cases_set_nr BEFORE INSERT ON public.customer_cases FOR EACH ROW EXECUTE FUNCTION public.generate_fall_nr();


--
-- Name: customer_cases customer_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_cases_updated_at BEFORE UPDATE ON public.customer_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: invoice_reminders invoice_reminders_erben; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoice_reminders_erben BEFORE INSERT ON public.invoice_reminders FOR EACH ROW EXECUTE FUNCTION public.invoice_reminders_sprache_erben();


--
-- Name: leads on_lead_high_spam_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_lead_high_spam_notify AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.trigger_notify_admin_high_spam();


--
-- Name: offers on_offer_response; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_offer_response AFTER UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.notify_offer_response();


--
-- Name: quittungen quittungen_set_nr; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quittungen_set_nr BEFORE INSERT ON public.quittungen FOR EACH ROW EXECUTE FUNCTION public.generate_quittung_nr();


--
-- Name: quittungen quittungen_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quittungen_updated_at BEFORE UPDATE ON public.quittungen FOR EACH ROW EXECUTE FUNCTION public.update_quittungen_updated_at();


--
-- Name: raeumung_anfragen raeumung_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER raeumung_updated_at BEFORE UPDATE ON public.raeumung_anfragen FOR EACH ROW EXECUTE FUNCTION public.update_raeumung_updated_at();


--
-- Name: rechnungen rechnungen_set_nr; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rechnungen_set_nr BEFORE INSERT ON public.rechnungen FOR EACH ROW EXECUTE FUNCTION public.generate_rechnung_nr();


--
-- Name: rechnungen rechnungen_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rechnungen_updated_at BEFORE UPDATE ON public.rechnungen FOR EACH ROW EXECUTE FUNCTION public.update_rechnungen_updated_at();


--
-- Name: service_locations service_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_locations_updated_at BEFORE UPDATE ON public.service_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: auftraege set_auftrag_nummer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_auftrag_nummer BEFORE INSERT ON public.auftraege FOR EACH ROW WHEN (((new.auftrag_nummer IS NULL) OR ((new.auftrag_nummer)::text = ''::text))) EXECUTE FUNCTION public.generate_auftrag_nummer();


--
-- Name: klaviertransport_anfragen set_klavier_nummer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_klavier_nummer BEFORE INSERT ON public.klaviertransport_anfragen FOR EACH ROW EXECUTE FUNCTION public.generate_klavier_nummer();


--
-- Name: moebellift_anfragen set_moebellift_nummer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_moebellift_nummer BEFORE INSERT ON public.moebellift_anfragen FOR EACH ROW EXECUTE FUNCTION public.generate_moebellift_nummer();


--
-- Name: moebellift_anfragen set_moebellift_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_moebellift_updated_at BEFORE UPDATE ON public.moebellift_anfragen FOR EACH ROW EXECUTE FUNCTION public.update_moebellift_updated_at();


--
-- Name: raeumung_anfragen set_raeumung_nummer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_raeumung_nummer BEFORE INSERT ON public.raeumung_anfragen FOR EACH ROW EXECUTE FUNCTION public.generate_raeumung_nummer();


--
-- Name: umzug_anfragen set_umzug_nummer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_umzug_nummer BEFORE INSERT ON public.umzug_anfragen FOR EACH ROW EXECUTE FUNCTION public.generate_umzug_nummer();


--
-- Name: api_keys trg_api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.set_api_keys_updated_at();


--
-- Name: auftraege trg_create_appointments_for_auftrag; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_create_appointments_for_auftrag AFTER INSERT ON public.auftraege FOR EACH ROW EXECUTE FUNCTION public.create_appointments_for_auftrag();


--
-- Name: appointments trg_sync_appointment_cancel_to_auftrag; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_appointment_cancel_to_auftrag AFTER UPDATE OF status ON public.appointments FOR EACH ROW WHEN (((new.appointment_type = 'service'::public.appointment_type) AND (new.status = 'cancelled'::public.appointment_status) AND (old.status IS DISTINCT FROM 'cancelled'::public.appointment_status))) EXECUTE FUNCTION public.sync_appointment_cancel_to_auftrag();


--
-- Name: appointments trg_sync_appointment_schedule_to_auftrag; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_appointment_schedule_to_auftrag AFTER UPDATE ON public.appointments FOR EACH ROW WHEN (((new.appointment_type = 'service'::public.appointment_type) AND ((old.appointment_date IS DISTINCT FROM new.appointment_date) OR (old.start_time IS DISTINCT FROM new.start_time) OR (old.duration_minutes IS DISTINCT FROM new.duration_minutes)))) EXECUTE FUNCTION public.sync_appointment_schedule_to_auftrag();


--
-- Name: auftraege trg_sync_auftrag_status_to_appointment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_auftrag_status_to_appointment AFTER UPDATE ON public.auftraege FOR EACH ROW WHEN ((((new.appointment_id IS NOT NULL) OR (new.offer_id IS NOT NULL)) AND ((old.status IS DISTINCT FROM new.status) OR (old.deleted_at IS DISTINCT FROM new.deleted_at)))) EXECUTE FUNCTION public.sync_auftrag_status_to_appointment();


--
-- Name: payment_allocations trigger_allocation_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_allocation_immutable BEFORE UPDATE ON public.payment_allocations FOR EACH ROW EXECUTE FUNCTION public.guard_allocation_immutable();


--
-- Name: payment_allocations trigger_allocation_rechnung_fortschreiben; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_allocation_rechnung_fortschreiben AFTER INSERT OR DELETE OR UPDATE ON public.payment_allocations FOR EACH ROW EXECUTE FUNCTION public.rechnung_zahlungsstand_fortschreiben();


--
-- Name: payment_allocations trigger_allocation_within_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_allocation_within_payment AFTER INSERT OR UPDATE ON public.payment_allocations FOR EACH ROW EXECUTE FUNCTION public.guard_allocation_within_payment();


--
-- Name: appointments trigger_appointments_set_customer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_appointments_set_customer BEFORE INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.appointments_set_customer();


--
-- Name: auftraege trigger_auftraege_set_customer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auftraege_set_customer BEFORE INSERT ON public.auftraege FOR EACH ROW EXECUTE FUNCTION public.auftraege_set_customer();


--
-- Name: auftraege trigger_auftraege_set_locations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auftraege_set_locations BEFORE INSERT ON public.auftraege FOR EACH ROW EXECUTE FUNCTION public.auftraege_set_locations();


--
-- Name: appointments trigger_calculate_duration; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_duration BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.calculate_appointment_duration();


--
-- Name: customer_case_events trigger_case_events_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_case_events_append_only BEFORE DELETE OR UPDATE ON public.customer_case_events FOR EACH ROW EXECUTE FUNCTION public.guard_case_events_append_only();


--
-- Name: communication_messages trigger_comm_thread_fortschreiben; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_comm_thread_fortschreiben AFTER INSERT ON public.communication_messages FOR EACH ROW EXECUTE FUNCTION public.communication_thread_fortschreiben();


--
-- Name: companies trigger_companies_ensure_owner_membership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_companies_ensure_owner_membership AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.companies_ensure_owner_membership();


--
-- Name: companies trigger_companies_guard_ownership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_companies_guard_ownership BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.guard_company_ownership();


--
-- Name: companies trigger_companies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: company_secrets trigger_company_secrets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_company_secrets_updated_at BEFORE UPDATE ON public.company_secrets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: credit_notes trigger_credit_notes_fortschreiben; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_credit_notes_fortschreiben AFTER INSERT OR DELETE OR UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.rechnung_gutschriften_fortschreiben();


--
-- Name: crm_tasks trigger_crm_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_crm_tasks_updated_at BEFORE UPDATE ON public.crm_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: customer_cases trigger_customer_cases_aufgabe; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_customer_cases_aufgabe AFTER INSERT ON public.customer_cases FOR EACH ROW EXECUTE FUNCTION public.customer_cases_aufgabe_anlegen();


--
-- Name: customer_cases trigger_customer_cases_verlauf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_customer_cases_verlauf AFTER INSERT OR UPDATE ON public.customer_cases FOR EACH ROW EXECUTE FUNCTION public.customer_cases_verlauf_schreiben();


--
-- Name: customer_merges trigger_customer_merges_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_customer_merges_append_only BEFORE DELETE OR UPDATE ON public.customer_merges FOR EACH ROW EXECUTE FUNCTION public.guard_customer_merges_append_only();


--
-- Name: customers trigger_customers_guard_merge; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_customers_guard_merge BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.guard_customer_merge_fields();


--
-- Name: customers trigger_customers_set_display_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_customers_set_display_name BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.customers_set_display_name();


--
-- Name: customers trigger_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: email_logs trigger_email_log_faden; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_email_log_faden AFTER INSERT ON public.email_logs FOR EACH ROW EXECUTE FUNCTION public.email_log_in_faden();


--
-- Name: offers trigger_generate_offer_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_offer_number BEFORE INSERT ON public.offers FOR EACH ROW WHEN ((new.offer_number IS NULL)) EXECUTE FUNCTION public.generate_offer_number();


--
-- Name: credit_notes trigger_gutschrift_hoehe; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_gutschrift_hoehe AFTER INSERT OR UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.guard_gutschrift_hoehe();


--
-- Name: inbound_emails trigger_inbound_email_faden; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_inbound_email_faden AFTER INSERT ON public.inbound_emails FOR EACH ROW EXECUTE FUNCTION public.inbound_email_in_faden();


--
-- Name: inbound_emails trigger_inbound_emails_set_customer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_inbound_emails_set_customer BEFORE INSERT ON public.inbound_emails FOR EACH ROW EXECUTE FUNCTION public.inbound_emails_set_customer();


--
-- Name: inbound_emails trigger_inbound_emails_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_inbound_emails_updated_at BEFORE UPDATE ON public.inbound_emails FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: leads trigger_leads_set_customer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_leads_set_customer BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.leads_set_customer();


--
-- Name: leads trigger_leads_stage_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_leads_stage_history AFTER UPDATE OF sales_stage ON public.leads FOR EACH ROW EXECUTE FUNCTION public.leads_record_stage_change();


--
-- Name: leads trigger_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: appointments trigger_log_appointment_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_log_appointment_changes AFTER INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.log_appointment_changes();


--
-- Name: invoice_reminders trigger_mahnstufe_reihenfolge; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_mahnstufe_reihenfolge BEFORE INSERT ON public.invoice_reminders FOR EACH ROW EXECUTE FUNCTION public.guard_mahnstufe_reihenfolge();


--
-- Name: offer_amendments trigger_offer_amendments_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_offer_amendments_guard BEFORE UPDATE ON public.offer_amendments FOR EACH ROW EXECUTE FUNCTION public.guard_amendment_after_send();


--
-- Name: offer_amendments trigger_offer_amendments_inherit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_offer_amendments_inherit BEFORE INSERT ON public.offer_amendments FOR EACH ROW EXECUTE FUNCTION public.offer_amendments_inherit();


--
-- Name: offer_amendments trigger_offer_amendments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_offer_amendments_updated_at BEFORE UPDATE ON public.offer_amendments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: offers trigger_offers_acceptance_evidence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_offers_acceptance_evidence BEFORE UPDATE OF status ON public.offers FOR EACH ROW EXECUTE FUNCTION public.set_offer_acceptance_evidence();


--
-- Name: offers trigger_offers_advance_stage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_offers_advance_stage AFTER INSERT OR UPDATE OF status ON public.offers FOR EACH ROW EXECUTE FUNCTION public.offers_advance_lead_stage();


--
-- Name: offers trigger_offers_guard_content; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_offers_guard_content BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.guard_offer_content_after_send();


--
-- Name: offers trigger_offers_set_customer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_offers_set_customer BEFORE INSERT ON public.offers FOR EACH ROW EXECUTE FUNCTION public.offers_set_customer();


--
-- Name: offers trigger_offers_set_series; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_offers_set_series BEFORE INSERT ON public.offers FOR EACH ROW EXECUTE FUNCTION public.offers_set_series();


--
-- Name: payments trigger_payments_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_payments_append_only BEFORE DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.guard_payment_append_only();


--
-- Name: quittungen trigger_quittungen_bezahlt_buchung; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_quittungen_bezahlt_buchung BEFORE UPDATE ON public.quittungen FOR EACH ROW EXECUTE FUNCTION public.guard_quittung_bezahlt_braucht_buchung();


--
-- Name: quittungen trigger_quittungen_guard_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_quittungen_guard_delete BEFORE DELETE ON public.quittungen FOR EACH ROW EXECUTE FUNCTION public.guard_quittung_delete();


--
-- Name: quittungen trigger_quittungen_guard_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_quittungen_guard_status BEFORE UPDATE OF status ON public.quittungen FOR EACH ROW EXECUTE FUNCTION public.guard_quittung_status_regression();


--
-- Name: quittungen trigger_quittungen_set_customer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_quittungen_set_customer BEFORE INSERT ON public.quittungen FOR EACH ROW EXECUTE FUNCTION public.beleg_set_customer();


--
-- Name: rechnungen trigger_rechnungen_bezahlt_deckung; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_rechnungen_bezahlt_deckung BEFORE UPDATE ON public.rechnungen FOR EACH ROW EXECUTE FUNCTION public.guard_rechnung_bezahlt_braucht_deckung();


--
-- Name: rechnungen trigger_rechnungen_guard_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_rechnungen_guard_delete BEFORE DELETE ON public.rechnungen FOR EACH ROW EXECUTE FUNCTION public.guard_rechnung_delete();


--
-- Name: rechnungen trigger_rechnungen_guard_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_rechnungen_guard_status BEFORE UPDATE OF status ON public.rechnungen FOR EACH ROW EXECUTE FUNCTION public.guard_rechnung_status_regression();


--
-- Name: rechnungen trigger_rechnungen_set_customer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_rechnungen_set_customer BEFORE INSERT ON public.rechnungen FOR EACH ROW EXECUTE FUNCTION public.beleg_set_customer();


--
-- Name: companies trigger_set_company_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_company_slug BEFORE INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_company_slug();


--
-- Name: leads trigger_set_lead_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_lead_slug BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_lead_slug();


--
-- Name: sales_stage_history trigger_stage_history_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_stage_history_append_only BEFORE DELETE OR UPDATE ON public.sales_stage_history FOR EACH ROW EXECUTE FUNCTION public.guard_stage_history_append_only();


--
-- Name: company_pricing_configs trigger_update_company_pricing_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_company_pricing_updated_at BEFORE UPDATE ON public.company_pricing_configs FOR EACH ROW EXECUTE FUNCTION public.update_company_pricing_updated_at();


--
-- Name: umzug_anfragen umzug_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER umzug_updated_at BEFORE UPDATE ON public.umzug_anfragen FOR EACH ROW EXECUTE FUNCTION public.update_umzug_updated_at();


--
-- Name: umzugsbox_rentals umzugsbox_rentals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER umzugsbox_rentals_updated_at BEFORE UPDATE ON public.umzugsbox_rentals FOR EACH ROW EXECUTE FUNCTION public.update_umzugsbox_rentals_updated_at();


--
-- Name: agb_sections update_agb_sections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agb_sections_updated_at BEFORE UPDATE ON public.agb_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: archive_logs update_archive_logs_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_archive_logs_timestamp BEFORE UPDATE ON public.archive_logs FOR EACH ROW EXECUTE FUNCTION public.update_archive_timestamp();


--
-- Name: archive_settings update_archive_settings_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_archive_settings_timestamp BEFORE UPDATE ON public.archive_settings FOR EACH ROW EXECUTE FUNCTION public.update_archive_timestamp();


--
-- Name: auftraege update_auftraege_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_auftraege_updated_at BEFORE UPDATE ON public.auftraege FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: checklist_templates update_checklist_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_checklist_templates_updated_at BEFORE UPDATE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: company_offer_templates update_company_offer_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_company_offer_templates_updated_at BEFORE UPDATE ON public.company_offer_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: company_service_items update_company_service_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_company_service_items_updated_at BEFORE UPDATE ON public.company_service_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: ip_blacklist update_ip_blacklist_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ip_blacklist_updated_at BEFORE UPDATE ON public.ip_blacklist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: klaviertransport_anfragen update_klaviertransport_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_klaviertransport_timestamp BEFORE UPDATE ON public.klaviertransport_anfragen FOR EACH ROW EXECUTE FUNCTION public.update_klaviertransport_updated_at();


--
-- Name: landing_pages update_landing_pages_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_landing_pages_timestamp BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.update_landing_pages_updated_at();


--
-- Name: lead_forms update_lead_forms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lead_forms_updated_at BEFORE UPDATE ON public.lead_forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: leistungsuebersicht_templates update_leistungsuebersicht_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_leistungsuebersicht_templates_updated_at BEFORE UPDATE ON public.leistungsuebersicht_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: offer_leistungsuebersicht update_offer_leistungsuebersicht_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_offer_leistungsuebersicht_updated_at BEFORE UPDATE ON public.offer_leistungsuebersicht FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: offers update_offers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: shared_content update_shared_content_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_shared_content_timestamp BEFORE UPDATE ON public.shared_content FOR EACH ROW EXECUTE FUNCTION public.update_landing_pages_updated_at();


--
-- Name: support_ticket_messages update_ticket_on_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ticket_on_message AFTER INSERT ON public.support_ticket_messages FOR EACH ROW EXECUTE FUNCTION public.update_ticket_timestamp();


--
-- Name: website_settings website_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER website_settings_updated_at BEFORE UPDATE ON public.website_settings FOR EACH ROW EXECUTE FUNCTION public.update_website_settings_timestamp();


--
-- Name: admin_activity_log admin_activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: agb_sections agb_sections_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agb_sections
    ADD CONSTRAINT agb_sections_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: appointment_history appointment_history_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_history
    ADD CONSTRAINT appointment_history_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_reminders appointment_reminders_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_reminders
    ADD CONSTRAINT appointment_reminders_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: appointments appointments_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_location_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_location_fk FOREIGN KEY (location_id, company_id) REFERENCES public.service_locations(id, company_id) ON DELETE SET NULL (location_id);


--
-- Name: appointments appointments_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_parent_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_parent_appointment_id_fkey FOREIGN KEY (parent_appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: archive_logs archive_logs_restored_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archive_logs
    ADD CONSTRAINT archive_logs_restored_by_user_id_fkey FOREIGN KEY (restored_by_user_id) REFERENCES auth.users(id);


--
-- Name: archive_logs archive_logs_triggered_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archive_logs
    ADD CONSTRAINT archive_logs_triggered_by_user_id_fkey FOREIGN KEY (triggered_by_user_id) REFERENCES auth.users(id);


--
-- Name: archive_snapshots archive_snapshots_archive_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archive_snapshots
    ADD CONSTRAINT archive_snapshots_archive_log_id_fkey FOREIGN KEY (archive_log_id) REFERENCES public.archive_logs(id) ON DELETE CASCADE;


--
-- Name: auftraege auftraege_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auftraege
    ADD CONSTRAINT auftraege_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: auftraege auftraege_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auftraege
    ADD CONSTRAINT auftraege_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: auftraege auftraege_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auftraege
    ADD CONSTRAINT auftraege_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: auftraege auftraege_from_location_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auftraege
    ADD CONSTRAINT auftraege_from_location_fk FOREIGN KEY (from_location_id, company_id) REFERENCES public.service_locations(id, company_id) ON DELETE SET NULL (from_location_id);


--
-- Name: auftraege auftraege_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auftraege
    ADD CONSTRAINT auftraege_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: auftraege auftraege_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auftraege
    ADD CONSTRAINT auftraege_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;


--
-- Name: auftraege auftraege_team_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auftraege
    ADD CONSTRAINT auftraege_team_leader_id_fkey FOREIGN KEY (team_leader_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: auftraege auftraege_to_location_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auftraege
    ADD CONSTRAINT auftraege_to_location_fk FOREIGN KEY (to_location_id, company_id) REFERENCES public.service_locations(id, company_id) ON DELETE SET NULL (to_location_id);


--
-- Name: automation_deliveries automation_deliveries_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_deliveries
    ADD CONSTRAINT automation_deliveries_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: blog_posts blog_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);


--
-- Name: blog_posts blog_posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.blog_categories(id);


--
-- Name: blog_seo_performance blog_seo_performance_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_seo_performance
    ADD CONSTRAINT blog_seo_performance_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.blog_posts(id) ON DELETE CASCADE;


--
-- Name: checklist_templates checklist_templates_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: communication_messages communication_messages_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_messages
    ADD CONSTRAINT communication_messages_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: communication_messages communication_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_messages
    ADD CONSTRAINT communication_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.communication_threads(id) ON DELETE CASCADE;


--
-- Name: communication_threads communication_threads_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_threads
    ADD CONSTRAINT communication_threads_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: communication_threads communication_threads_auftrag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_threads
    ADD CONSTRAINT communication_threads_auftrag_id_fkey FOREIGN KEY (auftrag_id) REFERENCES public.auftraege(id) ON DELETE SET NULL;


--
-- Name: communication_threads communication_threads_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_threads
    ADD CONSTRAINT communication_threads_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.customer_cases(id) ON DELETE SET NULL;


--
-- Name: communication_threads communication_threads_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_threads
    ADD CONSTRAINT communication_threads_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: communication_threads communication_threads_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_threads
    ADD CONSTRAINT communication_threads_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: communication_threads communication_threads_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_threads
    ADD CONSTRAINT communication_threads_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: communication_threads communication_threads_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_threads
    ADD CONSTRAINT communication_threads_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;


--
-- Name: companies companies_crm_enabled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_crm_enabled_by_fkey FOREIGN KEY (crm_enabled_by) REFERENCES auth.users(id);


--
-- Name: companies companies_trial_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_trial_granted_by_fkey FOREIGN KEY (trial_granted_by) REFERENCES auth.users(id);


--
-- Name: companies companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: CONSTRAINT companies_user_id_fkey ON companies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT companies_user_id_fkey ON public.companies IS 'Foreign key to auth.users. ON DELETE SET NULL ensures company record survives when user is deleted.';


--
-- Name: company_members company_members_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_members company_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: company_offer_settings company_offer_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_offer_settings
    ADD CONSTRAINT company_offer_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_offer_templates company_offer_templates_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_offer_templates
    ADD CONSTRAINT company_offer_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_plz_coverage company_plz_coverage_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_plz_coverage
    ADD CONSTRAINT company_plz_coverage_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_pricing_audit_log company_pricing_audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_pricing_audit_log
    ADD CONSTRAINT company_pricing_audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: company_pricing_audit_log company_pricing_audit_log_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_pricing_audit_log
    ADD CONSTRAINT company_pricing_audit_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_pricing_audit_log company_pricing_audit_log_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_pricing_audit_log
    ADD CONSTRAINT company_pricing_audit_log_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.company_pricing_configs(id) ON DELETE SET NULL;


--
-- Name: company_pricing_configs company_pricing_configs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_pricing_configs
    ADD CONSTRAINT company_pricing_configs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_pricing_configs company_pricing_configs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_pricing_configs
    ADD CONSTRAINT company_pricing_configs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: company_pricing_configs company_pricing_configs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_pricing_configs
    ADD CONSTRAINT company_pricing_configs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: company_reminder_settings company_reminder_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_reminder_settings
    ADD CONSTRAINT company_reminder_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_secrets company_secrets_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_secrets
    ADD CONSTRAINT company_secrets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_service_items company_service_items_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_service_items
    ADD CONSTRAINT company_service_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_services company_services_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_services
    ADD CONSTRAINT company_services_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: credit_notes credit_notes_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: credit_notes credit_notes_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: credit_notes credit_notes_rechnung_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_rechnung_fk FOREIGN KEY (rechnung_id, company_id) REFERENCES public.rechnungen(id, company_id) ON DELETE CASCADE;


--
-- Name: crm_tasks crm_tasks_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: crm_tasks crm_tasks_auftrag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_auftrag_id_fkey FOREIGN KEY (auftrag_id) REFERENCES public.auftraege(id) ON DELETE CASCADE;


--
-- Name: crm_tasks crm_tasks_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: crm_tasks crm_tasks_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: crm_tasks crm_tasks_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: crm_tasks crm_tasks_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE CASCADE;


--
-- Name: customer_case_events customer_case_events_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_case_events
    ADD CONSTRAINT customer_case_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.customer_cases(id) ON DELETE CASCADE;


--
-- Name: customer_case_events customer_case_events_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_case_events
    ADD CONSTRAINT customer_case_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: customer_cases customer_cases_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_cases
    ADD CONSTRAINT customer_cases_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: customer_cases customer_cases_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_cases
    ADD CONSTRAINT customer_cases_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: customer_cases customer_cases_auftrag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_cases
    ADD CONSTRAINT customer_cases_auftrag_id_fkey FOREIGN KEY (auftrag_id) REFERENCES public.auftraege(id) ON DELETE SET NULL;


--
-- Name: customer_cases customer_cases_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_cases
    ADD CONSTRAINT customer_cases_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: customer_cases customer_cases_credit_note_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_cases
    ADD CONSTRAINT customer_cases_credit_note_fk FOREIGN KEY (credit_note_id, company_id) REFERENCES public.credit_notes(id, company_id) ON DELETE SET NULL (credit_note_id);


--
-- Name: customer_cases customer_cases_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_cases
    ADD CONSTRAINT customer_cases_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: customer_cases customer_cases_location_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_cases
    ADD CONSTRAINT customer_cases_location_fk FOREIGN KEY (location_id, company_id) REFERENCES public.service_locations(id, company_id) ON DELETE SET NULL (location_id);


--
-- Name: customer_cases customer_cases_rechnung_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_cases
    ADD CONSTRAINT customer_cases_rechnung_fk FOREIGN KEY (rechnung_id, company_id) REFERENCES public.rechnungen(id, company_id) ON DELETE SET NULL (rechnung_id);


--
-- Name: customer_change_requests customer_change_requests_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_change_requests
    ADD CONSTRAINT customer_change_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: customer_change_requests customer_change_requests_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_change_requests
    ADD CONSTRAINT customer_change_requests_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE CASCADE;


--
-- Name: customer_merges customer_merges_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_merges
    ADD CONSTRAINT customer_merges_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: customers customers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: customers customers_merged_into_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_merged_into_customer_id_fkey FOREIGN KEY (merged_into_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: email_logs email_logs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: email_logs email_logs_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: fall_nr_counter fall_nr_counter_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fall_nr_counter
    ADD CONSTRAINT fall_nr_counter_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: firma_resources firma_resources_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firma_resources
    ADD CONSTRAINT firma_resources_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: appointments fk_rescheduled_from; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT fk_rescheduled_from FOREIGN KEY (rescheduled_from_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: appointments fk_rescheduled_to; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT fk_rescheduled_to FOREIGN KEY (rescheduled_to_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: gutschrift_nr_counter gutschrift_nr_counter_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gutschrift_nr_counter
    ADD CONSTRAINT gutschrift_nr_counter_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: inbound_emails inbound_emails_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_emails
    ADD CONSTRAINT inbound_emails_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: inbound_emails inbound_emails_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_emails
    ADD CONSTRAINT inbound_emails_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: inbound_emails inbound_emails_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_emails
    ADD CONSTRAINT inbound_emails_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: invoice_reminders invoice_reminders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_reminders
    ADD CONSTRAINT invoice_reminders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: invoice_reminders invoice_reminders_rechnung_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_reminders
    ADD CONSTRAINT invoice_reminders_rechnung_fk FOREIGN KEY (rechnung_id, company_id) REFERENCES public.rechnungen(id, company_id) ON DELETE CASCADE;


--
-- Name: ip_blacklist ip_blacklist_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id);


--
-- Name: landing_page_analytics landing_page_analytics_landing_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_page_analytics
    ADD CONSTRAINT landing_page_analytics_landing_page_id_fkey FOREIGN KEY (landing_page_id) REFERENCES public.landing_pages(id) ON DELETE CASCADE;


--
-- Name: landing_pages landing_pages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_pages
    ADD CONSTRAINT landing_pages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: landing_pages landing_pages_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_pages
    ADD CONSTRAINT landing_pages_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: lead_confirmations lead_confirmations_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_confirmations
    ADD CONSTRAINT lead_confirmations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: leads leads_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: leads leads_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: leads leads_source_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_source_form_id_fkey FOREIGN KEY (source_form_id) REFERENCES public.lead_forms(id) ON DELETE SET NULL;


--
-- Name: leads leads_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id);


--
-- Name: leistungsuebersicht_templates leistungsuebersicht_templates_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leistungsuebersicht_templates
    ADD CONSTRAINT leistungsuebersicht_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: manual_imported_leads manual_imported_leads_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_imported_leads
    ADD CONSTRAINT manual_imported_leads_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: manual_imported_leads manual_imported_leads_imported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_imported_leads
    ADD CONSTRAINT manual_imported_leads_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES auth.users(id);


--
-- Name: manual_imported_leads manual_imported_leads_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_imported_leads
    ADD CONSTRAINT manual_imported_leads_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: moving_calculation_presets moving_calculation_presets_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moving_calculation_presets
    ADD CONSTRAINT moving_calculation_presets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: offer_amendment_items offer_amendment_items_amendment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_amendment_items
    ADD CONSTRAINT offer_amendment_items_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.offer_amendments(id) ON DELETE CASCADE;


--
-- Name: offer_amendments offer_amendments_auftrag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_amendments
    ADD CONSTRAINT offer_amendments_auftrag_id_fkey FOREIGN KEY (auftrag_id) REFERENCES public.auftraege(id) ON DELETE SET NULL;


--
-- Name: offer_amendments offer_amendments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_amendments
    ADD CONSTRAINT offer_amendments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: offer_amendments offer_amendments_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_amendments
    ADD CONSTRAINT offer_amendments_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: offer_amendments offer_amendments_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_amendments
    ADD CONSTRAINT offer_amendments_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE CASCADE;


--
-- Name: offer_inventory_items offer_inventory_items_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_inventory_items
    ADD CONSTRAINT offer_inventory_items_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE CASCADE;


--
-- Name: offer_item_area_meta offer_item_area_meta_offer_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_item_area_meta
    ADD CONSTRAINT offer_item_area_meta_offer_item_id_fkey FOREIGN KEY (offer_item_id) REFERENCES public.offer_items(id) ON DELETE CASCADE;


--
-- Name: offer_item_breakdown offer_item_breakdown_offer_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_item_breakdown
    ADD CONSTRAINT offer_item_breakdown_offer_item_id_fkey FOREIGN KEY (offer_item_id) REFERENCES public.offer_items(id) ON DELETE CASCADE;


--
-- Name: offer_item_effort_meta offer_item_effort_meta_offer_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_item_effort_meta
    ADD CONSTRAINT offer_item_effort_meta_offer_item_id_fkey FOREIGN KEY (offer_item_id) REFERENCES public.offer_items(id) ON DELETE CASCADE;


--
-- Name: offer_item_leistung offer_item_leistung_offer_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_item_leistung
    ADD CONSTRAINT offer_item_leistung_offer_item_id_fkey FOREIGN KEY (offer_item_id) REFERENCES public.offer_items(id) ON DELETE CASCADE;


--
-- Name: offer_item_volume_meta offer_item_volume_meta_offer_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_item_volume_meta
    ADD CONSTRAINT offer_item_volume_meta_offer_item_id_fkey FOREIGN KEY (offer_item_id) REFERENCES public.offer_items(id) ON DELETE CASCADE;


--
-- Name: offer_items offer_items_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_items
    ADD CONSTRAINT offer_items_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE CASCADE;


--
-- Name: offer_leistungsuebersicht offer_leistungsuebersicht_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_leistungsuebersicht
    ADD CONSTRAINT offer_leistungsuebersicht_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE CASCADE;


--
-- Name: offers offers_assigned_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_assigned_team_member_id_fkey FOREIGN KEY (assigned_team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: offers offers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: offers offers_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: offers offers_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: offers offers_supersedes_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_supersedes_offer_id_fkey FOREIGN KEY (supersedes_offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;


--
-- Name: payment_allocations payment_allocations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: payment_allocations payment_allocations_payment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_payment_fk FOREIGN KEY (payment_id, company_id) REFERENCES public.payments(id, company_id) ON DELETE CASCADE;


--
-- Name: payment_allocations payment_allocations_rechnung_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_rechnung_fk FOREIGN KEY (rechnung_id, company_id) REFERENCES public.rechnungen(id, company_id) ON DELETE CASCADE;


--
-- Name: payments payments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: payments payments_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: payments payments_reverses_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_reverses_payment_id_fkey FOREIGN KEY (reverses_payment_id) REFERENCES public.payments(id) ON DELETE RESTRICT;


--
-- Name: portal_magic_links portal_magic_links_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_magic_links
    ADD CONSTRAINT portal_magic_links_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: portal_magic_links portal_magic_links_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_magic_links
    ADD CONSTRAINT portal_magic_links_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE CASCADE;


--
-- Name: portal_sessions portal_sessions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: portal_sessions portal_sessions_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE CASCADE;


--
-- Name: portal_sessions portal_sessions_magic_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_magic_link_id_fkey FOREIGN KEY (magic_link_id) REFERENCES public.portal_magic_links(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quittungen quittungen_auftrag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quittungen
    ADD CONSTRAINT quittungen_auftrag_id_fkey FOREIGN KEY (auftrag_id) REFERENCES public.auftraege(id) ON DELETE SET NULL;


--
-- Name: quittungen quittungen_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quittungen
    ADD CONSTRAINT quittungen_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: quittungen quittungen_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quittungen
    ADD CONSTRAINT quittungen_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: quittungen quittungen_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quittungen
    ADD CONSTRAINT quittungen_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;


--
-- Name: quittungen quittungen_payment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quittungen
    ADD CONSTRAINT quittungen_payment_fk FOREIGN KEY (payment_id, company_id) REFERENCES public.payments(id, company_id) ON DELETE SET NULL (payment_id);


--
-- Name: rechnung_nr_counter rechnung_nr_counter_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnung_nr_counter
    ADD CONSTRAINT rechnung_nr_counter_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: rechnungen rechnungen_auftrag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_auftrag_id_fkey FOREIGN KEY (auftrag_id) REFERENCES public.auftraege(id) ON DELETE SET NULL;


--
-- Name: rechnungen rechnungen_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: rechnungen rechnungen_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE SET NULL (customer_id);


--
-- Name: rechnungen rechnungen_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;


--
-- Name: sales_stage_history sales_stage_history_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_stage_history
    ADD CONSTRAINT sales_stage_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: sales_stage_history sales_stage_history_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_stage_history
    ADD CONSTRAINT sales_stage_history_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: service_locations service_locations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_locations
    ADD CONSTRAINT service_locations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: service_locations service_locations_customer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_locations
    ADD CONSTRAINT service_locations_customer_fk FOREIGN KEY (customer_id, company_id) REFERENCES public.customers(id, company_id) ON DELETE CASCADE;


--
-- Name: subscription_payments subscription_payments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: subscription_payments subscription_payments_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);


--
-- Name: subscription_reminders subscription_reminders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_reminders
    ADD CONSTRAINT subscription_reminders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: support_ticket_messages support_ticket_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id);


--
-- Name: support_ticket_messages support_ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id);


--
-- Name: support_tickets support_tickets_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: team_availability team_availability_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_availability
    ADD CONSTRAINT team_availability_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: umzugsbox_rentals umzugsbox_rentals_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzugsbox_rentals
    ADD CONSTRAINT umzugsbox_rentals_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: umzugsbox_rentals umzugsbox_rentals_assigned_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzugsbox_rentals
    ADD CONSTRAINT umzugsbox_rentals_assigned_team_member_id_fkey FOREIGN KEY (assigned_team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: umzugsbox_rentals umzugsbox_rentals_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzugsbox_rentals
    ADD CONSTRAINT umzugsbox_rentals_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: umzugsbox_rentals umzugsbox_rentals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzugsbox_rentals
    ADD CONSTRAINT umzugsbox_rentals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: umzugsbox_rentals umzugsbox_rentals_delivered_by_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzugsbox_rentals
    ADD CONSTRAINT umzugsbox_rentals_delivered_by_team_member_id_fkey FOREIGN KEY (delivered_by_team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: umzugsbox_rentals umzugsbox_rentals_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzugsbox_rentals
    ADD CONSTRAINT umzugsbox_rentals_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: umzugsbox_rentals umzugsbox_rentals_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzugsbox_rentals
    ADD CONSTRAINT umzugsbox_rentals_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;


--
-- Name: umzugsbox_rentals umzugsbox_rentals_picked_up_by_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umzugsbox_rentals
    ADD CONSTRAINT umzugsbox_rentals_picked_up_by_team_member_id_fkey FOREIGN KEY (picked_up_by_team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: lead_forms Active lead forms are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active lead forms are publicly readable" ON public.lead_forms FOR SELECT USING ((is_active = true));


--
-- Name: archive_logs Admins can create archive logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create archive logs" ON public.archive_logs FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: companies Admins can delete companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete companies" ON public.companies FOR DELETE USING (public.is_admin(auth.uid()));


--
-- Name: support_ticket_messages Admins can delete messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete messages" ON public.support_ticket_messages FOR DELETE USING (public.is_support_admin());


--
-- Name: pricing_rules Admins can delete pricing rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete pricing rules" ON public.pricing_rules FOR DELETE USING (public.is_admin(auth.uid()));


--
-- Name: support_tickets Admins can delete tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete tickets" ON public.support_tickets FOR DELETE USING (public.is_support_admin());


--
-- Name: companies Admins can insert companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert companies" ON public.companies FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: pricing_rules Admins can insert pricing rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert pricing rules" ON public.pricing_rules FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: ip_blacklist Admins can manage IP blacklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage IP blacklist" ON public.ip_blacklist USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: service_acquisition_costs Admins can manage acquisition costs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage acquisition costs" ON public.service_acquisition_costs TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: agb_sections Admins can manage all AGB sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all AGB sections" ON public.agb_sections USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: company_plz_coverage Admins can manage all PLZ coverage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all PLZ coverage" ON public.company_plz_coverage USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: appointments Admins can manage all appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all appointments" ON public.appointments USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: auftraege Admins can manage all auftraege; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all auftraege" ON public.auftraege USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role, 'moderator'::public.app_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: team_availability Admins can manage all availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all availability" ON public.team_availability USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: moving_calculation_presets Admins can manage all calculation presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all calculation presets" ON public.moving_calculation_presets USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: company_services Admins can manage all company services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all company services" ON public.company_services USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: landing_pages Admins can manage all landing pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all landing pages" ON public.landing_pages USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: lead_forms Admins can manage all lead forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all lead forms" ON public.lead_forms USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: leistungsuebersicht_templates Admins can manage all leistung templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all leistung templates" ON public.leistungsuebersicht_templates USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: notifications Admins can manage all notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all notifications" ON public.notifications USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: company_offer_settings Admins can manage all offer settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all offer settings" ON public.company_offer_settings USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: company_reminder_settings Admins can manage all reminder settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all reminder settings" ON public.company_reminder_settings USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: firma_resources Admins can manage all resources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all resources" ON public.firma_resources USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: company_service_items Admins can manage all service items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all service items" ON public.company_service_items USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: team_members Admins can manage all team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all team members" ON public.team_members USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: checklist_templates Admins can manage all templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all templates" ON public.checklist_templates USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: company_offer_templates Admins can manage all templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all templates" ON public.company_offer_templates USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: archive_settings Admins can manage archive settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage archive settings" ON public.archive_settings TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: archive_snapshots Admins can manage archive snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage archive snapshots" ON public.archive_snapshots TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: job_price_estimates Admins can manage job price estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage job price estimates" ON public.job_price_estimates TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: pricing_rules Admins can manage pricing rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage pricing rules" ON public.pricing_rules TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: pricing_settings Admins can manage pricing settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage pricing settings" ON public.pricing_settings TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.user_roles TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: service_detail_templates Admins can manage service templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage service templates" ON public.service_detail_templates USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: shared_content Admins can manage shared content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage shared content" ON public.shared_content USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: subscription_payments Admins can manage subscription payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage subscription payments" ON public.subscription_payments USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: subscription_reminders Admins can manage subscription reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage subscription reminders" ON public.subscription_reminders USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: companies Admins can update all companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all companies" ON public.companies FOR UPDATE USING (public.is_admin(auth.uid()));


--
-- Name: klaviertransport_anfragen Admins can update all klaviertransport anfragen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all klaviertransport anfragen" ON public.klaviertransport_anfragen FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['super_admin'::public.app_role, 'admin'::public.app_role, 'moderator'::public.app_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['super_admin'::public.app_role, 'admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: archive_logs Admins can update archive logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update archive logs" ON public.archive_logs FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: support_ticket_messages Admins can update messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update messages" ON public.support_ticket_messages FOR UPDATE USING (public.is_support_admin());


--
-- Name: pricing_rules Admins can update pricing rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update pricing rules" ON public.pricing_rules FOR UPDATE USING (public.is_admin(auth.uid()));


--
-- Name: raeumung_anfragen Admins can update raeumung requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update raeumung requests" ON public.raeumung_anfragen FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));


--
-- Name: umzug_anfragen Admins can update umzug anfragen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update umzug anfragen" ON public.umzug_anfragen FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['super_admin'::public.app_role, 'admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: companies Admins can view all companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all companies" ON public.companies FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: email_logs Admins can view all email logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all email logs" ON public.email_logs FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: appointment_history Admins can view all history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all history" ON public.appointment_history FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: manual_imported_leads Admins can view all imported leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all imported leads" ON public.manual_imported_leads FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: klaviertransport_anfragen Admins can view all klaviertransport anfragen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all klaviertransport anfragen" ON public.klaviertransport_anfragen FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['super_admin'::public.app_role, 'admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: offer_inventory_items Admins can view all offer inventory items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all offer inventory items" ON public.offer_inventory_items FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: offer_items Admins can view all offer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all offer items" ON public.offer_items FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: offer_leistungsuebersicht Admins can view all offer leistungsuebersicht; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all offer leistungsuebersicht" ON public.offer_leistungsuebersicht FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: offers Admins can view all offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all offers" ON public.offers FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: raeumung_anfragen Admins can view all raeumung requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all raeumung requests" ON public.raeumung_anfragen FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


--
-- Name: appointment_reminders Admins can view all reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all reminders" ON public.appointment_reminders FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: landing_page_analytics Admins can view analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view analytics" ON public.landing_page_analytics FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: archive_logs Admins can view archive logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view archive logs" ON public.archive_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: moebellift_anfragen Allow admin full access on moebellift_anfragen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin full access on moebellift_anfragen" ON public.moebellift_anfragen TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role, 'moderator'::public.app_role]))))));


--
-- Name: moebellift_anfragen Allow authenticated read on moebellift_anfragen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read on moebellift_anfragen" ON public.moebellift_anfragen FOR SELECT TO authenticated USING (true);


--
-- Name: moebellift_anfragen Allow public insert on moebellift_anfragen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert on moebellift_anfragen" ON public.moebellift_anfragen FOR INSERT WITH CHECK (true);


--
-- Name: klaviertransport_anfragen Anyone can insert klaviertransport anfragen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert klaviertransport anfragen" ON public.klaviertransport_anfragen FOR INSERT WITH CHECK (true);


--
-- Name: raeumung_anfragen Anyone can insert raeumung requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert raeumung requests" ON public.raeumung_anfragen FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: service_detail_templates Anyone can read service templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read service templates" ON public.service_detail_templates FOR SELECT USING (true);


--
-- Name: umzug_anfragen Anyone can submit umzug anfragen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit umzug anfragen" ON public.umzug_anfragen FOR INSERT WITH CHECK (true);


--
-- Name: service_acquisition_costs Authenticated can read acquisition costs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read acquisition costs" ON public.service_acquisition_costs FOR SELECT TO authenticated USING (true);


--
-- Name: job_price_estimates Authenticated users can read job price estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read job price estimates" ON public.job_price_estimates FOR SELECT TO authenticated USING (true);


--
-- Name: pricing_rules Authenticated users can read pricing rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read pricing rules" ON public.pricing_rules FOR SELECT TO authenticated USING (true);


--
-- Name: pricing_settings Authenticated users can read pricing settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read pricing settings" ON public.pricing_settings FOR SELECT TO authenticated USING (true);


--
-- Name: umzug_anfragen Authenticated users can read umzug anfragen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read umzug anfragen" ON public.umzug_anfragen FOR SELECT TO authenticated USING (true);


--
-- Name: support_ticket_messages Can create ticket messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Can create ticket messages" ON public.support_ticket_messages FOR INSERT WITH CHECK ((((sender_type = 'company'::text) AND (ticket_id IN ( SELECT support_tickets.id
   FROM public.support_tickets
  WHERE (support_tickets.company_id IN ( SELECT public.get_user_company_ids() AS get_user_company_ids))))) OR public.is_support_admin()));


--
-- Name: support_tickets Can update tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Can update tickets" ON public.support_tickets FOR UPDATE USING (((company_id IN ( SELECT public.get_user_company_ids() AS get_user_company_ids)) OR public.is_support_admin()));


--
-- Name: support_ticket_messages Can view ticket messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Can view ticket messages" ON public.support_ticket_messages FOR SELECT USING ((((is_internal = false) AND (ticket_id IN ( SELECT support_tickets.id
   FROM public.support_tickets
  WHERE (support_tickets.company_id IN ( SELECT public.get_user_company_ids() AS get_user_company_ids))))) OR public.is_support_admin()));


--
-- Name: admin_activity_log Owner can read all activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can read all activity logs" ON public.admin_activity_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.email)::text = 'test@test.invalid'::text)))));


--
-- Name: pricing_rules Pricing rules are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pricing rules are publicly readable" ON public.pricing_rules FOR SELECT USING (true);


--
-- Name: pricing_settings Pricing settings are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pricing settings are publicly readable" ON public.pricing_settings FOR SELECT USING (true);


--
-- Name: offers Public can update offer with valid token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can update offer with valid token" ON public.offers FOR UPDATE USING ((((auth.uid() IS NOT NULL) AND public.is_company_owner(company_id, auth.uid())) OR ((auth.uid() IS NOT NULL) AND public.is_admin(auth.uid())))) WITH CHECK ((((auth.uid() IS NOT NULL) AND public.is_company_owner(company_id, auth.uid())) OR ((auth.uid() IS NOT NULL) AND public.is_admin(auth.uid()))));


--
-- Name: shared_content Public can view active shared content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active shared content" ON public.shared_content FOR SELECT USING ((is_active = true));


--
-- Name: blog_categories Public can view blog categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view blog categories" ON public.blog_categories FOR SELECT USING (true);


--
-- Name: offers Public can view offer with valid token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view offer with valid token" ON public.offers FOR SELECT USING ((((auth.uid() IS NOT NULL) AND public.is_company_owner(company_id, auth.uid())) OR ((auth.uid() IS NOT NULL) AND public.is_admin(auth.uid())) OR ((access_token)::text = ((current_setting('request.headers'::text, true))::json ->> 'x-offer-token'::text))));


--
-- Name: blog_posts Public can view published blog posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view published blog posts" ON public.blog_posts FOR SELECT USING (((status)::text = 'published'::text));


--
-- Name: landing_pages Public can view published landing pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view published landing pages" ON public.landing_pages FOR SELECT USING ((is_published = true));


--
-- Name: service_catalog Service catalog is publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service catalog is publicly readable" ON public.service_catalog FOR SELECT USING (true);


--
-- Name: landing_page_analytics Service role can insert analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert analytics" ON public.landing_page_analytics FOR INSERT WITH CHECK (true);


--
-- Name: umzugsbox_rentals Service role full access to box rentals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to box rentals" ON public.umzugsbox_rentals USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: admin_activity_log Staff can insert activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert activity logs" ON public.admin_activity_log FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: user_roles Staff can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all roles" ON public.user_roles FOR SELECT USING (public.is_staff(auth.uid()));


--
-- Name: blog_categories Staff have full access to blog_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff have full access to blog_categories" ON public.blog_categories TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));


--
-- Name: blog_posts Staff have full access to blog_posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff have full access to blog_posts" ON public.blog_posts TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));


--
-- Name: blog_seo_performance Staff have full access to blog_seo_performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff have full access to blog_seo_performance" ON public.blog_seo_performance TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));


--
-- Name: user_roles Super admin can delete roles with hierarchy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin can delete roles with hierarchy" ON public.user_roles FOR DELETE USING ((public.is_super_admin(auth.uid()) AND public.can_modify_role(auth.uid(), user_id)));


--
-- Name: user_roles Super admin can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));


--
-- Name: user_roles Super admin can update roles with hierarchy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin can update roles with hierarchy" ON public.user_roles FOR UPDATE USING ((public.is_super_admin(auth.uid()) AND public.can_modify_role(auth.uid(), user_id))) WITH CHECK ((public.is_super_admin(auth.uid()) AND public.can_modify_role(auth.uid(), user_id)));


--
-- Name: swiss_plz Swiss PLZ is publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Swiss PLZ is publicly readable" ON public.swiss_plz FOR SELECT USING (true);


--
-- Name: companies Users can insert their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own company" ON public.companies FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: admin_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: agb_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agb_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: agb_sections agb_sections_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agb_sections_manage_member ON public.agb_sections USING (public.is_company_member(company_id));


--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_history ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_history appointment_history_view_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointment_history_view_member ON public.appointment_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = appointment_history.appointment_id) AND public.is_company_member(a.company_id)))));


--
-- Name: appointment_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_reminders appointment_reminders_view_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointment_reminders_view_member ON public.appointment_reminders FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = appointment_reminders.appointment_id) AND public.is_company_member(a.company_id)))));


--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments appointments_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_manage_member ON public.appointments USING (public.is_company_member(company_id));


--
-- Name: archive_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.archive_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: archive_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.archive_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: archive_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.archive_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: auftraege; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auftraege ENABLE ROW LEVEL SECURITY;

--
-- Name: auftraege auftraege_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auftraege_manage_member ON public.auftraege USING (public.is_company_member(company_id));


--
-- Name: automation_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_deliveries automation_deliveries_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_deliveries_select_member ON public.automation_deliveries FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: blog_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_seo_performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_seo_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_case_events case_events_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY case_events_select_member ON public.customer_case_events FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: customer_change_requests change_requests_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_requests_select_member ON public.customer_change_requests FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: checklist_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_templates checklist_templates_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_templates_select_member ON public.checklist_templates FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: checklist_templates checklist_templates_write_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_templates_write_owner_admin ON public.checklist_templates TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: communication_messages comm_messages_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comm_messages_select_member ON public.communication_messages FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: communication_messages comm_messages_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comm_messages_update_member ON public.communication_messages FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));


--
-- Name: communication_threads comm_threads_delete_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comm_threads_delete_owner_admin ON public.communication_threads FOR DELETE TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: communication_threads comm_threads_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comm_threads_insert_member ON public.communication_threads FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));


--
-- Name: communication_threads comm_threads_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comm_threads_select_member ON public.communication_threads FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: communication_threads comm_threads_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comm_threads_update_member ON public.communication_threads FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));


--
-- Name: communication_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: communication_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: companies companies_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_select_member ON public.companies FOR SELECT TO authenticated USING ((public.is_company_member(id) OR public.is_admin(auth.uid())));


--
-- Name: companies companies_update_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_update_owner_admin ON public.companies FOR UPDATE TO authenticated USING (public.is_company_role(id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_company_role(id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: company_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

--
-- Name: company_offer_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_offer_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: company_offer_settings company_offer_settings_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_offer_settings_select_member ON public.company_offer_settings FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: company_offer_settings company_offer_settings_write_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_offer_settings_write_owner_admin ON public.company_offer_settings TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: company_offer_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_offer_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: company_offer_templates company_offer_templates_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_offer_templates_manage_member ON public.company_offer_templates USING (public.is_company_member(company_id));


--
-- Name: api_keys company_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_owner_delete ON public.api_keys FOR DELETE USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.user_id = auth.uid()))));


--
-- Name: api_keys company_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_owner_insert ON public.api_keys FOR INSERT WITH CHECK ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.user_id = auth.uid()))));


--
-- Name: api_keys company_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_owner_select ON public.api_keys FOR SELECT USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.user_id = auth.uid()))));


--
-- Name: api_keys company_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_owner_update ON public.api_keys FOR UPDATE USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.user_id = auth.uid()))));


--
-- Name: company_plz_coverage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_plz_coverage ENABLE ROW LEVEL SECURITY;

--
-- Name: company_plz_coverage company_plz_coverage_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_plz_coverage_manage_member ON public.company_plz_coverage USING (public.is_company_member(company_id));


--
-- Name: company_pricing_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_pricing_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: company_pricing_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_pricing_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: company_pricing_configs company_pricing_configs_delete_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_pricing_configs_delete_member ON public.company_pricing_configs FOR DELETE USING (public.is_company_member(company_id));


--
-- Name: company_pricing_configs company_pricing_configs_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_pricing_configs_insert_member ON public.company_pricing_configs FOR INSERT WITH CHECK (public.is_company_member(company_id));


--
-- Name: company_pricing_configs company_pricing_configs_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_pricing_configs_select_member ON public.company_pricing_configs FOR SELECT USING (public.is_company_member(company_id));


--
-- Name: company_pricing_configs company_pricing_configs_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_pricing_configs_update_member ON public.company_pricing_configs FOR UPDATE USING (public.is_company_member(company_id));


--
-- Name: company_reminder_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_reminder_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: company_reminder_settings company_reminder_settings_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_reminder_settings_select_member ON public.company_reminder_settings FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: company_reminder_settings company_reminder_settings_write_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_reminder_settings_write_owner_admin ON public.company_reminder_settings TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: company_secrets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_secrets ENABLE ROW LEVEL SECURITY;

--
-- Name: company_service_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_service_items ENABLE ROW LEVEL SECURITY;

--
-- Name: company_service_items company_service_items_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_service_items_manage_member ON public.company_service_items USING (public.is_company_member(company_id));


--
-- Name: company_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_services ENABLE ROW LEVEL SECURITY;

--
-- Name: company_services company_services_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_services_manage_member ON public.company_services USING (public.is_company_member(company_id));


--
-- Name: cookie_consent_log cookie_consent_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cookie_consent_admin_read ON public.cookie_consent_log FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: cookie_consent_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cookie_consent_log ENABLE ROW LEVEL SECURITY;

--
-- Name: cookie_consent_log cookie_consent_public_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cookie_consent_public_insert ON public.cookie_consent_log FOR INSERT WITH CHECK (true);


--
-- Name: credit_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_notes credit_notes_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_notes_select_member ON public.credit_notes FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: credit_notes credit_notes_write_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_notes_write_owner_admin ON public.credit_notes TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: crm_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_tasks crm_tasks_delete_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_tasks_delete_member ON public.crm_tasks FOR DELETE TO authenticated USING (public.is_company_member(company_id));


--
-- Name: crm_tasks crm_tasks_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_tasks_insert_member ON public.crm_tasks FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));


--
-- Name: crm_tasks crm_tasks_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_tasks_select_member ON public.crm_tasks FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: crm_tasks crm_tasks_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_tasks_update_member ON public.crm_tasks FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));


--
-- Name: customer_case_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_case_events ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_cases customer_cases_delete_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_cases_delete_owner_admin ON public.customer_cases FOR DELETE TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: customer_cases customer_cases_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_cases_insert_member ON public.customer_cases FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));


--
-- Name: customer_cases customer_cases_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_cases_select_member ON public.customer_cases FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: customer_cases customer_cases_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_cases_update_member ON public.customer_cases FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));


--
-- Name: customer_change_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_change_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_merges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_merges ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_merges customer_merges_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_merges_select_member ON public.customer_merges FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customers_delete_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_delete_owner_admin ON public.customers FOR DELETE TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: customers customers_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_insert_member ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));


--
-- Name: customers customers_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_select_admin ON public.customers FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: customers customers_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_select_member ON public.customers FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: customers customers_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_update_member ON public.customers FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));


--
-- Name: edge_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: email_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: fall_nr_counter; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fall_nr_counter ENABLE ROW LEVEL SECURITY;

--
-- Name: firma_resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.firma_resources ENABLE ROW LEVEL SECURITY;

--
-- Name: firma_resources firma_resources_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY firma_resources_select_member ON public.firma_resources FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: firma_resources firma_resources_write_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY firma_resources_write_owner_admin ON public.firma_resources TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: gutschrift_nr_counter; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gutschrift_nr_counter ENABLE ROW LEVEL SECURITY;

--
-- Name: inbound_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: inbound_emails inbound_emails_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_emails_manage_member ON public.inbound_emails USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));


--
-- Name: inbound_emails inbound_emails_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_emails_select_admin ON public.inbound_emails FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: invoice_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_reminders invoice_reminders_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_reminders_select_member ON public.invoice_reminders FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: invoice_reminders invoice_reminders_write_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_reminders_write_owner_admin ON public.invoice_reminders TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: ip_blacklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;

--
-- Name: job_price_estimates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_price_estimates ENABLE ROW LEVEL SECURITY;

--
-- Name: klaviertransport_anfragen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.klaviertransport_anfragen ENABLE ROW LEVEL SECURITY;

--
-- Name: landing_page_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.landing_page_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: landing_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_confirmations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_confirmations ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_confirmations lead_confirmations_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_confirmations_admin_select ON public.lead_confirmations FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: POLICY lead_confirmations_admin_select ON lead_confirmations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY lead_confirmations_admin_select ON public.lead_confirmations IS 'Sadece admin kullanıcılar confirmation kayıtlarını görebilir. Token doğrulama edge function üzerinden SECURITY DEFINER ile yapılır.';


--
-- Name: lead_forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: leads leads_delete_company_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_delete_company_or_admin ON public.leads FOR DELETE TO authenticated USING ((public.is_admin(auth.uid()) OR public.is_company_member(company_id, auth.uid())));


--
-- Name: leads leads_public_insert_v2; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_public_insert_v2 ON public.leads FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: leads leads_select_company_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_select_company_or_admin ON public.leads FOR SELECT TO authenticated USING ((public.is_admin(auth.uid()) OR public.is_company_member(company_id, auth.uid())));


--
-- Name: leads leads_update_company_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_update_company_or_admin ON public.leads FOR UPDATE TO authenticated USING ((public.is_admin(auth.uid()) OR public.is_company_member(company_id, auth.uid()))) WITH CHECK ((public.is_admin(auth.uid()) OR public.is_company_member(company_id, auth.uid())));


--
-- Name: leistungsuebersicht_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leistungsuebersicht_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: leistungsuebersicht_templates leistungsuebersicht_templates_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leistungsuebersicht_templates_select_member ON public.leistungsuebersicht_templates FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: leistungsuebersicht_templates leistungsuebersicht_templates_write_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leistungsuebersicht_templates_write_owner_admin ON public.leistungsuebersicht_templates TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: manual_imported_leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manual_imported_leads ENABLE ROW LEVEL SECURITY;

--
-- Name: manual_imported_leads manual_imported_leads_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manual_imported_leads_manage_member ON public.manual_imported_leads USING (public.is_company_member(company_id));


--
-- Name: company_members members_delete_service_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_delete_service_only ON public.company_members FOR DELETE TO service_role USING (true);


--
-- Name: company_members members_insert_service_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_insert_service_only ON public.company_members FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: company_members members_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_select_own ON public.company_members FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: moebellift_anfragen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.moebellift_anfragen ENABLE ROW LEVEL SECURITY;

--
-- Name: moving_calculation_presets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.moving_calculation_presets ENABLE ROW LEVEL SECURITY;

--
-- Name: moving_calculation_presets moving_calculation_presets_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY moving_calculation_presets_select_member ON public.moving_calculation_presets FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: moving_calculation_presets moving_calculation_presets_write_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY moving_calculation_presets_write_owner_admin ON public.moving_calculation_presets TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_delete_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_delete_member ON public.notifications FOR DELETE USING (public.is_company_member(company_id));


--
-- Name: notifications notifications_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_member ON public.notifications FOR SELECT USING (public.is_company_member(company_id));


--
-- Name: notifications notifications_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_member ON public.notifications FOR UPDATE USING (public.is_company_member(company_id));


--
-- Name: offer_amendment_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_amendment_items ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_amendment_items offer_amendment_items_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_amendment_items_manage_member ON public.offer_amendment_items TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.offer_amendments a
  WHERE ((a.id = offer_amendment_items.amendment_id) AND public.is_company_member(a.company_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.offer_amendments a
  WHERE ((a.id = offer_amendment_items.amendment_id) AND public.is_company_member(a.company_id)))));


--
-- Name: offer_amendments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_amendments ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_amendments offer_amendments_delete_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_amendments_delete_owner_admin ON public.offer_amendments FOR DELETE TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: offer_amendments offer_amendments_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_amendments_insert_member ON public.offer_amendments FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));


--
-- Name: offer_amendments offer_amendments_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_amendments_select_member ON public.offer_amendments FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: offer_amendments offer_amendments_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_amendments_update_member ON public.offer_amendments FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));


--
-- Name: offer_inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_inventory_items offer_inventory_items_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_inventory_items_manage_member ON public.offer_inventory_items USING ((EXISTS ( SELECT 1
   FROM public.offers o
  WHERE ((o.id = offer_inventory_items.offer_id) AND public.is_company_member(o.company_id)))));


--
-- Name: offer_item_area_meta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_item_area_meta ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_item_area_meta offer_item_area_meta_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_item_area_meta_admin_select ON public.offer_item_area_meta FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: offer_item_area_meta offer_item_area_meta_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_item_area_meta_manage_member ON public.offer_item_area_meta USING ((EXISTS ( SELECT 1
   FROM (public.offer_items oi
     JOIN public.offers o ON ((o.id = oi.offer_id)))
  WHERE ((oi.id = offer_item_area_meta.offer_item_id) AND public.is_company_member(o.company_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.offer_items oi
     JOIN public.offers o ON ((o.id = oi.offer_id)))
  WHERE ((oi.id = offer_item_area_meta.offer_item_id) AND public.is_company_member(o.company_id)))));


--
-- Name: offer_item_breakdown; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_item_breakdown ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_item_breakdown offer_item_breakdown_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_item_breakdown_admin_select ON public.offer_item_breakdown FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: offer_item_breakdown offer_item_breakdown_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_item_breakdown_manage_member ON public.offer_item_breakdown USING ((EXISTS ( SELECT 1
   FROM (public.offer_items oi
     JOIN public.offers o ON ((o.id = oi.offer_id)))
  WHERE ((oi.id = offer_item_breakdown.offer_item_id) AND public.is_company_member(o.company_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.offer_items oi
     JOIN public.offers o ON ((o.id = oi.offer_id)))
  WHERE ((oi.id = offer_item_breakdown.offer_item_id) AND public.is_company_member(o.company_id)))));


--
-- Name: offer_item_effort_meta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_item_effort_meta ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_item_effort_meta offer_item_effort_meta_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_item_effort_meta_admin_select ON public.offer_item_effort_meta FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: offer_item_effort_meta offer_item_effort_meta_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_item_effort_meta_manage_member ON public.offer_item_effort_meta USING ((EXISTS ( SELECT 1
   FROM (public.offer_items oi
     JOIN public.offers o ON ((o.id = oi.offer_id)))
  WHERE ((oi.id = offer_item_effort_meta.offer_item_id) AND public.is_company_member(o.company_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.offer_items oi
     JOIN public.offers o ON ((o.id = oi.offer_id)))
  WHERE ((oi.id = offer_item_effort_meta.offer_item_id) AND public.is_company_member(o.company_id)))));


--
-- Name: offer_item_leistung; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_item_leistung ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_item_leistung offer_item_leistung_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_item_leistung_admin_select ON public.offer_item_leistung FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: offer_item_leistung offer_item_leistung_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_item_leistung_manage_member ON public.offer_item_leistung USING ((EXISTS ( SELECT 1
   FROM (public.offer_items oi
     JOIN public.offers o ON ((o.id = oi.offer_id)))
  WHERE ((oi.id = offer_item_leistung.offer_item_id) AND public.is_company_member(o.company_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.offer_items oi
     JOIN public.offers o ON ((o.id = oi.offer_id)))
  WHERE ((oi.id = offer_item_leistung.offer_item_id) AND public.is_company_member(o.company_id)))));


--
-- Name: offer_item_volume_meta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_item_volume_meta ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_item_volume_meta offer_item_volume_meta_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_item_volume_meta_admin_select ON public.offer_item_volume_meta FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: offer_item_volume_meta offer_item_volume_meta_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_item_volume_meta_manage_member ON public.offer_item_volume_meta USING ((EXISTS ( SELECT 1
   FROM (public.offer_items oi
     JOIN public.offers o ON ((o.id = oi.offer_id)))
  WHERE ((oi.id = offer_item_volume_meta.offer_item_id) AND public.is_company_member(o.company_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.offer_items oi
     JOIN public.offers o ON ((o.id = oi.offer_id)))
  WHERE ((oi.id = offer_item_volume_meta.offer_item_id) AND public.is_company_member(o.company_id)))));


--
-- Name: offer_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_items offer_items_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_items_manage_member ON public.offer_items USING ((EXISTS ( SELECT 1
   FROM public.offers o
  WHERE ((o.id = offer_items.offer_id) AND public.is_company_member(o.company_id)))));


--
-- Name: offer_leistungsuebersicht; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_leistungsuebersicht ENABLE ROW LEVEL SECURITY;

--
-- Name: offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

--
-- Name: offers offers_delete_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_delete_member ON public.offers FOR DELETE USING (public.is_company_member(company_id));


--
-- Name: offers offers_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_insert_member ON public.offers FOR INSERT WITH CHECK (public.is_company_member(company_id));


--
-- Name: offers offers_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_select_member ON public.offers FOR SELECT USING (public.is_company_member(company_id));


--
-- Name: offers offers_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_update_member ON public.offers FOR UPDATE USING (public.is_company_member(company_id));


--
-- Name: payment_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_allocations payment_allocations_delete_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_allocations_delete_owner_admin ON public.payment_allocations FOR DELETE TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: payment_allocations payment_allocations_insert_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_allocations_insert_owner_admin ON public.payment_allocations FOR INSERT TO authenticated WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: payment_allocations payment_allocations_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_allocations_select_member ON public.payment_allocations FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payments payments_insert_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_insert_owner_admin ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: payments payments_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_select_member ON public.payments FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: payments payments_update_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_update_owner_admin ON public.payments FOR UPDATE TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text])) WITH CHECK (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: portal_magic_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_magic_links ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_magic_links portal_magic_links_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portal_magic_links_select_member ON public.portal_magic_links FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: portal_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_sessions portal_sessions_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portal_sessions_select_member ON public.portal_sessions FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: company_pricing_audit_log pricing_audit_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pricing_audit_select_member ON public.company_pricing_audit_log FOR SELECT USING (public.is_company_member(company_id));


--
-- Name: pricing_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: quittungen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quittungen ENABLE ROW LEVEL SECURITY;

--
-- Name: quittungen quittungen_delete_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quittungen_delete_member ON public.quittungen FOR DELETE USING (public.is_company_member(company_id));


--
-- Name: quittungen quittungen_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quittungen_insert_member ON public.quittungen FOR INSERT WITH CHECK (public.is_company_member(company_id));


--
-- Name: quittungen quittungen_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quittungen_select_member ON public.quittungen FOR SELECT USING (public.is_company_member(company_id));


--
-- Name: quittungen quittungen_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quittungen_update_member ON public.quittungen FOR UPDATE USING (public.is_company_member(company_id));


--
-- Name: raeumung_anfragen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.raeumung_anfragen ENABLE ROW LEVEL SECURITY;

--
-- Name: rechnung_nr_counter; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rechnung_nr_counter ENABLE ROW LEVEL SECURITY;

--
-- Name: rechnungen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rechnungen ENABLE ROW LEVEL SECURITY;

--
-- Name: rechnungen rechnungen_company_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rechnungen_company_delete ON public.rechnungen FOR DELETE TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: rechnungen rechnungen_company_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rechnungen_company_insert ON public.rechnungen FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));


--
-- Name: rechnungen rechnungen_company_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rechnungen_company_select ON public.rechnungen FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: rechnungen rechnungen_company_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rechnungen_company_update ON public.rechnungen FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));


--
-- Name: sales_stage_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_stage_history ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_stage_history sales_stage_history_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_stage_history_select_member ON public.sales_stage_history FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: service_acquisition_costs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_acquisition_costs ENABLE ROW LEVEL SECURITY;

--
-- Name: service_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: service_detail_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_detail_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: service_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: service_locations service_locations_delete_owner_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_locations_delete_owner_admin ON public.service_locations FOR DELETE TO authenticated USING (public.is_company_role(company_id, ARRAY['owner'::text, 'admin'::text]));


--
-- Name: service_locations service_locations_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_locations_insert_member ON public.service_locations FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));


--
-- Name: service_locations service_locations_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_locations_select_member ON public.service_locations FOR SELECT TO authenticated USING (public.is_company_member(company_id));


--
-- Name: service_locations service_locations_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_locations_update_member ON public.service_locations FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));


--
-- Name: shared_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shared_content ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_payments subscription_payments_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscription_payments_select_member ON public.subscription_payments FOR SELECT USING (public.is_company_member(company_id));


--
-- Name: subscription_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: support_ticket_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: swiss_plz; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.swiss_plz ENABLE ROW LEVEL SECURITY;

--
-- Name: team_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: team_availability team_availability_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_availability_manage_member ON public.team_availability USING ((EXISTS ( SELECT 1
   FROM public.team_members tm
  WHERE ((tm.id = team_availability.team_member_id) AND public.is_company_member(tm.company_id)))));


--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members team_members_manage_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_members_manage_member ON public.team_members USING (public.is_company_member(company_id));


--
-- Name: umzug_anfragen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.umzug_anfragen ENABLE ROW LEVEL SECURITY;

--
-- Name: umzugsbox_rentals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.umzugsbox_rentals ENABLE ROW LEVEL SECURITY;

--
-- Name: umzugsbox_rentals umzugsbox_rentals_delete_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY umzugsbox_rentals_delete_member ON public.umzugsbox_rentals FOR DELETE USING (public.is_company_member(company_id));


--
-- Name: umzugsbox_rentals umzugsbox_rentals_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY umzugsbox_rentals_insert_member ON public.umzugsbox_rentals FOR INSERT WITH CHECK (public.is_company_member(company_id));


--
-- Name: umzugsbox_rentals umzugsbox_rentals_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY umzugsbox_rentals_select_member ON public.umzugsbox_rentals FOR SELECT USING (public.is_company_member(company_id));


--
-- Name: umzugsbox_rentals umzugsbox_rentals_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY umzugsbox_rentals_update_member ON public.umzugsbox_rentals FOR UPDATE USING (public.is_company_member(company_id));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: website_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: website_settings website_settings_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY website_settings_admin_write ON public.website_settings USING (public.is_admin(auth.uid()));


--
-- Name: website_settings website_settings_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY website_settings_public_read ON public.website_settings FOR SELECT USING (true);


--
-- PostgreSQL database dump complete
--

