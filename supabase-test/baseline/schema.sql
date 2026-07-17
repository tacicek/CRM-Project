-- CRM TEST BASELINE — SANITIZED, LOCAL INTEGRATION TESTS ONLY (not a prod migration).
-- From read-only prod --schema-only dump; 4 external-call fn bodies stubbed, URL/email/JWT literals neutralized.
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
-- Name: atomic_accept_lead(uuid, uuid, uuid, numeric, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atomic_accept_lead(p_lead_id uuid, p_distribution_id uuid, p_company_id uuid, p_token_cost numeric, p_current_balance numeric, p_max_companies integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_lead RECORD;
  v_distribution RECORD;
  v_company RECORD;
  v_new_accepted_count INTEGER;
  v_new_balance DECIMAL;
  v_quota_full BOOLEAN := FALSE;
BEGIN
  -- Lock the lead row to prevent concurrent quota modifications
  SELECT id, accepted_count, max_companies, service_type, from_city, from_plz, status
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead nicht gefunden');
  END IF;

  -- Check if quota is already full
  IF COALESCE(v_lead.accepted_count, 0) >= COALESCE(v_lead.max_companies, p_max_companies) THEN
    UPDATE public.lead_distributions
    SET status = 'quota_full', responded_at = NOW()
    WHERE id = p_distribution_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Das Kontingent für diese Anfrage ist bereits voll',
      'quota_full', true
    );
  END IF;

  -- Lock and check distribution
  SELECT id, status
  INTO v_distribution
  FROM public.lead_distributions
  WHERE id = p_distribution_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verteilung nicht gefunden');
  END IF;

  IF v_distribution.status != 'sent' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Diese Anfrage wurde bereits bearbeitet',
      'status', v_distribution.status
    );
  END IF;

  -- Re-fetch actual token balance from DB with row lock (prevents double-spend)
  SELECT id, token_balance
  INTO v_company
  FROM public.companies
  WHERE id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Firma nicht gefunden');
  END IF;

  IF COALESCE(v_company.token_balance, 0) < p_token_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nicht genügend Tokens',
      'required', p_token_cost,
      'current', v_company.token_balance
    );
  END IF;

  -- All checks passed — atomically update everything

  -- 1. Increment accepted_count on lead
  v_new_accepted_count := COALESCE(v_lead.accepted_count, 0) + 1;
  v_quota_full := v_new_accepted_count >= COALESCE(v_lead.max_companies, p_max_companies);

  UPDATE public.leads
  SET
    accepted_count = v_new_accepted_count,
    status = CASE WHEN v_quota_full THEN 'completed' ELSE status END
  WHERE id = p_lead_id;

  -- 2. Mark this distribution as accepted
  UPDATE public.lead_distributions
  SET
    status = 'accepted',
    responded_at = NOW(),
    token_charged = true
  WHERE id = p_distribution_id;

  -- 3. Deduct tokens (using live balance from DB)
  v_new_balance := COALESCE(v_company.token_balance, 0) - p_token_cost;

  UPDATE public.companies
  SET token_balance = v_new_balance
  WHERE id = p_company_id;

  -- 4. Record token transaction
  INSERT INTO public.token_transactions (
    company_id,
    type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    description
  ) VALUES (
    p_company_id,
    'charge',
    -p_token_cost,
    v_company.token_balance,
    v_new_balance,
    'lead',
    p_lead_id,
    'Lead angenommen: ' || v_lead.service_type || ' in ' || v_lead.from_city
  );

  -- 5. If quota is now full, mark remaining sent distributions as quota_full
  IF v_quota_full THEN
    UPDATE public.lead_distributions
    SET status = 'quota_full', responded_at = NOW()
    WHERE lead_id = p_lead_id
      AND status = 'sent'
      AND id != p_distribution_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_accepted_count', v_new_accepted_count,
    'new_balance', v_new_balance,
    'quota_full', v_quota_full
  );
END;
$$;


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
    LANGUAGE plpgsql
    AS $_$
DECLARE
  next_nr  INTEGER;
  year_str TEXT;
BEGIN
  IF NEW.rechnung_nr IS NULL THEN
    year_str := to_char(NOW(), 'YYYY');

    -- Bu firmanın bu yıldaki en yüksek numarasını bul, +1 al (per-company sayaç)
    SELECT COALESCE(
      MAX(
        CASE
          WHEN rechnung_nr ~ ('^RE-' || year_str || '-[0-9]+$')
          THEN CAST(SPLIT_PART(rechnung_nr, '-', 3) AS INTEGER)
          ELSE 0
        END
      ), 0
    ) + 1
    INTO next_nr
    FROM rechnungen
    WHERE company_id = NEW.company_id;

    NEW.rechnung_nr := 'RE-' || year_str || '-' || LPAD(next_nr::text, 4, '0');
  END IF;

  -- Fälligkeit: standardmäßig datum + 30 Tage
  IF NEW.faellig_am IS NULL THEN
    NEW.faellig_am := NEW.datum + 30;
  END IF;

  RETURN NEW;
END;
$_$;


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
    AND u.email = 'redacted@example.test'
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
    AND u.email = 'redacted@example.test'
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

CREATE FUNCTION public.get_box_rental_stats(p_company_id uuid) RETURNS TABLE(total_active integer, overdue integer, pickup_today integer, pickup_this_week integer, total_boxes_out integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_active,
    COUNT(*) FILTER (WHERE expected_return_date < CURRENT_DATE)::INTEGER as overdue,
    COUNT(*) FILTER (WHERE expected_return_date = CURRENT_DATE OR pickup_scheduled_date = CURRENT_DATE)::INTEGER as pickup_today,
    COUNT(*) FILTER (WHERE expected_return_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::INTEGER as pickup_this_week,
    COALESCE(SUM(get_total_box_quantity(box_items)), 0)::INTEGER as total_boxes_out
  FROM umzugsbox_rentals
  WHERE company_id = p_company_id
    AND status IN ('delivered', 'in_use', 'pickup_requested', 'pickup_scheduled')
    AND is_rental = true
    AND archived_at IS NULL;
END;
$$;


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

CREATE FUNCTION public.get_offer_by_token(offer_access_token text) RETURNS TABLE(id uuid, title character varying, description text, customer_first_name character varying, customer_last_name character varying, customer_email character varying, customer_phone character varying, service_date date, valid_until date, subtotal numeric, vat_rate numeric, vat_amount numeric, total numeric, status character varying, created_at timestamp with time zone, sent_at timestamp with time zone, viewed_at timestamp with time zone, accepted_at timestamp with time zone, rejected_at timestamp with time zone, company_id uuid, lead_id uuid, agb_accepted_at timestamp with time zone, service_type character varying, is_expired boolean, from_street character varying, from_house_number character varying, from_plz character varying, from_city character varying, from_floor integer, from_has_lift boolean, to_street character varying, to_house_number character varying, to_plz character varying, to_city character varying, to_floor integer, to_has_lift boolean, surcharges jsonb, price_model text, hourly_rate numeric, kostendach_max numeric, offerte_type text, discount_percent numeric, from_has_estrich boolean, from_has_keller boolean, language text)
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
    o.language
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
    AND u.email = 'redacted@example.test'
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
  WHERE u.email != 'redacted@example.test'
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

COMMENT ON FUNCTION public.submit_lead_json(lead_data jsonb) IS 'Public lead insert. Validates required fields (service_type, names, email format, phone, PLZ, city). Dedup: returns existing slug if same email+service_type+from_plz submitted within 1 hour. Sets expires_at = NOW() + 30 days. Status always pending_verification until admin verifies.';


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
    AS $$ BEGIN RETURN NULL; END; $$;


--
-- Name: FUNCTION trigger_team_reminder_for_appointment(p_appointment_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_team_reminder_for_appointment(p_appointment_id uuid) IS 'Manually trigger a team reminder for a specific appointment';


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
  ALLOWED_STATUSES      text[] := ARRAY['viewed', 'accepted', 'rejected'];
  TERMINAL_STATUSES     text[] := ARRAY['accepted', 'rejected'];
BEGIN
  -- Validate new_status against whitelist
  IF new_status IS NOT NULL AND NOT (new_status = ANY(ALLOWED_STATUSES)) THEN
    RAISE EXCEPTION 'Invalid status value: %', new_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Offer bilgilerini oku
  SELECT status, service_date, valid_until, id, company_id, lead_id
  INTO v_status, v_service_date, v_valid_until, v_offer_id, v_company_id, v_lead_id
  FROM public.offers
  WHERE access_token = offer_access_token;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Terminal statüdeki teklifler üzerinde status değişikliği yapılamaz
  -- (kabul edilmiş teklif reddedilemez, reddedilmiş kabul edilemez)
  IF new_status IS NOT NULL AND v_status = ANY(TERMINAL_STATUSES) THEN
    RETURN false;
  END IF;

  -- Kabul ediliyorsa son tarih kontrolü
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

  -- Offers tablosunu güncelle
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

  -- Auftrag otomatik oluştur (kabul durumunda, idempotent).
  -- Full column set restored from 20260411000004 — the 20260606 rewrite reduced
  -- this to a minimal INSERT that omitted the NOT-NULL scheduled_date (and other
  -- useful fields), so it could never succeed.
  IF new_status = 'accepted' AND v_offer_id IS NOT NULL THEN
    INSERT INTO public.auftraege (
      company_id,
      offer_id,
      lead_id,
      auftrag_nummer,
      title,
      customer_name,
      customer_email,
      customer_phone,
      from_address,
      to_address,
      scheduled_date,
      scheduled_time,
      description,
      status,
      subtotal,
      vat_rate,
      vat_amount,
      total,
      service_type,
      pricing_type,
      hourly_rate,
      items
    )
    SELECT
      o.company_id,
      o.id,
      o.lead_id,
      '',   -- auftrag_nummer: trigger tarafından otomatik oluşturulur
      COALESCE(NULLIF(o.title, ''), 'Auftrag'),
      TRIM(CONCAT(
        COALESCE(o.customer_first_name, ''), ' ',
        COALESCE(o.customer_last_name, '')
      )),
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
      -- C2: freeze the offer's financial snapshot onto the Auftrag (the manual
      -- AuftragModal path already did this; the accept path did not → total=0, items=[]).
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

    -- lead_distributions has no updated_at column; responded_at is the correct
    -- response-time field (consistent with 20260411000004).
    UPDATE public.lead_distributions
    SET status = 'job_confirmed', responded_at = COALESCE(responded_at, NOW())
    WHERE lead_id = v_lead_id AND company_id = v_company_id;

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
    CONSTRAINT appointments_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text])))
);

ALTER TABLE ONLY public.appointments REPLICA IDENTITY FULL;


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
    twilio_account_sid text,
    twilio_auth_token text,
    twilio_phone_number text,
    sms_reminders_enabled boolean DEFAULT false,
    resend_enabled boolean DEFAULT false,
    resend_api_key text,
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
-- Name: lead_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_distributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    company_id uuid NOT NULL,
    status character varying(50) DEFAULT 'sent'::character varying,
    sent_at timestamp with time zone DEFAULT now(),
    viewed_at timestamp with time zone,
    responded_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
    rejection_reason text,
    CONSTRAINT chk_lead_distributions_status CHECK (((status)::text = ANY ((ARRAY['sent'::character varying, 'accepted'::character varying, 'quota_full'::character varying, 'rejected'::character varying, 'expired'::character varying, 'job_confirmed'::character varying])::text[])))
);

ALTER TABLE ONLY public.lead_distributions REPLICA IDENTITY FULL;


--
-- Name: CONSTRAINT chk_lead_distributions_status ON lead_distributions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT chk_lead_distributions_status ON public.lead_distributions IS 'İzin verilen lead_distributions durum değerleri.';


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
    source character varying(100) DEFAULT 'website'::character varying,
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
    CONSTRAINT chk_leads_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'pending_verification'::character varying, 'awaiting_customer_confirmation'::character varying, 'unconfirmed_risky'::character varying, 'verified'::character varying, 'in_progress'::character varying, 'distributed'::character varying, 'no_matches'::character varying, 'unknown_plz'::character varying, 'completed'::character varying, 'rejected'::character varying, 'expired_unverified'::character varying, 'job_confirmed'::character varying])::text[]))),
    CONSTRAINT leads_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT leads_source_check CHECK (((source)::text = ANY ((ARRAY['web_form'::character varying, 'ai_voice'::character varying, 'manual'::character varying, 'import'::character varying, 'widget'::character varying, 'api'::character varying])::text[])))
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

COMMENT ON COLUMN public.leads.source IS 'Origin of the lead: web_form, ai_voice, manual, import, widget, api';


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
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    lead_id uuid,
    lead_distribution_id uuid,
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
-- Name: offer_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.offer_details AS
 SELECT o.id,
    o.company_id,
    o.lead_id,
    o.lead_distribution_id,
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
    CONSTRAINT chk_quittung_gesamt CHECK ((round(gesamttotal, 2) = round((total + mwst_betrag), 2))),
    CONSTRAINT chk_quittung_mwst CHECK ((round(mwst_betrag, 2) = round(((total * mwst_satz) / (100)::numeric), 2))),
    CONSTRAINT chk_quittung_total_from_rabatt CHECK ((round(total, 2) = round(GREATEST((zwischensumme - rabatt), (0)::numeric), 2))),
    CONSTRAINT quittungen_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT quittungen_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'signed'::text, 'sent'::text, 'paid'::text])))
);


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
    CONSTRAINT rechnungen_anrede_check CHECK (((anrede IS NULL) OR (anrede = ANY (ARRAY['Herr'::text, 'Frau'::text])))),
    CONSTRAINT rechnungen_language_check CHECK ((language = ANY (ARRAY['de'::text, 'fr'::text, 'en'::text]))),
    CONSTRAINT rechnungen_status_check CHECK ((status = ANY (ARRAY['entwurf'::text, 'versendet'::text, 'bezahlt'::text, 'ueberfaellig'::text])))
);


--
-- Name: TABLE rechnungen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rechnungen IS 'Swiss QR-Bill faturaları. abgeschlossen Auftrag''tan üretilir (auftrag_id UNIQUE = mükerrer engel). Kalemler offer_items''tan snapshot. quittungen (makbuz) sisteminden bağımsız.';


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

CREATE VIEW public.virtual_besichtigung_sessions AS
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
-- Name: firma_resources firma_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firma_resources
    ADD CONSTRAINT firma_resources_pkey PRIMARY KEY (id);


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
-- Name: lead_distributions lead_distributions_lead_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_distributions
    ADD CONSTRAINT lead_distributions_lead_id_company_id_key UNIQUE (lead_id, company_id);


--
-- Name: lead_distributions lead_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_distributions
    ADD CONSTRAINT lead_distributions_pkey PRIMARY KEY (id);


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
-- Name: quittungen quittungen_quittung_nr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quittungen
    ADD CONSTRAINT quittungen_quittung_nr_key UNIQUE (quittung_nr);


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
-- Name: rechnungen rechnungen_auftrag_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_auftrag_id_key UNIQUE (auftrag_id);


--
-- Name: rechnungen rechnungen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_pkey PRIMARY KEY (id);


--
-- Name: rechnungen rechnungen_rechnung_nr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_rechnung_nr_key UNIQUE (rechnung_nr);


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
-- Name: lead_distributions unique_lead_company; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_distributions
    ADD CONSTRAINT unique_lead_company UNIQUE (lead_id, company_id);


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
-- Name: idx_checklist_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_company ON public.checklist_templates USING btree (company_id);


--
-- Name: idx_checklist_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_service ON public.checklist_templates USING btree (service_type);


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
-- Name: idx_distributions_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributions_company ON public.lead_distributions USING btree (company_id);


--
-- Name: idx_distributions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_distributions_status ON public.lead_distributions USING btree (status);


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
-- Name: idx_lead_distributions_company_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_distributions_company_sent_at ON public.lead_distributions USING btree (company_id, sent_at DESC);


--
-- Name: INDEX idx_lead_distributions_company_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_lead_distributions_company_sent_at IS 'Optimizes dashboard recent leads query';


--
-- Name: idx_lead_distributions_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_distributions_company_status ON public.lead_distributions USING btree (company_id, status);


--
-- Name: INDEX idx_lead_distributions_company_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_lead_distributions_company_status IS 'Optimizes dashboard pending/accepted lead counts';


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
-- Name: idx_offers_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_lead_id ON public.offers USING btree (lead_id);


--
-- Name: idx_offers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offers_status ON public.offers USING btree (status);


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
-- Name: idx_quittungen_datum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quittungen_datum ON public.quittungen USING btree (datum DESC);


--
-- Name: idx_quittungen_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quittungen_offer_id ON public.quittungen USING btree (offer_id);


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
-- Name: appointments trigger_calculate_duration; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_duration BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.calculate_appointment_duration();


--
-- Name: companies trigger_companies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: offers trigger_generate_offer_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_offer_number BEFORE INSERT ON public.offers FOR EACH ROW WHEN ((new.offer_number IS NULL)) EXECUTE FUNCTION public.generate_offer_number();


--
-- Name: leads trigger_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: appointments trigger_log_appointment_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_log_appointment_changes AFTER INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.log_appointment_changes();


--
-- Name: companies trigger_set_company_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_company_slug BEFORE INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_company_slug();


--
-- Name: leads trigger_set_lead_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_lead_slug BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_lead_slug();


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
-- Name: appointments appointments_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


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
-- Name: lead_distributions lead_distributions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_distributions
    ADD CONSTRAINT lead_distributions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: lead_distributions lead_distributions_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_distributions
    ADD CONSTRAINT lead_distributions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


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
-- Name: offers offers_lead_distribution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_lead_distribution_id_fkey FOREIGN KEY (lead_distribution_id) REFERENCES public.lead_distributions(id) ON DELETE SET NULL;


--
-- Name: offers offers_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


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
-- Name: quittungen quittungen_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quittungen
    ADD CONSTRAINT quittungen_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;


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
-- Name: rechnungen rechnungen_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;


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
-- Name: lead_distributions Admins can delete lead distributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete lead distributions" ON public.lead_distributions FOR DELETE USING (public.is_admin(auth.uid()));


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
-- Name: lead_distributions Admins can insert lead distributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert lead distributions" ON public.lead_distributions FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


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
-- Name: lead_distributions Admins can update lead distributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update lead distributions" ON public.lead_distributions FOR UPDATE USING (public.is_admin(auth.uid()));


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
-- Name: lead_distributions Admins can view all lead distributions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all lead distributions" ON public.lead_distributions FOR SELECT USING (public.is_admin(auth.uid()));


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
-- Name: moving_calculation_presets Companies can manage their calculation presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies can manage their calculation presets" ON public.moving_calculation_presets USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = moving_calculation_presets.company_id) AND (companies.user_id = auth.uid())))));


--
-- Name: company_offer_settings Companies can manage their offer settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies can manage their offer settings" ON public.company_offer_settings USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = company_offer_settings.company_id) AND (companies.user_id = auth.uid())))));


--
-- Name: company_reminder_settings Companies can manage their reminder settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies can manage their reminder settings" ON public.company_reminder_settings USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = company_reminder_settings.company_id) AND (companies.user_id = auth.uid())))));


--
-- Name: firma_resources Companies can manage their resources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies can manage their resources" ON public.firma_resources USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = firma_resources.company_id) AND (companies.user_id = auth.uid())))));


--
-- Name: checklist_templates Companies can manage their templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies can manage their templates" ON public.checklist_templates USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = checklist_templates.company_id) AND (companies.user_id = auth.uid())))));


--
-- Name: leistungsuebersicht_templates Companies can manage their templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies can manage their templates" ON public.leistungsuebersicht_templates USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = leistungsuebersicht_templates.company_id) AND (companies.user_id = auth.uid())))));


--
-- Name: admin_activity_log Owner can read all activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can read all activity logs" ON public.admin_activity_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.email)::text = 'redacted@example.test'::text)))));


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
-- Name: checklist_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: companies companies_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_select_member ON public.companies FOR SELECT TO authenticated USING ((public.is_company_member(id) OR public.is_admin(auth.uid())));


--
-- Name: companies companies_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_update_member ON public.companies FOR UPDATE TO authenticated USING (public.is_company_member(id));


--
-- Name: company_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

--
-- Name: company_offer_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_offer_settings ENABLE ROW LEVEL SECURITY;

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
-- Name: edge_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: email_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: firma_resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.firma_resources ENABLE ROW LEVEL SECURITY;

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
-- Name: lead_distributions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_distributions ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_distributions lead_distributions_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_distributions_select_member ON public.lead_distributions FOR SELECT USING (public.is_company_member(company_id));


--
-- Name: lead_distributions lead_distributions_update_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_distributions_update_member ON public.lead_distributions FOR UPDATE USING (public.is_company_member(company_id));


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
-- Name: leads leads_select_company_or_distribution; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_select_company_or_distribution ON public.leads FOR SELECT TO authenticated USING ((public.is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.lead_distributions ld
     JOIN public.companies c ON ((c.id = ld.company_id)))
  WHERE ((ld.lead_id = leads.id) AND (c.user_id = auth.uid())))) OR public.is_company_member(company_id, auth.uid())));


--
-- Name: leads leads_update_company_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_update_company_or_admin ON public.leads FOR UPDATE TO authenticated USING ((public.is_admin(auth.uid()) OR public.is_company_member(company_id, auth.uid()))) WITH CHECK ((public.is_admin(auth.uid()) OR public.is_company_member(company_id, auth.uid())));


--
-- Name: leistungsuebersicht_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leistungsuebersicht_templates ENABLE ROW LEVEL SECURITY;

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
-- Name: rechnungen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rechnungen ENABLE ROW LEVEL SECURITY;

--
-- Name: rechnungen rechnungen_company_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rechnungen_company_delete ON public.rechnungen FOR DELETE USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.user_id = auth.uid()))));


--
-- Name: rechnungen rechnungen_company_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rechnungen_company_insert ON public.rechnungen FOR INSERT WITH CHECK ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.user_id = auth.uid()))));


--
-- Name: rechnungen rechnungen_company_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rechnungen_company_select ON public.rechnungen FOR SELECT USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.user_id = auth.uid()))));


--
-- Name: rechnungen rechnungen_company_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rechnungen_company_update ON public.rechnungen FOR UPDATE USING ((company_id IN ( SELECT companies.id
   FROM public.companies
  WHERE (companies.user_id = auth.uid()))));


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

