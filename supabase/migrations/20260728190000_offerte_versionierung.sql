-- =============================================================================
-- Eine gesendete Offerte wird nicht mehr veraendert, sondern neu aufgelegt
-- =============================================================================
--
-- BEFUND
-- `OfferteBearbeiten` sperrt nur `accepted` und `rejected`. Eine Offerte im
-- Status `sent` oder `viewed` laesst sich weiter bearbeiten — waehrend der Kunde
-- den Link in der Hand haelt. Heute betrifft das 30 von 54 Offerten (16 sent,
-- 14 viewed).
--
-- Die oeffentliche Seite liest ueber `get_offer_by_token` immer den AKTUELLEN
-- Stand. Wer eine Position streicht oder den Preis aendert, aendert damit
-- rueckwirkend das, was der Kunde sieht — und es gibt keinen Beleg darueber,
-- was er vorher gesehen hat. Bei einer Meinungsverschiedenheit steht Aussage
-- gegen Aussage.
--
-- Die Sperre lag ausserdem allein in der Oberflaeche. Ein PATCH direkt gegen die
-- API ging an ihr vorbei.
--
-- ABHILFE
-- Jede `offers`-Zeile IST eine Version. Kein zweites Schema, keine JSON-Kopie:
-- eine Offerte hat schon Dutzende Spalten und drei Kindtabellen, die man sonst
-- doppelt pflegen muesste.
--
--   offer_series_id     die Offerte ueber alle Versionen hinweg
--   version_number      1, 2, 3 …
--   supersedes_offer_id die Vorgaengerversion
--   superseded_at       gesetzt, sobald eine neue Version existiert
--   locked_at           gesetzt beim Uebergang nach `sent`
--   revision_reason     warum es eine neue Version gab
--
-- DIE SPERRE ARBEITET MIT EINER ERLAUBNISLISTE, NICHT MIT EINER VERBOTSLISTE.
-- `offers` hat ~95 Spalten. Zaehlt man die schuetzenswerten auf, ist die
-- naechste neue Spalte stillschweigend ungeschuetzt. Deshalb andersherum: nur
-- Status, Kundenantwort, AGB-Nachweis und die Versionsfelder duerfen sich nach
-- dem Versand noch aendern — alles andere nicht, auch das, was es heute noch
-- nicht gibt.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Spalten
-- -----------------------------------------------------------------------------

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS offer_series_id     UUID;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS version_number      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS supersedes_offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS superseded_at       TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS locked_at           TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS revision_reason     TEXT;

COMMENT ON COLUMN public.offers.offer_series_id IS
  'Die Offerte ueber alle Versionen hinweg. Version 1 traegt hier ihre eigene id.';
COMMENT ON COLUMN public.offers.locked_at IS
  'Gesetzt beim Uebergang nach `sent`. Ab da sind Inhaltsaenderungen gesperrt — '
  'Aenderungen laufen ueber create_offer_revision().';
COMMENT ON COLUMN public.offers.superseded_at IS
  'Gesetzt, sobald eine neuere Version existiert. Der alte Link bleibt gueltig '
  'und zeigt weiterhin DIESE Fassung, aber die Annahme ist darueber gesperrt.';

-- -----------------------------------------------------------------------------
-- 2. Bestand: jede vorhandene Offerte ist Version 1 ihrer eigenen Serie
--
-- Bereits versendete gelten ab sofort als gesperrt — mit ihrem tatsaechlichen
-- Versandzeitpunkt, nicht mit dem der Migration.
-- -----------------------------------------------------------------------------

UPDATE public.offers SET offer_series_id = id WHERE offer_series_id IS NULL;

UPDATE public.offers
SET locked_at = COALESCE(sent_at, accepted_at, rejected_at, updated_at)
WHERE locked_at IS NULL
  AND status IN ('sent', 'viewed', 'accepted', 'rejected');

ALTER TABLE public.offers ALTER COLUMN offer_series_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS offers_series_version_uniq
  ON public.offers (company_id, offer_series_id, version_number);

CREATE INDEX IF NOT EXISTS idx_offers_series
  ON public.offers (offer_series_id, version_number DESC);

-- -----------------------------------------------------------------------------
-- 3. Neue Offerten eroeffnen ihre eigene Serie
--
-- offer_series_id ist NOT NULL, aber kein Aufrufer setzt es — ohne diesen
-- Trigger wuerde jedes INSERT in `offers` scheitern. Ein Spaltenstandard geht
-- nicht: der Wert ist die id der Zeile selbst, die es beim DEFAULT noch nicht
-- gibt.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.offers_set_series()
RETURNS TRIGGER
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

DROP TRIGGER IF EXISTS trigger_offers_set_series ON public.offers;
CREATE TRIGGER trigger_offers_set_series
  BEFORE INSERT ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.offers_set_series();

-- -----------------------------------------------------------------------------
-- 4. Sperre
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

DROP TRIGGER IF EXISTS trigger_offers_guard_content ON public.offers;
CREATE TRIGGER trigger_offers_guard_content
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.guard_offer_content_after_send();

COMMIT;
