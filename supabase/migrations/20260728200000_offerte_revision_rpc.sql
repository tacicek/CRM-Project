-- =============================================================================
-- Eine neue Version einer versendeten Offerte anlegen
-- =============================================================================
--
-- BEFUND
-- Seit 20260728190000 ist eine versendete Offerte inhaltlich gesperrt. Damit
-- fehlt der Weg, der bisher der einzige war: etwas aendern. Ohne Ersatz waere
-- die Sperre nur eine Sackgasse.
--
-- ABHILFE
-- `create_offer_revision` legt die naechste Version derselben Serie an — die
-- Offerte, ihre Positionen, ihr Inventar und ihre Leistungsuebersicht, in EINER
-- Transaktion. Der Vorgaenger bleibt unveraendert stehen: er ist das, was der
-- Kunde gesehen hat.
--
-- DIE SPALTENLISTE KOMMT AUS DEM KATALOG, NICHT AUS DIESER DATEI.
-- `offers` hat ~95 Spalten. Wer sie hier auflistet, vergisst die naechste neue —
-- und dann fehlt sie still in jeder Revision. Deshalb wird kopiert, was da ist,
-- abzueglich einer kurzen Ausschlussliste: Identitaet, Zeitstempel, Token,
-- Status und die Versionsfelder.
--
-- Die Offertennummer WIRD uebernommen. `offer_number` ist nicht eindeutig, und
-- der erzeugende Trigger laeuft nur `WHEN (new.offer_number IS NULL)` — Version 2
-- von Offerte 10062 heisst also weiterhin 10062. Fuer den Kunden ist es dieselbe
-- Offerte, nur neu aufgelegt.
--
-- BEWUSST NICHT HIER: die Aenderung einer bereits ANGENOMMENEN Offerte. Das ist
-- ein Nachtrag — der Kunde hat dem alten Umfang zugestimmt, ein neuer Umfang
-- braucht seine erneute Zustimmung. Der Aufruf wird mit einer klaren Meldung
-- abgewiesen, statt so zu tun, als sei es dasselbe.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_offer_revision(
  p_offer_id UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

COMMENT ON FUNCTION public.create_offer_revision(UUID, TEXT) IS
  'Legt die naechste Version einer versendeten Offerte an (Offerte + Positionen + '
  'Inventar + Leistungsuebersicht, eine Transaktion). Der Vorgaenger bleibt '
  'unveraendert — er ist der Stand, den der Kunde gesehen hat. Eine ANGENOMMENE '
  'Offerte wird abgewiesen: das waere ein Nachtrag.';

REVOKE ALL ON FUNCTION public.create_offer_revision(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_offer_revision(UUID, TEXT) TO authenticated;

COMMIT;
