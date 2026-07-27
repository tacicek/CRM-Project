-- =============================================================================
-- Kanonische Kundenidentitaet (Customer 360, Kern)
-- =============================================================================
--
-- BEFUND
-- Es gibt keinen Kunden. Wer ein Kunde ist, steht in sieben Tabellen als
-- denormalisierte Kopie — in fuenf verschiedenen Namensschemata:
--
--   leads          customer_first_name / customer_last_name / customer_email / customer_phone
--   offers         dieselben vier + customer_salutation + customer_number
--   auftraege      customer_name  (EIN Feld!) / customer_email / customer_phone
--   appointments   customer_first_name / … (alle nullable)
--   rechnungen     customer_name / customer_address / customer_destination / anrede
--   quittungen     wie rechnungen, aber ohne anrede
--   inbound_emails from_email / from_name / extracted_data->>'first_name'
--
-- Zwischen diesen Kopien besteht kein einziger Fremdschluessel. Dieselbe Person
-- traegt ihren Namen in einem einzigen Auftrag sechsmal in verschiedene Zeilen.
-- Konsequenz im Betrieb: die Geschichte eines Kunden ist nicht abrufbar,
-- Wiederkehrer sind nicht erkennbar, und jede Korrektur trifft genau eine Kopie.
--
-- ABHILFE
-- `customers` wird der aktuelle Stand. Die customer_*-Felder auf Beleg und
-- Vorgang BLEIBEN unveraendert — sie sind der eingefrorene Stand zum Zeitpunkt
-- des Dokuments. Genau diese Trennung traegt die Zusage "eine geaenderte
-- E-Mail-Adresse veraendert keine alte Rechnung".
--
-- Diese Datei legt nur die Identitaet an. Die Verknuepfung (20260728110000),
-- die Aufloesung (…130000) und der Backfill (…140000) folgen getrennt, damit
-- kein Schritt Daten schreibt, bevor der Bericht dazu gelesen wurde.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Normalisierung
--
-- Beide Funktionen muessen IMMUTABLE sein: sie stehen in einer generierten
-- Spalte und in einem UNIQUE-Index.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_customer_email(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(LOWER(TRIM(p_email)), '');
$$;

COMMENT ON FUNCTION public.normalize_customer_email(TEXT) IS
  'Kanonische Form einer E-Mail fuer den Kundenabgleich: trim + lower, Leerstring '
  'wird NULL. BEWUSST OHNE anbieterspezifische Regeln (Gmail-Punkte, Plus-Adressen) '
  '— bei anderen Anbietern sind das verschiedene Personen.';

-- Zeichengleiche SQL-Fassung von normalizePhoneToE164() aus
-- supabase/functions/notify-appointment-reminder/index.ts:154. Nicht neu erfunden:
-- im Repo existieren drei verschiedene Telefon-Schreibweisen
-- (extractedLeadToLeadData.ts:11 und AnfrageEditDialog.tsx:440 erzeugen "+41 79 …"
-- mit Leerzeichen, der Inbound-Weg laesst den Rohwert stehen). Diese Funktion
-- fuehrt alle drei auf denselben Schluessel zurueck — die bestehende Uneinheit
-- beschaedigt den Abgleich also nicht.
CREATE OR REPLACE FUNCTION public.normalize_customer_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
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

COMMENT ON FUNCTION public.normalize_customer_phone(TEXT) IS
  'E.164 mit Schweizer Vorgabe. SQL-Gegenstueck zu normalizePhoneToE164() in '
  'notify-appointment-reminder. Nummern ohne erkennbares Praefix werden verworfen, '
  'nicht geraten.';

-- -----------------------------------------------------------------------------
-- 2. customers
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  customer_type            TEXT NOT NULL DEFAULT 'person',
  salutation               TEXT,
  first_name               TEXT,
  last_name                TEXT,
  company_name             TEXT,
  display_name             TEXT NOT NULL,

  primary_email            TEXT,
  primary_phone            TEXT,
  email_normalized         TEXT GENERATED ALWAYS AS (public.normalize_customer_email(primary_email)) STORED,
  phone_normalized         TEXT GENERATED ALWAYS AS (public.normalize_customer_phone(primary_phone)) STORED,

  language                 TEXT NOT NULL DEFAULT 'de',
  status                   TEXT NOT NULL DEFAULT 'active',

  source                   TEXT,
  first_seen_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  external_customer_number TEXT,

  merged_into_customer_id  UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  merged_at                TIMESTAMPTZ,
  possible_duplicate       BOOLEAN NOT NULL DEFAULT FALSE,

  created_via              TEXT NOT NULL DEFAULT 'manual',
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Traegt den zusammengesetzten Fremdschluessel der Folgemigration: nur so
  -- kann die Datenbank verhindern, dass Firma A den Kunden von Firma B eintraegt.
  CONSTRAINT customers_id_company_uniq UNIQUE (id, company_id),

  CONSTRAINT customers_type_check
    CHECK (customer_type IN ('person', 'company')),
  -- Wertebereich zeichengleich mit SALUTATIONS in
  -- src/components/offerte/OfferteDetailsSection.tsx:104.
  CONSTRAINT customers_salutation_check
    CHECK (salutation IS NULL OR salutation IN ('Herr', 'Frau', 'Firma')),
  CONSTRAINT customers_language_check
    CHECK (language IN ('de', 'fr', 'en')),
  CONSTRAINT customers_status_check
    CHECK (status IN ('active', 'inactive', 'blocked', 'anonymized')),
  CONSTRAINT customers_created_via_check
    CHECK (created_via IN ('manual', 'resolve_rpc', 'backfill', 'merge')),

  -- Ein Kunde ohne jeden Kontaktkanal ist im Abgleich unerreichbar: jeder neue
  -- Lead legt an ihm vorbei einen zweiten an. In diesem Datenbestand entstehen
  -- solche Zeilen ausschliesslich aus den Platzhaltern in _shared/leadMapping.ts
  -- ("Unbekannt", ""). Die 4 betroffenen Altzeilen bleiben unverknuepft und
  -- stehen im Dry-Run-Bericht mit ID — sie werden von Hand zugeordnet.
  CONSTRAINT customers_identity_required CHECK (
    public.normalize_customer_email(primary_email) IS NOT NULL
    OR public.normalize_customer_phone(primary_phone) IS NOT NULL
  ),
  CONSTRAINT customers_display_name_present
    CHECK (length(TRIM(display_name)) > 0),
  CONSTRAINT customers_merge_not_self
    CHECK (merged_into_customer_id IS DISTINCT FROM id),
  CONSTRAINT customers_merge_consistency CHECK (
    (merged_into_customer_id IS NULL AND merged_at IS NULL)
    OR (merged_into_customer_id IS NOT NULL AND merged_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.customers IS
  'Kanonische Kundenidentitaet je Firma. Die customer_*-Felder auf Lead, Offerte, '
  'Auftrag, Rechnung und Quittung bleiben unberuehrt: sie sind der Snapshot zum '
  'Zeitpunkt des Dokuments, diese Tabelle ist der aktuelle Stand.';

COMMENT ON COLUMN public.customers.email_normalized IS
  'Abgleichschluessel (generated, stored). ACHTUNG: aendert sich der Rumpf von '
  'normalize_customer_email(), berechnet Postgres bestehende Zeilen NICHT neu — '
  'in derselben Migration UPDATE customers SET primary_email = primary_email '
  'nachziehen und den UNIQUE-Index neu pruefen.';

COMMENT ON COLUMN public.customers.phone_normalized IS
  'Wie email_normalized. BEWUSST NICHT unique: der Festnetzanschluss eines '
  'Haushalts oder einer Verwaltung gehoert regelmaessig mehreren Personen.';

COMMENT ON COLUMN public.customers.display_name IS
  'Anzeigename. Wird vom Trigger aus Vor-/Nachname bzw. Firmenname gefuellt, '
  'kann aber vom Bediener ueberschrieben werden ("Familie Mueller") — deshalb '
  'keine generierte Spalte.';

COMMENT ON COLUMN public.customers.external_customer_number IS
  'Uebernommen aus offers.customer_number — dort ein Freitextfeld, das der '
  'Bediener je Offerte selbst tippt. BEWUSST NICHT unique: in der Vergangenheit '
  'vergebene Nummern koennen sich doppeln.';

COMMENT ON COLUMN public.customers.merged_into_customer_id IS
  'Zusammengefuehrt nach. Die Quellzeile wird NIE geloescht, sondern bleibt als '
  'Weiterleitung stehen, damit alte Links und Audit-Eintraege weiterhin aufloesen.';

COMMENT ON COLUMN public.customers.created_via IS
  'Entstehungsweg. Traegt die Ruecknahme des Backfills: DELETE … WHERE '
  'created_via = ''backfill'' entfernt genau die dort entstandenen Zeilen.';

COMMENT ON COLUMN public.customers.first_seen_at IS
  'Erster Kontakt. Beim Backfill das MIN(created_at) aller Quellzeilen — '
  'created_at waere dort der Zeitpunkt des Backfills und damit wertlos.';

-- Kein last_activity_at: der Wert leitet sich aus sieben Tabellen ab. Ihn zu
-- speichern hiesse sieben AFTER-INSERT-Trigger oder stilles Veralten. Er wird in
-- search_customers() und customer_summary() berechnet (20260728150000).

-- -----------------------------------------------------------------------------
-- 3. Indizes
-- -----------------------------------------------------------------------------

-- Eine E-Mail gehoert je Firma genau EINEM aktiven Kunden. Dieser Index ist
-- gleichzeitig die Absicherung gegen zwei gleichzeitig eintreffende Leads:
-- der zweite laeuft in 23505 und die Aufloesungsfunktion sucht erneut.
CREATE UNIQUE INDEX IF NOT EXISTS customers_company_email_uniq
  ON public.customers (company_id, email_normalized)
  WHERE email_normalized IS NOT NULL AND merged_into_customer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_company_phone
  ON public.customers (company_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL AND merged_into_customer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_company_status_name
  ON public.customers (company_id, status, display_name);

CREATE INDEX IF NOT EXISTS idx_customers_company_duplicates
  ON public.customers (company_id, created_at DESC)
  WHERE possible_duplicate AND merged_into_customer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_merged_into
  ON public.customers (merged_into_customer_id)
  WHERE merged_into_customer_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Trigger
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.customers_set_display_name()
RETURNS TRIGGER
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

DROP TRIGGER IF EXISTS trigger_customers_set_display_name ON public.customers;
CREATE TRIGGER trigger_customers_set_display_name
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.customers_set_display_name();

DROP TRIGGER IF EXISTS trigger_customers_updated_at ON public.customers;
CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Zusammenfuehrung ist nicht ruecknehmbar. Die beiden Felder, die sie festhalten,
-- duerfen deshalb nicht per PATCH aus dem Browser gesetzt werden koennen.
CREATE OR REPLACE FUNCTION public.guard_customer_merge_fields()
RETURNS TRIGGER
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

DROP TRIGGER IF EXISTS trigger_customers_guard_merge ON public.customers;
CREATE TRIGGER trigger_customers_guard_merge
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_merge_fields();

-- -----------------------------------------------------------------------------
-- 5. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_select_member ON public.customers;
CREATE POLICY customers_select_member
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS customers_insert_member ON public.customers;
CREATE POLICY customers_insert_member
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

-- WITH CHECK ist hier nicht optional: fehlt es, prueft Postgres die NEUE Zeile
-- erneut gegen USING — und ein Wechsel der company_id waere erlaubt. Genau das
-- war der BEFUND von 20260727120000.
DROP POLICY IF EXISTS customers_update_member ON public.customers;
CREATE POLICY customers_update_member
  ON public.customers FOR UPDATE
  TO authenticated
  USING      (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS customers_delete_owner_admin ON public.customers;
CREATE POLICY customers_delete_owner_admin
  ON public.customers FOR DELETE
  TO authenticated
  USING (public.is_company_role(company_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS customers_select_admin ON public.customers;
CREATE POLICY customers_select_admin
  ON public.customers FOR SELECT
  USING (public.is_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- 6. customer_merges — Nachweis der Zusammenfuehrung, nur anhaengend
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_merges (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- BEWUSST OHNE Fremdschluessel auf customers: der Nachweis muss jede spaetere
  -- Bereinigung ueberleben.
  source_customer_id UUID NOT NULL,
  target_customer_id UUID NOT NULL,
  merged_by          UUID,
  merged_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason             TEXT,
  moved_counts       JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_snapshot    JSONB NOT NULL,
  CONSTRAINT customer_merges_distinct CHECK (source_customer_id <> target_customer_id)
);

COMMENT ON TABLE public.customer_merges IS
  'Nachweis jeder Zusammenfuehrung. source_snapshot enthaelt die vollstaendige '
  'Quellzeile — damit laesst sich eine Zusammenfuehrung von Hand rueckgaengig '
  'machen. Eine unmerge-Funktion gibt es bewusst NICHT.';

CREATE INDEX IF NOT EXISTS idx_customer_merges_company_merged
  ON public.customer_merges (company_id, merged_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_merges_source
  ON public.customer_merges (source_customer_id);

ALTER TABLE public.customer_merges ENABLE ROW LEVEL SECURITY;

-- NUR SELECT. Geschrieben wird ausschliesslich von merge_customers()
-- (SECURITY DEFINER, umgeht RLS).
DROP POLICY IF EXISTS customer_merges_select_member ON public.customer_merges;
CREATE POLICY customer_merges_select_member
  ON public.customer_merges FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE OR REPLACE FUNCTION public.guard_customer_merges_append_only()
RETURNS TRIGGER
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

DROP TRIGGER IF EXISTS trigger_customer_merges_append_only ON public.customer_merges;
CREATE TRIGGER trigger_customer_merges_append_only
  BEFORE UPDATE OR DELETE ON public.customer_merges
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_merges_append_only();

COMMIT;
