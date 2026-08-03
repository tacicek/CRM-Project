-- Rollback zu 20260803040000_besichtigung_bucket_privat.sql
--
-- ── WARNUNG ────────────────────────────────────────────────────────────────
--
-- Dieser Rollback stellt Besichtigungsfotos wieder offen ins Netz. Danach laedt
-- jeder, der einen Dateipfad kennt, die Innenaufnahmen fremder Wohnungen
-- herunter — ohne Anmeldung, ohne Frist. Das war der Zustand vor der Migration.
--
-- Ihn herzustellen ergibt genau einen Sinn: die Umstellung macht in der
-- Oberflaeche Aerger und die Fotos muessen sofort wieder sichtbar sein. Dann
-- ist das hier eine Notbremse fuer Stunden, nicht der Normalzustand.
--
-- ── Die Asymmetrie, und warum sie beabsichtigt ist ─────────────────────────
--
-- ZURUECKGENOMMEN wird genau eines: `public = true` auf dem Bucket.
--
-- NICHT zurueckgenommen werden die drei kanonischen Policies und die
-- reparierte Zugriffsfunktion. Das ist kein unvollstaendiger Rollback, sondern
-- der Punkt.
--
-- Der Zustand davor war naemlich nicht "anders", sondern kaputt:
--
--   * `check_besichtigung_storage_access` hatte einen Zweig, der nie zutreffen
--     konnte (`s.status = 'active'` auf einer Sitzung, deren CHECK diesen Wert
--     nicht kennt) und las dafuer die Personalliste `team_members` statt der
--     Kontentabelle `company_members`.
--   * Die drei Policies aus 20260514000001 prueften `bucket_id =
--     'besichtigung'` — einen Bucket, den es nicht gibt — und verglichen
--     `sessions.id` mit dem Ordnernamen, obwohl dort der Token steht. Am
--     2026-08-03 in Produktion nachgemessen: null Treffer auf beiden Wegen.
--
-- Diese Fassungen zurueckzuholen hiesse, zwei Fehler wieder einzubauen, die
-- mit dem oeffentlichen Bucket nichts zu tun haben. Die Policies haengen
-- ausserdem nicht nur am Lesen: INSERT und DELETE fuer `authenticated` laufen
-- ueber dieselbe Funktion.
--
-- Solange der Bucket oeffentlich ist, spielt die Lesepolicy ohnehin keine
-- Rolle — oeffentliche Buckets werden beim Lesen nicht gegen RLS geprueft. Die
-- reparierten Regeln schaden in diesem Zustand also nichts und nuetzen den
-- beiden anderen Befehlen.
--
-- Ebenfalls NICHT zurueckgegeben wird das EXECUTE-Recht fuer `anon` und
-- PUBLIC. Es gab nie einen Aufrufweg dafuer; alle drei Policies sind
-- `TO authenticated`.
--
-- ── Was dieser Rollback nicht anfasst ──────────────────────────────────────
--
-- Kein anderer Bucket, kein anderes Storage-Objekt, keine Datei. Weder
-- `blog-content` noch `company-logos` noch `document-pdfs`. Es wird nichts
-- geloescht und nichts verschoben.
--
-- ── Danach ─────────────────────────────────────────────────────────────────
--
-- Die beiden Leser im Code (`Besichtigungen.tsx`, `analyze-besichtigung`)
-- erzeugen weiterhin signierte Adressen. Das funktioniert auch bei einem
-- oeffentlichen Bucket — Signieren setzt nicht voraus, dass der Bucket privat
-- ist, sondern dass der Aufrufer das Objekt lesen darf. Dieser Rollback allein
-- macht die Oberflaeche also nicht wieder funktionsfaehig, falls dort das
-- Problem liegt; dafuer muesste der Code zurueckgenommen werden.
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
  v_name   text;
  v_fehlt  text[] := '{}';
BEGIN
  SELECT b.public INTO v_public FROM storage.buckets b WHERE b.id = 'besichtigung-uploads';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rollback: den Bucket besichtigung-uploads gibt es nicht';
  END IF;
  IF v_public IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Rollback: der Bucket ist nicht oeffentlich (public=%)', v_public;
  END IF;

  -- Die Asymmetrie wird geprueft, nicht nur behauptet: die Reparatur muss
  -- stehen geblieben sein.
  SELECT p.prosrc INTO v_quelle
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'check_besichtigung_storage_access';
  IF v_quelle IS NULL THEN
    RAISE EXCEPTION 'Rollback: check_besichtigung_storage_access fehlt';
  END IF;
  IF v_quelle NOT LIKE '%is_company_member%' OR v_quelle LIKE '%team_members%' THEN
    RAISE EXCEPTION 'Rollback: die reparierte Zugriffsfunktion ist verlorengegangen';
  END IF;

  FOREACH v_name IN ARRAY ARRAY[
    'besichtigung_uploads_insert_member',
    'besichtigung_uploads_select_member',
    'besichtigung_uploads_delete_member'
  ] LOOP
    PERFORM 1 FROM pg_catalog.pg_policy
     WHERE polrelid = 'storage.objects'::regclass AND polname = v_name;
    IF NOT FOUND THEN
      v_fehlt := v_fehlt || v_name;
    END IF;
  END LOOP;
  IF array_length(v_fehlt, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback: kanonische Policy fehlt: %', array_to_string(v_fehlt, ', ');
  END IF;

  -- Und die kaputten Namen sind nicht zurueckgekehrt.
  FOREACH v_name IN ARRAY ARRAY[
    'besichtigung_storage_upload_member',
    'besichtigung_storage_read_member',
    'besichtigung_storage_delete_member'
  ] LOOP
    PERFORM 1 FROM pg_catalog.pg_policy
     WHERE polrelid = 'storage.objects'::regclass AND polname = v_name;
    IF FOUND THEN
      RAISE EXCEPTION 'Rollback: die fehlerhafte Policy % ist wieder da', v_name;
    END IF;
  END LOOP;

  RAISE NOTICE 'Rollback 20260803040000: der Bucket ist wieder oeffentlich. Policies und Zugriffsfunktion bleiben repariert.';
END
$$;

COMMIT;
