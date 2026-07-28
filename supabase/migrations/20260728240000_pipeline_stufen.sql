-- =============================================================================
-- Verkaufsstufen: wo steht diese Anfrage gerade?
-- =============================================================================
--
-- BEFUND
-- `leads.status` traegt 13 erlaubte Werte, benutzt werden zwei: `pending` (52)
-- und `job_confirmed` (16). Der Rest — `distributed`, `no_matches`,
-- `awaiting_customer_confirmation`, `unknown_plz` … — stammt aus dem
-- Marktplatz, in dem ein Lead an mehrere Firmen verteilt und von ihnen
-- angenommen wurde. Im Einzelmandanten passiert davon nichts.
--
-- Was fehlt, ist die Frage, die im Verkauf taeglich gestellt wird: woran wird
-- gerade gearbeitet, und was ist der naechste Schritt? Heute laesst sich das nur
-- indirekt erschliessen — "gibt es schon eine Offerte?" —, und wer eine Anfrage
-- nachfassen will, muss es sich merken.
--
-- ABHILFE
-- Eine zweite, eigene Achse: `sales_stage`. `status` bleibt unangetastet — er
-- haengt an Edge Functions und an der bestehenden Oberflaeche; ihn umzudeuten
-- haette denselben Wildwuchs noch einmal erzeugt.
--
--   new → qualifying → inspection → offer_draft → offer_sent → negotiating
--                                                              → won | lost
--
-- DIE STUFE BEWEGT SICH VON SELBST, WO SIE BEOBACHTBAR IST.
-- Eine Stufe, die jemand von Hand pflegen muss, veraltet — genau so ist
-- `leads.status` zu dem geworden, was er heute ist. Deshalb setzt ein Trigger
-- auf `offers` die Stufe bei den Ereignissen, die ohnehin passieren: Offerte
-- angelegt, versendet, angenommen, abgelehnt. Von Hand bleiben nur die Stufen,
-- die man nicht messen kann (`qualifying`, `inspection`, `negotiating`).
--
-- Rueckwaerts bewegt der Trigger NICHT: wer von Hand auf `negotiating` gestellt
-- hat, waehrend die Offerte versendet ist, soll das behalten duerfen.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Spalten
-- -----------------------------------------------------------------------------

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sales_stage      TEXT NOT NULL DEFAULT 'new';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS owner_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_action_at   TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason_code TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason_note TEXT;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_sales_stage_check;
ALTER TABLE public.leads ADD  CONSTRAINT leads_sales_stage_check
  CHECK (sales_stage IN ('new','qualifying','inspection','offer_draft',
                         'offer_sent','negotiating','won','lost'));

-- Der Grund fuer ein verlorenes Geschaeft gehoert in eine Auswahl, nicht in ein
-- Freitextfeld: nur so laesst sich spaeter zaehlen, WARUM verloren wurde.
-- Der Freitext daneben ergaenzt, ersetzt aber nicht.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_lost_reason_check;
ALTER TABLE public.leads ADD  CONSTRAINT leads_lost_reason_check
  CHECK (lost_reason_code IS NULL OR lost_reason_code IN
    ('price','timing','competitor','no_response','out_of_area','scope','other'));

-- `lost` ohne Grund ist eine Zahl, mit der niemand etwas anfangen kann.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_lost_needs_reason;
ALTER TABLE public.leads ADD  CONSTRAINT leads_lost_needs_reason
  CHECK (sales_stage <> 'lost' OR lost_reason_code IS NOT NULL);

COMMENT ON COLUMN public.leads.sales_stage IS
  'Verkaufsstufe. Zweite Achse neben `status`: der beschreibt den Lebenszyklus '
  'des Datensatzes (grossteils Marktplatz-Erbe), diese die Arbeit daran.';
COMMENT ON COLUMN public.leads.owner_user_id IS
  'Wer sich um diese Anfrage kuemmert. Bewusst auf auth.users statt auf '
  'company_members: eine geloeschte Mitgliedschaft soll die Zuordnung nicht '
  'mitnehmen, und der Name steht ohnehin dort.';
COMMENT ON COLUMN public.leads.next_action_at IS
  'Wann als naechstes nachgefasst wird. Grundlage der Wiedervorlage.';

CREATE INDEX IF NOT EXISTS idx_leads_stage
  ON public.leads (company_id, sales_stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_action
  ON public.leads (company_id, next_action_at)
  WHERE next_action_at IS NOT NULL AND sales_stage NOT IN ('won','lost');

-- -----------------------------------------------------------------------------
-- 2. Verlauf der Stufenwechsel — nur anhaengend
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_stage_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_stage  TEXT,
  to_stage    TEXT NOT NULL,
  changed_by  UUID,
  -- 'trigger' oder 'manual': ohne das laesst sich spaeter nicht sagen, ob die
  -- Pipeline gepflegt wird oder sich nur von selbst bewegt.
  source      TEXT NOT NULL DEFAULT 'manual',
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sales_stage_history_source_check CHECK (source IN ('manual','trigger')),
  CONSTRAINT sales_stage_history_distinct CHECK (from_stage IS DISTINCT FROM to_stage)
);

CREATE INDEX IF NOT EXISTS idx_sales_stage_history_lead
  ON public.sales_stage_history (lead_id, changed_at DESC);

ALTER TABLE public.sales_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_stage_history_select_member ON public.sales_stage_history;
CREATE POLICY sales_stage_history_select_member
  ON public.sales_stage_history FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

-- Geschrieben wird ausschliesslich vom Trigger (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.guard_stage_history_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('postgres','supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'sales_stage_history ist ein Verlauf und wird nicht veraendert'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trigger_stage_history_append_only ON public.sales_stage_history;
CREATE TRIGGER trigger_stage_history_append_only
  BEFORE UPDATE OR DELETE ON public.sales_stage_history
  FOR EACH ROW EXECUTE FUNCTION public.guard_stage_history_append_only();

-- -----------------------------------------------------------------------------
-- 3. Jeder Stufenwechsel wird festgehalten
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.leads_record_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sales_stage IS DISTINCT FROM OLD.sales_stage AND NEW.company_id IS NOT NULL THEN
    INSERT INTO public.sales_stage_history (company_id, lead_id, from_stage, to_stage, changed_by,
                                            source)
    VALUES (NEW.company_id, NEW.id, OLD.sales_stage, NEW.sales_stage, auth.uid(),
            COALESCE(current_setting('crm.stage_source', true), 'manual'));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'leads_record_stage_change: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_leads_stage_history ON public.leads;
CREATE TRIGGER trigger_leads_stage_history
  AFTER UPDATE OF sales_stage ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_record_stage_change();

-- -----------------------------------------------------------------------------
-- 4. Die Stufe folgt der Offerte
--
-- Nur vorwaerts, und nur bis zu der Stufe, die das Ereignis belegt. Wer von Hand
-- auf `negotiating` gestellt hat, behaelt das — der Trigger wuerde sonst die
-- Einschaetzung des Bedieners ueberschreiben.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.offers_advance_lead_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ziel TEXT;
  v_ist  TEXT;
  -- Reihenfolge der Stufen; Rueckschritte gibt es nicht.
  rang CONSTANT TEXT[] := ARRAY['new','qualifying','inspection','offer_draft',
                                'offer_sent','negotiating','won','lost'];
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_ziel := CASE NEW.status
              WHEN 'accepted' THEN 'won'
              WHEN 'rejected' THEN 'lost'
              WHEN 'sent'     THEN 'offer_sent'
              WHEN 'viewed'   THEN 'offer_sent'
              WHEN 'draft'    THEN 'offer_draft'
            END;
  IF v_ziel IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sales_stage INTO v_ist FROM public.leads WHERE id = NEW.lead_id;
  IF v_ist IS NULL THEN
    RETURN NEW;
  END IF;

  -- `lost` braucht einen Grund (CHECK). Den kann der Trigger nicht erfinden —
  -- eine abgelehnte Offerte setzt deshalb nur den Grund 'no_response' als
  -- Vorschlag, den der Bediener korrigieren kann.
  IF v_ziel = 'lost' THEN
    UPDATE public.leads
    SET sales_stage      = 'lost',
        lost_reason_code = COALESCE(lost_reason_code, 'no_response')
    WHERE id = NEW.lead_id AND sales_stage <> 'lost';
    RETURN NEW;
  END IF;

  IF array_position(rang, v_ziel) > array_position(rang, v_ist)
     AND v_ist NOT IN ('won','lost') THEN
    UPDATE public.leads SET sales_stage = v_ziel WHERE id = NEW.lead_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'offers_advance_lead_stage: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_offers_advance_stage ON public.offers;
CREATE TRIGGER trigger_offers_advance_stage
  AFTER INSERT OR UPDATE OF status ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.offers_advance_lead_stage();

-- -----------------------------------------------------------------------------
-- 5. Bestand einordnen
--
-- Die Stufe wird aus dem abgeleitet, was schon da ist — sonst staenden alle 68
-- Anfragen auf `new` und die Pipeline waere von Tag eins an falsch.
-- -----------------------------------------------------------------------------

UPDATE public.leads l SET sales_stage = q.stufe
FROM (
  SELECT l2.id,
         CASE
           WHEN EXISTS (SELECT 1 FROM public.offers o
                        WHERE o.lead_id = l2.id AND o.status = 'accepted') THEN 'won'
           WHEN EXISTS (SELECT 1 FROM public.offers o
                        WHERE o.lead_id = l2.id AND o.status IN ('sent','viewed')) THEN 'offer_sent'
           WHEN EXISTS (SELECT 1 FROM public.offers o
                        WHERE o.lead_id = l2.id AND o.status = 'draft') THEN 'offer_draft'
           WHEN EXISTS (SELECT 1 FROM public.appointments a
                        WHERE a.lead_id = l2.id AND a.appointment_type = 'besichtigung') THEN 'inspection'
           ELSE 'new'
         END AS stufe
  FROM public.leads l2
) q
WHERE l.id = q.id AND l.sales_stage = 'new' AND q.stufe <> 'new';

-- Abgelehnte Offerten ohne spaetere Annahme gelten als verloren; der Grund ist
-- ein Vorschlag, kein Befund.
UPDATE public.leads l
SET sales_stage = 'lost', lost_reason_code = COALESCE(lost_reason_code, 'no_response')
WHERE l.sales_stage NOT IN ('won','lost')
  AND EXISTS (SELECT 1 FROM public.offers o WHERE o.lead_id = l.id AND o.status = 'rejected')
  AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.lead_id = l.id AND o.status = 'accepted');

COMMIT;
