-- Requests, offers and appointments — enough for every tile and list on /firma to hold
-- real numbers instead of zeros.
--
-- Dates are written relative to :anchor rather than hardcoded. This is not cosmetic:
-- pages such as Aufgaben build their "overdue" filter from the *browser* clock but
-- Postgres evaluates it, and the dashboard's "today" window is computed client-side.
-- Pinning fixture dates to a fixed calendar day would eventually put the data on one
-- side of "now" and the labels on the other, producing screenshots that contradict
-- themselves. Anchoring keeps both sides on the same clock.
--
-- Requires :anchor (a date) from scripts/wiki-db.sh.

\set company_id '''e0000000-0000-4000-a000-000000000001'''

-- --- Requests --------------------------------------------------------------------
-- `source` must be spelled out: the column DEFAULT is 'website', which is not in the
-- leads_source_check allow-list, so an INSERT that omits it fails.
INSERT INTO public.leads (
  id, company_id, source, status, language,
  customer_first_name, customer_last_name, customer_email, customer_phone,
  service_type, from_plz, from_city, to_plz, to_city,
  distance_km, estimated_duration_minutes, moving_date, created_at
)
VALUES
  ('e0000000-0000-4000-b000-000000000001', :company_id, 'manual', 'verified', 'de',
   'Max', 'Muster', 'max.muster@example.test', '+41 79 000 00 21',
   'umzug', '8000', 'Zürich', '3000', 'Bern',
   122, 480, :'anchor'::date + 21, :'anchor'::timestamptz - interval '2 days'),

  ('e0000000-0000-4000-b000-000000000002', :company_id, 'web_form', 'verified', 'de',
   'Sara', 'Beispiel', 'sara.beispiel@example.test', '+41 79 000 00 22',
   'reinigung', '8400', 'Winterthur', NULL, NULL,
   NULL, 240, :'anchor'::date + 9, :'anchor'::timestamptz - interval '1 day'),

  ('e0000000-0000-4000-b000-000000000003', :company_id, 'email', 'verified', 'fr',
   'Luc', 'Exemple', 'luc.exemple@example.test', '+41 79 000 00 23',
   'umzug', '1200', 'Genève', '1000', 'Lausanne',
   62, 300, :'anchor'::date + 30, :'anchor'::timestamptz - interval '5 hours'),

  ('e0000000-0000-4000-b000-000000000004', :company_id, 'manual', 'verified', 'de',
   'Nina', 'Muster', 'nina.muster@example.test', '+41 79 000 00 24',
   'entsorgung', '6000', 'Luzern', NULL, NULL,
   NULL, 180, :'anchor'::date + 5, :'anchor'::timestamptz - interval '3 hours'),

  ('e0000000-0000-4000-b000-000000000005', :company_id, 'web_form', 'verified', 'de',
   'Peter', 'Beispiel', 'peter.beispiel@example.test', '+41 79 000 00 25',
   'malerarbeit', '9000', 'St. Gallen', NULL, NULL,
   NULL, 600, :'anchor'::date + 45, :'anchor'::timestamptz - interval '1 hour')
ON CONFLICT (id) DO NOTHING;

-- --- Offers ----------------------------------------------------------------------
-- Two are `sent`/`viewed` so the dashboard's "wartet auf Antwort" tile is non-zero, and
-- three of the five requests are left without an offer so the "offene Anfragen" tile is
-- non-zero too. offer_series_id is NOT NULL and identifies the version chain; for a
-- first version it equals the offer's own id.
--
-- Only `subtotal` and `vat_rate` are written: `vat_amount` and `total` are GENERATED
-- columns, so Postgres computes them and rejects any attempt to supply a value. That is
-- also why the totals in the screenshots are guaranteed to be arithmetically consistent.
INSERT INTO public.offers (
  id, company_id, lead_id, offer_series_id, version_number, status, language,
  customer_first_name, customer_last_name, customer_email, customer_phone,
  title, subtotal, vat_rate, valid_until, created_at, sent_at
)
VALUES
  ('e0000000-0000-4000-c000-000000000001', :company_id, 'e0000000-0000-4000-b000-000000000001',
   'e0000000-0000-4000-c000-000000000001', 1, 'sent', 'de',
   'Max', 'Muster', 'max.muster@example.test', '+41 79 000 00 21',
   'Umzug Zürich – Bern', 2300.00, 8.10, :'anchor'::date + 14,
   :'anchor'::timestamptz - interval '2 days', :'anchor'::timestamptz - interval '2 days'),

  ('e0000000-0000-4000-c000-000000000002', :company_id, 'e0000000-0000-4000-b000-000000000002',
   'e0000000-0000-4000-c000-000000000002', 1, 'viewed', 'de',
   'Sara', 'Beispiel', 'sara.beispiel@example.test', '+41 79 000 00 22',
   'Reinigung mit Abnahmegarantie', 820.00, 8.10, :'anchor'::date + 10,
   :'anchor'::timestamptz - interval '1 day', :'anchor'::timestamptz - interval '1 day'),

  ('e0000000-0000-4000-c000-000000000003', :company_id, 'e0000000-0000-4000-b000-000000000003',
   'e0000000-0000-4000-c000-000000000003', 1, 'accepted', 'fr',
   'Luc', 'Exemple', 'luc.exemple@example.test', '+41 79 000 00 23',
   'Déménagement Genève – Lausanne', 1620.00, 8.10, :'anchor'::date + 20,
   :'anchor'::timestamptz - interval '6 days', :'anchor'::timestamptz - interval '6 days')
ON CONFLICT (id) DO NOTHING;

-- --- Appointments ----------------------------------------------------------------
-- One service job today (so "Termine heute" has content), one later this month (so the
-- monthly counter is > 1), and one inspection.
INSERT INTO public.appointments (
  id, company_id, offer_id, appointment_type, status,
  appointment_date, start_time, end_time, title,
  location_city, customer_first_name, customer_last_name, customer_email
)
VALUES
  ('e0000000-0000-4000-d000-000000000001', :company_id, 'e0000000-0000-4000-c000-000000000003',
   'service', 'confirmed',
   :'anchor'::date, '08:00', '16:00', 'Déménagement Exemple', 'Genève', 'Luc', 'Exemple',
   'luc.exemple@example.test'),

  ('e0000000-0000-4000-d000-000000000002', :company_id, NULL,
   'besichtigung', 'confirmed',
   :'anchor'::date, '17:30', '18:15', 'Besichtigung Muster', 'Zürich', 'Max', 'Muster',
   'max.muster@example.test'),

  ('e0000000-0000-4000-d000-000000000003', :company_id, 'e0000000-0000-4000-c000-000000000001',
   'service', 'confirmed',
   :'anchor'::date + 21, '07:30', '17:00', 'Umzug Muster', 'Zürich', 'Max', 'Muster',
   'max.muster@example.test')
ON CONFLICT (id) DO NOTHING;

-- --- Notifications ---------------------------------------------------------------
-- Gives the header bell a real unread count, which the navigation article documents.
INSERT INTO public.notifications (
  id, company_id, type, title, body, read, created_at
)
VALUES
  ('e0000000-0000-4000-e000-000000000001', :company_id, 'offer_viewed',
   'Offerte angesehen', 'Sara Beispiel hat die Offerte geöffnet.', false,
   :'anchor'::timestamptz - interval '4 hours'),

  ('e0000000-0000-4000-e000-000000000002', :company_id, 'appointment',
   'Termin bestätigt', 'Der Termin am Morgen wurde bestätigt.', false,
   :'anchor'::timestamptz - interval '1 day')
ON CONFLICT (id) DO NOTHING;
