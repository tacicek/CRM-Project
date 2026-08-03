-- S2a: Foto-Loeschung an die geprüfte Sitzung binden
--
-- ── Befund ─────────────────────────────────────────────────────────────────
--
-- `delete_besichtigung_photo(p_photo_id uuid)` loescht ueber die Foto-id, sonst
-- nichts:
--
--     DELETE FROM besichtigung.photos WHERE id = p_photo_id
--
-- Der Aufrufer, `delete-besichtigung-photo`, prueft davor sehr wohl einen
-- Token und holt sich damit eine Sitzung. Er reicht sie aber nicht weiter. Die
-- Pruefung beantwortet also „gehoert dieser Token zu einer gueltigen Sitzung?"
-- und nicht „gehoert dieses Foto zu DIESER Sitzung?".
--
-- Damit kann, wer einen gueltigen Token fuer irgendeine Besichtigung besitzt,
-- die Fotos JEDER anderen Besichtigung loeschen — auch die einer fremden Firma,
-- sofern er eine Foto-id kennt. Die Funktion ist SECURITY DEFINER, RLS greift
-- nicht.
--
-- ── Was hier passiert ──────────────────────────────────────────────────────
--
-- Die Funktion bekommt einen zweiten, zwingenden Parameter: die Sitzung, die
-- der Aufrufer nachgewiesen hat. Geloescht wird nur, wenn BEIDE zusammenpassen.
--
-- Die alte Signatur faellt weg. Sie stehen zu lassen waere die gefaehrlichere
-- Variante: der ungebundene Weg bliebe erreichbar, und ein Aufrufer, der die
-- Umstellung verpasst, liefe stillschweigend weiter darueber. Ein Aufruf mit
-- der alten Signatur soll scheitern, nicht funktionieren.
--
-- Kein Treffer heisst NULL — dieselbe Antwort wie „gibt es nicht". Der Aufrufer
-- kann daraus nicht ableiten, ob das Foto existiert und nur woanders haengt.
--
-- Wiederholbar: DROP … IF EXISTS + CREATE OR REPLACE, ein zweiter Lauf ist ein
-- No-op.

BEGIN;

DROP FUNCTION IF EXISTS public.delete_besichtigung_photo(uuid);

CREATE OR REPLACE FUNCTION public.delete_besichtigung_photo(
  p_photo_id uuid,
  p_session_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  -- Ohne eines von beidem gibt es nichts zu tun. Ausdruecklich vor dem DELETE:
  -- `WHERE session_id = NULL` traefe keine Zeile, aber der Grund waere Zufall
  -- und nicht Absicht.
  IF p_photo_id IS NULL OR p_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM besichtigung.photos
   WHERE id = p_photo_id
     AND session_id = p_session_id
  RETURNING json_build_object(
    'id', id,
    'storage_path', storage_path
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Rechte wie zuvor: nur `service_role` (und der Eigentuemer). Der oeffentliche
-- Weg fuehrt ueber die Edge Function, die den Token prueft.
REVOKE ALL ON FUNCTION public.delete_besichtigung_photo(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_besichtigung_photo(uuid, uuid) TO service_role;

-- ── Nachpruefung, fail-closed ──────────────────────────────────────────────
DO $$
DECLARE
  v_oid    oid;
  v_anzahl integer;
BEGIN
  -- (1) Genau eine Signatur, und zwar die neue.
  SELECT count(*), min(p.oid) INTO v_anzahl, v_oid
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'delete_besichtigung_photo';
  IF v_anzahl <> 1 THEN
    RAISE EXCEPTION 'Pruefung 1: erwartet genau 1 Signatur, gefunden %', v_anzahl;
  END IF;

  PERFORM 1 FROM pg_catalog.pg_proc p
   WHERE p.oid = v_oid
     AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_photo_id uuid, p_session_id uuid'
     AND p.prosecdef
     AND p.proconfig = ARRAY['search_path=public'];
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 2: die Signatur entspricht nicht dem Vertrag';
  END IF;

  -- (3) Die Bindung steht wirklich im Quelltext. Ohne diese Pruefung koennte
  --     jemand die Signatur erweitern und den Parameter ignorieren — die
  --     Funktion saehe dann richtig aus und waere es nicht.
  PERFORM 1 FROM pg_catalog.pg_proc p
   WHERE p.oid = v_oid AND p.prosrc LIKE '%session_id = p_session_id%';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pruefung 3: die Sitzungsbindung fehlt im Rumpf';
  END IF;

  -- (4) Rechte: nur service_role, kein PUBLIC, kein anon, kein authenticated.
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_proc p, LATERAL aclexplode(p.proacl) acl
   WHERE p.oid = v_oid
     AND ( acl.grantee = 0
        OR acl.grantee = pg_catalog.to_regrole('anon')
        OR acl.grantee = pg_catalog.to_regrole('authenticated') );
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Pruefung 4: % unerwuenschte(r) Grant(s)', v_anzahl;
  END IF;
  IF NOT pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Pruefung 4: service_role kann nicht mehr ausfuehren';
  END IF;

  RAISE NOTICE 'S2a: delete_besichtigung_photo ist an die Sitzung gebunden.';
END
$$;

COMMIT;
