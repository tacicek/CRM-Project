-- =============================================================================
-- Sieben Tabellen haengen noch am Eigentum statt an der Mitgliedschaft
-- =============================================================================
--
-- BEFUND
-- 20260514000001 hat die RLS des CRM von `companies.user_id` auf
-- `company_members` umgestellt — aber nicht ueberall. Diese sieben Tabellen
-- pruefen weiterhin, ob die Firma dem Benutzer GEHOERT:
--
--   rechnungen                     (4 Policies)
--   checklist_templates            (1 ALL-Policy)
--   leistungsuebersicht_templates  (1)
--   firma_resources                (1)
--   company_offer_settings         (1)
--   company_reminder_settings      (1)
--   moving_calculation_presets     (1)
--
-- Nachgewiesen mit einem eingeladenen Mitglied (Rolle `member`, nicht
-- Eigentuemer) gegen die Produktion, in einer zurueckgerollten Transaktion:
--
--   sichtbare Anfragen    59     <- Mitgliedschaftsmodell, funktioniert
--   sichtbare Offerten    47     <- dito
--   sichtbare Kunden      59     <- dito
--   sichtbare Rechnungen   0     <- Eigentumsmodell, obwohl 17 existieren
--
-- Dasselbe gilt fuer Checklisten, Leistungsuebersichten, Ressourcen,
-- Preis-Voreinstellungen und die Erinnerungseinstellungen: ein eingeladenes
-- Mitglied sieht dort nichts. Nicht als Fehler — als leere Seite.
--
-- Heute faellt es nicht auf, weil beide Firmen genau ein Mitglied haben und das
-- ist der Eigentuemer. Es faellt bei der ersten Einladung auf.
--
-- ABHILFE (entschieden: lesen alle, schreiben owner|admin)
-- Wer im Betrieb mitarbeitet, muss die Grundlagen seiner Arbeit SEHEN — den
-- Leistungskatalog, die Checkliste, die Ressourcen, die Rechnungen. Was die
-- Firma KONFIGURIERT (Vorlagen, Voreinstellungen, Erinnerungen), aendern
-- Eigentuemer und Administratoren.
--
-- Rechnungen sind dabei die begruendete Ausnahme: eine Rechnung zu schreiben ist
-- die taegliche Arbeit, nicht Konfiguration. INSERT und UPDATE bleiben deshalb
-- allen Mitgliedern offen, nur DELETE ist owner|admin — zusaetzlich zur
-- bestehenden Sperre aus 20260727130000, die Geloeschtes ohnehin auf Entwuerfe
-- begrenzt.
--
-- BEWUSST NICHT GEAENDERT: `api_keys`. Das sind Zugangsdaten, keine
-- Betriebsdaten. Die Bewegung dieses Projekts geht in die andere Richtung —
-- 20260727150000 hat die Drittanbieter-Schluessel nach `company_secrets`
-- ausgelagert, wo GAR KEINE Policy existiert und nur der Service-Role-Key
-- herankommt. `api_keys` weiter zu oeffnen waere ein Schritt zurueck.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Rechnungen
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS rechnungen_company_select ON public.rechnungen;
CREATE POLICY rechnungen_company_select
  ON public.rechnungen FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS rechnungen_company_insert ON public.rechnungen;
CREATE POLICY rechnungen_company_insert
  ON public.rechnungen FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

-- WITH CHECK ist hier nicht optional: ohne ihn prueft Postgres die NEUE Zeile
-- erneut gegen USING, und ein Wechsel der company_id waere erlaubt.
DROP POLICY IF EXISTS rechnungen_company_update ON public.rechnungen;
CREATE POLICY rechnungen_company_update
  ON public.rechnungen FOR UPDATE
  TO authenticated
  USING      (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS rechnungen_company_delete ON public.rechnungen;
CREATE POLICY rechnungen_company_delete
  ON public.rechnungen FOR DELETE
  TO authenticated
  USING (public.is_company_role(company_id, ARRAY['owner', 'admin']));

-- -----------------------------------------------------------------------------
-- 2. Konfigurationstabellen: lesen alle, schreiben owner|admin
--
-- Die bisherige ALL-Policy wird in zwei geteilt. Eine ALL-Policy mit
-- unterschiedlichen Rechten fuer Lesen und Schreiben laesst sich nicht
-- formulieren.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Companies can manage their templates" ON public.checklist_templates;
CREATE POLICY checklist_templates_select_member
  ON public.checklist_templates FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY checklist_templates_write_owner_admin
  ON public.checklist_templates FOR ALL
  TO authenticated
  USING      (public.is_company_role(company_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Companies can manage their templates" ON public.leistungsuebersicht_templates;
CREATE POLICY leistungsuebersicht_templates_select_member
  ON public.leistungsuebersicht_templates FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY leistungsuebersicht_templates_write_owner_admin
  ON public.leistungsuebersicht_templates FOR ALL
  TO authenticated
  USING      (public.is_company_role(company_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Companies can manage their resources" ON public.firma_resources;
CREATE POLICY firma_resources_select_member
  ON public.firma_resources FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY firma_resources_write_owner_admin
  ON public.firma_resources FOR ALL
  TO authenticated
  USING      (public.is_company_role(company_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Companies can manage their offer settings" ON public.company_offer_settings;
CREATE POLICY company_offer_settings_select_member
  ON public.company_offer_settings FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY company_offer_settings_write_owner_admin
  ON public.company_offer_settings FOR ALL
  TO authenticated
  USING      (public.is_company_role(company_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Companies can manage their reminder settings" ON public.company_reminder_settings;
CREATE POLICY company_reminder_settings_select_member
  ON public.company_reminder_settings FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY company_reminder_settings_write_owner_admin
  ON public.company_reminder_settings FOR ALL
  TO authenticated
  USING      (public.is_company_role(company_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Companies can manage their calculation presets" ON public.moving_calculation_presets;
CREATE POLICY moving_calculation_presets_select_member
  ON public.moving_calculation_presets FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY moving_calculation_presets_write_owner_admin
  ON public.moving_calculation_presets FOR ALL
  TO authenticated
  USING      (public.is_company_role(company_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.is_company_role(company_id, ARRAY['owner', 'admin']));

COMMIT;
