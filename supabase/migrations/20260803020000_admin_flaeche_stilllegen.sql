-- S4: `get_user_overview()` stilllegen
--
-- ── Was die Funktion ist ───────────────────────────────────────────────────
--
-- Ein Rest der Offerio-Plattformverwaltung. Sie ist SECURITY DEFINER, liest
-- `auth.users` und gibt E-Mail, Namen, Rolle und letzten Anmeldezeitpunkt
-- JEDES Benutzers der Installation zurueck.
--
-- Ihre gesamte Zugangskontrolle ist eine fest im Quelltext stehende Adresse:
--
--     WHERE u.id = auth.uid() AND u.email = '<eine feste Adresse>'
--
-- Das ist keine Rolle und kein Recht, sondern ein Name. Wer diese Adresse
-- kontrolliert — durch Uebernahme des Kontos, durch einen E-Mail-Wechsel oder
-- weil er sie irgendwann einmal besass —, liest die Benutzerliste. Sie steht
-- ausserdem nicht in `user_roles`, laesst sich also mit keinem Rollenentzug
-- schliessen; der Entzug in 20260802120000 ging an ihr vorbei, was dort
-- ausdruecklich vermerkt und auf „eine eigene Runde" vertagt wurde. Dies ist
-- diese Runde.
--
-- Dazu: `anon` hat EXECUTE. Die Funktion wirft fuer `anon` zwar sofort, weil
-- `auth.uid()` dort NULL ist — aber ein SECURITY-DEFINER-Leser der
-- Benutzertabelle, den ein Unangemeldeter aufrufen darf, ist eine Zeile
-- Programmtext von einem Datenleck entfernt.
--
-- ── Warum sie faellt statt repariert zu werden ─────────────────────────────
--
-- Sie hat keinen Aufrufer. Gemessen ueber das ganze Repo: ausser der
-- generierten Typdatei und ihrer eigenen Migration nennt sie niemand. Es gibt
-- in diesem Fork auch keine Oberflaeche mehr, zu der sie gehoerte — die
-- Plattformverwaltung ist mit dem Marktplatz entfernt worden.
--
-- Eine Funktion mit einer besseren Pruefung auszustatten, die niemand aufruft,
-- waere Arbeit an einer Attrappe. Sie faellt.
--
-- ── Was hier NICHT passiert ────────────────────────────────────────────────
--
-- Die uebrigen Rollenfunktionen (`is_admin`, `is_staff`, …) bleiben: sie werden
-- noch gelesen, unter anderem von `guard_company_ownership()`. Die 78 Policies,
-- die auf ihnen stehen, werden nicht angefasst. Beides ist eine eigene Runde,
-- und beides heute anzufassen hiesse, eine Sicherheitsaenderung mit einem
-- Umbau zu vermischen.
--
-- Wiederholbar: DROP … IF EXISTS, ein zweiter Lauf ist ein No-op.

BEGIN;

DROP FUNCTION IF EXISTS public.get_user_overview();

-- ── Nachpruefung, fail-closed ──────────────────────────────────────────────
DO $$
DECLARE
  v_anzahl integer;
BEGIN
  -- (1) Kein Ueberrest, in KEINER Signatur. Geprueft wird ueber den Namen und
  --     nicht ueber die eine Signatur oben: eine versehentlich angelegte
  --     Ueberladung bliebe sonst stehen und waere weiterhin aufrufbar.
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_user_overview';
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Pruefung 1: get_user_overview ist noch da (% Signatur(en))', v_anzahl;
  END IF;

  -- (2) Gegenrichtung: die Rollenfunktionen, die noch gebraucht werden, sind
  --     nicht versehentlich mitgegangen.
  FOREACH v_anzahl IN ARRAY ARRAY[1] LOOP
    PERFORM 1 FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'is_company_member';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pruefung 2: is_company_member fehlt — zu weit geloescht';
    END IF;
  END LOOP;

  RAISE NOTICE 'S4: get_user_overview entfernt.';
END
$$;

COMMIT;
