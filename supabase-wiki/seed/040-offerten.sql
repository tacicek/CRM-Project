-- Offers in every state the manual has to show, plus a real version pair and a Nachtrag.
--
-- 020-dashboard.sql already created three offers (sent / viewed / accepted). This file
-- adds the states those three do not cover — a draft, a rejected one, line items, a
-- superseded version pair and an amendment — and it creates the version and the
-- amendment through the SAME routines the buttons call:
--
--   create_offer_revision()   ← the "Neue Version" button
--   create_offer_amendment()  ← the "Nachtrag erstellen" button
--
-- Writing those rows by hand would bypass the triggers that set locked_at,
-- superseded_at, version_number and offer_series_id, so the fixture would show
-- combinations the application can never produce.
--
-- Requires :user_id and :anchor from scripts/wiki-db.sh.

\set company_id '''e0000000-0000-4000-a000-000000000001'''

-- --- Line items for the existing offers -------------------------------------------
-- Without items the detail page shows an empty Positionen table, and the list cannot
-- show "nach Aufwand" for a rate-based position.
INSERT INTO public.offer_items (
  id, offer_id, description, quantity, unit, unit_price, amount_basis, "position"
)
VALUES
  ('e0000000-0000-4000-b100-000000000001', 'e0000000-0000-4000-c000-000000000001',
   'Umzug 3.5-Zimmer-Wohnung, inkl. Möbelmontage', 1, 'Pauschal', 1900.00, 'fixed', 1),
  ('e0000000-0000-4000-b100-000000000002', 'e0000000-0000-4000-c000-000000000001',
   'Verpackungsmaterial (Kartons, Folie)', 1, 'Pauschal', 180.00, 'fixed', 2),
  ('e0000000-0000-4000-b100-000000000003', 'e0000000-0000-4000-c000-000000000001',
   'Entsorgung Sperrgut', 1, 'Pauschal', 220.00, 'fixed', 3),

  ('e0000000-0000-4000-b100-000000000004', 'e0000000-0000-4000-c000-000000000002',
   'Endreinigung mit Abnahmegarantie', 1, 'Pauschal', 690.00, 'fixed', 1),
  ('e0000000-0000-4000-b100-000000000005', 'e0000000-0000-4000-c000-000000000002',
   'Zusatzarbeiten nach Aufwand', 1, 'Std.', 95.00, 'rate', 2),

  ('e0000000-0000-4000-b100-000000000006', 'e0000000-0000-4000-c000-000000000003',
   'Déménagement 4 pièces', 1, 'Forfait', 1420.00, 'fixed', 1),
  ('e0000000-0000-4000-b100-000000000007', 'e0000000-0000-4000-c000-000000000003',
   'Matériel d''emballage', 1, 'Forfait', 200.00, 'fixed', 2)
ON CONFLICT (id) DO NOTHING;

-- --- A draft and a rejected offer ---------------------------------------------------
-- Together with the three from 020-dashboard.sql this makes all five DISPLAYED statuses
-- visible in one screenshot: Entwurf, Gesendet, Angesehen, Angenommen, Abgelehnt.
INSERT INTO public.offers (
  id, company_id, lead_id, offer_series_id, version_number, status, language,
  customer_first_name, customer_last_name, customer_email, customer_phone,
  title, subtotal, vat_rate, valid_until, created_at, price_model
)
VALUES
  ('e0000000-0000-4000-c000-000000000004', :company_id, 'e0000000-0000-4000-b000-000000000004',
   'e0000000-0000-4000-c000-000000000004', 1, 'draft', 'de',
   'Nina', 'Muster', 'nina.muster@example.test', '+41 79 000 00 24',
   'Entsorgung Kellerabteil', 640.00, 8.10, :'anchor'::date + 30,
   :'anchor'::timestamptz - interval '4 hours', 'pauschal'),

  ('e0000000-0000-4000-c000-000000000005', :company_id, 'e0000000-0000-4000-b000-000000000005',
   'e0000000-0000-4000-c000-000000000005', 1, 'rejected', 'de',
   'Peter', 'Beispiel', 'peter.beispiel@example.test', '+41 79 000 00 25',
   'Malerarbeiten Wohnzimmer', 1250.00, 8.10, :'anchor'::date + 3,
   :'anchor'::timestamptz - interval '12 days', 'pauschal')
ON CONFLICT (id) DO NOTHING;

UPDATE public.offers
   SET sent_at     = :'anchor'::timestamptz - interval '12 days',
       viewed_at   = :'anchor'::timestamptz - interval '11 days',
       rejected_at = :'anchor'::timestamptz - interval '10 days',
       customer_response_note = 'Danke, wir haben uns anders entschieden.'
 WHERE id = 'e0000000-0000-4000-c000-000000000005';

-- Mark the "viewed" offer as actually viewed, so the Aktivitäten timeline has a
-- "Vom Kunden angesehen" entry to point at.
UPDATE public.offers
   SET viewed_at = :'anchor'::timestamptz - interval '20 hours'
 WHERE id = 'e0000000-0000-4000-c000-000000000002'
   AND viewed_at IS NULL;

INSERT INTO public.offer_items (id, offer_id, description, quantity, unit, unit_price, amount_basis, "position")
VALUES
  ('e0000000-0000-4000-b100-000000000008', 'e0000000-0000-4000-c000-000000000004',
   'Räumung Kellerabteil inkl. Abtransport', 1, 'Pauschal', 640.00, 'fixed', 1),
  ('e0000000-0000-4000-b100-000000000009', 'e0000000-0000-4000-c000-000000000005',
   'Malerarbeiten Wohnzimmer, 2 Anstriche', 1, 'Pauschal', 1250.00, 'fixed', 1)
ON CONFLICT (id) DO NOTHING;

-- --- A version pair and a Nachtrag, through the real routines ------------------------
-- Both RPCs are SECURITY DEFINER but check company membership through auth.uid(), so the
-- seed has to speak as the owner — exactly as PostgREST does for a logged-in operator.
BEGIN;
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', :'user_id', 'role', 'authenticated')::text,
                  true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_sent_offer uuid := 'e0000000-0000-4000-c000-000000000001';  -- Max Muster, status 'sent'
  v_accepted   uuid := 'e0000000-0000-4000-c000-000000000003';  -- Luc Exemple, 'accepted'
  v_new_ver    uuid;
  v_amendment  uuid;
BEGIN
  -- Both routines are guarded and refuse to run twice — create_offer_revision raises
  -- "Zu dieser Offerte gibt es bereits eine neuere Version". That guard is correct, so
  -- the fixture checks first instead of trying and failing: `npm run wiki:db:reseed`
  -- has to be re-runnable without a full schema rebuild.

  -- A second version of the SENT offer. This is what the "Neue Version" button does:
  -- the old row keeps its content and gets superseded_at, the new one starts as a draft
  -- with the same offer number and version_number = 2.
  IF NOT EXISTS (SELECT 1 FROM public.offers WHERE supersedes_offer_id = v_sent_offer) THEN
    v_new_ver := (public.create_offer_revision(v_sent_offer, 'Kunde wünscht Klaviertransport zusätzlich')
                  ->> 'neue_offerte_id')::uuid;
  END IF;

  -- A Nachtrag on the ACCEPTED offer. create_offer_amendment refuses anything that is not
  -- accepted, which is the rule the article states.
  IF NOT EXISTS (SELECT 1 FROM public.offer_amendments WHERE offer_id = v_accepted) THEN
    v_amendment := (public.create_offer_amendment(
                      v_accepted, 'Nachtrag', 'Zusätzliche Möbelmontage vor Ort vereinbart')
                    ->> 'nachtrag_id')::uuid;

    -- Give the Nachtrag a position so the page is not an empty form.
    INSERT INTO public.offer_amendment_items (amendment_id, description, quantity, unit, unit_price, "position")
    VALUES (v_amendment, 'Möbelmontage vor Ort', 3, 'Std.', 95.00, 1);
  END IF;
END $$;

RESET ROLE;
COMMIT;
