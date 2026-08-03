-- S3: Besichtigungsfotos aus dem oeffentlichen Netz nehmen
--
-- ── Befund ─────────────────────────────────────────────────────────────────
--
-- Der Bucket `besichtigung-uploads` steht auf `public = true`. Wer den Pfad
-- einer Datei kennt, laedt sie ohne Anmeldung herunter — kein Token, kein
-- Schluessel, keine Frist. Der Inhalt sind Innenaufnahmen von Wohnungen, die
-- Kunden fuer eine Umzugsofferte hochgeladen haben.
--
-- Die Begruendung von damals steht in 20260127150000 und ist zitierfaehig:
--
--     "Making bucket public avoids cross-schema RLS issues with signed URLs."
--
-- Der Bucket wurde also geoeffnet, weil signierte URLs nicht gingen. Als
-- Ersatz dient die Unratbarkeit des Pfades. Das ist kein Zugriffsschutz: der
-- Pfad steht im Browserverlauf, im Referrer, in jedem weitergereichten Link,
-- und er verfaellt nie.
--
-- ── Warum signierte URLs nicht gingen: ZWEI Fehler, nicht einer ────────────
--
-- (1) Die Zugriffsfunktion. `check_besichtigung_storage_access(folder_token)`
--     hatte einen Zweig, der nie zutreffen konnte:
--
--         SELECT tm.company_id FROM public.team_members tm
--          WHERE tm.user_id = auth.uid() AND s.status = 'active'
--
--     `s` ist die Besichtigungssitzung. Ihre Statusspalte traegt einen CHECK
--     aus 20260127100000 mit genau sieben erlaubten Werten: pending, uploading,
--     uploaded, analyzing, analyzed, completed, expired. `active` ist keiner
--     davon — die Bedingung ist immer falsch, der Zweig toter Code. Es ist die
--     zweite Fassung desselben Fehlers; die erste las `team_members.status`,
--     eine Spalte, die es dort nicht gibt (das Feld heisst `is_active` und ist
--     boolean). Uebrig blieb der Eigentuemerzweig: fuer den Firmeninhaber
--     funktionierten signierte URLs, fuer jeden anderen Angemeldeten nie.
--
--     Dazu die falsche Tabelle. `team_members` ist die Personalliste mit
--     NULL-erlaubtem `user_id`, weil die meisten Eintraege kein Konto haben.
--     Wer sich anmelden kann, steht in `company_members`.
--
-- (2) Die Policies auf `storage.objects`. 20260314250000 hatte drei Policies
--     unter den Namen "Company users can …" angelegt. 20260514000001 hat sie
--     im Zuge der Umstellung auf `company_members` ersetzt durch:
--
--         besichtigung_storage_upload_member
--         besichtigung_storage_read_member
--         besichtigung_storage_delete_member
--
--     Diese drei sind aber an zwei Stellen falsch, und am 2026-08-03 in
--     Produktion nachgemessen:
--
--       * Sie pruefen `bucket_id = 'besichtigung'`. Diesen Bucket gibt es
--         nicht. Vorhanden sind `besichtigung-uploads`, `blog-content`,
--         `company-logos` und `document-pdfs`.
--       * Sie vergleichen `sessions.id::text` mit dem ersten Pfadteil. Der
--         Upload legt aber unter dem TOKEN ab:
--         `${session.token}/${roomType}/${zeitstempel}_${datei}`
--         (`upload-besichtigung-photo`). Gemessen: 0 Objekte treffen auf `id`,
--         0 auf `token` — die Policies koennen unter keinen Umstaenden greifen.
--
--     Fuer `authenticated` gibt es auf `besichtigung-uploads` damit ueberhaupt
--     keinen Lesepfad. Nur `service_role` hat eine wirksame Policy.
--
-- Beides zusammen heisst: den Bucket privat zu machen, ohne die Policies zu
-- reparieren, haette nicht einzelne Mitglieder ausgesperrt, sondern ALLE. Die
-- Nachpruefung dieser Migration hat genau das beim ersten Rollout-Versuch
-- verhindert und die Transaktion zurueckgerollt.
--
-- ── Was hier passiert ──────────────────────────────────────────────────────
--
-- 1. Die Zugriffsfunktion bekommt den Zweig, der gemeint war: Eigentuemer ODER
--    Mitglied, ueber die vorhandenen Praedikate `is_company_owner` und
--    `is_company_member`.
-- 2. Die sechs alten Policy-Namen fallen — die drei von 202603 und die drei
--    von 202605. Beide Saetze, weil nicht verlaesslich feststeht, welcher in
--    einer gegebenen Installation liegt.
-- 3. Drei kanonische Policies entstehen: INSERT, SELECT, DELETE, jeweils auf
--    `besichtigung-uploads`, mit `(storage.foldername(name))[1]` als
--    Ordnerschluessel — das ist der Token — und der Zugriffsfunktion als
--    einziger Bedingung.
-- 4. Erst dann faellt der Riegel: `public = false`.
--
-- Die Reihenfolge ist nicht beliebig. Erst der Lesepfad, dann der Riegel.
--
-- ── Was hier NICHT passiert ────────────────────────────────────────────────
--
-- Kein anderer Bucket wird angefasst. Die Policy fuer `service_role` bleibt
-- unveraendert; die Schreiber (`upload-besichtigung-photo`,
-- `delete-besichtigung-photo`, `cleanup-besichtigung`) laufen darueber und
-- sind nicht betroffen.
--
-- Wiederholbar: DROP … IF EXISTS + CREATE, CREATE OR REPLACE, UPDATE auf einen
-- festen Wert. Ein zweiter Lauf ist ein No-op.

BEGIN;

-- ── 0. Diese Migration braucht Eigentumsrechte an storage.objects ──────────
--
-- `CREATE POLICY` verlangt Eigentum an der Tabelle, nicht blosse Rechte. Ohne
-- diese Vorpruefung scheitert die Migration mittendrin an einem "must be owner
-- of table objects" — technisch richtig, aber nicht handlungsleitend.
DO $$
DECLARE
  v_eigner name;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(relowner) INTO v_eigner
    FROM pg_catalog.pg_class WHERE oid = 'storage.objects'::regclass;
  IF NOT pg_catalog.pg_has_role(current_user, v_eigner, 'MEMBER') THEN
    RAISE EXCEPTION
      'Diese Migration legt Policies auf storage.objects an und muss deshalb als % (oder ein Superuser) laufen. Aktuell: %.',
      v_eigner, current_user;
  END IF;
END
$$;

-- ── 1. Der Lesepfad: die Zugriffsfunktion ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_besichtigung_storage_access(folder_token text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, besichtigung
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM besichtigung.sessions s
     WHERE s.token = folder_token
       AND ( public.is_company_owner(s.company_id, auth.uid())
          OR public.is_company_member(s.company_id, auth.uid()) )
  );
-- Bleibt bewusst erhalten: schlaegt hier etwas fehl, ist die Antwort "nein".
-- Ein Fehler in einer Zugriffsfunktion darf nicht zum Zugriff fuehren.
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$function$;

-- PUBLIC muss ausdruecklich mitgenannt werden. Postgres vergibt EXECUTE an
-- PUBLIC, sobald eine Funktion entsteht, und `CREATE OR REPLACE` behaelt die
-- vorhandenen Rechte bei. Nur `anon` zu entziehen brachte nichts: die Rolle
-- haette die Funktion ueber PUBLIC weiterhin aufrufen koennen.
REVOKE EXECUTE ON FUNCTION public.check_besichtigung_storage_access(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_besichtigung_storage_access(text) TO authenticated;

-- ── 2. Die alten Policies, beide Saetze ────────────────────────────────────

DROP POLICY IF EXISTS "Company users can upload to besichtigung"     ON storage.objects;
DROP POLICY IF EXISTS "Company users can read besichtigung uploads"  ON storage.objects;
DROP POLICY IF EXISTS "Company users can delete besichtigung uploads" ON storage.objects;
DROP POLICY IF EXISTS "besichtigung_storage_upload_member"           ON storage.objects;
DROP POLICY IF EXISTS "besichtigung_storage_read_member"             ON storage.objects;
DROP POLICY IF EXISTS "besichtigung_storage_delete_member"           ON storage.objects;

-- ── 3. Die kanonischen drei ────────────────────────────────────────────────
--
-- Ein Bucket, ein Ordnerschluessel, eine Bedingung. `(storage.foldername
-- (name))[1]` ist der erste Pfadteil und damit der Token, unter dem
-- `upload-besichtigung-photo` ablegt.

DROP POLICY IF EXISTS "besichtigung_uploads_insert_member" ON storage.objects;
CREATE POLICY "besichtigung_uploads_insert_member"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'besichtigung-uploads'
    AND public.check_besichtigung_storage_access((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "besichtigung_uploads_select_member" ON storage.objects;
CREATE POLICY "besichtigung_uploads_select_member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'besichtigung-uploads'
    AND public.check_besichtigung_storage_access((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "besichtigung_uploads_delete_member" ON storage.objects;
CREATE POLICY "besichtigung_uploads_delete_member"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'besichtigung-uploads'
    AND public.check_besichtigung_storage_access((storage.foldername(name))[1])
  );

-- ── 4. Der Riegel ──────────────────────────────────────────────────────────

UPDATE storage.buckets
   SET public = false
 WHERE id = 'besichtigung-uploads';

-- ── Nachpruefung, fail-closed ──────────────────────────────────────────────
DO $$
DECLARE
  k_bucket   constant text := 'besichtigung-uploads';
  k_kanon    constant text[] := ARRAY[
    'besichtigung_uploads_insert_member',
    'besichtigung_uploads_select_member',
    'besichtigung_uploads_delete_member'];
  k_alt      constant text[] := ARRAY[
    'Company users can upload to besichtigung',
    'Company users can read besichtigung uploads',
    'Company users can delete besichtigung uploads',
    'besichtigung_storage_upload_member',
    'besichtigung_storage_read_member',
    'besichtigung_storage_delete_member'];
  k_cmd      constant "char"[] := ARRAY['a','r','d'];
  v_oid      oid;
  v_public   boolean;
  v_quelle   text;
  v_ausdruck text;
  v_name     text;
  v_i        integer;
  v_anzahl   integer;
BEGIN
  -- (1) Der Bucket ist da und privat. Kein `IF FOUND`-Umweg: fehlt die Zeile,
  --     hat das UPDATE nichts getan und die Migration ihr Ziel verfehlt.
  SELECT b.public INTO v_public FROM storage.buckets b WHERE b.id = k_bucket;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 1: den Bucket % gibt es nicht', k_bucket;
  END IF;
  IF v_public IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Pruefung 1: der Bucket ist nicht privat (public=%)', v_public;
  END IF;

  -- (2) Die Zugriffsfunktion: Signatur, SECURITY DEFINER, search_path.
  SELECT p.oid, p.prosrc INTO v_oid, v_quelle
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'check_besichtigung_storage_access'
     AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'folder_token text';
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Pruefung 2: check_besichtigung_storage_access(text) fehlt';
  END IF;
  PERFORM 1 FROM pg_catalog.pg_proc p
   WHERE p.oid = v_oid AND p.prosecdef
     AND p.proconfig = ARRAY['search_path=public, besichtigung'];
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 2: SECURITY DEFINER oder search_path stimmen nicht';
  END IF;

  -- (3) Der unerfuellbare Zweig ist weg, der gemeinte da. Geprueft wird am
  --     Rumpf und nicht am Verhalten: der alte Zweig lieferte immer false, und
  --     das tut ein fehlender auch. Nur der Quelltext unterscheidet "richtig
  --     verboten" von "kaputt".
  IF v_quelle LIKE '%team_members%' THEN
    RAISE EXCEPTION 'Pruefung 3: der Rumpf liest weiterhin die Personalliste';
  END IF;
  IF v_quelle LIKE '%''active''%' THEN
    RAISE EXCEPTION 'Pruefung 3: die unerfuellbare Statusbedingung steht noch im Rumpf';
  END IF;
  IF v_quelle NOT LIKE '%is_company_member%' OR v_quelle NOT LIKE '%is_company_owner%' THEN
    RAISE EXCEPTION 'Pruefung 3: der Rumpf benutzt die Mitgliedspraedikate nicht';
  END IF;

  -- (4) Rechte an der Funktion: authenticated ja, anon und PUBLIC nein.
  IF NOT pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Pruefung 4: authenticated kann die Funktion nicht aufrufen';
  END IF;
  PERFORM 1 FROM pg_catalog.pg_proc p, LATERAL aclexplode(p.proacl) acl
   WHERE p.oid = v_oid AND (acl.grantee = 0 OR acl.grantee = pg_catalog.to_regrole('anon'));
  IF FOUND THEN
    RAISE EXCEPTION 'Pruefung 4: anon oder PUBLIC haben weiterhin EXECUTE';
  END IF;

  -- (5) Keiner der sechs alten Namen ist uebrig.
  FOREACH v_name IN ARRAY k_alt LOOP
    PERFORM 1 FROM pg_catalog.pg_policy
     WHERE polrelid = 'storage.objects'::regclass AND polname = v_name;
    IF FOUND THEN
      RAISE EXCEPTION 'Pruefung 5: alte Policy steht noch: %', v_name;
    END IF;
  END LOOP;

  -- (6) Genau die drei kanonischen, mit dem richtigen Befehl und der richtigen
  --     Rolle — und keine vierte, die den Bucket sonst noch anfasst.
  FOR v_i IN 1..3 LOOP
    v_name := k_kanon[v_i];
    SELECT pg_catalog.pg_get_expr(coalesce(pol.polqual, pol.polwithcheck), pol.polrelid)
      INTO v_ausdruck
      FROM pg_catalog.pg_policy pol
     WHERE pol.polrelid = 'storage.objects'::regclass
       AND pol.polname = v_name
       AND pol.polcmd = k_cmd[v_i]
       AND pol.polroles = ARRAY[pg_catalog.to_regrole('authenticated')::oid];
    IF v_ausdruck IS NULL THEN
      RAISE EXCEPTION 'Pruefung 6: Policy % fehlt, hat den falschen Befehl oder die falsche Rolle', v_name;
    END IF;

    -- (7) Genau dieser Bucket. `besichtigung-uploads` enthaelt `besichtigung`
    --     als Teilzeichenkette, deshalb wird der ganze Vergleich geprueft und
    --     nicht der blosse Name.
    IF v_ausdruck NOT LIKE '%bucket_id = ''besichtigung-uploads''::text%' THEN
      RAISE EXCEPTION 'Pruefung 7: % prueft nicht genau auf den Bucket besichtigung-uploads', v_name;
    END IF;

    -- (8) Der Ordnerschluessel ist der erste Pfadteil, also der Token — nicht
    --     die Sitzungs-id, an der 20260514000001 gescheitert ist.
    IF v_ausdruck NOT LIKE '%storage.foldername(%' THEN
      RAISE EXCEPTION 'Pruefung 8: % benutzt nicht den Pfadanfang als Ordnerschluessel', v_name;
    END IF;
    IF v_ausdruck LIKE '%s.id%' OR v_ausdruck LIKE '%sessions%' THEN
      RAISE EXCEPTION 'Pruefung 8: % vergleicht wieder direkt gegen die Sitzung', v_name;
    END IF;

    -- (9) Und die Entscheidung faellt in der geprueften Funktion.
    IF v_ausdruck NOT LIKE '%check_besichtigung_storage_access%' THEN
      RAISE EXCEPTION 'Pruefung 9: % ruft die Zugriffsfunktion nicht auf', v_name;
    END IF;
  END LOOP;

  -- (10) Kein Weg fuer anon oder PUBLIC auf diesen Bucket.
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_policy pol
   WHERE pol.polrelid = 'storage.objects'::regclass
     AND coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '')
       || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '') LIKE '%besichtigung%'
     AND ( pol.polroles = ARRAY[0]::oid[]
        OR pg_catalog.to_regrole('anon')::oid = ANY(pol.polroles) );
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Pruefung 10: % Policy(s) oeffnen besichtigung fuer anon oder PUBLIC', v_anzahl;
  END IF;

  -- (11) Die Schreiber laufen ueber service_role — diese Policy bleibt.
  PERFORM 1 FROM pg_catalog.pg_policy
   WHERE polrelid = 'storage.objects'::regclass
     AND polname = 'Service role besichtigung storage access';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 11: die service_role-Policy ist verschwunden — Upload und Aufraeumen waeren tot';
  END IF;

  RAISE NOTICE 'S3: besichtigung-uploads ist privat, der Lesepfad steht auf Token und Mitgliedschaft.';
END
$$;

COMMIT;
