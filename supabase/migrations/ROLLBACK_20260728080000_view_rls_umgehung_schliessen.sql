-- =============================================================================
-- ROLLBACK für 20260728080000_view_rls_umgehung_schliessen.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Dieser Rückbau ÖFFNET eine nachgewiesene Datenpanne wieder. Danach liefert
--
--     GET /rest/v1/offer_details?select=customer_email,customer_phone
--
--    mit dem öffentlichen anon-Schlüssel — der in jedem Browser-Bundle liegt —
--    Name, E-Mail, Telefon und Adressen sämtlicher Offerten. Ohne Anmeldung.
--
--    Es gibt keinen betrieblichen Grund dafür. Sollte eine Auswertung die View
--    brauchen, ist der richtige Weg ein GRANT an `authenticated` (oder eine
--    SECURITY-DEFINER-Funktion mit Firmenprüfung), NICHT das Zurückdrehen von
--    security_invoker.
-- =============================================================================

BEGIN;

ALTER VIEW public.offer_details                  SET (security_invoker = off);
ALTER VIEW public.virtual_besichtigung_sessions  SET (security_invoker = off);

GRANT SELECT ON public.offer_details                 TO anon;
GRANT SELECT ON public.virtual_besichtigung_sessions TO anon;

COMMIT;
