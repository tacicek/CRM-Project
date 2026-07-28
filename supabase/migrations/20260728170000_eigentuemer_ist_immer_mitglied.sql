-- =============================================================================
-- Der Eigentuemer einer Firma ist immer auch ihr Mitglied
-- =============================================================================
--
-- BEFUND
-- Es gibt zwei Wege, "gehoert diese Firma mir?" zu beantworten, und sie sind
-- nicht aneinander gebunden:
--
--   companies.user_id          — der Eigentuemer
--   company_members(user_id)   — die Mitgliedschaft, auf der alle RLS-Policies
--                                und der CompanyProvider aufbauen
--
-- Nichts haelt sie zusammen. `company_members` hat keinen Trigger, und im
-- gesamten Repo legt kein Code eine Mitgliedschaft an — die beiden vorhandenen
-- Zeilen wurden von Hand eingefuegt. Eine Firma anzulegen heisst also: an zwei
-- Stellen schreiben und daran denken. Wer die zweite vergisst, bekommt eine
-- Firma, deren Eigentuemer in der Anwendung nichts sieht.
--
-- Heute faellt das nicht auf: beide Firmen haben ihre Mitgliedschaft (geprueft,
-- 0 Eigentuemer ohne). Es faellt beim NAECHSTEN Anlegen auf — und dann als
-- leere Seiten, nicht als Fehlermeldung.
--
-- ABHILFE
-- Die Mitgliedschaft entsteht mit der Firma. Damit wird aus einer Konvention,
-- an die man sich erinnern muss, eine Eigenschaft des Schemas.
--
-- Warum ein Trigger und nicht "beim Anlegen daran denken": das Anlegen passiert
-- laut docs/ von Hand ueber GoTrue + INSERT. Genau dort ist die Wahrscheinlichkeit
-- am hoechsten, den zweiten Schritt zu vergessen — und die Folge am schwersten
-- zu erkennen.
--
-- Nur INSERT, kein UPDATE: `guard_company_ownership` (20260727120000) verbietet
-- den Wechsel von companies.user_id bereits. Gaebe es diesen Guard nicht,
-- muesste hier auch der Umzug der Mitgliedschaft stehen.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Bestand nachziehen (heute 0 Zeilen — der Lauf ist die Probe aufs Exempel)
-- -----------------------------------------------------------------------------

INSERT INTO public.company_members (company_id, user_id, role)
SELECT c.id, c.user_id, 'owner'
FROM public.companies c
WHERE c.user_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Trigger
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.companies_ensure_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ON CONFLICT DO NOTHING statt einer Existenzpruefung: zwei gleichzeitige
  -- Anlagen laufen so hintereinander durch, ohne dass eine scheitert.
  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.companies_ensure_owner_membership() IS
  'Legt die owner-Mitgliedschaft zusammen mit der Firma an. Ohne sie sieht der '
  'Eigentuemer in der Anwendung nichts — alle Policies und die Firmenaufloesung '
  'gehen ueber company_members, nicht ueber companies.user_id.';

DROP TRIGGER IF EXISTS trigger_companies_ensure_owner_membership ON public.companies;
CREATE TRIGGER trigger_companies_ensure_owner_membership
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.companies_ensure_owner_membership();

COMMIT;
