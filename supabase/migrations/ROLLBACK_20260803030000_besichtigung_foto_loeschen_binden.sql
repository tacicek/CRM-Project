-- Rollback zu 20260803030000_besichtigung_foto_loeschen_binden.sql
--
-- ── WARNUNG ────────────────────────────────────────────────────────────────
--
-- Dieser Rollback stellt die ungebundene Fassung wieder her. Danach loescht
-- `delete_besichtigung_photo` wieder allein ueber die Foto-id, und wer einen
-- gueltigen Token fuer IRGENDEINE Besichtigung besitzt, kann die Fotos jeder
-- anderen loeschen — auch die einer fremden Firma.
--
-- Er existiert, damit der Weg zurueck offen ist, nicht weil er empfehlenswert
-- waere. Wer ihn geht, sollte die Edge Function im selben Zug zuruecknehmen:
-- sie ruft nach der Migration mit zwei Argumenten auf und wuerde sonst
-- scheitern.
--
-- Geloescht wird nichts: keine Zeile in `besichtigung.photos`, keine Datei im
-- Speicher.
--
-- Wiederholbar: ein zweiter Lauf ist ein No-op.

BEGIN;

DROP FUNCTION IF EXISTS public.delete_besichtigung_photo(uuid, uuid);

CREATE OR REPLACE FUNCTION public.delete_besichtigung_photo(p_photo_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  DELETE FROM besichtigung.photos
  WHERE id = p_photo_id
  RETURNING json_build_object(
    'id', id,
    'storage_path', storage_path
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_besichtigung_photo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_besichtigung_photo(uuid) TO service_role;

DO $pruef$
DECLARE v_anzahl integer;
BEGIN
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'delete_besichtigung_photo';
  IF v_anzahl <> 1 THEN
    RAISE EXCEPTION 'Rollback: erwartet genau 1 Signatur, gefunden %', v_anzahl;
  END IF;

  PERFORM 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'delete_besichtigung_photo'
     AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_photo_id uuid';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rollback: die alte Signatur wurde nicht hergestellt';
  END IF;

  RAISE NOTICE 'Rollback 20260803030000: ungebundene Fassung wieder aktiv. Daten unveraendert.';
END
$pruef$;

COMMIT;
