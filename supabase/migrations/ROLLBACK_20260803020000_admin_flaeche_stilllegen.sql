-- Rollback zu 20260803020000_admin_flaeche_stilllegen.sql
--
-- Stellt `public.get_user_overview()` in genau der Fassung wieder her, die vor
-- der Migration im Katalog stand — inklusive der fest verdrahteten
-- E-Mail-Adresse, die der Grund fuer die Stilllegung war.
--
-- ── WARNUNG ────────────────────────────────────────────────────────────────
--
-- Diese Funktion ist SECURITY DEFINER, liest `auth.users` und entscheidet ihre
-- Berechtigung an EINER fest im Text stehenden Adresse. Wer diese Adresse
-- kontrolliert, liest die Benutzerliste der ganzen Installation. Sie
-- wiederherzustellen ergibt nur Sinn, wenn jemand sie wieder braucht — und dann
-- gehoert die Adresse ersetzt, nicht zurueckgeholt.
--
-- Die Rechte werden bewusst NICHT vollstaendig wiederhergestellt: `anon` hatte
-- EXECUTE, was aus demselben `--no-privileges`-Rueckstand stammt wie die
-- Tabellenrechte in 20260803010000. Ein Rollback stellt die Absicht wieder her,
-- nicht das Versehen.
--
-- Wiederholbar: CREATE OR REPLACE, ein zweiter Lauf ist ein No-op.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_overview()
 RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, role text, user_type text, last_sign_in_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() 
    AND u.email = 'test@test.invalid'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Owner access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email::text,
    p.first_name,
    p.last_name,
    COALESCE(ur.role::text, 'user') as role,
    CASE 
      WHEN ur.role IS NOT NULL THEN 'staff'
      WHEN c.id IS NOT NULL THEN 'company'
      ELSE 'unknown'
    END as user_type,
    u.last_sign_in_at,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.companies c ON c.user_id = u.id
  WHERE u.email != 'test@test.invalid'
  ORDER BY u.last_sign_in_at DESC NULLS LAST;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_overview() TO authenticated, service_role;

DO $pruef$
DECLARE v_anzahl integer;
BEGIN
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_user_overview';
  IF v_anzahl <> 1 THEN
    RAISE EXCEPTION 'Rollback: erwartet genau 1 Signatur, gefunden %', v_anzahl;
  END IF;

  IF pg_catalog.has_function_privilege('anon',
       'public.get_user_overview()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback: anon haette wieder EXECUTE — das war nie beabsichtigt';
  END IF;

  RAISE NOTICE 'Rollback 20260803020000: get_user_overview wiederhergestellt, anon bleibt aussen vor.';
END
$pruef$;

COMMIT;
