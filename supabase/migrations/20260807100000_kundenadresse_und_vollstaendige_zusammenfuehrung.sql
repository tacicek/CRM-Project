-- =============================================================================
-- Die Anschrift des Kunden — und eine Zusammenfuehrung, die nichts stehen laesst
-- =============================================================================
--
-- BEFUND 1 — der Kunde hat keine Adresse
-- `customers` traegt Name, E-Mail, Telefon, Sprache. Wo jemand WOHNT und wohin
-- die Rechnung geht, steht nirgends. Die Kundenkarte zeigt deshalb keine
-- Anschrift, und die Kundenliste behilft sich mit
--
--     ort := (SELECT from_plz || ' ' || from_city FROM leads … ORDER BY created_at DESC LIMIT 1)
--
-- also mit der AUSZUGSADRESSE der letzten Anfrage. Bei einem Umzug ist das
-- genau die Adresse, an der der Kunde nicht mehr wohnt. Der Wert sieht aus wie
-- eine Stammangabe und ist eine Vorgangsangabe.
--
-- `service_locations` (20260731100000) loest das NICHT: dort steht, wo GEARBEITET
-- wird — Auszug, Einzug, Reinigungsobjekt, Lager. Eine Rechnungsanschrift ist
-- keine Einsatzstelle; eine Hausverwaltung bekommt die Rechnung ins Buero und
-- den Auftrag in die Liegenschaft. Die Tabelle dafuer zu missbrauchen hiesse,
-- zwei verschiedene Dinge unter einem `kind` zu fuehren.
--
-- ABHILFE
-- `customer_addresses` — additiv, danebengestellt, mit derselben Bauart wie
-- `service_locations`:
--
--     * `address_raw` bleibt UNZERLEGT (die Lehre aus 20260728120000 und
--       20260731100000: der Rueckweg aus zerlegten Feldern ist nie verlustfrei);
--     * die strukturierten Felder daneben sind alle nullable;
--     * je Kunde und Adressart hoechstens EINE Hauptadresse — von der Datenbank
--       gehalten, nicht von der Oberflaeche.
--
-- KEIN BACKFILL. Die vorhandene Auszugsadresse eines Leads ALS Wohnadresse zu
-- uebernehmen waere genau die Verwechslung, die diese Migration abstellt. Ein
-- Kunde ohne Adresse zeigt in der Oberflaeche "Adresse hinzufuegen" — geraten
-- wird nicht.
--
-- DREI ADRESSBEGRIFFE, die sich nicht vermischen duerfen:
--   1. customer_addresses   aktueller Stand, aenderbar        (NEU)
--   2. service_locations    Einsatzstelle je Kunde            (vorhanden)
--   3. Beleg-Snapshots      rechnungen.recipient_*, offers.frozen_*, …
--                           historisch, wird NIE nachgezogen  (unberuehrt)
--
-- -----------------------------------------------------------------------------
--
-- BEFUND 2 — die Zusammenfuehrung laesst die Haelfte stehen
-- `merge_customers` (20260728130000) haengt sieben Tabellen um: leads, offers,
-- auftraege, appointments, rechnungen, quittungen, inbound_emails. Seither sind
-- ELF weitere Tabellen mit Kundenbezug dazugekommen — payments, credit_notes,
-- crm_tasks, customer_cases, service_locations, customer_change_requests,
-- communication_threads, offer_amendments, portal_magic_links, portal_sessions
-- und die Weiterleitungskette in `customers` selbst.
--
-- Folge im Betrieb: nach dem Zusammenfuehren zeigt die Kundenkarte des Ziels
-- weder die Zahlungen noch die Faelle, Aufgaben, Orte oder Adressen der Quelle.
-- Das Geld ist nicht weg, aber es steht an einem Kunden, den die Liste nicht
-- mehr zeigt. Die Vorschau versprach genau diese sieben Zahlen und war damit
-- nicht falsch, sondern unvollstaendig — was schlimmer ist, weil es nach
-- Vollstaendigkeit aussieht.
--
-- ABHILFE — die Liste wird nicht laenger gepflegt, sondern ERFRAGT
-- `customer_reference_columns()` liest aus `pg_constraint`, welche Spalten auf
-- `customers.id` zeigen. Jede kuenftige Tabelle mit Kundenbezug ist damit am Tag
-- ihrer Migration dabei; eine vergessene Zeile in einer handgepflegten Liste
-- kann es nicht mehr geben. Genau das war der Fehler, den diese Datei behebt —
-- ihn durch eine zweite handgepflegte Liste zu ersetzen hiesse, ihn in zwei
-- Jahren erneut zu haben.
--
-- Zwei Tabellen brauchen mehr als ein UPDATE und werden vorher gesondert
-- behandelt (Begruendung jeweils am Ort):
--   service_locations   UNIQUE (customer_id, lower(trim(address_raw)))
--   customer_addresses  UNIQUE (customer_id, address_type) WHERE is_primary
--
-- Alles andere wird umgehaengt. Kollidiert dabei ein Eindeutigkeitsindex, den
-- diese Datei nicht kennt, BRICHT die Zusammenfuehrung mit Klartext ab — die
-- ganze Funktion laeuft in einer Transaktion, es bleibt nichts halb erledigt.
-- Stillschweigend zu ueberspringen waere derselbe Fehler noch einmal.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. customer_addresses
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL,

  -- Nur zwei Arten. `service` und `origin`/`destination` gehoeren nach
  -- service_locations — dort steht schon, was beim Anfahren zaehlt (Stockwerk,
  -- Lift, Parksituation). Sie hier ein zweites Mal zuzulassen erzeugte zwei
  -- Orte fuer dieselbe Sache.
  address_type TEXT NOT NULL DEFAULT 'correspondence',

  label        TEXT,
  address_raw  TEXT NOT NULL,

  street       TEXT,
  house_number TEXT,
  plz          TEXT,
  city         TEXT,
  country      TEXT,

  notes        TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT TRUE,

  -- Ein Umzug macht die alte Anschrift nicht falsch, sondern vergangen.
  valid_from   DATE,
  valid_to     DATE,

  created_via  TEXT NOT NULL DEFAULT 'manual',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT customer_addresses_type_check
    CHECK (address_type IN ('correspondence', 'billing')),
  CONSTRAINT customer_addresses_created_via_check
    CHECK (created_via IN ('manual', 'portal', 'merge')),
  CONSTRAINT customer_addresses_adresse_da
    CHECK (length(TRIM(address_raw)) > 0),
  CONSTRAINT customer_addresses_zeitraum_plausibel
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

-- Derselbe zusammengesetzte Fremdschluessel wie ueberall seit 20260728100000:
-- so kann eine Adresse von Firma A nicht an einem Kunden von Firma B haengen.
ALTER TABLE public.customer_addresses
  DROP CONSTRAINT IF EXISTS customer_addresses_customer_fk,
  ADD  CONSTRAINT customer_addresses_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id) ON DELETE CASCADE;

-- Nur anlegen, wenn er fehlt (Muster aus 20260731100000): auf diesen Schluessel
-- koennen spaeter Fremdschluessel zeigen, ein DROP risse sie mit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_addresses_id_company_uniq'
      AND conrelid = 'public.customer_addresses'::regclass
  ) THEN
    ALTER TABLE public.customer_addresses
      ADD CONSTRAINT customer_addresses_id_company_uniq UNIQUE (id, company_id);
  END IF;
END $$;

COMMENT ON TABLE public.customer_addresses IS
  'Kanonische Anschrift des Kunden: Korrespondenz und Rechnung. NICHT der Ort, '
  'an dem gearbeitet wird — das ist service_locations. NICHT die Adresse auf '
  'einem Beleg — die ist ein Snapshot und wird nie nachgezogen.';
COMMENT ON COLUMN public.customer_addresses.address_raw IS
  'Unzerlegt, so wie erfasst. Die strukturierten Felder daneben fuellt der '
  'Bediener oder die Ortssuche, wenn sie bekannt sind.';
COMMENT ON COLUMN public.customer_addresses.is_primary IS
  'Je Kunde und Adressart hoechstens eine. Der partielle UNIQUE-Index haelt das; '
  'der Trigger daneben nimmt der Oberflaeche das zweite Schreiben ab.';

-- Die eigentliche Zusicherung: EINE Hauptadresse je Kunde und Art.
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_eine_hauptadresse
  ON public.customer_addresses (customer_id, address_type)
  WHERE is_primary;

-- Dieselbe Anschrift zweimal derselben Art anzulegen ist ein Vertipper, kein
-- zweiter Wohnsitz.
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_je_kunde_und_art
  ON public.customer_addresses (customer_id, address_type, LOWER(TRIM(address_raw)));

CREATE INDEX IF NOT EXISTS idx_customer_addresses_company_ort
  ON public.customer_addresses (company_id, city);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_kunde
  ON public.customer_addresses (customer_id, address_type);

DROP TRIGGER IF EXISTS customer_addresses_updated_at ON public.customer_addresses;
CREATE TRIGGER customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------------------------
-- Hauptadresse: setzen statt tauschen
--
-- Ohne diesen Trigger muesste die Oberflaeche zwei Anweisungen in der richtigen
-- Reihenfolge schicken (erst alte abwaehlen, dann neue setzen) — und ein
-- Abbruch dazwischen liesse den Kunden ohne Hauptadresse zurueck. Hier ist es
-- eine Anweisung, und der Index bleibt in jedem Moment erfuellt.
--
-- Die Rekursion endet von selbst: das innere UPDATE setzt is_primary = FALSE,
-- der erneute Aufruf betritt den IF-Zweig nicht mehr.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.customer_addresses_eine_hauptadresse()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.customer_addresses
    SET is_primary = FALSE
    WHERE customer_id  = NEW.customer_id
      AND address_type = NEW.address_type
      AND id <> NEW.id
      AND is_primary;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_customer_addresses_eine_hauptadresse ON public.customer_addresses;
CREATE TRIGGER trigger_customer_addresses_eine_hauptadresse
  BEFORE INSERT OR UPDATE OF is_primary, address_type, customer_id
  ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.customer_addresses_eine_hauptadresse();

-- Faellt die Hauptadresse weg, rueckt die aelteste verbliebene nach. Sonst
-- haette ein Kunde Adressen, aber keine gueltige — und die Kundenkarte zeigte
-- "Adresse hinzufuegen", obwohl drei dastehen.
CREATE OR REPLACE FUNCTION public.customer_addresses_hauptadresse_nachruecken()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT OLD.is_primary THEN
    RETURN OLD;
  END IF;

  UPDATE public.customer_addresses
  SET is_primary = TRUE
  WHERE id = (
    SELECT a.id FROM public.customer_addresses a
    WHERE a.customer_id  = OLD.customer_id
      AND a.address_type = OLD.address_type
      AND a.id <> OLD.id
    ORDER BY a.created_at, a.id
    LIMIT 1
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_customer_addresses_nachruecken ON public.customer_addresses;
CREATE TRIGGER trigger_customer_addresses_nachruecken
  AFTER DELETE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.customer_addresses_hauptadresse_nachruecken();

-- -----------------------------------------------------------------------------
-- RLS — wortgleich zu service_locations: Adresspflege ist Tagesarbeit.
-- -----------------------------------------------------------------------------

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_addresses_select_member ON public.customer_addresses;
CREATE POLICY customer_addresses_select_member ON public.customer_addresses FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS customer_addresses_insert_member ON public.customer_addresses;
CREATE POLICY customer_addresses_insert_member ON public.customer_addresses FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));

-- WITH CHECK ist nicht optional (BEFUND von 20260727120000): ohne sie waere ein
-- Wechsel der company_id erlaubt.
DROP POLICY IF EXISTS customer_addresses_update_member ON public.customer_addresses;
CREATE POLICY customer_addresses_update_member ON public.customer_addresses FOR UPDATE
  TO authenticated
  USING      (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS customer_addresses_delete_owner_admin ON public.customer_addresses;
CREATE POLICY customer_addresses_delete_owner_admin ON public.customer_addresses FOR DELETE
  TO authenticated USING (public.is_company_role(company_id, ARRAY['owner', 'admin']));

-- -----------------------------------------------------------------------------
-- Tabellenrechte — ausdruecklich, nicht geerbt
--
-- RLS entscheidet, WELCHE Zeilen jemand sieht. Ob eine Rolle die Tabelle
-- ueberhaupt anfassen darf, entscheidet das Tabellenrecht davor — und eine neu
-- angelegte Tabelle hat keines, solange es nicht jemand vergibt.
--
-- Sich auf ALTER DEFAULT PRIVILEGES zu verlassen scheitert nachweislich: im
-- Screenshot-Stapel (supabase-wiki) trug diese Tabelle nach dem Anlegen eine
-- LEERE relacl, waehrend service_locations und crm_tasks ihre Rechte fuehrten —
-- der Bediener bekam "permission denied for table customer_addresses", obwohl
-- jede Policy stimmte.
--
-- `anon` bekommt BEWUSST nichts. Die Altbestaende tragen anon-Rechte aus der
-- Zeit vor 20260803010000 ("anon_schreibrechte_schliessen"); eine neue Tabelle
-- soll diesen Weg nicht wieder aufmachen. Die Kundenkarte ist angemeldeter
-- Bereich, das Portal liest ueber SECURITY-DEFINER-Funktionen.
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.customer_addresses FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_addresses TO authenticated;
GRANT ALL    ON TABLE public.customer_addresses TO service_role;

-- =============================================================================
-- 2. Wer zeigt auf den Kunden? — gefragt, nicht gepflegt
-- =============================================================================

CREATE OR REPLACE FUNCTION public.customer_reference_columns()
RETURNS TABLE (tabelle TEXT, spalte TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT
         quote_ident(n.nspname) || '.' || quote_ident(cl.relname),
         a.attname::TEXT
  FROM pg_constraint c
  JOIN pg_class     cl ON cl.oid = c.conrelid
  JOIN pg_namespace n  ON n.oid  = cl.relnamespace
  JOIN LATERAL unnest(c.conkey)  WITH ORDINALITY AS k(attnum, ord) ON TRUE
  JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS f(attnum, ord) ON f.ord = k.ord
  JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = k.attnum
  JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = f.attnum
  WHERE c.contype = 'f'
    AND c.confrelid = 'public.customers'::regclass
    AND fa.attname = 'id'
    -- customers zeigt mit merged_into_customer_id auf sich selbst. Diese Spalte
    -- ist die Weiterleitungskette und wird in merge_customers() eigens
    -- behandelt, nicht wie ein Vorgang umgehaengt.
    AND c.conrelid <> 'public.customers'::regclass;
$$;

COMMENT ON FUNCTION public.customer_reference_columns() IS
  'Alle Spalten, die auf customers.id zeigen — aus pg_constraint gelesen, nicht '
  'von Hand gepflegt. Grundlage von merge_customers() und customer_merge_preview(): '
  'eine neue Tabelle mit Kundenbezug ist damit am Tag ihrer Migration dabei.';

REVOKE ALL ON FUNCTION public.customer_reference_columns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_reference_columns() TO authenticated, service_role;

-- =============================================================================
-- 2b. Das Zahlungsbuch bleibt anhaengend — aber es folgt einer Zusammenfuehrung
-- =============================================================================
--
-- BEFUND
-- `guard_payment_append_only` (20260729100000) laesst auf einer gebuchten
-- Zahlung nur drei Felder zu: reconciliation_status, reference, note. Alles
-- andere — auch `customer_id` — ist unveraenderlich, "Korrektur nur per Storno".
--
-- Das ist richtig fuer eine KORREKTUR: wer sich im Betrag oder im Zahler geirrt
-- hat, bucht gegen und neu, damit das Buch nachvollziehbar bleibt.
--
-- Eine Zusammenfuehrung ist aber keine Korrektur. Sie stellt fest, dass zwei
-- Kundenzeilen immer schon dieselbe Person waren. Der Zahler aendert sich dabei
-- nicht — nur die Zeile, unter der er gefuehrt wird. Bliebe die Zahlung stehen,
-- zeigte die Kundenkarte des bleibenden Kunden einen zu kleinen Bezahlt-Betrag,
-- und das Geld haenge an einem Kunden, den die Liste nicht mehr zeigt. Genau das
-- ist der Befund, den diese Migration behebt.
--
-- ABHILFE — eine eng gefasste Ausnahme, kein Loch
-- `customer_id` darf sich aendern, wenn im laufenden Vorgang GENAU dieser
-- Wechsel als Zusammenfuehrung angemeldet ist. Die Marke setzt merge_customers()
-- und niemand sonst; sie gilt nur fuer die Transaktion (is_local = true) und
-- muss von-nach zeichengenau treffen. Alle anderen Spalten und jeder Wechsel
-- ausserhalb einer Zusammenfuehrung bleiben gesperrt.
--
-- Der Nachweis geht nicht verloren: welche Zahlungen umgehaengt wurden, steht
-- mit Zahl in customer_merges.moved_counts, und die vollstaendige Quellzeile
-- daneben.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_payment_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  erlaubt TEXT[] := ARRAY['reconciliation_status','reference','note'];
  spalte  TEXT;
  alt_j   JSONB := to_jsonb(OLD);
  neu_j   JSONB := to_jsonb(NEW);
  marke   TEXT  := COALESCE(current_setting('crm.merging_customers', TRUE), '');
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
    IF spalte = ANY(erlaubt) THEN
      CONTINUE;
    END IF;

    -- Die einzige neue Ausnahme. Zeichengenau: eine gesetzte Marke erlaubt
    -- GENAU einen Wechsel und keinen anderen.
    IF spalte = 'customer_id'
       AND marke <> ''
       AND marke = COALESCE(OLD.customer_id::TEXT, '') || '>' || COALESCE(NEW.customer_id::TEXT, '') THEN
      CONTINUE;
    END IF;

    IF (alt_j -> spalte) IS DISTINCT FROM (neu_j -> spalte) THEN
      RAISE EXCEPTION
        'Zahlung %: "%" ist nicht nachtraeglich aenderbar. Korrektur nur per Storno.',
        OLD.id, spalte
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_payment_append_only() IS
  'Das Zahlungsbuch ist anhaengend. Einzige Ausnahme seit 20260807100000: '
  'customer_id folgt einer Zusammenfuehrung, wenn merge_customers() genau '
  'diesen Wechsel fuer die laufende Transaktion angemeldet hat.';

-- =============================================================================
-- 3. Vorschau — zeigt, was TATSAECHLICH umgehaengt wird
-- =============================================================================

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
DECLARE
  v_src   public.customers;
  v_tgt   public.customers;
  v_ref   RECORD;
  v_n     BIGINT;
  v_moves JSONB := '{}'::JSONB;
  v_name  TEXT;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_src FROM public.customers WHERE id = p_source_customer_id AND company_id = p_company_id;
  SELECT * INTO v_tgt FROM public.customers WHERE id = p_target_customer_id AND company_id = p_company_id;
  IF v_src.id IS NULL OR v_tgt.id IS NULL THEN
    RAISE EXCEPTION 'Kunde gehoert nicht zu dieser Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Dieselbe Quelle wie die Zusammenfuehrung selbst. Eine zweite, hier
  -- ausgeschriebene Liste waere genau der Grund, warum diese Migration
  -- geschrieben werden musste.
  FOR v_ref IN SELECT * FROM public.customer_reference_columns() ORDER BY tabelle
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', v_ref.tabelle, v_ref.spalte)
      INTO v_n USING v_src.id;
    IF v_n > 0 THEN
      -- Ohne Schemapraefix und ohne Anfuehrungszeichen: die Oberflaeche zeigt
      -- den Tabellennamen als Schluessel.
      v_name := replace(split_part(v_ref.tabelle, '.', 2), '"', '');
      v_moves := v_moves || jsonb_build_object(v_name, v_n);
    END IF;
  END LOOP;

  -- Die Weiterleitungskette: Kunden, die bereits auf die Quelle zeigen, zeigen
  -- danach auf das Ziel.
  SELECT count(*) INTO v_n FROM public.customers WHERE merged_into_customer_id = v_src.id;
  IF v_n > 0 THEN
    v_moves := v_moves || jsonb_build_object('weiterleitungen', v_n);
  END IF;

  RETURN jsonb_build_object(
    'moves', v_moves,
    -- Orte und Adressen, die im Ziel schon in derselben Schreibweise stehen,
    -- werden nicht doppelt gefuehrt, sondern zusammengelegt.
    'zusammengelegt', jsonb_build_object(
      'service_locations', (
        SELECT count(*) FROM public.service_locations s
        WHERE s.customer_id = v_src.id
          AND EXISTS (SELECT 1 FROM public.service_locations z
                      WHERE z.customer_id = v_tgt.id
                        AND LOWER(TRIM(z.address_raw)) = LOWER(TRIM(s.address_raw)))),
      'customer_addresses', (
        SELECT count(*) FROM public.customer_addresses a
        WHERE a.customer_id = v_src.id
          AND EXISTS (SELECT 1 FROM public.customer_addresses z
                      WHERE z.customer_id = v_tgt.id
                        AND z.address_type = a.address_type
                        AND LOWER(TRIM(z.address_raw)) = LOWER(TRIM(a.address_raw))))
    ),
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
        UNION ALL SELECT 'notes', v_src.notes
          WHERE v_tgt.notes IS NULL AND v_src.notes IS NOT NULL
      ) f
    ),
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
  'Vorschau VOR dem Zusammenfuehren. `moves` zaehlt ueber ALLE Tabellen mit '
  'Kundenbezug (aus customer_reference_columns), nicht ueber eine gepflegte '
  'Liste. Schreibt nichts (STABLE).';

-- =============================================================================
-- 4. Zusammenfuehren — vollstaendig oder gar nicht
-- =============================================================================

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
  v_src     public.customers;
  v_tgt     public.customers;
  v_moved   JSONB := '{}'::JSONB;
  v_legiert JSONB := '{}'::JSONB;
  v_ref     RECORD;
  v_ort     RECORD;
  v_adr     RECORD;
  v_ziel_id UUID;
  v_n       INTEGER;
  v_summe   INTEGER := 0;
  v_name    TEXT;
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

  -- ---------------------------------------------------------------------------
  -- 4a. Serviceorte — gleiche Anschrift ergibt einen Ort, nicht zwei
  --
  -- `idx_service_locations_je_kunde` ist UNIQUE (customer_id, lower(trim(
  -- address_raw))). Ein blosses UPDATE liefe in 23505, sobald beide Kunden
  -- dieselbe Wohnung tragen — und genau das ist bei Duplikaten der Regelfall.
  --
  -- Der Ort der Quelle wird deshalb NICHT umgehaengt, sondern in den
  -- bestehenden Ort des Ziels gelegt: Luecken auffuellen (Stockwerk, Lift,
  -- Parkhinweis — was einer von beiden weiss, weiss danach das Ziel), alle
  -- Verweise nachziehen, dann die leergeraeumte Zeile entfernen. Verloren geht
  -- dabei nichts: der Adresstext ist derselbe, sonst waere es kein Konflikt.
  -- ---------------------------------------------------------------------------
  FOR v_ort IN
    SELECT s.* FROM public.service_locations s WHERE s.customer_id = v_src.id
  LOOP
    SELECT z.id INTO v_ziel_id
    FROM public.service_locations z
    WHERE z.customer_id = v_tgt.id
      AND LOWER(TRIM(z.address_raw)) = LOWER(TRIM(v_ort.address_raw))
    LIMIT 1;

    IF v_ziel_id IS NULL THEN
      CONTINUE;  -- kein Konflikt: die Schleife unten haengt ihn regulaer um
    END IF;

    UPDATE public.service_locations z SET
      label        = COALESCE(z.label,        v_ort.label),
      kind         = z.kind,
      street       = COALESCE(z.street,       v_ort.street),
      house_number = COALESCE(z.house_number, v_ort.house_number),
      plz          = COALESCE(z.plz,          v_ort.plz),
      city         = COALESCE(z.city,         v_ort.city),
      floor        = COALESCE(z.floor,        v_ort.floor),
      has_elevator = COALESCE(z.has_elevator, v_ort.has_elevator),
      parking_note = COALESCE(z.parking_note, v_ort.parking_note),
      access_note  = COALESCE(z.access_note,  v_ort.access_note),
      rooms        = COALESCE(z.rooms,        v_ort.rooms),
      area_m2      = COALESCE(z.area_m2,      v_ort.area_m2),
      notes        = COALESCE(z.notes,        v_ort.notes)
    WHERE z.id = v_ziel_id;

    UPDATE public.auftraege      SET from_location_id = v_ziel_id WHERE from_location_id = v_ort.id;
    UPDATE public.auftraege      SET to_location_id   = v_ziel_id WHERE to_location_id   = v_ort.id;
    UPDATE public.appointments   SET location_id      = v_ziel_id WHERE location_id      = v_ort.id;
    UPDATE public.customer_cases SET location_id      = v_ziel_id WHERE location_id      = v_ort.id;

    DELETE FROM public.service_locations WHERE id = v_ort.id;
    v_summe := v_summe + 1;
  END LOOP;
  IF v_summe > 0 THEN
    v_legiert := v_legiert || jsonb_build_object('service_locations', v_summe);
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4b. Anschriften — eine Hauptadresse je Art bleibt eine
  --
  -- Zwei Indizes koennen hier kollidieren: dieselbe Anschrift derselben Art
  -- (dann zusammenlegen) und zwei Hauptadressen derselben Art (dann behaelt das
  -- ZIEL seine — es ist der bleibende Kunde; die der Quelle zieht als weitere
  -- Anschrift mit, damit die Angabe nicht verschwindet).
  -- ---------------------------------------------------------------------------
  v_summe := 0;
  FOR v_adr IN
    SELECT a.* FROM public.customer_addresses a WHERE a.customer_id = v_src.id
  LOOP
    SELECT z.id INTO v_ziel_id
    FROM public.customer_addresses z
    WHERE z.customer_id  = v_tgt.id
      AND z.address_type = v_adr.address_type
      AND LOWER(TRIM(z.address_raw)) = LOWER(TRIM(v_adr.address_raw))
    LIMIT 1;

    IF v_ziel_id IS NOT NULL THEN
      UPDATE public.customer_addresses z SET
        label        = COALESCE(z.label,        v_adr.label),
        street       = COALESCE(z.street,       v_adr.street),
        house_number = COALESCE(z.house_number, v_adr.house_number),
        plz          = COALESCE(z.plz,          v_adr.plz),
        city         = COALESCE(z.city,         v_adr.city),
        country      = COALESCE(z.country,      v_adr.country),
        notes        = COALESCE(z.notes,        v_adr.notes),
        valid_from   = COALESCE(z.valid_from,   v_adr.valid_from),
        valid_to     = COALESCE(z.valid_to,     v_adr.valid_to)
      WHERE z.id = v_ziel_id;

      DELETE FROM public.customer_addresses WHERE id = v_adr.id;
      v_summe := v_summe + 1;
      CONTINUE;
    END IF;

    UPDATE public.customer_addresses SET
      customer_id = v_tgt.id,
      is_primary  = (v_adr.is_primary AND NOT EXISTS (
                       SELECT 1 FROM public.customer_addresses z
                       WHERE z.customer_id = v_tgt.id
                         AND z.address_type = v_adr.address_type
                         AND z.is_primary)),
      created_via = 'merge'
    WHERE id = v_adr.id;
  END LOOP;
  IF v_summe > 0 THEN
    v_legiert := v_legiert || jsonb_build_object('customer_addresses', v_summe);
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4c. Alles Uebrige — eine Anweisung je Spalte, die auf customers.id zeigt
  --
  -- Die Ausnahmeliste enthaelt NUR die beiden oben eigens behandelten Tabellen.
  -- Alles andere wird umgehaengt, auch was es zum Zeitpunkt dieser Migration
  -- noch nicht gab.
  --
  -- Laeuft ein Eindeutigkeitsindex dagegen, den diese Datei nicht kennt, bricht
  -- die Zusammenfuehrung mit Klartext ab. Sie steckt in EINER Transaktion —
  -- danach ist der Zustand unveraendert, nicht halb umgehaengt.
  -- ---------------------------------------------------------------------------
  -- Meldet den Wechsel fuer die laufende Transaktion an. Das Zahlungsbuch
  -- (guard_payment_append_only) laesst `customer_id` genau dann folgen — und
  -- nur diesen einen Wechsel. `is_local = true`: mit dem Ende der Transaktion
  -- ist die Marke weg, auch wenn etwas dazwischen fehlschlaegt.
  PERFORM set_config('crm.merging_customers',
                     v_src.id::TEXT || '>' || v_tgt.id::TEXT, TRUE);

  FOR v_ref IN SELECT * FROM public.customer_reference_columns() ORDER BY tabelle
  LOOP
    v_name := replace(split_part(v_ref.tabelle, '.', 2), '"', '');
    BEGIN
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2',
                     v_ref.tabelle, v_ref.spalte, v_ref.spalte)
        USING v_tgt.id, v_src.id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION
        'Zusammenfuehren gestoppt: in %.% kollidieren beide Kunden auf einem '
        'Eindeutigkeitsindex (%). Es wurde nichts geaendert. Den Konflikt in '
        'dieser Tabelle zuerst aufloesen.',
        v_name, v_ref.spalte, SQLERRM
        USING ERRCODE = 'unique_violation';
    END;

    IF v_n > 0 THEN
      v_moved := v_moved || jsonb_build_object(
        v_name, COALESCE((v_moved ->> v_name)::INTEGER, 0) + v_n);
    END IF;
  END LOOP;

  -- Die Marke gilt nur fuer das Umhaengen. Danach ist das Zahlungsbuch wieder
  -- vollstaendig geschlossen, auch innerhalb derselben Transaktion.
  PERFORM set_config('crm.merging_customers', '', TRUE);

  -- Die Weiterleitungskette flach halten: wer schon auf die Quelle zeigte,
  -- zeigt danach direkt auf das Ziel. Sonst muesste jeder alte Link zwei
  -- Weiterleitungen folgen — und der naechste Merge drei.
  UPDATE public.customers SET merged_into_customer_id = v_tgt.id
   WHERE merged_into_customer_id = v_src.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    v_moved := v_moved || jsonb_build_object('weiterleitungen', v_n);
  END IF;

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
          NULLIF(TRIM(COALESCE(p_reason, '')), ''),
          v_moved || jsonb_build_object('zusammengelegt', v_legiert),
          to_jsonb(v_src));

  -- Die Quellzeile bleibt als Weiterleitung stehen. Der partielle UNIQUE-Index
  -- auf customers greift nur bei merged_into_customer_id IS NULL — die E-Mail
  -- gibt den Index in diesem Moment frei, es entsteht kein Konflikt.
  UPDATE public.customers
  SET merged_into_customer_id = v_tgt.id,
      merged_at               = NOW(),
      status                  = 'inactive'
  WHERE id = v_src.id;

  RETURN jsonb_build_object(
    'target_customer_id', v_tgt.id,
    'moved', v_moved,
    'zusammengelegt', v_legiert);
END;
$$;

COMMENT ON FUNCTION public.merge_customers(UUID, UUID, UUID, TEXT) IS
  'Fuehrt zwei Kunden zusammen — ueber ALLE Tabellen mit Kundenbezug, ermittelt '
  'aus pg_constraint. Serviceorte und Anschriften mit gleichem Text werden '
  'zusammengelegt statt verdoppelt. Ein unbekannter Eindeutigkeitskonflikt '
  'bricht mit Klartext ab; die Funktion laeuft in einer Transaktion. Nicht '
  'ruecknehmbar; der Nachweis steht in customer_merges.';

REVOKE ALL ON FUNCTION public.merge_customers(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_customers(UUID, UUID, UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.customer_merge_preview(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_merge_preview(UUID, UUID, UUID) TO authenticated;

-- =============================================================================
-- 5. customer_summary — "zuletzt" ist nicht "als naechstes"
-- =============================================================================
--
-- BEFUND
-- `letzte_aktion` nimmt das Maximum ueber sieben Tabellen, darunter
--
--     max(appointment_date::timestamptz) FROM appointments
--
-- Ein Termin liegt regelmaessig in der ZUKUNFT. Bei einem Kunden, dessen Umzug
-- in drei Wochen ansteht, meldet die Kundenkarte deshalb "Letzte Aktion: in drei
-- Wochen" — und die Liste sortiert ihn ueber alle, bei denen tatsaechlich etwas
-- geschehen ist. Zuletzt und demnaechst sind zwei verschiedene Fragen.
--
-- ABHILFE
--   letzte_aktion    nur Geschehenes. Ein Termin zaehlt, wenn er stattgefunden
--                    hat, nicht wenn er eingetragen ist.
--   naechster_termin unveraendert die Zukunft — jetzt mit Uhrzeit und Art.
--   naechste_aufgabe NEU: die faellige Wiedervorlage.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.customer_summary(p_customer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kunde  public.customers;
  v_letzte RECORD;
BEGIN
  SELECT * INTO v_kunde FROM public.customers WHERE id = p_customer_id;
  IF v_kunde.id IS NULL OR NOT public.is_company_member(v_kunde.company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Kunden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Ein Durchgang fuer Zeitpunkt UND Art: die Oberflaeche soll "Letzte Aktion"
  -- benennen koennen und nicht nur datieren.
  SELECT x.t AS am, x.art AS art INTO v_letzte
  FROM (
    SELECT max(created_at) AS t, 'anfrage'::TEXT AS art FROM public.leads      WHERE customer_id = p_customer_id
    UNION ALL SELECT max(created_at), 'offerte'  FROM public.offers            WHERE customer_id = p_customer_id
    UNION ALL SELECT max(created_at), 'auftrag'  FROM public.auftraege         WHERE customer_id = p_customer_id AND deleted_at IS NULL
    UNION ALL SELECT max(created_at), 'rechnung' FROM public.rechnungen        WHERE customer_id = p_customer_id
    UNION ALL SELECT max(created_at), 'quittung' FROM public.quittungen        WHERE customer_id = p_customer_id
    UNION ALL SELECT max(received_at),'email'    FROM public.inbound_emails    WHERE customer_id = p_customer_id
    UNION ALL SELECT max(created_at), 'zahlung'  FROM public.payments          WHERE customer_id = p_customer_id
    UNION ALL SELECT max(created_at), 'fall'     FROM public.customer_cases    WHERE customer_id = p_customer_id
    -- Der einzige Zweig mit Bedingung: nur STATTGEFUNDENE Termine.
    UNION ALL
    SELECT max((t.appointment_date + COALESCE(t.start_time, TIME '00:00')) AT TIME ZONE 'Europe/Zurich'),
           'termin'
    FROM public.appointments t
    WHERE t.customer_id = p_customer_id
      AND t.status <> 'cancelled'
      AND (t.appointment_date + COALESCE(t.start_time, TIME '00:00')) AT TIME ZONE 'Europe/Zurich' <= NOW()
  ) x
  WHERE x.t IS NOT NULL
  ORDER BY x.t DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'kunde', to_jsonb(v_kunde),
    'anzahl', jsonb_build_object(
      'anfragen',   (SELECT count(*) FROM public.leads              WHERE customer_id = p_customer_id),
      'offerten',   (SELECT count(*) FROM public.offers             WHERE customer_id = p_customer_id),
      'auftraege',  (SELECT count(*) FROM public.auftraege          WHERE customer_id = p_customer_id AND deleted_at IS NULL),
      'termine',    (SELECT count(*) FROM public.appointments       WHERE customer_id = p_customer_id),
      'rechnungen', (SELECT count(*) FROM public.rechnungen         WHERE customer_id = p_customer_id),
      'quittungen', (SELECT count(*) FROM public.quittungen         WHERE customer_id = p_customer_id),
      'emails',     (SELECT count(*) FROM public.inbound_emails     WHERE customer_id = p_customer_id),
      'faelle',     (SELECT count(*) FROM public.customer_cases     WHERE customer_id = p_customer_id),
      'aufgaben',   (SELECT count(*) FROM public.crm_tasks          WHERE customer_id = p_customer_id),
      'orte',       (SELECT count(*) FROM public.service_locations  WHERE customer_id = p_customer_id),
      'adressen',   (SELECT count(*) FROM public.customer_addresses WHERE customer_id = p_customer_id)
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
    -- Was JETZT Aufmerksamkeit braucht. Die Oberflaeche zeigt daraus den
    -- Achtungsstreifen; ohne diesen Block muesste sie vier eigene Abfragen
    -- stellen und koennte bei einer davon still auf 0 fallen.
    'offen', jsonb_build_object(
      'aufgaben',      (SELECT count(*) FROM public.crm_tasks
                        WHERE customer_id = p_customer_id AND status = 'open'),
      'aufgaben_faellig', (SELECT count(*) FROM public.crm_tasks
                        WHERE customer_id = p_customer_id AND status = 'open'
                          AND due_at IS NOT NULL AND due_at <= NOW()),
      'faelle',        (SELECT count(*) FROM public.customer_cases
                        WHERE customer_id = p_customer_id
                          AND status NOT IN ('geloest','abgelehnt')),
      'faelle_dringend', (SELECT count(*) FROM public.customer_cases
                        WHERE customer_id = p_customer_id
                          AND status NOT IN ('geloest','abgelehnt')
                          AND priority IN ('high','urgent')),
      'aenderungswuensche', (SELECT count(*) FROM public.customer_change_requests
                        WHERE customer_id = p_customer_id AND status = 'offen')
    ),
    'finanzen', jsonb_build_object(
      'fakturiert',  (SELECT COALESCE(SUM(COALESCE(gesamttotal, total, 0)), 0)
                      FROM public.rechnungen
                      WHERE customer_id = p_customer_id AND status <> 'entwurf'),
      'bezahlt',     (SELECT COALESCE(SUM(amount), 0) FROM public.payments
                      WHERE customer_id = p_customer_id),
      'offen',       (SELECT COALESCE(SUM(open_amount), 0) FROM public.rechnungen
                      WHERE customer_id = p_customer_id
                        AND status <> 'entwurf' AND open_amount > 0),
      -- NEU: der Teil des offenen Betrags, dessen Frist verstrichen ist. Genau
      -- dieser Wert gehoert in den Achtungsstreifen, nicht der offene gesamt.
      'ueberfaellig',(SELECT COALESCE(SUM(open_amount), 0) FROM public.rechnungen
                      WHERE customer_id = p_customer_id
                        AND status <> 'entwurf' AND open_amount > 0
                        AND faellig_am IS NOT NULL AND faellig_am < CURRENT_DATE),
      'davon_quittungen', (SELECT COALESCE(SUM(p.amount), 0)
                      FROM public.payments p
                      JOIN public.quittungen q ON q.payment_id = p.id
                      WHERE p.customer_id = p_customer_id),
      'gutschriften', (SELECT COALESCE(SUM(amount), 0) FROM public.credit_notes
                      WHERE customer_id = p_customer_id AND status = 'versendet')
    ),
    'aktivitaet', jsonb_build_object(
      'erster_kontakt',   v_kunde.first_seen_at,
      'letzte_aktion',    v_letzte.am,
      'letzte_aktion_art', v_letzte.art,
      'naechster_termin', (SELECT jsonb_build_object(
                             'id', a.id, 'datum', a.appointment_date,
                             'start', a.start_time, 'ende', a.end_time,
                             'ganztags', a.all_day,
                             'art', a.appointment_type, 'titel', a.title)
                           FROM public.appointments a
                           WHERE a.customer_id = p_customer_id
                             AND a.appointment_date >= CURRENT_DATE
                             AND a.status NOT IN ('cancelled')
                           ORDER BY a.appointment_date, a.start_time NULLS FIRST LIMIT 1),
      'naechste_aufgabe', (SELECT jsonb_build_object(
                             'id', k.id, 'titel', k.title, 'faellig_am', k.due_at,
                             'prioritaet', k.priority, 'art', k.task_type)
                           FROM public.crm_tasks k
                           WHERE k.customer_id = p_customer_id AND k.status = 'open'
                           ORDER BY k.due_at NULLS LAST, k.created_at LIMIT 1)
    ),
    -- Woran eine Schnellaktion anknuepfen kann. Die Offertenerstellung im
    -- Dashboard braucht einen Lead (/firma/offerten/neu?lead=…) — ohne ihn gibt
    -- es die Aktion nicht, und eine Schaltflaeche, die nirgendwohin fuehrt,
    -- soll gar nicht erst erscheinen.
    'aktionen', jsonb_build_object(
      'letzte_anfrage_id', (SELECT l.id FROM public.leads l
                            WHERE l.customer_id = p_customer_id
                            ORDER BY l.created_at DESC LIMIT 1)
    ),
    'zusammengefuehrt_aus', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', s.id, 'anzeigename', s.display_name, 'am', s.merged_at)), '[]'::jsonb)
      FROM public.customers s WHERE s.merged_into_customer_id = p_customer_id)
  );
END;
$$;

COMMENT ON FUNCTION public.customer_summary(UUID) IS
  'Kennzahlen der Kundenkarte. aktivitaet.letzte_aktion enthaelt NUR '
  'Geschehenes — ein Termin naechste Woche ist keine letzte Aktion, er steht '
  'unter naechster_termin. finanzen.davon_quittungen ist ein Anteil von '
  'bezahlt und wird nicht dazugezaehlt.';

-- =============================================================================
-- 6. search_customers — der Ort kommt aus der Anschrift, nicht aus dem Auszug
-- =============================================================================
--
-- Bisher: `ort` war Postleitzahl und Stadt der letzten ANFRAGE, also die
-- Adresse, aus der jemand ausgezogen ist. In der Liste steht das direkt neben
-- Name und E-Mail und liest sich als Wohnort.
--
-- Jetzt: die kanonische Anschrift, wenn es sie gibt. Ohne Anschrift bleibt der
-- letzte Einsatzort — aber `ort_quelle` sagt, was man sieht, und die Oberflaeche
-- beschriftet ihn entsprechend. Raten und dann so tun, als waere es gewusst,
-- ist die eine Moeglichkeit, die ausscheidet.
--
-- Der Rueckgabetyp waechst um zwei Spalten (ort_quelle, offene_faelle). Postgres
-- laesst das nicht per CREATE OR REPLACE zu ("cannot change return type of
-- existing function") — deshalb erst DROP, dann anlegen, dann die Rechte neu
-- setzen. Ein DROP nimmt die Rechte mit; sie unten wieder zu vergeben ist
-- Pflicht und kein Beiwerk.
-- =============================================================================

DROP FUNCTION IF EXISTS public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.search_customers(
  p_company_id UUID,
  p_query      TEXT    DEFAULT NULL,
  p_filter     TEXT    DEFAULT 'alle',
  p_limit      INTEGER DEFAULT 25,
  p_offset     INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                  UUID,
  display_name        TEXT,
  customer_type       TEXT,
  first_name          TEXT,
  last_name           TEXT,
  company_name        TEXT,
  primary_email       TEXT,
  primary_phone       TEXT,
  language            TEXT,
  status              TEXT,
  possible_duplicate  BOOLEAN,
  first_seen_at       TIMESTAMPTZ,
  letzte_aktion       TIMESTAMPTZ,
  offerten_offen      INTEGER,
  auftraege_gesamt    INTEGER,
  offener_betrag      NUMERIC(12,2),
  bezahlter_betrag    NUMERIC(12,2),
  ort                 TEXT,
  ort_quelle          TEXT,
  offene_faelle       INTEGER,
  gesamt              BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

  -- Der Bediener tippt "079 123 45 67", gespeichert ist "+41791234567". Die
  -- fuehrende Null der nationalen Schreibweise muss weg, sonst findet die Suche
  -- ausgerechnet die Form nicht, die man am ehesten eintippt.
  v_ziffer := NULLIF(regexp_replace(
                regexp_replace(COALESCE(v_such, ''), '\D', '', 'g'),
                '^0+', ''), '');

  RETURN QUERY
  WITH treffer AS (
    SELECT c.*
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.merged_into_customer_id IS NULL
      AND (p_filter IS DISTINCT FROM 'person'    OR c.customer_type = 'person')
      AND (p_filter IS DISTINCT FROM 'firma'     OR c.customer_type = 'company')
      AND (p_filter IS DISTINCT FROM 'duplikate' OR c.possible_duplicate)
      AND (
        v_such IS NULL
        OR c.display_name  ILIKE '%' || v_such || '%'
        OR c.primary_email ILIKE '%' || v_such || '%'
        -- NEU: nach Ort und Postleitzahl der kanonischen Anschrift suchen. Wer
        -- "Winterthur" tippt, meint den Wohnort und nicht den Namen.
        OR EXISTS (SELECT 1 FROM public.customer_addresses a
                   WHERE a.customer_id = c.id
                     AND (a.city ILIKE '%' || v_such || '%'
                       OR a.plz  ILIKE v_such || '%'
                       OR a.address_raw ILIKE '%' || v_such || '%'))
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
    COALESCE(adr.ort, ort.ort),
    CASE WHEN adr.ort IS NOT NULL THEN 'adresse'
         WHEN ort.ort IS NOT NULL THEN 'einsatzort' END,
    COALESCE(fll.n, 0)::INTEGER,
    gezaehlt.n
  FROM treffer t
  CROSS JOIN gezaehlt
  LEFT JOIN LATERAL (
    -- Nur Geschehenes, dieselbe Regel wie in customer_summary. Leads, Offerten,
    -- Auftraege, Rechnungen und Posteingang tragen created_at bzw. received_at
    -- und liegen damit ohnehin in der Vergangenheit; der Termin ist der
    -- Sonderfall und steht deshalb mit Bedingung da.
    SELECT max(x.t) AS letzte FROM (
      SELECT max(l.created_at) t FROM public.leads      l WHERE l.customer_id = t.id
      UNION ALL SELECT max(o.created_at) FROM public.offers     o WHERE o.customer_id = t.id
      UNION ALL SELECT max(a.created_at) FROM public.auftraege  a WHERE a.customer_id = t.id AND a.deleted_at IS NULL
      UNION ALL SELECT max(r.created_at) FROM public.rechnungen r WHERE r.customer_id = t.id
      UNION ALL SELECT max(p.created_at) FROM public.payments   p WHERE p.customer_id = t.id
      UNION ALL SELECT max(i.received_at) FROM public.inbound_emails i WHERE i.customer_id = t.id
      UNION ALL
      SELECT max((m.appointment_date + COALESCE(m.start_time, TIME '00:00')) AT TIME ZONE 'Europe/Zurich')
      FROM public.appointments m
      WHERE m.customer_id = t.id AND m.status <> 'cancelled'
        AND (m.appointment_date + COALESCE(m.start_time, TIME '00:00')) AT TIME ZONE 'Europe/Zurich' <= NOW()
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
  LEFT JOIN LATERAL (
    SELECT count(*) AS n FROM public.customer_cases f
    WHERE f.customer_id = t.id AND f.status NOT IN ('geloest','abgelehnt')
  ) fll ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(r.open_amount) FILTER (
             WHERE r.status <> 'entwurf' AND r.open_amount > 0), 0) AS offen,
           COALESCE((SELECT SUM(p.amount) FROM public.payments p
                     WHERE p.customer_id = t.id), 0) AS bezahlt
    FROM public.rechnungen r WHERE r.customer_id = t.id
  ) fin ON TRUE
  -- Die kanonische Anschrift zuerst: Korrespondenz schlaegt Rechnung, denn wo
  -- die Post hingeht ist naeher am "wo wohnt der Kunde" als wo die Rechnung
  -- hingeht.
  LEFT JOIN LATERAL (
    SELECT NULLIF(TRIM(CONCAT_WS(' ', a.plz, a.city)), '') AS ort
    FROM public.customer_addresses a
    WHERE a.customer_id = t.id
      AND (a.city IS NOT NULL OR a.plz IS NOT NULL)
      AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
    ORDER BY a.is_primary DESC,
             (a.address_type = 'correspondence') DESC,
             a.created_at DESC
    LIMIT 1
  ) adr ON TRUE
  LEFT JOIN LATERAL (
    SELECT NULLIF(TRIM(CONCAT_WS(' ', l.from_plz, l.from_city)), '') AS ort
    FROM public.leads l WHERE l.customer_id = t.id AND l.from_city IS NOT NULL
    ORDER BY l.created_at DESC LIMIT 1
  ) ort ON TRUE
  ORDER BY akt.letzte DESC NULLS LAST, t.display_name
  LIMIT v_limit OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

COMMENT ON FUNCTION public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER) IS
  'Kundenliste mit abgeleiteten Werten. `ort` kommt aus customer_addresses, '
  'ersatzweise aus dem letzten Einsatzort — `ort_quelle` sagt welches von '
  'beiden, damit die Oberflaeche eine Auszugsadresse nicht als Wohnort zeigt.';

REVOKE ALL ON FUNCTION public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_customers(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- =============================================================================
-- 7. customer_kennzahlen — "inaktiv" heisst: es ist nichts passiert
-- =============================================================================
--
-- BEFUND
-- Die Kachel "Inaktiv (90 T.)" zaehlte in useKunden.ts
--
--     customers.first_seen_at < heute - 90 Tage
--
-- also Kunden, deren ERSTER Kontakt lange her ist. Ein Stammkunde seit zwei
-- Jahren, der letzte Woche einen Auftrag erteilt hat, faellt darunter. Die
-- Kachel zeigt damit ungefaehr das Gegenteil ihres Namens.
--
-- ABHILFE — dieselbe letzte Aktion wie ueberall sonst, in einer Abfrage statt
-- in vier Zaehlern aus dem Browser.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.customer_kennzahlen(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_erg JSONB;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
    'gesamt',    count(*),
    'neu30',     count(*) FILTER (WHERE k.created_at >= NOW() - INTERVAL '30 days'),
    'duplikate', count(*) FILTER (WHERE k.possible_duplicate),
    -- Inaktiv: seit 90 Tagen ist nichts geschehen. Ein Kunde ohne jede Aktion
    -- zaehlt ueber seinen ersten Kontakt — er ist derselbe Fall, nur ohne
    -- Vorgang.
    'inaktiv90', count(*) FILTER (
      WHERE COALESCE(a.letzte, k.first_seen_at) < NOW() - INTERVAL '90 days'),
    'blockiert', count(*) FILTER (WHERE k.status = 'blocked')
  ) INTO v_erg
  FROM public.customers k
  LEFT JOIN LATERAL (
    SELECT max(x.t) AS letzte FROM (
      SELECT max(l.created_at) t FROM public.leads      l WHERE l.customer_id = k.id
      UNION ALL SELECT max(o.created_at) FROM public.offers     o WHERE o.customer_id = k.id
      UNION ALL SELECT max(u.created_at) FROM public.auftraege  u WHERE u.customer_id = k.id AND u.deleted_at IS NULL
      UNION ALL SELECT max(r.created_at) FROM public.rechnungen r WHERE r.customer_id = k.id
      UNION ALL SELECT max(p.created_at) FROM public.payments   p WHERE p.customer_id = k.id
      UNION ALL SELECT max(i.received_at) FROM public.inbound_emails i WHERE i.customer_id = k.id
      UNION ALL
      SELECT max((m.appointment_date + COALESCE(m.start_time, TIME '00:00')) AT TIME ZONE 'Europe/Zurich')
      FROM public.appointments m
      WHERE m.customer_id = k.id AND m.status <> 'cancelled'
        AND (m.appointment_date + COALESCE(m.start_time, TIME '00:00')) AT TIME ZONE 'Europe/Zurich' <= NOW()
    ) x
  ) a ON TRUE
  WHERE k.company_id = p_company_id
    AND k.merged_into_customer_id IS NULL;

  RETURN v_erg;
END;
$$;

COMMENT ON FUNCTION public.customer_kennzahlen(UUID) IS
  'Die vier Kacheln der Kundenliste. "inaktiv90" zaehlt fehlende AKTIVITAET, '
  'nicht ein weit zurueckliegendes first_seen_at — das war der alte Zaehler und '
  'meldete Stammkunden als inaktiv.';

REVOKE ALL ON FUNCTION public.customer_kennzahlen(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_kennzahlen(UUID) TO authenticated;

COMMIT;
