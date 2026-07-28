-- =============================================================================
-- Dringende Boxen-Abholungen als eigene Kennzahl
-- =============================================================================
--
-- BEFUND
-- Die Boxenseite zeigt oben ein rotes Band "Dringende Abholungen (n)". Diese
-- Zahl entsteht IM BROWSER, aus den gerade geladenen Zeilen:
--
--   Umzugsboxen.tsx: differenceInDays(expected_return_date, heute) <= 0
--
-- `get_box_rental_stats` kennt sie nicht. Es liefert `overdue`
-- (expected_return_date < HEUTE) und `pickup_today` — und `pickup_today`
-- vermischt zwei Dinge: heute faellige Rueckgaben UND heute geplante
-- Abholungen. Die beiden zu addieren ergibt deshalb nicht die Zahl aus dem
-- Band: eine Miete, die naechste Woche zurueckkommt, aber heute abgeholt
-- werden soll, waere dabei faelschlich "dringend".
--
-- Solange die Zahl nur auf der Boxenseite steht, faellt das nicht auf. Sobald
-- sie auch in der Seitenleiste erscheinen soll, braucht es EINE Definition —
-- sonst zeigt das Abzeichen eine andere Zahl als die Seite, auf die es fuehrt.
--
-- ABHILFE
-- `urgent` als eigene Spalte: alles, was heute oder frueher zurueck sein
-- muesste. Das ist genau die Bedingung des Bandes, nur serverseitig und damit
-- unabhaengig davon, wie viele Zeilen die Seite gerade geladen hat.
--
-- WARUM DROP UND NICHT CREATE OR REPLACE
-- Eine Spalte laesst sich einem RETURNS TABLE nicht per REPLACE hinzufuegen;
-- Postgres verlangt dafuer ein DROP. Fuer bestehende Aufrufer ist die
-- zusaetzliche Spalte unschaedlich — das Frontend liest die Antwort als Objekt
-- und ignoriert, was es nicht kennt. Ein Deploy-Fenster entsteht dadurch nicht.
--
-- MITGENOMMEN, WEIL DIE FUNKTION OHNEHIN NEU GESCHRIEBEN WIRD
-- Die bisherige Fassung ist SECURITY DEFINER, hat KEINE Zugehoerigkeitspruefung
-- und ist an `anon` vergeben. Damit umgeht sie die RLS von
-- `umzugsbox_rentals` (die aktiv ist) und beantwortet jede Firmen-ID, die man
-- ihr gibt — auch ohne Anmeldung. Das gibt zwar nur Zaehlwerte preis (wie viele
-- Mieten, wie viele Boxen im Umlauf), aber es gibt sie jedem preis.
--
-- Die neue Fassung prueft `is_company_member` und ist fuer `anon` gesperrt.
-- Aufrufer sind ausschliesslich zwei angemeldete Seiten (Dashboard und
-- Boxenseite); serverseitig ruft sie niemand. `service_role` bleibt ausdruecklich
-- berechtigt, weil der pauschale REVOKE von PUBLIC ihm das Recht sonst
-- mitnaehme.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_box_rental_stats(UUID);

CREATE FUNCTION public.get_box_rental_stats(p_company_id UUID)
RETURNS TABLE (
  total_active      INTEGER,
  overdue           INTEGER,
  urgent            INTEGER,
  pickup_today      INTEGER,
  pickup_this_week  INTEGER,
  total_boxes_out   INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE expected_return_date < CURRENT_DATE)::INTEGER,
    -- Dieselbe Bedingung wie das Band auf der Boxenseite: heute oder frueher
    -- faellig. Schliesst `overdue` mit ein.
    COUNT(*) FILTER (WHERE expected_return_date <= CURRENT_DATE)::INTEGER,
    COUNT(*) FILTER (WHERE expected_return_date = CURRENT_DATE
                        OR pickup_scheduled_date = CURRENT_DATE)::INTEGER,
    COUNT(*) FILTER (WHERE expected_return_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::INTEGER,
    COALESCE(SUM(get_total_box_quantity(box_items)), 0)::INTEGER
  FROM public.umzugsbox_rentals
  WHERE company_id = p_company_id
    AND status IN ('delivered', 'in_use', 'pickup_requested', 'pickup_scheduled')
    AND is_rental = true
    AND archived_at IS NULL;
END;
$$;

COMMENT ON FUNCTION public.get_box_rental_stats(UUID) IS
  'Kennzahlen der Boxenvermietung. `urgent` (heute oder frueher faellig) ist die '
  'Zahl, die das Abzeichen in der Seitenleiste und das Band auf der Boxenseite '
  'gemeinsam benutzen — damit beide dasselbe meinen.';

REVOKE EXECUTE ON FUNCTION public.get_box_rental_stats(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_box_rental_stats(UUID) TO authenticated, service_role;

COMMIT;
