-- Rollback zu 20260803040000_besichtigung_bucket_privat.sql
--
-- ── WARNUNG ────────────────────────────────────────────────────────────────
--
-- Dieser Rollback stellt Besichtigungsfotos wieder offen ins Netz. Danach laedt
-- jeder, der einen Dateipfad kennt, die Innenaufnahmen fremder Wohnungen
-- herunter — ohne Anmeldung, ohne Frist. Das war der Zustand vor der Migration.
--
-- Ihn herzustellen ergibt genau einen Sinn: die Umstellung auf signierte URLs
-- macht in der Oberflaeche Aerger und die Fotos muessen sofort wieder sichtbar
-- sein. Dann ist das hier eine Notbremse fuer Stunden, nicht der Normalzustand.
--
-- ── Was wiederhergestellt wird, und was nicht ──────────────────────────────
--
-- WIEDERHERGESTELLT wird allein `public = true` auf dem Bucket.
--
-- NICHT wiederhergestellt wird die alte Fassung von
-- `check_besichtigung_storage_access`. Das ist Absicht.
--
-- Die alte Fassung enthielt einen Zweig, der nie zutreffen konnte
-- (`s.status = 'active'` auf einer Sitzung, deren CHECK diesen Wert nicht
-- kennt), und las dafuer die Personalliste `team_members` statt der
-- Kontentabelle `company_members`. Diese Funktion haengt nicht nur an der
-- Lesepolicy: die Policies fuer INSERT und DELETE auf `storage.objects` rufen
-- sie ebenfalls auf. Sie zurueckzurollen hiesse, einen Fehler wieder
-- einzubauen, der mit dem oeffentlichen Bucket nichts zu tun hat.
--
-- Solange der Bucket oeffentlich ist, spielt die Lesepolicy ohnehin keine
-- Rolle — oeffentliche Buckets werden beim Lesen nicht gegen RLS geprueft. Die
-- reparierte Funktion schadet in diesem Zustand also nichts und nuetzt den
-- beiden anderen Policies.
--
-- Ebenfalls NICHT wiederhergestellt wird das EXECUTE-Recht fuer `anon`. Es gab
-- nie einen Aufrufweg dafuer; alle drei Policies sind `TO authenticated`.
--
-- ── Danach ─────────────────────────────────────────────────────────────────
--
-- Die beiden Leser im Code (`Besichtigungen.tsx`, `analyze-besichtigung`)
-- erzeugen weiterhin signierte URLs. Das funktioniert auch bei einem
-- oeffentlichen Bucket — Signieren setzt nicht voraus, dass der Bucket privat
-- ist. Dieser Rollback allein macht die Oberflaeche also nicht wieder
-- funktionsfaehig, falls dort das Problem liegt; dafuer muesste der Code
-- zurueckgenommen werden.
--
-- Wiederholbar: ein zweiter Lauf ist ein No-op.

BEGIN;

UPDATE storage.buckets
   SET public = true
 WHERE id = 'besichtigung-uploads';

-- ── Nachpruefung ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_public boolean;
  v_quelle text;
BEGIN
  SELECT b.public INTO v_public FROM storage.buckets b WHERE b.id = 'besichtigung-uploads';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rollback: den Bucket besichtigung-uploads gibt es nicht';
  END IF;
  IF v_public IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Rollback: der Bucket ist nicht oeffentlich (public=%)', v_public;
  END IF;

  -- Und die Funktion ist ausdruecklich NICHT mitgerollt worden.
  SELECT p.prosrc INTO v_quelle
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'check_besichtigung_storage_access';
  IF v_quelle IS NULL THEN
    RAISE EXCEPTION 'Rollback: check_besichtigung_storage_access fehlt';
  END IF;
  IF v_quelle NOT LIKE '%is_company_member%' THEN
    RAISE EXCEPTION 'Rollback: die reparierte Zugriffsfunktion ist verschwunden';
  END IF;

  RAISE NOTICE 'Rollback 20260803040000: der Bucket ist wieder oeffentlich. Die Zugriffsfunktion bleibt repariert.';
END
$$;

COMMIT;
