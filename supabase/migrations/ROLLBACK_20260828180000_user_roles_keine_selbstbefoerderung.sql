-- Ruecknahme zu 20260828180000.
--
-- Stellt `Admins can manage roles` wieder her und gibt Browserclients das
-- Schreibrecht auf user_roles zurueck. Damit kann ein `moderator` wieder jede
-- Rolle vergeben, sich selbst eingeschlossen. Das ist der UNSICHERE Zustand.

BEGIN;

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO anon;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

DROP TRIGGER IF EXISTS trigger_user_roles_protokoll ON public.user_roles;
DROP FUNCTION IF EXISTS public.user_roles_protokollieren();

COMMIT;
