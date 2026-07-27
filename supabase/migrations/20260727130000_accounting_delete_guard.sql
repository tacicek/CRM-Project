-- =============================================================================
-- Rechnungen und Quittungen: Löschen nur im Entwurf
-- =============================================================================
--
-- BEFUND
-- `deleteRechnung` und `deleteQuittung` setzen ein nacktes DELETE ab — ohne
-- Statusprüfung, und die RLS-Policies prüfen ebenfalls nur die Zugehörigkeit zur
-- Firma. Eine bezahlte Rechnung liess sich damit genauso entfernen wie ein
-- Entwurf. Aktuell betroffen: 6 versendete + 4 bezahlte Rechnungen, 3 versendete
-- + 2 unterschriebene Quittungen.
--
-- Zusätzlich wiegt bei Rechnungen ein zweiter Umstand: `generate_rechnung_nr()`
-- vergibt die Nummer als MAX(...)+1 pro Firma. Wird die höchste Rechnung
-- gelöscht, vergibt die nächste Rechnung DIESELBE Nummer erneut — in der
-- Buchhaltung schlimmer als eine Lücke. (Wird separat auf eine echte Sequenz
-- umgestellt.)
--
-- ABHILFE
-- Die Prüfung gehört in die Datenbank, nicht in den Hook: sie muss auch dann
-- greifen, wenn jemand direkt gegen die API arbeitet.
--
-- Mitgedacht: das naheliegende Schlupfloch. Ohne die zweite Regel würde man den
-- Status einfach auf 'entwurf' zurückdrehen und dann löschen; ein Rückschritt aus
-- 'versendet'/'bezahlt' ist deshalb ebenfalls gesperrt.
--
-- Ausnahme nur für den direkten Datenbankzugang (psql als postgres) — der
-- bewusste manuelle Eingriff mit voller Verantwortung. Anwendung und Edge
-- Functions (service_role) sind gesperrt; für sie ist der richtige Weg die
-- Stornierung, nicht das Löschen.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Rechnungen
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_rechnung_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- SECURITY INVOKER (Default): current_user muss der echte Aufrufer sein.
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN OLD;
  END IF;

  IF OLD.status IS DISTINCT FROM 'entwurf' THEN
    RAISE EXCEPTION
      'Rechnung % ist im Status "%" und darf nicht geloescht werden. Bitte stornieren.',
      OLD.rechnung_nr, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_rechnungen_guard_delete ON public.rechnungen;
CREATE TRIGGER trigger_rechnungen_guard_delete
  BEFORE DELETE ON public.rechnungen
  FOR EACH ROW EXECUTE FUNCTION public.guard_rechnung_delete();

CREATE OR REPLACE FUNCTION public.guard_rechnung_status_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('versendet', 'bezahlt') AND NEW.status = 'entwurf' THEN
    RAISE EXCEPTION
      'Rechnung % kann nicht in den Entwurf zurueckgesetzt werden (Status "%").',
      OLD.rechnung_nr, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_rechnungen_guard_status ON public.rechnungen;
CREATE TRIGGER trigger_rechnungen_guard_status
  BEFORE UPDATE OF status ON public.rechnungen
  FOR EACH ROW EXECUTE FUNCTION public.guard_rechnung_status_regression();

-- -----------------------------------------------------------------------------
-- Quittungen
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_quittung_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN OLD;
  END IF;

  IF OLD.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION
      'Quittung % ist im Status "%" und darf nicht geloescht werden.',
      OLD.quittung_nr, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_quittungen_guard_delete ON public.quittungen;
CREATE TRIGGER trigger_quittungen_guard_delete
  BEFORE DELETE ON public.quittungen
  FOR EACH ROW EXECUTE FUNCTION public.guard_quittung_delete();

CREATE OR REPLACE FUNCTION public.guard_quittung_status_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('signed', 'sent', 'paid') AND NEW.status = 'draft' THEN
    RAISE EXCEPTION
      'Quittung % kann nicht in den Entwurf zurueckgesetzt werden (Status "%").',
      OLD.quittung_nr, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_quittungen_guard_status ON public.quittungen;
CREATE TRIGGER trigger_quittungen_guard_status
  BEFORE UPDATE OF status ON public.quittungen
  FOR EACH ROW EXECUTE FUNCTION public.guard_quittung_status_regression();

COMMIT;
