-- =============================================================================
-- Nachtrag: anlegen, oeffentlich lesen, zustimmen
-- =============================================================================
--
-- Drei Funktionen, die zusammen den Weg bilden:
--
--   create_offer_amendment   der Bediener legt den Nachtrag an (nur zu einer
--                            ANGENOMMENEN Offerte — sonst ist es eine Revision)
--   get_amendment_by_token   der Kunde liest ihn ueber seinen eigenen Link
--   update_amendment_by_token  der Kunde stimmt zu oder lehnt ab
--
-- BEI DER ZUSTIMMUNG WIRD DER AUFTRAG FORTGESCHRIEBEN, nicht die Offerte:
-- Positionen kommen zu `items` dazu, die Betraege werden addiert. Die Offerte
-- und der Nachtrag selbst bleiben als Beleg unveraendert.
--
-- Der Zeitpunkt und die IP kommen aus der Datenbank bzw. dem Aufruf, nicht vom
-- Browser — dieselbe Ueberlegung wie in 20260727170000 fuer die Offerte: der
-- Nachweis ist nur so viel wert, wie die Stelle, die ihn erzeugt.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Anlegen
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_offer_amendment(
  p_offer_id UUID,
  p_title    TEXT,
  p_reason   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION public.create_offer_amendment(UUID, TEXT, TEXT) IS
  'Legt einen Nachtrag zu einer ANGENOMMENEN Offerte an. Nummer, Kunde, Sprache '
  'und Auftrag kommen per Trigger aus der Offerte.';

-- -----------------------------------------------------------------------------
-- 2. Oeffentlich lesen
--
-- Nur was der Kunde sehen muss. Kein company_id, kein internes Feld — dieselbe
-- Zurueckhaltung wie bei get_offer_by_token.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_amendment_by_token(p_token TEXT)
RETURNS TABLE (
  id               UUID,
  amendment_number INTEGER,
  title            TEXT,
  reason           TEXT,
  status           TEXT,
  subtotal         NUMERIC,
  vat_rate         NUMERIC,
  vat_amount       NUMERIC,
  total            NUMERIC,
  language         TEXT,
  sent_at          TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  rejected_at      TIMESTAMPTZ,
  offer_title      TEXT,
  offer_number     INTEGER,
  company_name     TEXT,
  positionen       JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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

COMMENT ON FUNCTION public.get_amendment_by_token(TEXT) IS
  'Oeffentliche Sicht auf einen Nachtrag. Entwuerfe sind bewusst nicht dabei — '
  'was nicht versendet wurde, hat der Kunde nie bekommen.';

-- -----------------------------------------------------------------------------
-- 3. Zustimmen oder ablehnen
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_amendment_by_token(
  p_token      TEXT,
  p_new_status TEXT,
  p_note       TEXT DEFAULT NULL,
  p_ip         TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION public.update_amendment_by_token(TEXT, TEXT, TEXT, TEXT) IS
  'Zustimmung oder Ablehnung eines Nachtrags durch den Kunden. Bei Zustimmung '
  'wird der Auftrag fortgeschrieben (Positionen und Betraege kommen dazu); '
  'Offerte und Nachtrag bleiben als Beleg unveraendert.';

REVOKE ALL ON FUNCTION public.create_offer_amendment(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_offer_amendment(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_amendment_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_amendment_by_token(TEXT) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_amendment_by_token(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_amendment_by_token(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

COMMIT;
