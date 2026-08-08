-- Customers, invoices and the payment ledger.
--
-- Covers the states the Kunden / Finanzen / Rechnungen articles have to show:
-- a duplicate pair, an unpaid invoice, an overdue invoice, a PARTIALLY paid invoice, a
-- fully paid one, a draft, plus a reversed payment (Storno) in the ledger.
--
-- Payments go through public.record_payment(), the same routine the "Zahlung erfassen"
-- dialog calls. Writing rows by hand would bypass the triggers that maintain
-- rechnungen.paid_total and flip the status — the fixture would then show combinations
-- the application can never actually produce, which is worse than no fixture.
--
-- Requires :user_id and :anchor from scripts/wiki-db.sh.

\set company_id '''e0000000-0000-4000-a000-000000000001'''

-- --- Customers -------------------------------------------------------------------
--
-- IMPORTANT: the five customers matching the seeded leads ALREADY EXIST by the time this
-- file runs. A database trigger creates a customer from every lead, which is exactly how
-- the application behaves — there is no "new customer" button anywhere in the UI, and the
-- customer list says so in its empty state. Inserting them again violates
-- `customers_company_email_uniq`.
--
-- So this file adds only what a lead cannot produce: a second record that collides with
-- an existing one (to give the customer card a real duplicate banner) and a company-type
-- customer. Everything else is looked up by email rather than pinned to a fixed uuid,
-- because the trigger — not this file — decides those ids.
INSERT INTO public.customers (
  company_id, display_name, customer_type, salutation,
  first_name, last_name, company_name,
  primary_email, primary_phone, language, status, created_via,
  first_seen_at, created_at
)
VALUES
  -- Same phone as Max Muster, different e-mail. duplicate_candidates() keys on the
  -- normalized phone, so the customer card shows "Möglicherweise dieselbe Person".
  (:company_id, 'M. Muster', 'person', 'Herr',
   'M.', 'Muster', NULL,
   'm.muster@example.test', '+41 79 000 00 21', 'de', 'active', 'resolve_rpc',
   :'anchor'::timestamptz - interval '3 days', :'anchor'::timestamptz - interval '3 days'),

  -- A company customer, so the list shows the "Firma" badge and the Personen/Firmen
  -- filters both return something.
  (:company_id, 'Beispiel Bau GmbH', 'company', 'Firma',
   NULL, NULL, 'Beispiel Bau GmbH',
   'buero@example.test', '+41 79 000 00 24', 'de', 'active', 'resolve_rpc',
   :'anchor'::timestamptz - interval '200 days', :'anchor'::timestamptz - interval '200 days')
ON CONFLICT DO NOTHING;

-- --- Invoices ---------------------------------------------------------------------
-- `open_amount` is GENERATED (gesamttotal - paid_total - credited_total); never write it.
-- Statuses here are the pre-payment ones only: the triggers move rows to 'bezahlt' when
-- the allocations cover them, which is exactly the behaviour the article describes.
-- Resolve the trigger-created customers by e-mail. Their ids belong to the trigger,
-- not to this file, so they must never be hardcoded.
\set kunde_max    '(SELECT id FROM public.customers WHERE company_id = ' :company_id ' AND primary_email = ''max.muster@example.test'')'
\set kunde_sara   '(SELECT id FROM public.customers WHERE company_id = ' :company_id ' AND primary_email = ''sara.beispiel@example.test'')'
\set kunde_luc    '(SELECT id FROM public.customers WHERE company_id = ' :company_id ' AND primary_email = ''luc.exemple@example.test'')'
\set kunde_firma  '(SELECT id FROM public.customers WHERE company_id = ' :company_id ' AND primary_email = ''buero@example.test'')'

INSERT INTO public.rechnungen (
  id, company_id, customer_id, rechnung_nr, customer_name, customer_email,
  datum, faellig_am, status, language, gesamttotal, mwst_satz, notiz
)
VALUES
  -- Overdue: due 12 days before the anchor.
  ('e0000000-0000-4000-a100-000000000001', :company_id, :kunde_max,
   'RE-2026-0001', 'Max Muster', 'max.muster@example.test',
   :'anchor'::date - 42, :'anchor'::date - 12, 'ueberfaellig', 'de', 2480.00, 8.10, NULL),

  -- Sent, not yet due — this one receives a PARTIAL payment below.
  ('e0000000-0000-4000-a100-000000000002', :company_id, :kunde_sara,
   'RE-2026-0002', 'Sara Beispiel', 'sara.beispiel@example.test',
   :'anchor'::date - 8, :'anchor'::date + 22, 'versendet', 'de', 890.00, 8.10, NULL),

  -- Sent — gets paid in full below, so it ends up 'bezahlt' via the trigger.
  ('e0000000-0000-4000-a100-000000000003', :company_id, :kunde_luc,
   'RE-2026-0003', 'Luc Exemple', 'luc.exemple@example.test',
   :'anchor'::date - 30, :'anchor'::date, 'versendet', 'fr', 1750.00, 8.10, NULL),

  -- Draft: excluded from "Offen", and the only status the list allows to be deleted.
  ('e0000000-0000-4000-a100-000000000004', :company_id, :kunde_firma,
   'RE-2026-0004', 'Beispiel Bau GmbH', 'buero@example.test',
   :'anchor'::date, :'anchor'::date + 30, 'entwurf', 'de', 3200.00, 8.10, 'Wartet auf Freigabe.')
ON CONFLICT (id) DO NOTHING;

-- --- Payments, through the real routine -------------------------------------------
-- record_payment() writes the payment, its allocation, and lets the triggers update
-- paid_total / open_amount / status. Same path as the dialog.
--
-- The anchor goes through a GUC because psql's :variables are substituted by the client
-- and are not visible inside a DO block's body.
SELECT set_config('wiki.anchor', :'anchor', false);

-- record_payment() refuses anyone who is not owner or admin of the company — it raises
-- "Nur Eigentuemer oder Administrator koennen Zahlungen erfassen." That check is real and
-- server-side, and the articles document it, so the fixture must satisfy it rather than
-- work around it. Impersonate the seeded owner exactly as PostgREST would: set the JWT
-- claims the policies read, and switch to the `authenticated` role.
BEGIN;
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', :'user_id', 'role', 'authenticated')::text,
                  true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_company uuid := 'e0000000-0000-4000-a000-000000000001';
  v_anchor  date := current_setting('wiki.anchor')::date;
  v_wrong   uuid;
BEGIN
  -- Full payment on RE-2026-0003 → trigger flips it to 'bezahlt'.
  PERFORM public.record_payment(
    v_company, 1750.00, v_anchor - 5, 'bank',
    (SELECT id FROM public.customers WHERE company_id=v_company AND primary_email='luc.exemple@example.test'), 'QR 21 00000 00000 00003', NULL,
    '[{"rechnung_id":"e0000000-0000-4000-a100-000000000003","amount":1750.00}]'::jsonb);

  -- PARTIAL payment on RE-2026-0002: 400 of 890. The open-items row then reads
  -- "400.00 von 890.00 bezahlt", which is what the article points at.
  PERFORM public.record_payment(
    v_company, 400.00, v_anchor - 2, 'twint',
    (SELECT id FROM public.customers WHERE company_id=v_company AND primary_email='sara.beispiel@example.test'), 'TWINT 4471', NULL,
    '[{"rechnung_id":"e0000000-0000-4000-a100-000000000002","amount":400.00}]'::jsonb);

  -- A payment booked in error, then reversed — so the ledger shows a real Storno pair
  -- and the article can show what a correction looks like without inventing one.
  --
  -- record_payment returns JSONB, not a uuid:
  --   {"payment_id": "...", "amount": .., "allocated": .., "unallocated": ..}
  -- The unallocated amount here is the whole 120.00, because no allocation was passed —
  -- which is also what an unmatched payment looks like in the ledger.
  v_wrong := (public.record_payment(
    v_company, 120.00, v_anchor - 6, 'cash',
    (SELECT id FROM public.customers WHERE company_id=v_company AND primary_email='max.muster@example.test'), 'Beleg 88', NULL, '[]'::jsonb
  ) ->> 'payment_id')::uuid;
  PERFORM public.reverse_payment(v_wrong, 'Falscher Kunde erfasst');
END $$;

-- --- Anschriften und Einsatzorte ---------------------------------------------------
-- Die Kundenkarte trennt zwei Begriffe, und der Screenshot soll beide zeigen:
--   customer_addresses  wo jemand wohnt und wohin die Rechnung geht
--   service_locations   wo gearbeitet wird, mit Stockwerk / Lift / Zugang
--
-- Bewusst NICHT flaechendeckend: Luc bekommt keine Anschrift, damit der
-- Leerzustand "Adresse hinzufuegen" ebenfalls im Bild vorkommt.
INSERT INTO public.customer_addresses (
  company_id, customer_id, address_type, label, address_raw, plz, city, is_primary, notes
)
VALUES
  (:company_id, :kunde_max, 'correspondence', 'Wohnung',
   'Seestrasse 42, 8002 Zürich', '8002', 'Zürich', TRUE, NULL),
  (:company_id, :kunde_sara, 'correspondence', NULL,
   'Bahnhofweg 7, 3011 Bern', '3011', 'Bern', TRUE, NULL),
  (:company_id, :kunde_firma, 'correspondence', 'Empfang',
   'Industriestrasse 12, 8404 Winterthur', '8404', 'Winterthur', TRUE, NULL),
  -- Eine eigene Rechnungsadresse: genau der Fall, für den es die zweite Art gibt.
  (:company_id, :kunde_firma, 'billing', 'Buchhaltung',
   'Postfach 340, 8401 Winterthur', '8401', 'Winterthur', TRUE,
   'Rechnungen bitte ausschliesslich per Post.');

INSERT INTO public.service_locations (
  company_id, customer_id, kind, label, address_raw, plz, city,
  floor, has_elevator, parking_note, access_note, rooms, area_m2
)
VALUES
  (:company_id, :kunde_max, 'from', 'Auszug',
   'Seestrasse 42, 8002 Zürich', '8002', 'Zürich',
   '4. OG', FALSE, 'Halteverbot nötig, Bewilligung liegt vor.',
   'Schlüssel bei der Nachbarin, Klingel Meier.', 3.5, 82.00),
  (:company_id, :kunde_max, 'to', 'Einzug',
   'Bergweg 5, 8032 Zürich', '8032', 'Zürich',
   'EG', TRUE, 'Zwei Plätze in der Tiefgarage.', NULL, 4.5, 110.00),
  (:company_id, :kunde_firma, 'object', 'Büroetage',
   'Industriestrasse 12, 8404 Winterthur', '8404', 'Winterthur',
   '2. OG', TRUE, 'Anlieferung hinten.', 'Badge beim Empfang abholen.', NULL, 240.00);

-- --- Eine offene Aufgabe und ein offener Fall ---------------------------------------
-- Ohne sie bliebe der Achtungsstreifen leer, und der Screenshot zeigte genau den
-- Zustand, den der Artikel NICHT erklärt.
INSERT INTO public.crm_tasks (
  company_id, customer_id, title, description, task_type, priority, status, due_at
)
VALUES
  (:company_id, :kunde_max, 'Rückruf wegen Liftreservation',
   'Hauswartung hat sich noch nicht gemeldet.', 'call', 'high', 'open',
   :'anchor'::date - 1);

INSERT INTO public.customer_cases (
  company_id, customer_id, case_type, title, description, status, priority, reported_by
)
VALUES
  (:company_id, :kunde_max, 'damage', 'Kratzer am Esstisch',
   'Beim Abstellen im Treppenhaus entstanden. Fotos folgen.', 'in_arbeit', 'normal', 'kunde');

RESET ROLE;
COMMIT;
