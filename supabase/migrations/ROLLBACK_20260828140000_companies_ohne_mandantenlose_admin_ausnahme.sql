-- =============================================================================
-- ROLLBACK zu 20260828140000_companies_ohne_mandantenlose_admin_ausnahme.sql
-- =============================================================================
--
-- Stellt die vier mandantenlosen Admin-Policies und den `is_admin`-Zweig in
-- `companies_select_member` wieder her.
--
-- AUSDRUECKLICH: der wiederhergestellte Zustand ist der WEITERE. Danach gibt ein
-- einziger Eintrag in `user_roles` wieder SELECT, INSERT, UPDATE und DELETE auf
-- JEDE Firma. Diese Datei existiert, damit der Eingriff umkehrbar ist, nicht
-- weil der alte Zustand richtig waere.
-- =============================================================================

BEGIN;

CREATE POLICY "Admins can view all companies" ON public.companies
  FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can update all companies" ON public.companies
  FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert companies" ON public.companies
  FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete companies" ON public.companies
  FOR DELETE USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS companies_select_member ON public.companies;
CREATE POLICY companies_select_member ON public.companies
  FOR SELECT TO authenticated
  USING (is_company_member(id) OR is_admin(auth.uid()));

COMMIT;
