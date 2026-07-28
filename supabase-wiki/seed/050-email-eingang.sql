-- Inbound e-mails for the "E-Mail-Eingang" review queue.
--
-- Covers all four tabs the screen offers, so the article can point at each one:
--   needs_review · lead_created · rejected · failed
--
-- `body_preview` is deliberately a short plain-text excerpt, not a full message. That is
-- what the application actually stores — the original HTML is never kept — and the
-- article says so. A fixture with a full mail body would illustrate a feature that does
-- not exist.
--
-- Requires :anchor from scripts/wiki-db.sh.

\set company_id '''e0000000-0000-4000-a000-000000000001'''

-- --- Enquiries that do NOT have an offer yet ----------------------------------------
--
-- 040-offerten.sql gave every one of the five original leads an offer, which emptied
-- both the "Alle" tab on /firma/anfragen (it lists only offer-less enquiries) and the
-- dashboard's "Neue Anfragen" tile. These three restore the normal working state: fresh
-- enquiries waiting to be quoted, which is exactly what the articles describe.
--
-- `source` is spelled out because the column default 'website' violates its own CHECK.
INSERT INTO public.leads (
  id, company_id, source, status, language, sales_stage,
  customer_first_name, customer_last_name, customer_email, customer_phone,
  service_type, from_plz, from_city, to_plz, to_city,
  from_rooms, from_living_space_m2, moving_date, created_at
)
VALUES
  ('e0000000-0000-4000-b000-000000000011', :company_id, 'email', 'verified', 'de', 'new',
   'Familie', 'Muster', 'familie.muster@example.test', '+41 79 000 00 31',
   'umzug_privat', '8000', 'Zürich', '8400', 'Winterthur',
   4, 96, :'anchor'::date + 32, :'anchor'::timestamptz - interval '3 hours'),

  ('e0000000-0000-4000-b000-000000000012', :company_id, 'web_form', 'verified', 'de', 'qualifying',
   'Tobias', 'Beispiel', 'tobias.beispiel@example.test', '+41 79 000 00 32',
   'reinigung', '6000', 'Luzern', NULL, NULL,
   3, 78, :'anchor'::date + 12, :'anchor'::timestamptz - interval '9 hours'),

  ('e0000000-0000-4000-b000-000000000013', :company_id, 'manual', 'verified', 'de', 'inspection',
   'Rita', 'Muster', 'rita.muster@example.test', '+41 79 000 00 33',
   'klaviertransport', '3000', 'Bern', '3600', 'Thun',
   NULL, NULL, :'anchor'::date + 18, :'anchor'::timestamptz - interval '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.inbound_emails (
  id, company_id, provider, provider_message_id,
  from_email, from_name, to_emails, subject, body_preview,
  processing_status, classification, confidence_score,
  extracted_data, received_at, processed_at, processing_attempts, opened_at
)
VALUES
  -- 1) Waiting for review, high confidence. This is what the sidebar badge counts.
  ('e0000000-0000-4000-c100-000000000001', :company_id, 'resend', 'msg-wiki-0001',
   'familie.muster@example.test', 'Familie Muster',
   ARRAY['anfragen@example.test'],
   'Umzugsanfrage 4-Zimmer-Wohnung, Ende August',
   E'Guten Tag\n\nWir ziehen Ende August von Zürich nach Winterthur um. Es ist eine\n4-Zimmer-Wohnung im 3. Stock, mit Lift. Können Sie uns eine Offerte machen?\n\nFreundliche Grüsse\nFamilie Muster\n+41 79 000 00 31',
   'needs_review', 'umzug', 0.92,
   '{"customer_first_name":"","customer_last_name":"Muster","customer_email":"familie.muster@example.test","customer_phone":"+41 79 000 00 31","service_type":"umzug_privat","from_city":"Zürich","from_plz":"8000","to_city":"Winterthur","to_plz":"8400","rooms":4,"language":"de"}'::jsonb,
   :'anchor'::timestamptz - interval '3 hours', :'anchor'::timestamptz - interval '3 hours', 1, NULL),

  -- 2) Waiting for review, LOW confidence and a missing field — the case the article
  --    warns about, where the operator must fill in the gap before approving.
  ('e0000000-0000-4000-c100-000000000002', :company_id, 'resend', 'msg-wiki-0002',
   's.beispiel@example.test', 'S. Beispiel',
   ARRAY['anfragen@example.test'],
   'Frage',
   E'Hallo, brauche noch eine Endreinigung für die Wohnungsabgabe.\nWas kostet das etwa? Danke.',
   'needs_review', 'reinigung', 0.48,
   '{"customer_first_name":"","customer_last_name":"Beispiel","customer_email":"s.beispiel@example.test","customer_phone":"","service_type":"reinigung","from_city":"","from_plz":"","language":"de"}'::jsonb,
   :'anchor'::timestamptz - interval '1 day', :'anchor'::timestamptz - interval '1 day', 1, NULL),

  -- 3) Already turned into an enquiry — links to the seeded lead.
  ('e0000000-0000-4000-c100-000000000003', :company_id, 'resend', 'msg-wiki-0003',
   'luc.exemple@example.test', 'Luc Exemple',
   ARRAY['anfragen@example.test'],
   'Demande de déménagement Genève – Lausanne',
   E'Bonjour,\n\nNous déménageons de Genève à Lausanne fin septembre.\nPouvez-vous nous faire une offre ?\n\nCordialement\nLuc Exemple',
   'lead_created', 'umzug', 0.95,
   '{"customer_first_name":"Luc","customer_last_name":"Exemple","customer_email":"luc.exemple@example.test","service_type":"umzug_privat","from_city":"Genève","from_plz":"1200","to_city":"Lausanne","to_plz":"1000","language":"fr"}'::jsonb,
   :'anchor'::timestamptz - interval '6 days', :'anchor'::timestamptz - interval '6 days', 1,
   :'anchor'::timestamptz - interval '6 days'),

  -- 4) Rejected by hand — shows the "Manuell abgelehnt" reason in the detail view.
  ('e0000000-0000-4000-c100-000000000004', :company_id, 'resend', 'msg-wiki-0004',
   'newsletter@example.test', 'Branchenverzeichnis',
   ARRAY['anfragen@example.test'],
   'Ihr Eintrag im Branchenverzeichnis',
   E'Sichern Sie sich jetzt den Premium-Eintrag für nur CHF 490 pro Jahr.',
   'rejected', NULL, 0.10, NULL,
   :'anchor'::timestamptz - interval '2 days', :'anchor'::timestamptz - interval '2 days', 1,
   :'anchor'::timestamptz - interval '2 days'),

  -- 5) Failed with an error and two attempts — the only state that offers
  --    "Erneut verarbeiten" without an extraction form.
  ('e0000000-0000-4000-c100-000000000005', :company_id, 'resend', 'msg-wiki-0005',
   'kontakt@example.test', NULL,
   ARRAY['anfragen@example.test'],
   'Weitergeleitet: Anfrage',
   E'(Weiterleitung ohne Textinhalt)',
   'failed', NULL, NULL, NULL,
   :'anchor'::timestamptz - interval '4 days', :'anchor'::timestamptz - interval '4 days', 2,
   :'anchor'::timestamptz - interval '4 days')
ON CONFLICT (id) DO NOTHING;

-- Link the already-imported mail to the French lead, so "Zur Anfrage" has a target and
-- the row shows the connection the article describes.
UPDATE public.inbound_emails
   SET lead_id = (SELECT id FROM public.leads
                   WHERE company_id = :company_id
                     AND customer_email = 'luc.exemple@example.test'
                   LIMIT 1)
 WHERE id = 'e0000000-0000-4000-c100-000000000003';

UPDATE public.inbound_emails
   SET last_error = 'Kein auswertbarer Textinhalt gefunden.',
       rejection_reason = 'Manuell abgelehnt'
 WHERE id = 'e0000000-0000-4000-c100-000000000005';

UPDATE public.inbound_emails
   SET rejection_reason = 'Manuell abgelehnt'
 WHERE id = 'e0000000-0000-4000-c100-000000000004';
