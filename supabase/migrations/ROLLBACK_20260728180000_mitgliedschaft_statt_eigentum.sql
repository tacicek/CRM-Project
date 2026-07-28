-- =============================================================================
-- ROLLBACK für 20260728180000_mitgliedschaft_statt_eigentum.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach sehen eingeladene Mitglieder wieder NICHTS in Rechnungen,
--    Checklisten, Leistungsübersichten, Ressourcen, Offerten-/Erinnerungs-
--    einstellungen und Preis-Voreinstellungen — und zwar als leere Seite, nicht
--    als Fehler. Nur der Eigentümer arbeitet dann noch mit diesen Bereichen.
--
--    Weniger drastisch, falls nur EIN Bereich stört: die beiden Policies dieser
--    einen Tabelle zurückbauen und den Rest stehen lassen.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS rechnungen_company_select ON public.rechnungen;
CREATE POLICY rechnungen_company_select ON public.rechnungen FOR SELECT
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS rechnungen_company_insert ON public.rechnungen;
CREATE POLICY rechnungen_company_insert ON public.rechnungen FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS rechnungen_company_update ON public.rechnungen;
CREATE POLICY rechnungen_company_update ON public.rechnungen FOR UPDATE
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS rechnungen_company_delete ON public.rechnungen;
CREATE POLICY rechnungen_company_delete ON public.rechnungen FOR DELETE
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS checklist_templates_select_member      ON public.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_write_owner_admin  ON public.checklist_templates;
CREATE POLICY "Companies can manage their templates" ON public.checklist_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies
                 WHERE companies.id = checklist_templates.company_id AND companies.user_id = auth.uid()));

DROP POLICY IF EXISTS leistungsuebersicht_templates_select_member     ON public.leistungsuebersicht_templates;
DROP POLICY IF EXISTS leistungsuebersicht_templates_write_owner_admin ON public.leistungsuebersicht_templates;
CREATE POLICY "Companies can manage their templates" ON public.leistungsuebersicht_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies
                 WHERE companies.id = leistungsuebersicht_templates.company_id AND companies.user_id = auth.uid()));

DROP POLICY IF EXISTS firma_resources_select_member     ON public.firma_resources;
DROP POLICY IF EXISTS firma_resources_write_owner_admin ON public.firma_resources;
CREATE POLICY "Companies can manage their resources" ON public.firma_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies
                 WHERE companies.id = firma_resources.company_id AND companies.user_id = auth.uid()));

DROP POLICY IF EXISTS company_offer_settings_select_member     ON public.company_offer_settings;
DROP POLICY IF EXISTS company_offer_settings_write_owner_admin ON public.company_offer_settings;
CREATE POLICY "Companies can manage their offer settings" ON public.company_offer_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies
                 WHERE companies.id = company_offer_settings.company_id AND companies.user_id = auth.uid()));

DROP POLICY IF EXISTS company_reminder_settings_select_member     ON public.company_reminder_settings;
DROP POLICY IF EXISTS company_reminder_settings_write_owner_admin ON public.company_reminder_settings;
CREATE POLICY "Companies can manage their reminder settings" ON public.company_reminder_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies
                 WHERE companies.id = company_reminder_settings.company_id AND companies.user_id = auth.uid()));

DROP POLICY IF EXISTS moving_calculation_presets_select_member     ON public.moving_calculation_presets;
DROP POLICY IF EXISTS moving_calculation_presets_write_owner_admin ON public.moving_calculation_presets;
CREATE POLICY "Companies can manage their calculation presets" ON public.moving_calculation_presets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies
                 WHERE companies.id = moving_calculation_presets.company_id AND companies.user_id = auth.uid()));

COMMIT;
