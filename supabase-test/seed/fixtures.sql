-- Deterministic, synthetic two-tenant fixtures for local integration tests.
-- Inserted as the DB superuser (RLS bypassed) — this is SETUP only. Every
-- ASSERTION query in tests/assertions.sql runs as `anon` or `authenticated`
-- with a specific user's JWT claims, never as superuser/service_role.
--
-- Synthetic data only: @example.test (reserved TLD), +4179000000x, Teststrasse.
-- Fixed UUIDs → deterministic, collision-free across parallel/repeat runs.

begin;

-- Auth users (the JWT subjects). Minimal columns; the rest default.
insert into auth.users (id, aud, role, email, is_sso_user, is_anonymous)
values
  ('a0000000-0000-4000-8000-000000000001','authenticated','authenticated','owner-a@example.test', false, false),
  ('b0000000-0000-4000-8000-000000000002','authenticated','authenticated','owner-b@example.test', false, false)
on conflict (id) do nothing;

-- Companies (owner via companies.user_id).
insert into companies (id, company_name, email, city, plz, user_id)
values
  ('a0000000-0000-4000-8000-0000000000c1','Test Umzug AG','firma-a@example.test','Zürich','8000','a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-0000000000c2','Test Reinigung GmbH','firma-b@example.test','Zürich','8000','b0000000-0000-4000-8000-000000000002');

-- Membership (member path for leads/offers policies).
insert into company_members (company_id, user_id, role)
values
  ('a0000000-0000-4000-8000-0000000000c1','a0000000-0000-4000-8000-000000000001','owner'),
  ('b0000000-0000-4000-8000-0000000000c2','b0000000-0000-4000-8000-000000000002','owner');

-- Leads (one per tenant). `source` set explicitly: the prod column default
-- ('website') violates leads_source_check — a latent schema inconsistency the
-- baseline faithfully preserves; real inserts always pass a valid source.
insert into leads (id, company_id, customer_first_name, customer_last_name, customer_email, customer_phone, from_city, from_plz, service_type, language, source, status)
values
  ('11110000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-0000000000c1','Max','Mustermann','kunde-a@example.test','+41790000001','Zürich','8000','umzug_privat','de','manual','verified'),
  ('22220000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-0000000000c2','Erika','Musterfrau','kunde-b@example.test','+41790000002','Zürich','8000','reinigung','de','manual','verified');

-- Offers (token-bearing; one per tenant).
insert into offers (id, company_id, customer_first_name, customer_last_name, customer_email, title, access_token, language, status)
values
  ('33330000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-0000000000c1','Max','Mustermann','kunde-a@example.test','Offerte A','tok_a_0000000000000000000000000000','de','sent'),
  ('33330000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-0000000000c2','Erika','Musterfrau','kunde-b@example.test','Offerte B','tok_b_0000000000000000000000000000','de','sent');

insert into offer_items (id, offer_id, description, amount_basis, position)
values ('44440000-0000-4000-8000-000000000001','33330000-0000-4000-8000-000000000001','Umzugsservice','fixed',1);

-- Auftrag → Rechnung / Quittung (tenant A chain).
insert into auftraege (id, company_id, offer_id, lead_id, auftrag_nummer, customer_name, title, scheduled_date)
values ('55550000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-0000000000c1','33330000-0000-4000-8000-000000000001','11110000-0000-4000-8000-000000000001','A-2026-0001','Max Mustermann','Auftrag A','2026-02-01');

insert into rechnungen (id, company_id, auftrag_id, offer_id, customer_name, faellig_am, datum, language)
values ('66660000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-0000000000c1','55550000-0000-4000-8000-000000000001','33330000-0000-4000-8000-000000000001','Max Mustermann','2026-03-01','2026-02-01','de');

insert into quittungen (id, company_id, auftrag_id, offer_id, customer_name, datum, language)
values ('77770000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-0000000000c1','55550000-0000-4000-8000-000000000001','33330000-0000-4000-8000-000000000001','Max Mustermann','2026-02-01','de');

commit;
