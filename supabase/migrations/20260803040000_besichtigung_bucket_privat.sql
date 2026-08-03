-- S3: Besichtigungsfotos aus dem oeffentlichen Netz nehmen
--
-- ── Befund ─────────────────────────────────────────────────────────────────
--
-- Der Bucket `besichtigung-uploads` steht auf `public = true`. Wer den Pfad
-- einer Datei kennt, laedt sie ohne Anmeldung herunter — kein Token, kein
-- Schluessel, keine Frist. Der Inhalt sind Innenaufnahmen von Wohnungen, die
-- Kunden fuer eine Umzugsofferte hochgeladen haben, zusammen mit Raumtyp und
-- Adresse in der Sitzung.
--
-- Die Begruendung von damals steht in 20260127150000 und ist zitierfaehig:
--
--     "Making bucket public avoids cross-schema RLS issues with signed URLs."
--
-- Der Bucket wurde also oeffentlich gemacht, weil signierte URLs nicht gingen.
-- Als Ersatz dient bis heute die Unratbarkeit des Pfades — im selben Kommentar
-- als "unguessable random tokens" beschrieben. Das ist kein Zugriffsschutz: der
-- Pfad steht im Browserverlauf, im Referrer, in jedem Weiterleiten des Links,
-- und er verfaellt nie.
--
-- ── Warum signierte URLs nicht gingen ──────────────────────────────────────
--
-- Nicht wegen "cross-schema RLS". Die Lesepolicy auf `storage.objects` ruft
-- `check_besichtigung_storage_access(token)` auf, und diese Funktion hat einen
-- Zweig, der nicht erfuellbar ist:
--
--     SELECT tm.company_id FROM public.team_members tm
--      WHERE tm.user_id = auth.uid()
--        AND s.status = 'active'
--
-- `s` ist die Besichtigungssitzung. Ihre Statusspalte traegt einen CHECK aus
-- 20260127100000, der genau sieben Werte zulaesst: pending, uploading,
-- uploaded, analyzing, analyzed, completed, expired. `active` ist keiner davon.
-- Die Bedingung ist damit immer falsch, und der ganze Zweig ist toter Code.
--
-- Es ist die zweite Fassung desselben Fehlers. Die erste, in 20260127100000,
-- las `team_members.status = 'active'` — eine Spalte, die es in `team_members`
-- nicht gibt (dort heisst das Feld `is_active` und ist boolean). 20260314250000
-- hat den Ausdruck in die Sitzung verschoben, wo er syntaktisch aufgeht und
-- inhaltlich weiterhin nie zutrifft.
--
-- Uebrig bleibt der Eigentuemerzweig. Fuer den Firmeninhaber funktionieren
-- signierte URLs also sehr wohl; fuer jeden anderen Angemeldeten nie. Statt
-- den Zweig zu reparieren wurde der Bucket geoeffnet.
--
-- Dazu kommt die falsche Tabelle. `team_members` ist die Personalliste —
-- Vorname, Nachname, Faehigkeiten, Farbcode — und ihr `user_id` ist
-- NULL-erlaubt, weil die meisten Eintraege gar kein Konto haben. Wer sich
-- anmelden kann, steht in `company_members` (`user_id NOT NULL`, Rolle owner /
-- admin / member). Genau dafuer gibt es `is_company_member()`.
--
-- ── Was hier passiert ──────────────────────────────────────────────────────
--
-- 1. Die Zugriffsfunktion bekommt den Zweig, der gemeint war: Eigentuemer ODER
--    Mitglied der Firma, ueber die vorhandenen Praedikate. Damit funktionieren
--    signierte URLs fuer alle, die die Fotos sehen duerfen — der Grund, den
--    Bucket offen zu lassen, faellt weg.
-- 2. Der Bucket wird privat.
--
-- Die Reihenfolge ist nicht beliebig. Erst der Lesepfad, dann der Riegel: waere
-- es umgekehrt, gaebe es zwischen den beiden Anweisungen einen Moment, in dem
-- niemand ausser dem Eigentuemer die Fotos sehen kann. In einer Transaktion ist
-- das nach aussen unsichtbar, aber die Reihenfolge beschreibt die Absicht.
--
-- Die Leser sind in derselben Runde umgestellt (`Besichtigungen.tsx`,
-- `analyze-besichtigung`); beide erzeugen jetzt signierte URLs. Die Schreiber
-- (`upload-besichtigung-photo`, `delete-besichtigung-photo`,
-- `cleanup-besichtigung`) laufen auf `service_role` und sind nicht betroffen.
--
-- ── Was hier NICHT passiert ────────────────────────────────────────────────
--
-- Die drei Policies auf `storage.objects` werden nicht neu angelegt. Sie stehen
-- seit 20260314250000 und sind richtig; falsch war allein die Funktion, die sie
-- aufrufen. Diese Migration prueft sie und veraendert sie nicht.
--
-- Andere Buckets werden nicht angefasst.
--
-- Wiederholbar: CREATE OR REPLACE + UPDATE auf einen festen Wert, ein zweiter
-- Lauf ist ein No-op.

BEGIN;

-- ── 1. Der Lesepfad ────────────────────────────────────────────────────────

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

-- `anon` verliert das Ausfuehrungsrecht. Alle drei Policies, die diese Funktion
-- aufrufen, sind `TO authenticated`; fuer `anon` gab es nie einen Aufrufweg.
-- Ein SECURITY-DEFINER-Leser eines fremden Schemas, den ein Unangemeldeter
-- aufrufen darf, ist Angriffsflaeche ohne Gegenwert.
--
-- PUBLIC muss ausdruecklich mitgenannt werden. Postgres vergibt EXECUTE an
-- PUBLIC, sobald eine Funktion entsteht, und `CREATE OR REPLACE` behaelt die
-- vorhandenen Rechte bei. Nur `anon` zu entziehen brachte deshalb nichts: die
-- Rolle haette die Funktion ueber PUBLIC weiterhin aufrufen koennen. Die
-- Nachpruefung unten hat genau das gemeldet.
REVOKE EXECUTE ON FUNCTION public.check_besichtigung_storage_access(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_besichtigung_storage_access(text) TO authenticated;

-- ── 2. Der Riegel ──────────────────────────────────────────────────────────

UPDATE storage.buckets
   SET public = false
 WHERE id = 'besichtigung-uploads';

-- ── Nachpruefung, fail-closed ──────────────────────────────────────────────
DO $$
DECLARE
  v_oid       oid;
  v_public    boolean;
  v_quelle    text;
  v_policy    text;
  v_fehlend   text[] := '{}';
BEGIN
  -- (1) Der Bucket ist privat. Kein `IF FOUND`-Umweg: ist die Zeile nicht da,
  --     hat das UPDATE nichts getan und die Migration hat ihr Ziel verfehlt.
  SELECT b.public INTO v_public FROM storage.buckets b WHERE b.id = 'besichtigung-uploads';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 1: den Bucket besichtigung-uploads gibt es nicht';
  END IF;
  IF v_public IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Pruefung 1: der Bucket ist weiterhin oeffentlich (public=%)', v_public;
  END IF;

  -- (2) Die Zugriffsfunktion steht, und zwar als SECURITY DEFINER mit festem
  --     search_path.
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
   WHERE p.oid = v_oid
     AND p.prosecdef
     AND p.proconfig = ARRAY['search_path=public, besichtigung'];
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 2: SECURITY DEFINER oder search_path stimmen nicht';
  END IF;

  -- (3) Der unerfuellbare Zweig ist weg, und der gemeinte ist da. Geprueft wird
  --     am Rumpf und nicht am Verhalten, weil das Verhalten des alten Zweiges
  --     genau darin bestand, sich NICHT zu zeigen: er lieferte immer false, und
  --     das tut ein fehlender Zweig auch. Nur der Quelltext unterscheidet
  --     "richtig verboten" von "kaputt".
  IF v_quelle LIKE '%team_members%' THEN
    RAISE EXCEPTION 'Pruefung 3: der Rumpf liest weiterhin team_members';
  END IF;
  IF v_quelle LIKE '%''active''%' THEN
    RAISE EXCEPTION 'Pruefung 3: die unerfuellbare Statusbedingung steht noch im Rumpf';
  END IF;
  IF v_quelle NOT LIKE '%is_company_member%' OR v_quelle NOT LIKE '%is_company_owner%' THEN
    RAISE EXCEPTION 'Pruefung 3: der Rumpf benutzt die Mitgliedspraedikate nicht';
  END IF;

  -- (4) Rechte: `authenticated` ja, `anon` nein, PUBLIC nein.
  IF NOT pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Pruefung 4: authenticated kann die Funktion nicht mehr aufrufen';
  END IF;
  PERFORM 1 FROM pg_catalog.pg_proc p, LATERAL aclexplode(p.proacl) acl
   WHERE p.oid = v_oid
     AND (acl.grantee = 0 OR acl.grantee = pg_catalog.to_regrole('anon'));
  IF FOUND THEN
    RAISE EXCEPTION 'Pruefung 4: anon oder PUBLIC haben weiterhin EXECUTE';
  END IF;

  -- (5) Der Lesepfad, den der Riegel voraussetzt. Ohne diese Policies waere der
  --     private Bucket fuer das Dashboard schlicht leer — fail-closed, aber
  --     kaputt. Diese Migration legt sie nicht an; sie besteht darauf, dass es
  --     sie gibt.
  FOREACH v_policy IN ARRAY ARRAY[
    'Company users can read besichtigung uploads',
    'Company users can upload to besichtigung',
    'Company users can delete besichtigung uploads'
  ] LOOP
    PERFORM 1 FROM pg_catalog.pg_policy
     WHERE polrelid = 'storage.objects'::regclass AND polname = v_policy;
    IF NOT FOUND THEN
      v_fehlend := v_fehlend || v_policy;
    END IF;
  END LOOP;
  IF array_length(v_fehlend, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Pruefung 5: Policy fehlt auf storage.objects: %', array_to_string(v_fehlend, ', ');
  END IF;

  -- (6) Und sie muessen ueber die gepruefte Funktion laufen. Eine Policy mit
  --     `USING (bucket_id = ...)` allein waere fuer jeden Angemeldeten offen.
  SELECT pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) INTO v_quelle
    FROM pg_catalog.pg_policy pol
   WHERE pol.polrelid = 'storage.objects'::regclass
     AND pol.polname = 'Company users can read besichtigung uploads';
  IF v_quelle IS NULL OR v_quelle NOT LIKE '%check_besichtigung_storage_access%' THEN
    RAISE EXCEPTION 'Pruefung 6: die Lesepolicy prueft die Zugriffsfunktion nicht';
  END IF;

  RAISE NOTICE 'S3: besichtigung-uploads ist privat, der Lesepfad steht.';
END
$$;

COMMIT;
