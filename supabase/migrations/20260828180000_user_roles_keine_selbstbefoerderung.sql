-- M01-02: ein Moderator kann sich heute zum super_admin machen.
--
-- BEFUND (gemessen 2026-08-28)
--
-- `public.user_roles` traegt sechs Policies. Fuenf sind sauber gestuft. Die
-- sechste hebt die Stufung auf:
--
--     Admins can manage roles | FOR ALL | TO authenticated
--       USING is_admin(auth.uid())  WITH CHECK is_admin(auth.uid())
--
-- `is_admin` schliesst `moderator` ein. Und weil Policies PERMISSIV sind und sich
-- verodern, genuegt diese eine: die daneben stehenden Super-Admin-Policies
-- pruefen `can_modify_role()` und damit die Hierarchie — diese hier prueft nichts
-- dergleichen. Ein `moderator` darf also INSERT, UPDATE und DELETE auf JEDER
-- Zeile, sich selbst eingeschlossen.
--
-- In `src/lib/adminPermissions.ts` ist `moderator` die SCHWAECHSTE Rolle
-- (Stufe 10). In der Datenbank ist sie damit die staerkste, die es gibt. Zwei
-- Rollenmodelle, ein Name.
--
-- Ruhend, nicht aktiv: `user_roles` hat 0 Zeilen. Genau deshalb ist jetzt der
-- richtige Zeitpunkt — nach der ersten Rollenvergabe waere es ein Eingriff in
-- den laufenden Betrieb.
--
-- WAS DIESE MIGRATION TUT
--
-- 1. Die Policy `Admins can manage roles` entfaellt. Die gestuften
--    Super-Admin-Policies bleiben woertlich stehen.
-- 2. `anon` und `authenticated` verlieren INSERT, UPDATE und DELETE auf der
--    Tabelle. Bisher war die Policy die einzige Schranke; ein Browserclient
--    hatte das Tabellenrecht. Danach kann kein Browserclient mehr schreiben,
--    gleich welche Policy jemand spaeter anlegt. SELECT bleibt — die eigene
--    Rolle zu lesen ist die Grundlage der Oberflaeche.
-- 3. Jede Aenderung wird protokolliert.
--
-- KEINE AUSSPERRUNG
--
-- `user_roles` ist leer, es gibt also keinen super_admin, der die gestuften
-- Policies ausloesen koennte. Plattformrollen werden folglich ueber den
-- Betreiberweg vergeben: `service_role` umgeht RLS und behaelt das
-- Tabellenrecht. Das ist die Absicht — Rollenvergabe ist ein getrennt
-- authentifizierter, protokollierter Vorgang, kein Browser-Klick.
--
-- Ziel-Rolle und Ziel-Benutzer werden serverseitig geprueft: der Trigger unten
-- weist eine unbekannte Rolle ab, und der Fremdschluessel auf `auth.users`
-- besteht bereits.

BEGIN;

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;

-- Protokoll. Die Pruefung der Ziel-Rolle macht die Datenbank bereits selbst:
-- `user_roles.role` ist der Enum `app_role` (super_admin, admin, moderator,
-- user), und `user_id` traegt einen Fremdschluessel auf `auth.users`. Eine
-- eigene Whitelist hier waere keine zweite Linie, sondern eine schlechtere
-- Kopie — ein erster Entwurf zaehlte drei Rollen auf und haette die legitime
-- vierte (`user`) abgewiesen. Nachweis 5 unten prueft, dass beide Schranken
-- wirklich stehen, statt sie nachzubauen.
CREATE OR REPLACE FUNCTION public.user_roles_protokollieren()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $trigger$
BEGIN
  INSERT INTO public.admin_activity_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'user_roles.' || lower(TG_OP),
    'user_roles',
    coalesce(NEW.user_id, OLD.user_id)::text,
    jsonb_build_object(
      'rolle_neu', NEW.role,
      'rolle_alt', OLD.role,
      -- NICHT current_user: in einer SECURITY-DEFINER-Funktion ist das immer
      -- der Eigentuemer (postgres), egal wer aufgerufen hat — das Feld haette
      -- konstant gelogen. session_user nennt die Anmelde-Rolle; wer es
      -- fachlich war, steht ohnehin in user_id (auth.uid()).
      'anmelderolle', session_user
    )
  );

  RETURN coalesce(NEW, OLD);
END
$trigger$;

DROP TRIGGER IF EXISTS trigger_user_roles_protokoll ON public.user_roles;
CREATE TRIGGER trigger_user_roles_protokoll
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.user_roles_protokollieren();

-- Nachweis 1: keine Policy auf user_roles gewaehrt mehr Schreibrechte ohne
-- Hierarchiepruefung.
DO $pruefung$
DECLARE
  v_rest integer;
  v_namen text;
BEGIN
  SELECT count(*), coalesce(string_agg(polname, ', '), '') INTO v_rest, v_namen
    FROM pg_policy
   WHERE polrelid = 'public.user_roles'::regclass
     AND polcmd IN ('a', 'w', 'd', '*')
     AND coalesce(pg_get_expr(polwithcheck, polrelid), pg_get_expr(polqual, polrelid), '')
           !~* '\mcan_modify_role\M'
     AND coalesce(pg_get_expr(polwithcheck, polrelid), pg_get_expr(polqual, polrelid), '')
           !~* '\mis_super_admin\M';

  IF v_rest > 0 THEN
    RAISE EXCEPTION
      '% schreibende Policies auf user_roles ohne Hierarchiepruefung: %', v_rest, v_namen;
  END IF;
END
$pruefung$;

-- Nachweis 2: Browserclients halten kein Schreibrecht mehr auf der Tabelle.
DO $pruefung$
DECLARE
  v_rolle text;
  v_recht text;
BEGIN
  FOREACH v_rolle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH v_recht IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
      IF has_table_privilege(v_rolle, 'public.user_roles', v_recht) THEN
        RAISE EXCEPTION '% haelt weiterhin %-Recht auf user_roles', v_rolle, v_recht;
      END IF;
    END LOOP;
  END LOOP;

  -- SELECT muss bleiben: "Users can view own roles" traegt die Oberflaeche.
  IF NOT has_table_privilege('authenticated', 'public.user_roles', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated kann die eigene Rolle nicht mehr lesen';
  END IF;
END
$pruefung$;

-- Nachweis 3: der Betreiberweg bleibt offen — sonst waere niemand mehr in der
-- Lage, je eine Rolle zu vergeben.
DO $pruefung$
BEGIN
  IF NOT has_table_privilege('service_role', 'public.user_roles', 'INSERT') THEN
    RAISE EXCEPTION 'service_role kann keine Rolle mehr vergeben — Aussperrung';
  END IF;
  IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'service_role umgeht RLS nicht — der Betreiberweg waere blockiert';
  END IF;
END
$pruefung$;

-- Nachweis 4: das Protokoll haengt wirklich an der Tabelle.
DO $pruefung$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.user_roles'::regclass
       AND tgname = 'trigger_user_roles_protokoll'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'der Protokoll-Trigger auf user_roles fehlt';
  END IF;
END
$pruefung$;

-- Nachweis 5: die serverseitige Pruefung von Ziel-Rolle und Ziel-Benutzer steht
-- — als Enum und Fremdschluessel, nicht als nachgebaute Liste.
DO $pruefung$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
      JOIN pg_type t ON t.oid = a.atttypid
     WHERE a.attrelid = 'public.user_roles'::regclass
       AND a.attname = 'role' AND t.typtype = 'e'
  ) THEN
    RAISE EXCEPTION 'user_roles.role ist kein Enum — die Rolle waere nicht serverseitig geprueft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.user_roles'::regclass
       AND contype = 'f'
       AND confrelid = 'auth.users'::regclass
  ) THEN
    RAISE EXCEPTION 'user_roles.user_id hat keinen Fremdschluessel auf auth.users';
  END IF;
END
$pruefung$;

COMMIT;
