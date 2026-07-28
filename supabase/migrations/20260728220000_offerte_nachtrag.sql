-- =============================================================================
-- Nachtrag: Aenderungen am vereinbarten Umfang brauchen erneute Zustimmung
-- =============================================================================
--
-- BEFUND
-- Seit 20260728200000 laesst sich eine versendete Offerte neu auflegen — aber
-- nur, solange der Kunde noch nicht zugestimmt hat. Eine ANGENOMMENE Offerte
-- weist create_offer_revision ausdruecklich ab, und das ist richtig: der Kunde
-- hat einem bestimmten Umfang zugestimmt, den man ihm nicht nachtraeglich
-- unterschieben darf.
--
-- Damit stand der Betrieb aber ohne Weg da. Auf der Produktion sind 13 Offerten
-- angenommen; an ihrem Umfang laesst sich derzeit gar nichts mehr aendern —
-- auch nicht das, was im Alltag staendig vorkommt: eine Zusatzleistung, ein
-- zweiter Termin, ein Klavier, das erst beim Besichtigen auftaucht.
--
-- ABHILFE
-- Ein Nachtrag ist ein eigener kleiner Beleg mit eigenem Link und eigener
-- Zustimmung. Die angenommene Offerte bleibt unberuehrt — sie ist der Nachweis
-- der urspruenglichen Vereinbarung. Der Nachtrag steht daneben, nicht darin.
--
-- WOHIN DER ZUSAETZLICHE UMFANG WIRKT
-- Beim Annehmen wird der AUFTRAG fortgeschrieben, nicht die Offerte. Der
-- Auftrag ist die Ausfuehrung — er soll zeigen, was tatsaechlich zu tun und zu
-- verrechnen ist. Offerte und Nachtrag bleiben als Beleg unveraendert stehen.
-- (Es gibt genau einen Auftrag je Offerte; update_offer_by_token legt ihn mit
-- NOT EXISTS an. Ein zweiter Auftrag waere die Alternative gewesen, haette aber
-- Termin, Team und Rechnung gespalten.)
--
-- Die MwSt rechnet dieselbe Formel wie bei der Offerte — hier generiert, damit
-- Nachtrag und Offerte nicht auseinanderlaufen koennen.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tabellen
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.offer_amendments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  offer_id         UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  -- Der Auftrag, den die Zustimmung fortschreibt. Beim Anlegen bereits bekannt;
  -- SET NULL, damit ein geloeschter Auftrag den Beleg nicht mitnimmt.
  auftrag_id       UUID REFERENCES public.auftraege(id) ON DELETE SET NULL,

  amendment_number INTEGER NOT NULL,
  title            TEXT NOT NULL,
  reason           TEXT,

  status           TEXT NOT NULL DEFAULT 'draft',
  access_token     TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),

  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate         NUMERIC(5,2)  NOT NULL DEFAULT 8.1,
  vat_amount       NUMERIC GENERATED ALWAYS AS ((subtotal * vat_rate) / 100) STORED,
  total            NUMERIC GENERATED ALWAYS AS (subtotal + ((subtotal * vat_rate) / 100)) STORED,

  sent_at          TIMESTAMPTZ,
  viewed_at        TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  rejected_at      TIMESTAMPTZ,
  customer_response_note TEXT,
  -- Wie bei der Offerte serverseitig gesetzt, nicht vom Browser geliefert.
  accepted_ip      TEXT,

  -- Die Sprache des KUNDEN, aus der Offerte eingefroren. Der Nachtrag geht an
  -- ihn hinaus; sie darf nicht aus der Dashboard-Sprache des Bedieners kommen.
  --
  -- BEWUSST OHNE Spaltenstandard: ein DEFAULT 'de' greift VOR dem Trigger, und
  -- der koennte dann nicht mehr unterscheiden, ob 'de' gewollt war oder nur
  -- eingesetzt wurde — die Sprache der Offerte kaeme nie an. Ein franzoesischer
  -- Kunde bekaeme einen deutschen Nachtrag. Der Trigger fuellt die Spalte.
  language         TEXT NOT NULL,
  customer_id      UUID,

  locked_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT offer_amendments_status_check
    CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected')),
  CONSTRAINT offer_amendments_language_check
    CHECK (language IN ('de', 'fr', 'en')),
  CONSTRAINT offer_amendments_title_present
    CHECK (length(TRIM(title)) > 0),
  CONSTRAINT offer_amendments_number_uniq UNIQUE (offer_id, amendment_number),
  CONSTRAINT offer_amendments_token_uniq  UNIQUE (access_token),
  -- Fuer den zusammengesetzten Fremdschluessel der Positionen.
  CONSTRAINT offer_amendments_id_company_uniq UNIQUE (id, company_id)
);

COMMENT ON TABLE public.offer_amendments IS
  'Nachtrag zu einer angenommenen Offerte: eigener Beleg, eigener Link, eigene '
  'Zustimmung. Die Offerte bleibt unberuehrt — sie belegt die urspruengliche '
  'Vereinbarung. Bei Zustimmung wird der AUFTRAG fortgeschrieben.';

COMMENT ON COLUMN public.offer_amendments.language IS
  'Sprache des Kunden, aus der Offerte eingefroren. NICHT die Dashboard-Sprache '
  'des Bedieners — der Nachtrag geht an den Kunden.';

CREATE TABLE IF NOT EXISTS public.offer_amendment_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID NOT NULL REFERENCES public.offer_amendments(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 1,
  description  TEXT NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit         TEXT,
  unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_type TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_amendments_offer
  ON public.offer_amendments (offer_id, amendment_number);
CREATE INDEX IF NOT EXISTS idx_offer_amendments_company_status
  ON public.offer_amendments (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_amendment_items_amendment
  ON public.offer_amendment_items (amendment_id, position);

-- -----------------------------------------------------------------------------
-- 2. Kundenbezug und updated_at — dieselben Muster wie ueberall
-- -----------------------------------------------------------------------------

ALTER TABLE public.offer_amendments
  DROP CONSTRAINT IF EXISTS offer_amendments_customer_fk,
  ADD  CONSTRAINT offer_amendments_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

CREATE OR REPLACE FUNCTION public.offer_amendments_inherit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS trigger_offer_amendments_inherit ON public.offer_amendments;
CREATE TRIGGER trigger_offer_amendments_inherit
  BEFORE INSERT ON public.offer_amendments
  FOR EACH ROW EXECUTE FUNCTION public.offer_amendments_inherit();

DROP TRIGGER IF EXISTS trigger_offer_amendments_updated_at ON public.offer_amendments;
CREATE TRIGGER trigger_offer_amendments_updated_at
  BEFORE UPDATE ON public.offer_amendments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Sperre nach dem Versand — dieselbe Erlaubnisliste-Logik wie bei der Offerte
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_amendment_after_send()
RETURNS TRIGGER
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

DROP TRIGGER IF EXISTS trigger_offer_amendments_guard ON public.offer_amendments;
CREATE TRIGGER trigger_offer_amendments_guard
  BEFORE UPDATE ON public.offer_amendments
  FOR EACH ROW EXECUTE FUNCTION public.guard_amendment_after_send();

-- -----------------------------------------------------------------------------
-- 4. RLS — wie bei Offerten: Betrieb, kein Konfigurationsgut
-- -----------------------------------------------------------------------------

ALTER TABLE public.offer_amendments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_amendment_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offer_amendments_select_member ON public.offer_amendments;
CREATE POLICY offer_amendments_select_member ON public.offer_amendments FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS offer_amendments_insert_member ON public.offer_amendments;
CREATE POLICY offer_amendments_insert_member ON public.offer_amendments FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS offer_amendments_update_member ON public.offer_amendments;
CREATE POLICY offer_amendments_update_member ON public.offer_amendments FOR UPDATE
  TO authenticated
  USING      (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS offer_amendments_delete_owner_admin ON public.offer_amendments;
CREATE POLICY offer_amendments_delete_owner_admin ON public.offer_amendments FOR DELETE
  TO authenticated USING (public.is_company_role(company_id, ARRAY['owner','admin']));

-- Positionen ueber den Nachtrag, wie offer_items ueber die Offerte.
DROP POLICY IF EXISTS offer_amendment_items_manage_member ON public.offer_amendment_items;
CREATE POLICY offer_amendment_items_manage_member ON public.offer_amendment_items FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.offer_amendments a
                 WHERE a.id = offer_amendment_items.amendment_id
                   AND public.is_company_member(a.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.offer_amendments a
                      WHERE a.id = offer_amendment_items.amendment_id
                        AND public.is_company_member(a.company_id)));

COMMIT;
