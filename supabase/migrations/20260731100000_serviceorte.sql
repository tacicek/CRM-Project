-- =============================================================================
-- Serviceorte: die Adresse als Sache, nicht als Textfeld
-- =============================================================================
--
-- BEFUND
-- Eine Adresse steht heute als freier Text an fuenf Stellen:
--
--   leads.from_address / to_address        (+ from_plz, from_city, …)
--   offers.frozen_from_address / …
--   auftraege.from_address / to_address
--   appointments.location_address + location_plz + location_city
--   inbound_emails — im Fliesstext
--
-- Zwischen diesen Kopien gibt es keinen Bezug. Ein Kunde, der zum dritten Mal
-- aus derselben Wohnung auszieht, hinterlaesst drei nicht verbundene
-- Adressstrings; wo der Lift ist, ob man vor dem Haus halten darf und in
-- welchem Stock es liegt, muss jedes Mal neu erfragt werden. Beim zweiten
-- Auftrag am selben Objekt weiss das System nichts von den Erfahrungen des
-- ersten.
--
-- Das ist derselbe Befund, den `customers` (20260728100000) fuer PERSONEN
-- geloest hat, nur fuer ORTE.
--
-- ABHILFE
-- `service_locations` — je Kunde ein kanonischer Ort, mit dem, was beim Anfahren
-- zaehlt: Stockwerk, Lift, Parksituation, Zugang, Flaeche, Zimmer.
--
-- DIE ADRESSE WIRD NICHT ZERLEGT. `address_raw` traegt den Text so, wie er
-- erfasst wurde. Ein Parser ueber „Musterstrasse 12, 8000 Zuerich" haette bei
-- „c/o Meier, Hinterhaus links" bereits geraten, und geraten waere schlimmer
-- als roh. Die strukturierten Felder daneben fuellt der Bediener, wenn er sie
-- kennt — sie sind alle nullable und keines ist Voraussetzung.
--
-- Das ist auch die Lehre aus 20260728120000: dort wurde ein Name aus
-- first+last zusammengesetzt und spaeter per split_part wieder zerlegt; der
-- Rueckweg war nie verlustfrei. Hier wird gar nicht erst zerlegt.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.service_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,

  -- Wofuer der Ort im Ablauf steht. Ein Ort kann beim naechsten Auftrag eine
  -- andere Rolle haben (Auszugsadresse wird Einzugsadresse), deshalb ist die
  -- Rolle hier nur die BEIM ANLEGEN beobachtete und nicht bindend.
  kind        TEXT NOT NULL DEFAULT 'object',

  label       TEXT,
  address_raw TEXT NOT NULL,

  -- Alles ab hier ist nullable: es wird erfasst, wenn es jemand weiss.
  street      TEXT,
  house_number TEXT,
  plz         TEXT,
  city        TEXT,

  floor       TEXT,
  has_elevator BOOLEAN,
  parking_note TEXT,
  access_note  TEXT,
  rooms       NUMERIC(4,1),
  area_m2     NUMERIC(8,2),
  notes       TEXT,

  created_via TEXT NOT NULL DEFAULT 'manual',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT service_locations_kind_check
    CHECK (kind IN ('from','to','object','storage')),
  CONSTRAINT service_locations_created_via_check
    CHECK (created_via IN ('manual','backfill','portal')),
  CONSTRAINT service_locations_adresse_da CHECK (length(TRIM(address_raw)) > 0)
);

ALTER TABLE public.service_locations
  DROP CONSTRAINT IF EXISTS service_locations_customer_fk,
  ADD  CONSTRAINT service_locations_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id) ON DELETE CASCADE;

-- Nur anlegen, wenn er fehlt — NICHT droppen und neu setzen. Auf diesen
-- Schluessel zeigen spaeter Fremdschluessel (customer_cases_location_fk); ein
-- DROP scheitert dann an der Abhaengigkeit und reisst die ganze Datei mit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_locations_id_company_uniq'
      AND conrelid = 'public.service_locations'::regclass
  ) THEN
    ALTER TABLE public.service_locations
      ADD CONSTRAINT service_locations_id_company_uniq UNIQUE (id, company_id);
  END IF;
END $$;

COMMENT ON TABLE public.service_locations IS
  'Kanonische Orte je Kunde. address_raw bleibt unzerlegt — geraten waere '
  'schlimmer als roh. Die strukturierten Felder daneben sind alle optional.';
COMMENT ON COLUMN public.service_locations.kind IS
  'Die beim Anlegen beobachtete Rolle. Nicht bindend: eine Auszugsadresse kann '
  'beim naechsten Mal die Einzugsadresse sein.';

-- Derselbe Text beim selben Kunden ergibt einen Ort, nicht zwei. TRIM+LOWER,
-- weil „Musterstrasse 12 " und „musterstrasse 12" dasselbe Haus sind.
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_locations_je_kunde
  ON public.service_locations (customer_id, LOWER(TRIM(address_raw)));
CREATE INDEX IF NOT EXISTS idx_service_locations_company
  ON public.service_locations (company_id, city);

DROP TRIGGER IF EXISTS service_locations_updated_at ON public.service_locations;
CREATE TRIGGER service_locations_updated_at
  BEFORE UPDATE ON public.service_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------------------------
-- Verknuepfung
--
-- Nur dort, wo eine Adresse eine ROLLE im Vorgang hat. `leads` und `offers`
-- bekommen bewusst keine Spalte: dort ist die Adresse Teil der Anfrage bzw.
-- des eingefrorenen Belegs und aendert sich nicht mehr.
-- -----------------------------------------------------------------------------

ALTER TABLE public.auftraege
  ADD COLUMN IF NOT EXISTS from_location_id UUID,
  ADD COLUMN IF NOT EXISTS to_location_id   UUID;

ALTER TABLE public.auftraege
  DROP CONSTRAINT IF EXISTS auftraege_from_location_fk,
  ADD  CONSTRAINT auftraege_from_location_fk
       FOREIGN KEY (from_location_id, company_id)
       REFERENCES public.service_locations (id, company_id)
       ON DELETE SET NULL (from_location_id);

ALTER TABLE public.auftraege
  DROP CONSTRAINT IF EXISTS auftraege_to_location_fk,
  ADD  CONSTRAINT auftraege_to_location_fk
       FOREIGN KEY (to_location_id, company_id)
       REFERENCES public.service_locations (id, company_id)
       ON DELETE SET NULL (to_location_id);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS location_id UUID;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_location_fk,
  ADD  CONSTRAINT appointments_location_fk
       FOREIGN KEY (location_id, company_id)
       REFERENCES public.service_locations (id, company_id)
       ON DELETE SET NULL (location_id);

CREATE INDEX IF NOT EXISTS idx_auftraege_from_location
  ON public.auftraege (from_location_id) WHERE from_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auftraege_to_location
  ON public.auftraege (to_location_id) WHERE to_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_location
  ON public.appointments (location_id) WHERE location_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Ort aufloesen — dieselbe Bauart wie resolve_or_create_customer
--
-- Eine Stelle, an der entschieden wird, ob ein Ort schon existiert. Sie wird
-- vom Backfill UND vom laufenden Betrieb benutzt, damit die Regel nicht an
-- zwei Orten auseinanderlaufen kann.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_or_create_location(
  p_company_id  UUID,
  p_customer_id UUID,
  p_address_raw TEXT,
  p_kind        TEXT DEFAULT 'object',
  p_created_via TEXT DEFAULT 'manual'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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

REVOKE EXECUTE ON FUNCTION public.resolve_or_create_location(UUID,UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resolve_or_create_location(UUID,UUID,TEXT,TEXT,TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- Auftraege verknuepfen sich beim Anlegen selbst
--
-- BEFORE INSERT, nicht im aufrufenden Code: `auftraege` wird aus zwei
-- Codebasen geschrieben (AuftragModal und update_offer_by_token). Dieselbe
-- Begruendung wie bei 20260728130000 — nur die UI anzufassen liesse den
-- Hauptweg ohne Ortsbezug.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auftraege_set_locations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS trigger_auftraege_set_locations ON public.auftraege;
CREATE TRIGGER trigger_auftraege_set_locations
  BEFORE INSERT ON public.auftraege
  FOR EACH ROW EXECUTE FUNCTION public.auftraege_set_locations();

-- -----------------------------------------------------------------------------
-- Backfill — idempotent, nur was noch keinen Bezug hat
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.run_location_backfill(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

REVOKE EXECUTE ON FUNCTION public.run_location_backfill(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.run_location_backfill(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.service_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_locations_select_member ON public.service_locations;
CREATE POLICY service_locations_select_member ON public.service_locations FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

-- Zugangsnotizen zu pflegen ist Tagesarbeit, keine Konfiguration.
DROP POLICY IF EXISTS service_locations_insert_member ON public.service_locations;
CREATE POLICY service_locations_insert_member ON public.service_locations FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS service_locations_update_member ON public.service_locations;
CREATE POLICY service_locations_update_member ON public.service_locations FOR UPDATE
  TO authenticated
  USING      (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS service_locations_delete_owner_admin ON public.service_locations;
CREATE POLICY service_locations_delete_owner_admin ON public.service_locations FOR DELETE
  TO authenticated USING (public.is_company_role(company_id, ARRAY['owner','admin']));

COMMIT;
