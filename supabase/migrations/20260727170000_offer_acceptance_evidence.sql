-- =============================================================================
-- Beweiskraft der Offertenannahme
-- =============================================================================
--
-- BEFUND
-- Bei der Annahme über den öffentlichen Link schickte der BROWSER den Zeitpunkt
-- mit (`new Date().toISOString()`), und die Funktion übernahm ihn per COALESCE
-- unverändert. Wer die Uhr seines Rechners verstellt, bestimmt damit, wann er
-- angenommen haben will. Als "AGB-Version" wurde ausserdem nur
-- `id:titel|id:titel` gespeichert — ändert sich der TEXT einer Klausel, bleibt
-- diese Kennung identisch. Damit lässt sich hinterher nicht belegen, WELCHEM
-- Wortlaut der Kunde zugestimmt hat. Eine IP wurde gar nicht festgehalten.
--
-- ABHILFE — alle drei Angaben entstehen jetzt serverseitig:
--
--   • Zeitpunkt: now() der Datenbank. Die Parameter bleiben in der Signatur
--     (Altaufrufer), werden für die Annahme aber ignoriert.
--
--   • AGB-Fassung: SHA-256 über den TATSÄCHLICHEN Wortlaut. Gehasht wird die
--     Ausgabe von get_agb_sections_by_offer_token() — dieselbe Quelle, aus der
--     der Kunde liest, samt serverseitiger Übersetzung und Reihenfolge. Ändert
--     sich ein Buchstabe, ändert sich der Hash.
--
--     Bewusst OHNE Service-Filter, also über alle aktiven Klauseln der Firma:
--     die Zuordnung Service→AGB steckt in einer langen Varianten-Tabelle in
--     TypeScript (normalizeServiceTypeForAgb). Sie hier in SQL nachzubauen hiesse,
--     zwei Kopien derselben Regel zu pflegen — sie würden auseinanderlaufen, und
--     ein falsch zugeordneter Hash wäre als Beweismittel schlechter als ein
--     etwas weiter gefasster. Festgehalten wird damit: "so lautete das
--     AGB-Werk der Firma im Moment der Annahme".
--
--   • IP: aus den Kopfzeilen der Anfrage, die PostgREST als GUC bereitstellt.
--     Steht sie nicht zur Verfügung, bleibt das Feld NULL — das ist der heutige
--     Zustand und damit keine Verschlechterung. Der vom Aufrufer gelieferte Wert
--     wird weiterhin ignoriert (der Kommentar dazu stand schon vorher hier).
--
-- Die Auftragserstellung lag bereits in dieser Funktion und damit in derselben
-- Transaktion; daran ändert sich nichts.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Wortlaut-Hash der AGB, die zu dieser Offerte gehören
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agb_content_hash(p_access_token TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
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

COMMENT ON FUNCTION public.agb_content_hash(TEXT) IS
  'SHA-256 ueber den Wortlaut aller aktiven AGB-Klauseln der Firma zu dieser '
  'Offerte. Beweismittel: aendert sich der Text, aendert sich der Hash.';

-- -----------------------------------------------------------------------------
-- Annahme-Zeitpunkt, AGB-Hash und IP serverseitig setzen
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_offer_acceptance_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION public.set_offer_acceptance_evidence() IS
  'Setzt accepted_at, agb_version (Wortlaut-Hash) und agb_ip_address beim '
  'Uebergang nach accepted — serverseitig, unabhaengig davon, was der Aufrufer schickt.';

DROP TRIGGER IF EXISTS trigger_offers_acceptance_evidence ON public.offers;
CREATE TRIGGER trigger_offers_acceptance_evidence
  BEFORE UPDATE OF status ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_offer_acceptance_evidence();

COMMIT;
