-- =============================================================================
-- Kundenaufloesung: eine Regel, sieben Trigger, eine Zusammenfuehrung
-- =============================================================================
--
-- BEFUND
-- Die Spalten aus 20260728110000 sind leer und niemand fuellt sie. Ein Kunde
-- entsteht heute an zehn Stellen — und zwar in ZWEI Codebasen: `auftraege` wird
-- sowohl von AuftragModal.tsx als auch von update_offer_by_token geschrieben,
-- `appointments` sowohl von AppointmentModal.tsx als auch von
-- create_appointments_for_auftrag. Wer nur die Oberflaeche anfasst, laesst genau
-- den Hauptweg — die Annahme durch den Kunden — ohne Kundenbezug.
--
-- ABHILFE — Trigger, nicht Aufrufer
-- Dieselbe Entscheidung hat dieses Repo schon einmal getroffen und begruendet
-- (20260704151000): "Appointment creation lives in an AFTER INSERT trigger —
-- NOT inside update_offer_by_token — so RPC rewrites cannot silently drop the
-- side effect." Das Argument gilt hier woertlich.
--
-- Jeder Trigger folgt derselben Kette:
--
--     COALESCE(bereits gesetzt, vom Elternsatz erben, neu aufloesen)
--
-- Er bricht das INSERT NIEMALS ab. Eine verlorene Anfrage waere um ein
-- Vielfaches schlimmer als eine Anfrage ohne Kundenbezug — und der Backfill
-- (20260728140000) ist idempotent und sammelt Liegengebliebenes spaeter ein.
-- Das ist das Sicherheitsnetz fuer die stille RAISE WARNING.
--
-- Die Zuordnungsregel steht in find_customer_by_identity() und NUR dort:
-- Aufloesung, Backfill, Posteingang und Duplikatssuche rufen alle dieselbe
-- Funktion. Eine zweite Kopie der Regel waere eine zweite Wahrheit.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Zuordnungsregel
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.find_customer_by_identity(
  p_company_id UUID,
  p_email      TEXT,
  p_phone      TEXT
)
RETURNS TABLE (customer_id UUID, matched_on TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
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

COMMENT ON FUNCTION public.find_customer_by_identity(UUID, TEXT, TEXT) IS
  'Einzige Stelle, an der die Zuordnungsregel steht. Liefert den besten Treffer '
  'und woran er haengt (email_and_phone | email | phone). Legt NICHTS an.';

-- -----------------------------------------------------------------------------
-- 2. Aufloesen oder anlegen
--
-- Entscheidungstabelle:
--
--   E-Mail trifft                  → binden. Der UNIQUE-Index macht einen
--                                    zweiten Kunden mit dieser Adresse ohnehin
--                                    unmoeglich; eine geaenderte Telefonnummer
--                                    ist eine Aktualisierung, keine zweite Person.
--   nur Telefon trifft             → NEUER Kunde, beide als Duplikat-Verdacht
--                                    markiert. Ein Haushaltsanschluss gehoert
--                                    regelmaessig mehreren Personen; automatisch
--                                    zu binden waere eine falsche Verschmelzung.
--   kein Merkmal vorhanden         → KEIN Kunde. Ein Datensatz, der weder
--                                    E-Mail noch Telefon traegt, ist im Abgleich
--                                    unerreichbar (siehe CHECK auf customers).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_or_create_customer(
  p_company_id   UUID,
  p_email        TEXT,
  p_phone        TEXT,
  p_first_name   TEXT        DEFAULT NULL,
  p_last_name    TEXT        DEFAULT NULL,
  p_company_name TEXT        DEFAULT NULL,
  p_salutation   TEXT        DEFAULT NULL,
  p_language     TEXT        DEFAULT NULL,
  p_source       TEXT        DEFAULT NULL,
  p_seen_at      TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION public.resolve_or_create_customer(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ) IS
  'Ordnet einen eingehenden Datensatz der kanonischen Kundenidentitaet zu. Ein '
  'E-Mail-Treffer bindet; ein reiner Telefon-Treffer erzeugt einen zweiten Kunden '
  'und markiert beide als Duplikat-Verdacht. Ohne jedes Identitaetsmerkmal wird '
  'KEIN Kunde angelegt (customer_id = null).';

REVOKE ALL ON FUNCTION public.resolve_or_create_customer(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_or_create_customer(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.find_customer_by_identity(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_customer_by_identity(UUID,TEXT,TEXT) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Trigger
--
-- Alle sieben nach demselben Muster. Der aeussere EXCEPTION-Block ist Pflicht:
-- ein Fehler in der Kundenzuordnung darf niemals einen Vorgang verhindern.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.leads_set_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.offers_set_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.auftraege_set_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.appointments_set_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Rechnung und Quittung teilen sich eine Funktion: beide tragen auftrag_id,
-- offer_id, customer_name, customer_email, customer_phone unter denselben Namen.
CREATE OR REPLACE FUNCTION public.beleg_set_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Posteingang: NUR zuordnen, NIE anlegen. Sonst legte jede Werbemail einen Kunden an.
CREATE OR REPLACE FUNCTION public.inbound_emails_set_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS trigger_leads_set_customer ON public.leads;
CREATE TRIGGER trigger_leads_set_customer
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_set_customer();

DROP TRIGGER IF EXISTS trigger_offers_set_customer ON public.offers;
CREATE TRIGGER trigger_offers_set_customer
  BEFORE INSERT ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.offers_set_customer();

DROP TRIGGER IF EXISTS trigger_auftraege_set_customer ON public.auftraege;
CREATE TRIGGER trigger_auftraege_set_customer
  BEFORE INSERT ON public.auftraege
  FOR EACH ROW EXECUTE FUNCTION public.auftraege_set_customer();

DROP TRIGGER IF EXISTS trigger_appointments_set_customer ON public.appointments;
CREATE TRIGGER trigger_appointments_set_customer
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_set_customer();

DROP TRIGGER IF EXISTS trigger_rechnungen_set_customer ON public.rechnungen;
CREATE TRIGGER trigger_rechnungen_set_customer
  BEFORE INSERT ON public.rechnungen
  FOR EACH ROW EXECUTE FUNCTION public.beleg_set_customer();

DROP TRIGGER IF EXISTS trigger_quittungen_set_customer ON public.quittungen;
CREATE TRIGGER trigger_quittungen_set_customer
  BEFORE INSERT ON public.quittungen
  FOR EACH ROW EXECUTE FUNCTION public.beleg_set_customer();

DROP TRIGGER IF EXISTS trigger_inbound_emails_set_customer ON public.inbound_emails;
CREATE TRIGGER trigger_inbound_emails_set_customer
  BEFORE INSERT ON public.inbound_emails
  FOR EACH ROW EXECUTE FUNCTION public.inbound_emails_set_customer();

-- -----------------------------------------------------------------------------
-- 4. Zusammenfuehren
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.customer_merge_preview(
  p_company_id         UUID,
  p_source_customer_id UUID,
  p_target_customer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

COMMENT ON FUNCTION public.customer_merge_preview(UUID, UUID, UUID) IS
  'Vorschau VOR dem Zusammenfuehren: wie viele Vorgaenge umgehaengt werden, '
  'welche Luecken das Ziel uebernimmt und welche Werte der Quelle dabei '
  'verloren gehen. Schreibt nichts (STABLE).';

CREATE OR REPLACE FUNCTION public.merge_customers(
  p_company_id         UUID,
  p_source_customer_id UUID,
  p_target_customer_id UUID,
  p_reason             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION public.merge_customers(UUID, UUID, UUID, TEXT) IS
  'Fuehrt zwei Kunden zusammen. Die Quellzeile wird NICHT geloescht, sondern zur '
  'Weiterleitung — alte Links loesen weiter auf. Nicht ruecknehmbar; der Nachweis '
  'inklusive vollstaendiger Quellzeile steht in customer_merges.';

REVOKE ALL ON FUNCTION public.merge_customers(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_customers(UUID, UUID, UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.customer_merge_preview(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_merge_preview(UUID, UUID, UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Duplikat-Kandidaten
--
-- BEWUSST eine Funktion und keine View. Eine View ohne `security_invoker = on`
-- laeuft mit den Rechten ihres Eigentuemers und umgeht RLS — ein stiller Bruch
-- der Mandantentrennung. Dass das kein theoretisches Risiko ist, zeigen
-- 20260119150000 (vier Views nachtraeglich repariert) und 20260728080000 (zwei
-- weitere, eine davon nachweislich offen fuer anon). Hier steht die
-- Rechtepruefung in der ersten Zeile und ist mit einer Zusicherung testbar.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.duplicate_candidates(
  p_company_id  UUID,
  p_customer_id UUID DEFAULT NULL,
  p_limit       INTEGER DEFAULT 50,
  p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
  customer_a_id    UUID,
  customer_a_name  TEXT,
  customer_a_email TEXT,
  customer_a_phone TEXT,
  customer_b_id    UUID,
  customer_b_name  TEXT,
  customer_b_email TEXT,
  customer_b_phone TEXT,
  match_reason     TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

COMMENT ON FUNCTION public.duplicate_candidates(UUID, UUID, INTEGER, INTEGER) IS
  'Paare mit derselben Telefonnummer. Ohne p_customer_id die Liste fuer die '
  'Uebersicht (jedes Paar einmal), mit p_customer_id das Band auf der Kundenkarte. '
  'Reine Namensaehnlichkeit gilt bewusst NICHT als Kandidat.';

REVOKE ALL ON FUNCTION public.duplicate_candidates(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_candidates(UUID, UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;
