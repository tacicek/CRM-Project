-- =============================================================================
-- ROLLBACK für 20260727120000_company_role_guard.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Dieser Rückbau ÖFFNET die Rechteausweitung wieder: ohne WITH CHECK kann
--    jedes Mitglied `UPDATE companies SET user_id = <sich selbst>` schreiben und
--    darüber an `rechnungen` und `api_keys` gelangen. Nur ausführen, wenn die
--    neue Policy nachweislich einen Betriebsablauf blockiert — und dann zeitnah
--    eine korrigierte Fassung nachziehen.
--
--    Weniger drastische Zwischenschritte, bevor man hierher greift:
--      • Nur die Rolle lockern:  USING/WITH CHECK auf is_company_member(id)
--        ändern, Trigger BEHALTEN (Ausbruchspfad bleibt zu).
--      • Einzelne Person zum `admin` machen statt `member`.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS companies_update_owner_admin ON public.companies;

CREATE POLICY companies_update_member
  ON public.companies FOR UPDATE
  TO authenticated
  USING (public.is_company_member(id));

DROP TRIGGER IF EXISTS trigger_companies_guard_ownership ON public.companies;
DROP FUNCTION IF EXISTS public.guard_company_ownership();

-- is_company_role() bleibt bestehen: andere Policies können sie inzwischen
-- benutzen, und eine ungenutzte Funktion schadet nicht.

COMMIT;
