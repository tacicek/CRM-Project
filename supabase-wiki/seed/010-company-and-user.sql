-- Company, owner profile and membership for the wiki screenshot stack.
--
-- Every value here is synthetic and obviously so: `example.test` is a reserved TLD that
-- can never resolve, phone numbers are in the +41 79 000 00 xx block, and the company is
-- named "Test Umzug AG". Nothing in this file could be mistaken for a real customer.
--
-- Requires two psql variables, both set by scripts/wiki-db.sh:
--   :user_id  the uuid GoTrue assigned to the synthetic operator
--   :anchor   the date all other fixture dates are written relative to
--
-- The company id is fixed so the shot manifest can link to detail routes by uuid. The
-- e0000000-… band is reserved for this stack and never collides with supabase-test's
-- fixtures, which use a different band.

\set company_id '''e0000000-0000-4000-a000-000000000001'''

INSERT INTO public.profiles (id, first_name, last_name)
VALUES (:'user_id', 'Anna', 'Beispiel')
ON CONFLICT (id) DO UPDATE
  SET first_name = EXCLUDED.first_name,
      last_name  = EXCLUDED.last_name;

-- is_verified = true, otherwise FirmaLayout renders its "Verifizierung ausstehend" gate
-- instead of the app and every screenshot would show that gate.
--
-- Secrets stay NULL on purpose: with no Resend/Twilio credentials there is nothing for a
-- Settings screenshot to leak, and nothing for any flow to send with.
INSERT INTO public.companies (
  id, user_id, company_name, legal_name, email, phone,
  street, house_number, plz, city, canton,
  is_verified, is_active, default_language, website, slogan
)
VALUES (
  :company_id, :'user_id', 'Test Umzug AG', 'Test Umzug AG', 'kontakt@example.test',
  '+41 79 000 00 10',
  'Teststrasse', '4', '8000', 'Zürich', 'ZH',
  true, true, 'de', 'https://example.test', 'Umzug, Reinigung und mehr'
)
ON CONFLICT (id) DO UPDATE
  SET company_name     = EXCLUDED.company_name,
      email            = EXCLUDED.email,
      is_verified      = true,
      default_language = EXCLUDED.default_language;

-- The owner membership row. A trigger on companies also creates this, but writing it
-- explicitly makes the fixture a standalone assertion: if the trigger ever stops firing,
-- this file still produces a working stack and the test suite catches the trigger
-- separately.
INSERT INTO public.company_members (company_id, user_id, role)
VALUES (:company_id, :'user_id', 'owner')
ON CONFLICT DO NOTHING;

-- Deliberately NO row in public.user_roles.
--
-- is_admin() reads that table. An admin row would switch on platform-admin policies and
-- admin-only UI, and the manual documents what an ordinary company owner sees. Adding a
-- role here would silently change what every screenshot shows.
