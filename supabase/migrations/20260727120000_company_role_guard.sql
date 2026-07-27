-- =============================================================================
-- Rechteausweitung schliessen + Rollen-Helfer einführen
-- =============================================================================
--
-- BEFUND
-- `companies_update_member` hatte nur ein USING und KEIN WITH CHECK. Fehlt das
-- WITH CHECK, prüft Postgres die NEUE Zeile noch einmal gegen USING — und
-- `is_company_member(id)` bleibt wahr, egal was in der Zeile steht. Zusammen mit
-- dem tabellenweiten GRANT an `authenticated` (keine Spalten-Grants) konnte damit
-- JEDES Mitglied schreiben:
--
--     UPDATE companies SET user_id = <sich selbst> WHERE id = <eigene Firma>;
--
-- Das ist keine Kosmetik: `rechnungen` und `api_keys` autorisieren bis heute über
-- `companies.user_id = auth.uid()`. Ein einziges UPDATE verschafft einem
-- gewöhnlichen `member` also Zugriff auf Rechnungen und alle API-Schlüssel der
-- Firma. Beide Tabellen entstanden NACH der company_members-Migration und haben
-- deren Modell nie übernommen.
--
-- ABHILFE — zwei voneinander unabhängige Schichten:
--   1. Die Policy verlangt jetzt owner|admin und prüft die neue Zeile (WITH CHECK).
--   2. Ein Trigger verbietet den Eigentümerwechsel überhaupt. RLS allein reicht
--      dafür nicht: eine Policy sieht die ALTE Zeile nicht und kann deshalb nicht
--      formulieren "user_id darf sich nicht ändern".
--
-- Die Rollen-Zuordnung der übrigen Tabellen folgt in einem eigenen Schritt; hier
-- wird nur der Ausbruchspfad geschlossen und das Werkzeug dafür bereitgestellt.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Rollen-Helfer
--
-- Geschwister-Funktion zu `is_company_member`. Diese ist der einzige Engpass,
-- über den rund 40 Policies laufen — eine gleich geformte Funktion lässt sich
-- deshalb einsetzen, ohne den Aufbau der Policies zu verändern.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_company_role(
  _company_id UUID,
  _roles      TEXT[],
  _user_id    UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id
      AND user_id    = _user_id
      AND role       = ANY(_roles)
  );
$$;

COMMENT ON FUNCTION public.is_company_role(UUID, TEXT[], UUID) IS
  'Ist der Benutzer Mitglied dieser Firma MIT einer der genannten Rollen? '
  'Gegenstück zu is_company_member(), das jede Rolle akzeptiert.';

-- -----------------------------------------------------------------------------
-- 2. Eigentümerwechsel unterbinden
--
-- Erlaubt bleibt er nur serverseitig (Service-Role, direkte DB-Verbindung) und
-- für Plattform-Admins — also für Wege, die ohnehin schon alles dürfen.
-- -----------------------------------------------------------------------------

-- BEWUSST SECURITY INVOKER (kein DEFINER): in einer SECURITY-DEFINER-Funktion
-- liefert current_user den EIGENTÜMER der Funktion (postgres) und nicht den
-- Aufrufer — die Ausnahmeliste unten würde dann immer greifen und der Trigger
-- wäre wirkungslos. Genau das ist beim ersten Testlauf passiert.
-- `is_admin()` ist selbst SECURITY DEFINER und funktioniert hier weiterhin.
CREATE OR REPLACE FUNCTION public.guard_company_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
       AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Eigentuemerwechsel ist ueber die Anwendung nicht erlaubt'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_company_ownership() IS
  'Verhindert UPDATE companies SET user_id = … aus der Anwendung heraus. '
  'companies.user_id ist der Anker mehrerer Alt-Policies (rechnungen, api_keys); '
  'ein Wechsel waere eine Rechteausweitung.';

DROP TRIGGER IF EXISTS trigger_companies_guard_ownership ON public.companies;
CREATE TRIGGER trigger_companies_guard_ownership
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_company_ownership();

-- -----------------------------------------------------------------------------
-- 3. Schreibrecht auf Firmendaten an die Rolle binden
--
-- Firmendaten sind Stammdaten (Adresse, IBAN, MwSt-Nummer, Vorlagen). Sie gehören
-- zu "Firmeneinstellungen" und damit laut Rechtematrix zu owner|admin.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS companies_update_member ON public.companies;

CREATE POLICY companies_update_owner_admin
  ON public.companies FOR UPDATE
  TO authenticated
  USING      (public.is_company_role(id, ARRAY['owner', 'admin']))
  WITH CHECK (public.is_company_role(id, ARRAY['owner', 'admin']));

COMMIT;
