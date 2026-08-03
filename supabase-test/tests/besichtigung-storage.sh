#!/bin/bash
#
# Vertragstest fuer 20260803040000 — Besichtigungs-Storage
# ========================================================
#
# Prueft den Lesepfad, den die Migration herstellt, gegen eine echte Datenbank:
# wer die Fotos einer Besichtigung sehen darf und wer nicht.
#
# ── Warum ein Treiberskript und keine .sql in tests/ ───────────────────────
#
# Die uebrigen Dateien in `supabase-test/tests/` laufen gegen die Baseline. Der
# hier gepruefte Zustand entsteht aber erst durch die Migration, und die legt
# Policies auf `storage.objects` an — das verlangt Eigentum an der Tabelle und
# damit eine andere Verbindung als die Baseline-Suite benutzt. Dazu kommen
# Rollenwechsel je Fall. Beides braucht einen Treiber.
#
# ── Was NICHT geprueft wird ────────────────────────────────────────────────
#
# Das Ausstellen einer signierten Adresse ueber HTTP. Der lokale Stapel faehrt
# `db` und `kong`, aber keinen storage-Dienst. Geprueft wird stattdessen die
# Bedingung, an der das Signieren haengt: ob der Aufrufer das Objekt per RLS
# SELECT sehen darf. Der storage-Dienst laesst genau daran das Signieren
# scheitern oder gelingen. Das ist eine Aussage ueber die Voraussetzung, nicht
# ueber den HTTP-Weg — und sie wird hier auch so benannt.
#
# Aufruf:  bash supabase-test/tests/besichtigung-storage.sh
# Setzt voraus: der crm-test-Stapel laeuft (npm run test:db:up).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG="$REPO_ROOT/supabase/migrations/20260803040000_besichtigung_bucket_privat.sql"
RB="$REPO_ROOT/supabase/migrations/ROLLBACK_20260803040000_besichtigung_bucket_privat.sql"
CONT="${TEST_DB_CONTAINER:-supabase_db_crm-test}"
PW="${TEST_DB_ADMIN_PASSWORD:-postgres}"

GRUEN='\033[0;32m'; ROT='\033[0;31m'; AUS='\033[0m'
BESTANDEN=0; GESCHEITERT=0

# Alles laeuft als supabase_admin: die Migration braucht Eigentum an
# storage.objects, und die Faelle brauchen SET ROLE.
A() { docker exec -e PGPASSWORD="$PW" -i "$CONT" psql -U supabase_admin -h 127.0.0.1 -d postgres -qtA "$@"; }
A_STRIKT() { docker exec -e PGPASSWORD="$PW" -i "$CONT" psql -U supabase_admin -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 -qtA "$@"; }

ist() {  # ist <beschreibung> <erwartet> <ist>
  if [ "$2" = "$3" ]; then
    printf "  ${GRUEN}✓${AUS} %-58s %s\n" "$1" "$3"; BESTANDEN=$((BESTANDEN + 1))
  else
    printf "  ${ROT}✗${AUS} %-58s erwartet=%s ist=%s\n" "$1" "$2" "$3"; GESCHEITERT=$((GESCHEITERT + 1))
  fi
}

# Zaehlt die fuer <uid> sichtbaren Objekte in <bucket>. Leere uid = anon.
sichtbar() {  # sichtbar <uid|-> <bucket>
  local uid="$1" bucket="$2" rolle="authenticated" claims out rc
  if [ "$uid" = "-" ]; then rolle="anon"; claims="{}"; else claims="{\"sub\":\"$uid\",\"role\":\"authenticated\"}"; fi
  # `set_config` in einem DO-Block, damit seine Rueckgabe die Ausgabe nicht
  # verschmutzt. ON_ERROR_STOP, damit ein Rechtefehler als MESSFEHLER sichtbar
  # wird statt als "sieht eben nichts" — das waere die vacuous-Falle.
  out="$(A_STRIKT -c "BEGIN;
        DO \$\$ BEGIN PERFORM set_config('request.jwt.claims', '$claims', true); END \$\$;
        SET LOCAL ROLE $rolle;
        SELECT count(*) FROM storage.objects WHERE bucket_id = '$bucket';
        ROLLBACK;" 2>&1)"; rc=$?
  if [ $rc -ne 0 ]; then printf 'MESSFEHLER'; return; fi
  printf '%s' "$out" | tail -1
}

# Versucht ein INSERT bzw. DELETE als <uid> und meldet ok/verweigert.
schreibprobe() {  # schreibprobe <uid> <befehl:insert|delete> <name>
  local uid="$1" was="$2" name="$3" sql
  if [ "$was" = "insert" ]; then
    sql="INSERT INTO storage.objects (id,bucket_id,name) VALUES (gen_random_uuid(),'besichtigung-uploads','$name');"
  else
    sql="DELETE FROM storage.objects WHERE bucket_id='besichtigung-uploads' AND name='$name';"
  fi
  A -c "BEGIN;
        SELECT set_config('request.jwt.claims', '{\"sub\":\"$uid\",\"role\":\"authenticated\"}', true);
        SET LOCAL ROLE authenticated;
        DO \$\$ BEGIN
          $sql
          RAISE NOTICE 'ERGEBNIS ok';
        EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ERGEBNIS verweigert';
        END \$\$;
        ROLLBACK;" 2>&1 | sed -n 's/.*ERGEBNIS \(.*\)/\1/p' | tail -1
}

# ── Ausgangszustand wie in Produktion ──────────────────────────────────────
#
# Bucket oeffentlich, die kaputte Zugriffsfunktion, die beiden alten
# Policy-Saetze. Genau der Stand, den die Messung vom 2026-08-03 ergeben hat.
produktionsstand() {
  A_STRIKT >/dev/null 2>&1 <<'SQL'
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS public boolean NOT NULL DEFAULT false;
INSERT INTO storage.buckets (id,name,public) VALUES ('besichtigung-uploads','besichtigung-uploads',true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id,name,public) VALUES ('company-logos','company-logos',true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "besichtigung_uploads_insert_member" ON storage.objects;
DROP POLICY IF EXISTS "besichtigung_uploads_select_member" ON storage.objects;
DROP POLICY IF EXISTS "besichtigung_uploads_delete_member" ON storage.objects;
DROP POLICY IF EXISTS "Service role besichtigung storage access" ON storage.objects;

CREATE POLICY "Service role besichtigung storage access" ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'besichtigung-uploads')
  WITH CHECK (bucket_id = 'besichtigung-uploads');

-- Die drei fehlerhaften aus 20260514000001: falscher Bucket, Sitzungs-id
-- statt Token.
DROP POLICY IF EXISTS "besichtigung_storage_read_member" ON storage.objects;
CREATE POLICY "besichtigung_storage_read_member" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'besichtigung'
    AND EXISTS (SELECT 1 FROM besichtigung.sessions s
                 WHERE s.id::text = (storage.foldername(name))[1]
                   AND public.is_company_member(s.company_id)));

-- Die kaputte Zugriffsfunktion von davor.
CREATE OR REPLACE FUNCTION public.check_besichtigung_storage_access(folder_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, besichtigung
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM besichtigung.sessions s
     WHERE s.token = folder_token
       AND s.company_id IN (
         SELECT c.id FROM public.companies c WHERE c.user_id = auth.uid()
         UNION
         SELECT tm.company_id FROM public.team_members tm
          WHERE tm.user_id = auth.uid() AND s.status = 'active'));
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.check_besichtigung_storage_access(text) TO anon, authenticated;

-- Nur fuers Geruest: der besichtigung-Stub vergibt keine Rechte. Die ALTE
-- Policy liest `besichtigung.sessions` direkt und braucht sie deshalb. Die
-- kanonischen Policies brauchen das nicht — sie entscheiden ausschliesslich in
-- der SECURITY-DEFINER-Funktion. Genau das ist ein Vorzug der neuen Fassung.
GRANT USAGE ON SCHEMA besichtigung TO authenticated, anon;
GRANT SELECT ON besichtigung.sessions TO authenticated, anon;
SQL
}

fixtures() {
  A_STRIKT >/dev/null 2>&1 <<'SQL'
-- Ein Konto, das NUR Mitglied ist. user2 waere zugleich Eigentuemer von c2 und
-- saehe damit zwei Besichtigungen — die Zahlen waeren nicht mehr eindeutig.
INSERT INTO auth.users (id, email)
VALUES ('d0000000-0000-4000-8000-00000000000a','mitglied@test.invalid')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.company_members (company_id, user_id, role)
VALUES ('a0000000-0000-4000-8000-0000000000c1','d0000000-0000-4000-8000-00000000000a','member')
ON CONFLICT DO NOTHING;

INSERT INTO besichtigung.sessions (id, token, company_id, customer_name, status)
VALUES ('e1111111-0000-4000-8000-000000000001','tok-eigen',
        'a0000000-0000-4000-8000-0000000000c1','Kunde A','uploaded')
ON CONFLICT (id) DO NOTHING;
INSERT INTO besichtigung.sessions (id, token, company_id, customer_name, status)
VALUES ('e2222222-0000-4000-8000-000000000002','tok-fremd',
        'b0000000-0000-4000-8000-0000000000c2','Kunde B','uploaded')
ON CONFLICT (id) DO NOTHING;

DELETE FROM storage.objects WHERE bucket_id IN ('besichtigung-uploads','company-logos');
INSERT INTO storage.objects (id,bucket_id,name) VALUES
  (gen_random_uuid(),'besichtigung-uploads','tok-eigen/wohnzimmer/1.jpg'),
  (gen_random_uuid(),'besichtigung-uploads','tok-fremd/kueche/2.jpg'),
  -- Der Pfad, den die kaputten Policies erwartet haetten: die Sitzungs-id.
  (gen_random_uuid(),'besichtigung-uploads','e1111111-0000-4000-8000-000000000001/bad/3.jpg'),
  (gen_random_uuid(),'company-logos','irgendwas/logo.png');
SQL
}

EIGNER=a0000000-0000-4000-8000-000000000001   # Inhaber von c1
MITGLIED=d0000000-0000-4000-8000-00000000000a # NUR Mitglied von c1
FREMD=c0000000-0000-4000-8000-00000000000f    # gehoert nirgends dazu

echo "══ 1. Ohne Bucket schlaegt die Migration fehl und laesst NICHTS zurueck ══"
produktionsstand; fixtures
A_STRIKT -c "DELETE FROM storage.objects WHERE bucket_id='besichtigung-uploads';
             DELETE FROM storage.buckets WHERE id='besichtigung-uploads';" >/dev/null 2>&1
ist "Vorbedingung: der Bucket ist wirklich weg" "0" \
  "$(A -c "SELECT count(*) FROM storage.buckets WHERE id='besichtigung-uploads';")"
AUSGABE="$(A_STRIKT < "$MIG" 2>&1)"; RC=$?
ist "Migration bricht ab" "1" "$([ $RC -ne 0 ] && echo 1 || echo 0)"
ist "Fehlermeldung nennt den Bucket" "1" "$(printf '%s' "$AUSGABE" | grep -cq 'Pruefung 1' && echo 1 || echo 0)"
ist "keine kanonische Policy angelegt" "0" \
  "$(A -c "SELECT count(*) FROM pg_policy WHERE polrelid='storage.objects'::regclass AND polname LIKE 'besichtigung_uploads_%';")"
ist "Zugriffsfunktion unveraendert kaputt" "1" \
  "$(A -c "SELECT (prosrc LIKE '%team_members%')::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname='check_besichtigung_storage_access';")"

echo
echo "══ 2. Vorzustand: der kaputte Lesepfad sperrt sogar den Eigentuemer aus ══"
produktionsstand; fixtures
ist "Bucket ist oeffentlich" "true" "$(A -c "SELECT public::text FROM storage.buckets WHERE id='besichtigung-uploads';")"
ist "Eigentuemer sieht ueber RLS nichts" "0" "$(sichtbar "$EIGNER" besichtigung-uploads)"
ist "Mitglied sieht ueber RLS nichts"    "0" "$(sichtbar "$MITGLIED" besichtigung-uploads)"

echo
echo "══ 3. Migration, zweimal (idempotent) ══"
for lauf in 1 2; do
  AUSGABE="$(A_STRIKT < "$MIG" 2>&1)"; RC=$?
  ist "Lauf $lauf laeuft durch" "0" "$RC"
  ist "Lauf $lauf meldet Erfolg" "1" "$(printf '%s' "$AUSGABE" | grep -cq 'S3: besichtigung-uploads ist privat' && echo 1 || echo 0)"
done
ist "Bucket ist privat" "false" "$(A -c "SELECT public::text FROM storage.buckets WHERE id='besichtigung-uploads';")"

echo
echo "══ 4. Wer darf lesen ══"
ist "Eigentuemer sieht sein Foto"                    "1" "$(sichtbar "$EIGNER" besichtigung-uploads)"
ist "Mitglied derselben Firma sieht es auch"         "1" "$(sichtbar "$MITGLIED" besichtigung-uploads)"
ist "Fremder sieht nichts"                           "0" "$(sichtbar "$FREMD" besichtigung-uploads)"
ist "anon sieht nichts"                              "0" "$(sichtbar "-" besichtigung-uploads)"

echo
echo "   (Der Eigentuemer sieht GENAU EIN Objekt: das unter seinem Token."
echo "    Das dritte Objekt liegt unter der Sitzungs-id — dem Pfad, auf den die"
echo "    fehlerhaften Policies von 20260514000001 gesetzt hatten. Dass es"
echo "    unsichtbar bleibt, ist der eigentliche Nachweis.)"
ist "Sitzungs-id als Pfadpraefix bleibt unsichtbar" "0" \
  "$(A -c "BEGIN; SELECT set_config('request.jwt.claims','{\"sub\":\"$EIGNER\",\"role\":\"authenticated\"}',true);
           SET LOCAL ROLE authenticated;
           SELECT count(*) FROM storage.objects WHERE bucket_id='besichtigung-uploads' AND name LIKE 'e1111111%';
           ROLLBACK;" 2>/dev/null | tail -1)"

echo
echo "══ 5. Der Bucket ist genau benannt ══"
ist "fremder Bucket bleibt unberuehrt (company-logos)" "0" "$(sichtbar "$EIGNER" company-logos)"
ist "kein Objekt in einem Bucket namens 'besichtigung'" "0" \
  "$(A -c "SELECT count(*) FROM storage.buckets WHERE id='besichtigung';")"

echo
echo "══ 6. Schreiben und Loeschen tragen dieselbe Isolation ══"
ist "Eigentuemer darf in seinen Ordner schreiben"  "ok"         "$(schreibprobe "$EIGNER" insert 'tok-eigen/neu/4.jpg')"
ist "Mitglied darf ebenfalls"                      "ok"         "$(schreibprobe "$MITGLIED" insert 'tok-eigen/neu/5.jpg')"
ist "Fremder darf nicht schreiben"                 "verweigert" "$(schreibprobe "$FREMD" insert 'tok-eigen/neu/6.jpg')"
ist "Eigentuemer darf nicht in fremden Ordner"     "verweigert" "$(schreibprobe "$EIGNER" insert 'tok-fremd/neu/7.jpg')"
ist "Eigentuemer darf sein Foto loeschen"          "ok"         "$(schreibprobe "$EIGNER" delete 'tok-eigen/wohnzimmer/1.jpg')"
ist "Fremder darf es nicht loeschen"               "ok"         "$(schreibprobe "$FREMD" delete 'tok-eigen/wohnzimmer/1.jpg')"

echo "   (Ein DELETE ohne Trefferrecht meldet keinen Fehler, es trifft null"
echo "    Zeilen — RLS filtert, statt zu werfen. Deshalb zaehlt hier, was"
echo "    danach noch da ist:)"
ist "das Foto liegt nach dem Fremdversuch noch da" "1" \
  "$(A -c "BEGIN; SELECT set_config('request.jwt.claims','{\"sub\":\"$FREMD\",\"role\":\"authenticated\"}',true);
           SET LOCAL ROLE authenticated;
           DELETE FROM storage.objects WHERE bucket_id='besichtigung-uploads' AND name='tok-eigen/wohnzimmer/1.jpg';
           RESET ROLE;
           SELECT count(*) FROM storage.objects WHERE name='tok-eigen/wohnzimmer/1.jpg';
           ROLLBACK;" 2>/dev/null | tail -1)"

echo
echo "══ 7. Voraussetzung des Signierens ══"
echo "   (Der storage-Dienst laeuft lokal nicht. Gemessen wird die Bedingung,"
echo "    an der er das Signieren scheitern laesst: das SELECT-Recht am Objekt.)"
ist "Eigentuemer erfuellt sie" "1" "$(sichtbar "$EIGNER" besichtigung-uploads)"
ist "Mitglied erfuellt sie"    "1" "$(sichtbar "$MITGLIED" besichtigung-uploads)"
ist "Fremder erfuellt sie nicht" "0" "$(sichtbar "$FREMD" besichtigung-uploads)"

echo
echo "══ 8. Rollback, zweimal ══"
for lauf in 1 2; do
  AUSGABE="$(A_STRIKT < "$RB" 2>&1)"; RC=$?
  ist "Rollback-Lauf $lauf laeuft durch" "0" "$RC"
done
ist "Bucket ist wieder oeffentlich" "true" "$(A -c "SELECT public::text FROM storage.buckets WHERE id='besichtigung-uploads';")"
ist "die drei kanonischen Policies bleiben" "3" \
  "$(A -c "SELECT count(*) FROM pg_policy WHERE polrelid='storage.objects'::regclass AND polname LIKE 'besichtigung_uploads_%';")"
ist "die Zugriffsfunktion bleibt repariert" "0" \
  "$(A -c "SELECT (prosrc LIKE '%team_members%')::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname='check_besichtigung_storage_access';")"
ist "die fehlerhaften Policies kehren nicht zurueck" "0" \
  "$(A -c "SELECT count(*) FROM pg_policy WHERE polrelid='storage.objects'::regclass AND polname LIKE 'besichtigung_storage_%';")"
ist "anon bekommt EXECUTE nicht zurueck" "f" \
  "$(A -c "SELECT has_function_privilege('anon','public.check_besichtigung_storage_access(text)','EXECUTE');")"

echo
echo "══ 9. Wieder vorwaerts ══"
AUSGABE="$(A_STRIKT < "$MIG" 2>&1)"; RC=$?
ist "Migration nach dem Rollback erneut anwendbar" "0" "$RC"
ist "Bucket wieder privat" "false" "$(A -c "SELECT public::text FROM storage.buckets WHERE id='besichtigung-uploads';")"
ist "Eigentuemer liest weiterhin" "1" "$(sichtbar "$EIGNER" besichtigung-uploads)"

echo
echo "═══════════════════════════════════════════════"
printf "bestanden %s, gescheitert %s\n" "$BESTANDEN" "$GESCHEITERT"
[ "$GESCHEITERT" -eq 0 ] || exit 1
exit 0
