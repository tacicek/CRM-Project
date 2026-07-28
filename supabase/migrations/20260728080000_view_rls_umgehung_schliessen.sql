-- =============================================================================
-- Zwei Views umgehen RLS und liegen fuer anon offen
-- =============================================================================
--
-- BEFUND
-- Eine View ohne `security_invoker` laeuft mit den Rechten ihres Eigentuemers.
-- Eigentuemer ist hier `postgres` — RLS der Basistabellen greift also NICHT.
-- Zwei Views stehen so da und sind zugleich fuer `anon` freigegeben, also fuer
-- den Schluessel, der in jedem ausgelieferten Browser-Bundle liegt.
--
-- `offer_details` — nachgewiesen, nicht vermutet. Als Rolle anon:
--
--     SELECT count(*) FROM offers;          -->  0   (RLS greift)
--     SELECT count(*) FROM offer_details;   --> 54   (RLS umgangen)
--
-- Und ueber HTTP mit dem oeffentlichen anon-Key:
--
--     GET /rest/v1/offer_details?select=customer_email,customer_phone
--     [{"customer_email":"…@gmail.com","customer_phone":"+41 76 …"}, …]
--
-- Die View verbindet offers, companies, leads und team_members. Damit lagen
-- Name, E-Mail, Telefon, Auszugs- und Einzugsadresse aller 54 Offerten offen —
-- ohne Anmeldung.
--
-- `virtual_besichtigung_sessions` — derselbe Aufbau ueber besichtigung.sessions
-- (Name, E-Mail, Telefon, Adresse). Heute 0 Zeilen, also noch kein Abfluss; die
-- Luecke oeffnet sich mit der ersten Sitzung.
--
-- Warum das durchrutschte: 20260119150000_fix_security_definer_views.sql hat
-- genau dieses Problem fuer vier Views behoben (appointment_summary,
-- offer_moving_details, pending_box_pickups, pending_team_reminders). Diese
-- beiden waren nicht dabei.
--
-- ABHILFE — zwei Schichten
--   1. security_invoker = on: die View rechnet mit den Rechten des Aufrufers,
--      RLS der Basistabellen greift wieder.
--   2. anon verliert jedes Recht auf beiden Views. Auch ohne Punkt 1 waere damit
--      nichts mehr abrufbar; beides zusammen, weil eine kuenftige GRANT-Zeile
--      Punkt 2 wieder aufheben koennte (das Repo verteilt an einer Stelle
--      pauschal Rechte, siehe supabase-test/baseline/grants.sql).
--
-- Kein Bruch fuer die Anwendung: `offer_details` hat keinen Aufrufer im Repo,
-- `virtual_besichtigung_sessions` wird von FirmaLayout als ANGEMELDETER Benutzer
-- gelesen (besichtigung.sessions traegt die Policy is_company_member) und von
-- complete-besichtigung mit dem Service-Role-Key.
--
-- ⚠️ Der Schluessel war oeffentlich abrufbar. Ob jemand die Daten geholt hat,
--    laesst sich nur an den Zugriffsprotokollen von Kong/PostgREST ablesen.
-- =============================================================================

BEGIN;

ALTER VIEW public.offer_details                  SET (security_invoker = on);
ALTER VIEW public.virtual_besichtigung_sessions  SET (security_invoker = on);

REVOKE ALL ON public.offer_details                 FROM anon;
REVOKE ALL ON public.virtual_besichtigung_sessions FROM anon;

COMMENT ON VIEW public.offer_details IS
  'Offerte mit Firma, Lead und Betreuer. security_invoker = on — ohne das laeuft '
  'die View als postgres und umgeht RLS. anon hat hier nichts verloren.';

COMMENT ON VIEW public.virtual_besichtigung_sessions IS
  'Oeffentliche Sicht auf besichtigung.sessions fuer die Firmenoberflaeche. '
  'security_invoker = on, damit die Policy is_company_member der Basistabelle greift.';

COMMIT;
