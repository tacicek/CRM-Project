-- ============================================================
-- Adım 5: RLS politikalarını company_members'a taşı
--
-- Önceki adımda oluşturulan is_company_member() fonksiyonu
-- kullanılarak tüm "companies.user_id = auth.uid()" tabanlı
-- politikalar, üyelik tablosu sorgusuyla değiştirilir.
--
-- Strateji:
--   1. Eski politikayı DROP IF EXISTS ile kaldır
--   2. is_company_member(company_id) kullanan yeni politikayı ekle
--   3. companies.user_id kolonu korunur (Adım 6'da frontend uyumlu hale gelir)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. companies tablosu
-- ────────────────────────────────────────────────────────────
-- Kullanıcı artık company_members üzerinden kendi firmasını görür.
-- INSERT: user_id hâlâ doldurulduğundan backfill çalışır; bırakıyoruz.
-- ⚠ Nihai politikalar aşağıdaki #26 bloğunda tanımlanır (admin kontrolü dahil).

DROP POLICY IF EXISTS "Companies can view their own data"    ON public.companies;
DROP POLICY IF EXISTS "Companies can update their own data"  ON public.companies;
DROP POLICY IF EXISTS "companies_owner_full_access"          ON public.companies;

-- ────────────────────────────────────────────────────────────
-- 2. company_services
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company owners can manage their services" ON public.company_services;

CREATE POLICY "company_services_manage_member"
  ON public.company_services FOR ALL
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 3. company_plz_coverage
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company owners can manage their PLZ coverage" ON public.company_plz_coverage;

CREATE POLICY "company_plz_coverage_manage_member"
  ON public.company_plz_coverage FOR ALL
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 4. lead_distributions
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can view their lead distributions"   ON public.lead_distributions;
DROP POLICY IF EXISTS "Companies can update their lead distributions" ON public.lead_distributions;

CREATE POLICY "lead_distributions_select_member"
  ON public.lead_distributions FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "lead_distributions_update_member"
  ON public.lead_distributions FOR UPDATE
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 5. leads — firma üyesi dağıtılmış lead'i görebilir
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can view leads distributed to them" ON public.leads;

CREATE POLICY "leads_select_via_distribution_member"
  ON public.leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lead_distributions ld
      WHERE ld.lead_id = leads.id
        AND is_company_member(ld.company_id)
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. token_transactions
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can view their token transactions"   ON public.token_transactions;
DROP POLICY IF EXISTS "Companies can insert their token transactions" ON public.token_transactions;

CREATE POLICY "token_transactions_select_member"
  ON public.token_transactions FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "token_transactions_insert_member"
  ON public.token_transactions FOR INSERT
  WITH CHECK (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 7. offers + offer_items
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can view their own offers"    ON public.offers;
DROP POLICY IF EXISTS "Companies can insert their own offers"  ON public.offers;
DROP POLICY IF EXISTS "Companies can update their own offers"  ON public.offers;
DROP POLICY IF EXISTS "Companies can delete their own offers"  ON public.offers;
DROP POLICY IF EXISTS "Companies can manage their offer items" ON public.offer_items;

CREATE POLICY "offers_select_member" ON public.offers FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "offers_insert_member" ON public.offers FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "offers_update_member" ON public.offers FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "offers_delete_member" ON public.offers FOR DELETE
  USING (is_company_member(company_id));

CREATE POLICY "offer_items_manage_member" ON public.offer_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_items.offer_id AND is_company_member(o.company_id)
    )
  );

-- ────────────────────────────────────────────────────────────
-- 8. manual_import_subscriptions + manual_imported_leads
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can view own subscription"   ON public.manual_import_subscriptions;
DROP POLICY IF EXISTS "Companies can manage own imported leads" ON public.manual_imported_leads;

CREATE POLICY "manual_import_subs_select_member"
  ON public.manual_import_subscriptions FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "manual_imported_leads_manage_member"
  ON public.manual_imported_leads FOR ALL
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 9. team_reminder_settings
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can manage their reminder settings" ON public.team_reminder_settings;

CREATE POLICY "team_reminder_settings_manage_member"
  ON public.team_reminder_settings FOR ALL
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 10. offer_settings
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can manage their offer settings" ON public.offer_settings;

CREATE POLICY "offer_settings_manage_member"
  ON public.offer_settings FOR ALL
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 11. agb_sections
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can manage their AGB sections" ON public.agb_sections;

CREATE POLICY "agb_sections_manage_member"
  ON public.agb_sections FOR ALL
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 12. team_members + appointments + team_availability
--     + appointment_reminders + appointment_history + team_resources
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can manage their team members"         ON public.team_members;
DROP POLICY IF EXISTS "Companies can manage their appointments"         ON public.appointments;
DROP POLICY IF EXISTS "Companies can manage their team availability"    ON public.team_availability;
DROP POLICY IF EXISTS "Companies can view their appointment reminders"  ON public.appointment_reminders;
DROP POLICY IF EXISTS "Companies can view their appointment history"    ON public.appointment_history;
DROP POLICY IF EXISTS "Companies can manage their resources"            ON public.team_resources;

CREATE POLICY "team_members_manage_member"
  ON public.team_members FOR ALL
  USING (is_company_member(company_id));

CREATE POLICY "appointments_manage_member"
  ON public.appointments FOR ALL
  USING (is_company_member(company_id));

CREATE POLICY "team_availability_manage_member"
  ON public.team_availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = team_availability.team_member_id
        AND is_company_member(tm.company_id)
    )
  );

CREATE POLICY "appointment_reminders_view_member"
  ON public.appointment_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_reminders.appointment_id
        AND is_company_member(a.company_id)
    )
  );

CREATE POLICY "appointment_history_view_member"
  ON public.appointment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_history.appointment_id
        AND is_company_member(a.company_id)
    )
  );

CREATE POLICY "team_resources_manage_member"
  ON public.team_resources FOR ALL
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 13. notifications
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can view their notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Companies can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Companies can delete their notifications" ON public.notifications;

CREATE POLICY "notifications_select_member"
  ON public.notifications FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "notifications_update_member"
  ON public.notifications FOR UPDATE
  USING (is_company_member(company_id));

CREATE POLICY "notifications_delete_member"
  ON public.notifications FOR DELETE
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 14. company_offer_templates (service_catalog templates)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can manage their templates" ON public.company_offer_templates;

CREATE POLICY "company_offer_templates_manage_member"
  ON public.company_offer_templates FOR ALL
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 15. company_service_items + leistung_templates + offer_leistungsuebersicht
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can manage their service items"              ON public.company_service_items;
DROP POLICY IF EXISTS "Companies can manage their templates"                  ON public.leistung_templates;
DROP POLICY IF EXISTS "Companies can manage their offer leistungsuebersicht"  ON public.offer_leistungsuebersicht;

CREATE POLICY "company_service_items_manage_member"
  ON public.company_service_items FOR ALL
  USING (is_company_member(company_id));

CREATE POLICY "leistung_templates_manage_member"
  ON public.leistung_templates FOR ALL
  USING (is_company_member(company_id));

CREATE POLICY "offer_leistungsuebersicht_manage_member"
  ON public.offer_leistungsuebersicht FOR ALL
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 16. umzugsbox_rentals
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can view their own box rentals"   ON public.umzugsbox_rentals;
DROP POLICY IF EXISTS "Companies can insert their own box rentals" ON public.umzugsbox_rentals;
DROP POLICY IF EXISTS "Companies can update their own box rentals" ON public.umzugsbox_rentals;
DROP POLICY IF EXISTS "Companies can delete their own box rentals" ON public.umzugsbox_rentals;

CREATE POLICY "umzugsbox_rentals_select_member" ON public.umzugsbox_rentals FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "umzugsbox_rentals_insert_member" ON public.umzugsbox_rentals FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "umzugsbox_rentals_update_member" ON public.umzugsbox_rentals FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "umzugsbox_rentals_delete_member" ON public.umzugsbox_rentals FOR DELETE
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 17. support_tickets + support_ticket_messages
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can view their tickets"        ON public.support_tickets;
DROP POLICY IF EXISTS "Companies can create tickets"            ON public.support_tickets;
DROP POLICY IF EXISTS "Companies can view ticket messages"      ON public.support_ticket_messages;
DROP POLICY IF EXISTS "Companies can create ticket messages"    ON public.support_ticket_messages;

CREATE POLICY "support_tickets_select_member"
  ON public.support_tickets FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "support_tickets_insert_member"
  ON public.support_tickets FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "support_ticket_messages_select_member"
  ON public.support_ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = support_ticket_messages.ticket_id
        AND is_company_member(st.company_id)
    )
  );

CREATE POLICY "support_ticket_messages_insert_member"
  ON public.support_ticket_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = support_ticket_messages.ticket_id
        AND is_company_member(st.company_id)
    )
  );

-- ────────────────────────────────────────────────────────────
-- 18. auftraege
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can manage their auftraege" ON public.auftraege;

CREATE POLICY "auftraege_manage_member"
  ON public.auftraege FOR ALL
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 19. company_pricing_configs
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_read_own_pricing"   ON public.company_pricing_configs;
DROP POLICY IF EXISTS "company_insert_own_pricing" ON public.company_pricing_configs;
DROP POLICY IF EXISTS "company_update_own_pricing" ON public.company_pricing_configs;
DROP POLICY IF EXISTS "company_delete_own_pricing" ON public.company_pricing_configs;

CREATE POLICY "company_pricing_configs_select_member" ON public.company_pricing_configs FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "company_pricing_configs_insert_member" ON public.company_pricing_configs FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "company_pricing_configs_update_member" ON public.company_pricing_configs FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "company_pricing_configs_delete_member" ON public.company_pricing_configs FOR DELETE
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 20. besichtigung schema (sessions, photos, videos, ai_analysis)
--     + storage policies remain service_role — only session lookup changes
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company users can access own sessions" ON besichtigung.sessions;
DROP POLICY IF EXISTS "Access photos through session"         ON besichtigung.photos;
DROP POLICY IF EXISTS "Access videos through session"         ON besichtigung.videos;
DROP POLICY IF EXISTS "Access analysis through session"       ON besichtigung.ai_analysis;

CREATE POLICY "besichtigung_sessions_member"
  ON besichtigung.sessions FOR ALL
  USING (is_company_member(company_id));

CREATE POLICY "besichtigung_photos_member"
  ON besichtigung.photos FOR ALL
  USING (
    session_id IN (
      SELECT id FROM besichtigung.sessions
      WHERE is_company_member(company_id)
    )
  );

CREATE POLICY "besichtigung_videos_member"
  ON besichtigung.videos FOR ALL
  USING (
    session_id IN (
      SELECT id FROM besichtigung.sessions
      WHERE is_company_member(company_id)
    )
  );

CREATE POLICY "besichtigung_ai_analysis_member"
  ON besichtigung.ai_analysis FOR ALL
  USING (
    session_id IN (
      SELECT id FROM besichtigung.sessions
      WHERE is_company_member(company_id)
    )
  );

-- ────────────────────────────────────────────────────────────
-- 21. quittungen
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "quittungen_company_select" ON public.quittungen;
DROP POLICY IF EXISTS "quittungen_company_insert" ON public.quittungen;
DROP POLICY IF EXISTS "quittungen_company_update" ON public.quittungen;
DROP POLICY IF EXISTS "quittungen_company_delete" ON public.quittungen;

CREATE POLICY "quittungen_select_member" ON public.quittungen FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "quittungen_insert_member" ON public.quittungen FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "quittungen_update_member" ON public.quittungen FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "quittungen_delete_member" ON public.quittungen FOR DELETE
  USING (is_company_member(company_id));

-- ────────────────────────────────────────────────────────────
-- 22. crm_subscriptions (if exists)
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_subscriptions'
  ) THEN
    DROP POLICY IF EXISTS "Companies can view own crm subscription" ON public.crm_subscriptions;
    EXECUTE 'CREATE POLICY "crm_subscriptions_select_member"
      ON public.crm_subscriptions FOR SELECT
      USING (is_company_member(company_id))';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 23. get_user_company_ids() helper — company_members kullanacak şekilde güncelle
--     Support tickets politikaları bunu kullandığından otomatik düzelir.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
$$;

-- ────────────────────────────────────────────────────────────
-- 24. support_tickets + support_ticket_messages — get_user_company_ids artık
--     company_members kullandığından politikalar geçerli; "view their tickets"
--     ve "create tickets" daha önce eklendi. Mevcut final policy isimleri:
--     "Companies can view their tickets", "Companies can create tickets",
--     "Can update tickets", "Can view ticket messages", "Can create ticket messages"
--     Bunlar get_user_company_ids() çağırdığından güncellenen fonksiyon yeterli.
-- (Ayrıca migration #17'de yazdığımız member-tabanlı politikalar silinmeli
--  çünkü son migration'da farklı isimler var — onları kaldıralım)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "support_tickets_select_member"           ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert_member"           ON public.support_tickets;
DROP POLICY IF EXISTS "support_ticket_messages_select_member"   ON public.support_ticket_messages;
DROP POLICY IF EXISTS "support_ticket_messages_insert_member"   ON public.support_ticket_messages;

-- ────────────────────────────────────────────────────────────
-- 25. leads — son güvenlik fix'indeki "leads_select_own_distributions"
--     politikasını company_members tabanlıyla değiştir
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leads_select_own_distributions"          ON public.leads;
DROP POLICY IF EXISTS "leads_select_via_distribution_member"    ON public.leads;

CREATE POLICY "leads_select_own_distributions"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.lead_distributions ld
      WHERE ld.lead_id = leads.id
        AND is_company_member(ld.company_id)
    )
  );

-- ────────────────────────────────────────────────────────────
-- 26. companies — "companies_owner_full_access" politikasını güncelle
--     (Bu Adım 5'teki #1 ile örtüşür; idempotent şekilde uygula)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "companies_owner_full_access"        ON public.companies;
DROP POLICY IF EXISTS "Companies can view their own data"  ON public.companies;
DROP POLICY IF EXISTS "companies_select_member"            ON public.companies;
DROP POLICY IF EXISTS "Companies can update their own data" ON public.companies;
DROP POLICY IF EXISTS "companies_update_member"            ON public.companies;

CREATE POLICY "companies_select_member"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    is_company_member(id)
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "companies_update_member"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (is_company_member(id));

-- ────────────────────────────────────────────────────────────
-- 27. subscription_payments
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can view their payments" ON public.subscription_payments;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_payments'
  ) THEN
    EXECUTE 'CREATE POLICY "subscription_payments_select_member"
      ON public.subscription_payments FOR SELECT
      USING (is_company_member(company_id))';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 28. offer_inventory_items + calculation_presets (moving_calculator)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Companies can manage their offer inventory items"  ON public.offer_inventory_items;
DROP POLICY IF EXISTS "Companies can manage their calculation presets"    ON public.calculation_presets;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'offer_inventory_items'
  ) THEN
    EXECUTE 'CREATE POLICY "offer_inventory_items_manage_member"
      ON public.offer_inventory_items FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.offers o
          WHERE o.id = offer_inventory_items.offer_id AND is_company_member(o.company_id)
        )
      )';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'calculation_presets'
  ) THEN
    EXECUTE 'CREATE POLICY "calculation_presets_manage_member"
      ON public.calculation_presets FOR ALL
      USING (is_company_member(company_id))';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 29. company_pricing_audit_log
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_read_own_audit" ON public.company_pricing_audit_log;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_pricing_audit_log'
  ) THEN
    EXECUTE 'CREATE POLICY "pricing_audit_select_member"
      ON public.company_pricing_audit_log FOR SELECT
      USING (is_company_member(company_id))';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 30. besichtigung storage (storage.objects)
--     Politikalar company_members üzerinden kontrol edilecek
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company users can upload to besichtigung"       ON storage.objects;
DROP POLICY IF EXISTS "Company users can read besichtigung uploads"    ON storage.objects;
DROP POLICY IF EXISTS "Company users can delete besichtigung uploads"  ON storage.objects;

CREATE POLICY "besichtigung_storage_upload_member"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'besichtigung'
    AND EXISTS (
      SELECT 1 FROM besichtigung.sessions s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND is_company_member(s.company_id)
    )
  );

CREATE POLICY "besichtigung_storage_read_member"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'besichtigung'
    AND EXISTS (
      SELECT 1 FROM besichtigung.sessions s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND is_company_member(s.company_id)
    )
  );

CREATE POLICY "besichtigung_storage_delete_member"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'besichtigung'
    AND EXISTS (
      SELECT 1 FROM besichtigung.sessions s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND is_company_member(s.company_id)
    )
  );

-- ────────────────────────────────────────────────────────────
-- Log
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Adım 5 tamamlandı: RLS politikaları company_members''a taşındı.';
END $$;
