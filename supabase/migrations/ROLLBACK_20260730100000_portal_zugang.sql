-- =============================================================================
-- ROLLBACK für 20260730100000_portal_zugang.sql — NICHT als Migration ausführen.
--
-- ⚠️ Sperrt jeden Kunden sofort aus dem Portal aus. Alle Sitzungen sind weg,
--    alle noch nicht eingelösten Links sind wertlos. Wiederherstellen lässt
--    sich das NICHT: die Tabellen enthalten nur Abdrücke, aus denen sich kein
--    Token zurückrechnen lässt — jeder Kunde braucht einen neuen Link.
--
--    Reihenfolge: erst 20260730120000, dann 20260730110000, dann diese Datei.
-- =============================================================================

BEGIN;

SELECT cron.unschedule('portal-cleanup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'portal-cleanup');

DROP FUNCTION IF EXISTS public.portal_cleanup();
DROP FUNCTION IF EXISTS public.portal_revoke_access(UUID);
DROP FUNCTION IF EXISTS public.portal_touch_session(TEXT);
DROP FUNCTION IF EXISTS public.portal_session_customer(TEXT);
DROP FUNCTION IF EXISTS public.portal_redeem_magic_link(TEXT);
DROP FUNCTION IF EXISTS public.portal_create_magic_link(UUID, INTEGER);

DROP TABLE IF EXISTS public.portal_sessions;
DROP TABLE IF EXISTS public.portal_magic_links;

COMMIT;
