-- =============================================
-- FIX FUNCTION SEARCH PATH MUTABLE WARNINGS
-- These functions don't have search_path set, which is a security risk
-- =============================================

DO $$
DECLARE
  func_name TEXT;
  func_names TEXT[] := ARRAY[
    'increment_blog_view_count',
    'update_umzugsbox_rentals_updated_at',
    'archive_returned_boxes',
    'cleanup_archived_boxes',
    'get_total_box_quantity',
    'atomic_accept_lead',
    'get_box_rental_stats',
    'update_landing_pages_updated_at',
    'generate_offer_number',
    'get_archivable_leads',
    'get_archivable_offers',
    'get_archive_statistics',
    'create_archive_log',
    'update_archive_timestamp',
    'is_crm_enabled',
    'get_role_level',
    'generate_umzug_nummer',
    'update_umzug_updated_at',
    'extend_subscription',
    'deactivate_expired_subscriptions',
    'generate_raeumung_nummer',
    'update_raeumung_updated_at',
    'get_companies_needing_reminders',
    'update_website_settings_timestamp',
    'generate_klavier_nummer',
    'update_klaviertransport_updated_at',
    'generate_moebellift_nummer',
    'update_moebellift_updated_at',
    'update_ticket_timestamp',
    'is_support_admin',
    'get_user_company_ids',
    'generate_auftrag_nummer',
    'handle_updated_at',
    'get_auftraege_needing_reminders',
    'update_manual_import_sub_updated_at',
    'notify_admin_new_company',
    'deactivate_manual_import',
    'increment_manual_import_count',
    'activate_manual_import',
    'insert_manual_imported_lead'
  ];
  func_record RECORD;
BEGIN
  -- Loop through each function name
  FOREACH func_name IN ARRAY func_names
  LOOP
    -- Find all overloads of the function and update search_path
    FOR func_record IN 
      SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = func_name
    LOOP
      BEGIN
        EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', 
                       func_record.proname, func_record.args);
        RAISE NOTICE 'Updated search_path for function: %.%(%)', 
                     'public', func_record.proname, func_record.args;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not update function %.%(%): %', 
                     'public', func_record.proname, func_record.args, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END $$;

-- =============================================
-- NOTE: RLS Policy Always True warnings
-- These are INTENTIONAL for public form submissions:
-- - cookie_consent_log: Public can log consent
-- - klaviertransport_anfragen: Public form submission
-- - landing_page_analytics: Analytics tracking
-- - leads: Public form submission
-- - manual_imported_leads: Import functionality
-- - moebellift_anfragen: Public form submission
-- - raeumung_anfragen: Public form submission
-- - umzug_anfragen: Public form submission
--
-- These tables intentionally allow INSERT from anonymous users
-- because they handle public-facing form submissions.
-- =============================================

-- =============================================
-- NOTE: Leaked Password Protection
-- This is an Auth setting that should be enabled in Supabase Dashboard:
-- Settings > Authentication > Password Protection > Enable leaked password protection
-- =============================================
