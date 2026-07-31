-- =============================================================================
-- Der Plattformadministrator, den es nicht mehr gibt
-- =============================================================================
--
-- BEFUND
--
-- 78 Policies auf 59 Tabellen tragen einen Zweig `is_admin(auth.uid()) OR …`.
-- Der stammt aus Offerio: dort brauchte ein Plattformbetreiber Einblick in alle
-- Mandanten. Diesen Betreiber gibt es im Fork nicht mehr — die Rolle blieb
-- trotzdem stehen, und zwar auf dem Konto der ERSTEN Firma. Damit sieht diese
-- Firma die Kunden, Offerten, Auftraege, Termine und eingehenden E-Mails der
-- zweiten. Auf der Produktion gemessen (2026-07-31), Sicht des Kontos gegen
-- tatsaechlichen Bestand:
--
--     leads 80/80   offers 63/63   offer_items 297/297   customers 75/75
--     auftraege 18/18   appointments 52/52   inbound_emails 129/129
--     companies 2/2
--
-- Der zweite Mandant sieht jeweils nur das Seine. Die Trennung ist also nicht
-- kaputt — sie wird an genau einer Stelle uebersprungen.
--
-- Gebraucht wird die Rolle nirgends: `/firma` liest `isAdmin` an keiner Stelle
-- (0 Treffer in src/), `useAuth` gibt das Feld gar nicht mehr heraus, und die
-- sechs `admin-*`-Edge-Functions haben keinen einzigen Aufrufer im Frontend.
--
-- ABHILFE
--
-- DIE ZEILE, NICHT DIE POLICIES. Ohne eine Zeile, die ihn erfuellt, laeuft der
-- Zweig `is_admin(auth.uid())` ins Leere — er ist dann wirkungslos, ohne dass
-- 78 Policies angefasst werden muessen. Das ist der kleinste Eingriff mit der
-- vollen Wirkung; die Policies aufzuraeumen ist Kosmetik und kann warten.
--
-- NICHT HIER, bewusst: `is_admin()` und die uebrigen Rollenfunktionen bleiben
-- stehen (sie werden noch von `guard_company_ownership()` gelesen), die
-- Hintertuer in `get_user_overview()` (fest verdrahtete E-Mail-Adresse) bleibt,
-- und die toten `admin-*`-Functions bleiben. Jedes davon ist eine eigene Runde.
--
-- SETZT 20260802110000 VORAUS. Ohne die dortige Mitgliederregel auf
-- `email_logs` verliert dieses Konto mit der Rolle auch seine EIGENEN 171
-- E-Mail-Zeilen — die Tabelle kannte bis dahin nur eine Admin-Policy. Der
-- Pruefblock am Ende faellt genau darauf, falls jemand die Reihenfolge dreht.
--
-- EINBAHNSTRASSE. Die Policy `Super admin can insert roles` verlangt
-- `is_super_admin(auth.uid())`. Faellt die letzte solche Zeile, kann ueber die
-- Anwendung nie wieder eine Rolle angelegt werden — nur noch als `postgres`
-- oder `service_role`. Das ROLLBACK-Skript laeuft als `postgres` und ist davon
-- nicht betroffen.
--
-- NEBENWIRKUNG, gewollt: `guard_company_ownership()` laesst einen Wechsel von
-- `companies.user_id` nur fuer `postgres`/`service_role`/`supabase_admin` oder
-- einen Admin zu. Ohne Admin ist der Eigentuemerwechsel ueber die Anwendung
-- vollstaendig zu. Einen Weg dafuer gibt es in der Oberflaeche ohnehin nicht.
--
-- WIEDERHOLBAR. Ein zweiter Lauf findet keine `super_admin`-Zeile mehr und
-- loescht nichts.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Rueckbau-Speicher
--
-- Gespeichert wird die ganze Zeile samt `id` und `created_at`, nicht nur die
-- Benutzerkennung: das ROLLBACK stellt damit dieselbe Zeile wieder her und
-- nicht eine neue mit frischer Kennung.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.undo_20260802120000 (
  id         UUID PRIMARY KEY,
  user_id    UUID            NOT NULL,
  role       public.app_role NOT NULL,
  created_at TIMESTAMPTZ,
  noted_at   TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.undo_20260802120000 IS
  'Die von 20260802120000 entzogene(n) Rollenzeile(n), vollstaendig. Das zugehoerige ROLLBACK-Skript setzt sie zurueck und entfernt die Tabelle danach.';

-- Bewusst mit RLS und ohne Policy: erreichbar nur fuer service_role und
-- postgres (BYPASSRLS), wie bei company_secrets und den Nummernkreisen. Eine
-- Tabelle, die Rollenzuweisungen aufbewahrt, hat im Client nichts zu suchen.
ALTER TABLE public.undo_20260802120000 ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 1. Entzug
--
-- Loeschen und Vermerken in einer Anweisung: kaeme etwas dazwischen, gaebe es
-- sonst einen Entzug ohne Rueckweg. `RETURNING` liefert genau die Zeilen, die
-- wirklich verschwunden sind — nicht die, von denen wir es annehmen.
--
-- Ausgewaehlt wird ueber die Rolle, nicht ueber eine feste Benutzerkennung:
-- gaebe es einen zweiten Plattformadministrator, waere er genauso gemeint.
-- -----------------------------------------------------------------------------
WITH entzogen AS (
  DELETE FROM public.user_roles
  WHERE role = 'super_admin'
  RETURNING id, user_id, role, created_at
)
INSERT INTO public.undo_20260802120000 (id, user_id, role, created_at)
SELECT id, user_id, role, created_at FROM entzogen
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Nachweis
--
-- Zwei Fragen. Erstens: ist die Zeile wirklich weg. Zweitens — und das ist die
-- wichtigere: sieht das betroffene Konto danach noch seine eigenen E-Mail-
-- Zeilen. Die zweite Pruefung faellt, wenn 20260802110000 fehlt.
--
-- Die Sollzahl wird hergeleitet (die Zeilen der Firmen, in denen das Konto
-- Mitglied ist), nicht eingetragen. Steht morgen eine E-Mail mehr im Buch,
-- prueft dieselbe Bedingung weiterhin das Richtige.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_user   UUID;
  erwartet BIGINT;
  gesehen  BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    RAISE EXCEPTION 'user_roles traegt weiterhin eine super_admin-Zeile.';
  END IF;

  SELECT user_id INTO v_user
  FROM public.undo_20260802120000
  WHERE role = 'super_admin'
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE NOTICE 'Keine entzogene Zeile vermerkt — die Sichtpruefung entfaellt.';
    RETURN;
  END IF;

  SELECT count(*) INTO erwartet
  FROM public.email_logs
  WHERE company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = v_user
  );

  -- Kurz in die Haut des Kontos schluepfen. `SET LOCAL` (dritter Parameter
  -- true) endet mit der Transaktion; der Ruecksprung unten ist trotzdem
  -- ausdruecklich, damit COMMIT nicht als `authenticated` laeuft.
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::TEXT,
    true
  );

  SELECT count(*) INTO gesehen FROM public.email_logs;

  PERFORM set_config('role', 'none', true);

  IF gesehen <> erwartet THEN
    RAISE EXCEPTION
      'Das Konto sieht % E-Mail-Zeilen, erwartet waren % (die seiner eigenen Firmen). Fehlt die Mitgliederregel aus 20260802110000?',
      gesehen, erwartet;
  END IF;

  RAISE NOTICE 'Sichtpruefung bestanden: % E-Mail-Zeilen, wie erwartet.', gesehen;
END $$;

COMMIT;
