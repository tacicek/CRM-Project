-- Work orders, team members and a fuller calendar week.
--
-- Covers the states the Auftrag / Kalender articles point at:
--   geplant · bestaetigt · in_bearbeitung · abgeschlossen · storniert
--   plus an overdue one, so the coral banner and the "Überfällig" badge appear.
--
-- Appointments get several types and statuses on purpose — including a COMPLETED and a
-- CANCELLED one. Those two are hidden by the calendar's default filter, which is exactly
-- the behaviour the article warns about; the screenshot then shows the honest default.
--
-- Requires :anchor from scripts/wiki-db.sh.

\set company_id '''e0000000-0000-4000-a000-000000000001'''

-- --- Team ---------------------------------------------------------------------------
-- Only members WITH an e-mail can be picked as team leader in the Auftrag modal, so both
-- get one. The colour drives the event tiles in the calendar.
INSERT INTO public.team_members (
  id, company_id, first_name, last_name, email, phone, role, is_active, color_code
)
VALUES
  ('e0000000-0000-4000-d100-000000000001', :company_id, 'Marco', 'Muster',
   'marco.muster@example.test', '+41 79 000 00 41', 'Teamleiter', true, '#10B981'),
  ('e0000000-0000-4000-d100-000000000002', :company_id, 'Elena', 'Beispiel',
   'elena.beispiel@example.test', '+41 79 000 00 42', 'Mitarbeiterin', true, '#8B5CF6')
ON CONFLICT (id) DO NOTHING;

-- --- Work orders --------------------------------------------------------------------
-- `auftrag_nummer` is NOT NULL and has no default here, so the fixture supplies it.
INSERT INTO public.auftraege (
  id, company_id, offer_id, auftrag_nummer, title, customer_name, customer_phone,
  customer_email, scheduled_date, scheduled_time, estimated_duration_minutes,
  from_address, to_address, status, team_leader_id
)
VALUES
  -- Today, confirmed — fills the "Heute" tile and gets the coral "Heute" badge.
  ('e0000000-0000-4000-e100-000000000001', :company_id, 'e0000000-0000-4000-c000-000000000003',
   'AU-2026-0001', 'Déménagement Genève – Lausanne', 'Luc Exemple', '+41 79 000 00 23',
   'luc.exemple@example.test', :'anchor'::date, '08:00', 480,
   'Rue du Test 4, 1200 Genève', 'Avenue Exemple 9, 1000 Lausanne',
   'bestaetigt', 'e0000000-0000-4000-d100-000000000001'),

  -- Tomorrow, planned — fills the "Morgen" tile.
  ('e0000000-0000-4000-e100-000000000002', :company_id, NULL,
   'AU-2026-0002', 'Reinigung Winterthur', 'Sara Beispiel', '+41 79 000 00 22',
   'sara.beispiel@example.test', :'anchor'::date + 1, '13:00', 240,
   'Teststrasse 11, 8400 Winterthur', NULL,
   'geplant', 'e0000000-0000-4000-d100-000000000002'),

  -- Running right now.
  ('e0000000-0000-4000-e100-000000000003', :company_id, NULL,
   'AU-2026-0003', 'Entsorgung Kellerabteil', 'Nina Muster', '+41 79 000 00 24',
   'nina.muster@example.test', :'anchor'::date, '09:30', 180,
   'Beispielweg 2, 6000 Luzern', NULL,
   'in_bearbeitung', 'e0000000-0000-4000-d100-000000000001'),

  -- Finished last week — this is the only status that offers "Rechnung erstellen".
  ('e0000000-0000-4000-e100-000000000004', :company_id, 'e0000000-0000-4000-c000-000000000001',
   'AU-2026-0004', 'Umzug Zürich – Bern', 'Max Muster', '+41 79 000 00 21',
   'max.muster@example.test', :'anchor'::date - 7, '07:30', 570,
   'Teststrasse 4, 8000 Zürich', 'Musterweg 18, 3000 Bern',
   'abgeschlossen', 'e0000000-0000-4000-d100-000000000001'),

  -- Overdue: in the past and neither finished nor cancelled → coral banner + badge.
  ('e0000000-0000-4000-e100-000000000005', :company_id, NULL,
   'AU-2026-0005', 'Malerarbeiten Wohnzimmer', 'Peter Beispiel', '+41 79 000 00 25',
   'peter.beispiel@example.test', :'anchor'::date - 3, '08:00', 480,
   'Beispielgasse 7, 9000 St. Gallen', NULL,
   'geplant', NULL),

  -- Cancelled — reachable only through the "Alle" tab, which the article says.
  ('e0000000-0000-4000-e100-000000000006', :company_id, NULL,
   'AU-2026-0006', 'Lagerung Container', 'Tobias Beispiel', '+41 79 000 00 32',
   'tobias.beispiel@example.test', :'anchor'::date + 5, '10:00', 120,
   'Lagerweg 3, 6000 Luzern', NULL,
   'storniert', NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE public.auftraege
   SET completed_at = :'anchor'::timestamptz - interval '7 days',
       completion_notes = 'Alles nach Plan, keine Beanstandungen.'
 WHERE id = 'e0000000-0000-4000-e100-000000000004';

-- --- More calendar entries ------------------------------------------------------------
-- Several types so the type filter has something to filter, plus one completed and one
-- cancelled appointment. Those two are HIDDEN by the calendar's default status filter —
-- that is the real behaviour, and the article explains how to reveal them.
INSERT INTO public.appointments (
  id, company_id, appointment_type, status,
  appointment_date, start_time, end_time, title,
  location_city, customer_first_name, customer_last_name, customer_email,
  assigned_team_member_ids, description
)
VALUES
  ('e0000000-0000-4000-d000-000000000011', :company_id, 'service', 'confirmed',
   :'anchor'::date + 1, '13:00', '17:00', 'Reinigung Beispiel', 'Winterthur',
   'Sara', 'Beispiel', 'sara.beispiel@example.test',
   ARRAY['e0000000-0000-4000-d100-000000000002']::uuid[], 'Endreinigung mit Abnahme.'),

  ('e0000000-0000-4000-d000-000000000012', :company_id, 'besichtigung', 'pending',
   :'anchor'::date + 2, '10:00', '10:45', 'Besichtigung Muster', 'Zürich',
   'Familie', 'Muster', 'familie.muster@example.test',
   ARRAY['e0000000-0000-4000-d100-000000000001']::uuid[], NULL),

  ('e0000000-0000-4000-d000-000000000013', :company_id, 'follow_up', 'pending',
   :'anchor'::date + 3, '16:00', '16:30', 'Nachfassen Offerte 10002', 'Winterthur',
   'Sara', 'Beispiel', 'sara.beispiel@example.test', NULL, 'Nach Reaktion auf die Offerte fragen.'),

  ('e0000000-0000-4000-d000-000000000014', :company_id, 'blocked', 'confirmed',
   :'anchor'::date + 4, '00:00', '23:59', 'Betriebsferien', NULL,
   NULL, NULL, NULL, NULL, 'Ganzes Team abwesend.'),

  -- Hidden by the default filter until the operator ticks "Abgeschlossen".
  ('e0000000-0000-4000-d000-000000000015', :company_id, 'service', 'completed',
   :'anchor'::date - 7, '07:30', '17:00', 'Umzug Muster', 'Zürich',
   'Max', 'Muster', 'max.muster@example.test',
   ARRAY['e0000000-0000-4000-d100-000000000001']::uuid[], NULL),

  -- Hidden by the default filter until the operator ticks "Abgesagt".
  ('e0000000-0000-4000-d000-000000000016', :company_id, 'service', 'cancelled',
   :'anchor'::date + 5, '10:00', '12:00', 'Lagerung Container', 'Luzern',
   'Tobias', 'Beispiel', 'tobias.beispiel@example.test', NULL, NULL)
ON CONFLICT (id) DO NOTHING;
