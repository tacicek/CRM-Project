-- Auftrag INSERT/UPDATE persistence contract (Batch 4B.2B).
--
-- Verifies that the generated `auftraege` payload shape the client factories produce
-- (src/lib/auftragPayload.ts) is accepted by the real schema, and that the DB-side trigger
-- (`set_auftrag_nummer`) behaves as the `auftrag_nummer: ''` sentinel assumes. Each test runs
-- as `authenticated` tenant A (RLS in force — no superuser), inside begin/rollback, and RAISEs
-- on failure so psql (ON_ERROR_STOP=1) exits non-zero. offer_id/lead_id are NULL so the
-- AFTER INSERT appointment trigger no-ops (create_appointments_for_auftrag: RETURN on null
-- offer) and the status-sync trigger's WHEN is not met — isolating the row contract.

\set ON_ERROR_STOP on

-- Insert: trigger fills the nummer sentinel; status enum, nullable ids, JSON + financials round-trip.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  do $$
  declare
    r public.auftraege%rowtype;
  begin
    insert into public.auftraege
      (company_id, auftrag_nummer, offer_id, lead_id, appointment_id, title, customer_name,
       scheduled_date, status, language, subtotal, vat_rate, vat_amount, total,
       items, extra_services, service_details)
    values
      ('a0000000-0000-4000-8000-0000000000c1', '', null, null, null, 'Contract Auftrag',
       'Max Mustermann', '2026-02-10', 'geplant', 'de', 1000, 8.1, 81, 1081,
       '[{"id":"i1","position":1,"description":"Umzug","quantity":2,"unit":"Std","unit_price":120,"total":240,"price_type":"hourly"}]'::jsonb,
       '[{"id":"e1","description":"Entsorgung","quantity":1,"unit":"Pauschal","unit_price":80}]'::jsonb,
       '{"from_rooms":3,"packing_service_needed":true,"piano_transport_needed":false,"note":null}'::jsonb)
    returning * into r;

    -- 1) auftrag_nummer sentinel replaced by the trigger, in YYYY-NNNN form.
    if r.auftrag_nummer = '' or r.auftrag_nummer is null then
      raise exception 'FAIL A1: auftrag_nummer sentinel not filled by trigger';
    end if;
    if r.auftrag_nummer !~ ('^' || to_char(current_date, 'YYYY') || '-[0-9]{4,}$') then
      raise exception 'FAIL A1: auftrag_nummer % not in YYYY-NNNN format', r.auftrag_nummer;
    end if;
    -- 2) status stored as the enum value.
    if r.status <> 'geplant'::public.auftrag_status then raise exception 'FAIL A2: status not stored as enum'; end if;
    -- 3) nullable lead_id / offer_id accepted.
    if r.lead_id is not null or r.offer_id is not null then raise exception 'FAIL A3: nullable ids not preserved'; end if;
    -- 4) JSON snapshots round-trip byte-for-byte (value equality).
    if r.items <> '[{"id":"i1","position":1,"description":"Umzug","quantity":2,"unit":"Std","unit_price":120,"total":240,"price_type":"hourly"}]'::jsonb
      then raise exception 'FAIL A4: items did not round-trip'; end if;
    if r.extra_services <> '[{"id":"e1","description":"Entsorgung","quantity":1,"unit":"Pauschal","unit_price":80}]'::jsonb
      then raise exception 'FAIL A4: extra_services did not round-trip'; end if;
    if r.service_details <> '{"from_rooms":3,"packing_service_needed":true,"piano_transport_needed":false,"note":null}'::jsonb
      then raise exception 'FAIL A4: service_details did not round-trip'; end if;
    -- 5) financial snapshot preserved verbatim.
    if r.subtotal <> 1000 or r.vat_rate <> 8.1 or r.vat_amount <> 81 or r.total <> 1081 then
      raise exception 'FAIL A5: financial snapshot altered';
    end if;
    raise notice 'PASS A1-A5: insert trigger nummer + enum + nullable ids + JSON/financial round-trip';
  end $$;
rollback;

-- Update: auftrag_nummer immutable; reminder-reset fields persist when the client sends them.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  do $$
  declare
    v_id   uuid;
    v_nr   text;
    v_nr2  text;
    v_tr   boolean;
    v_rsa  timestamptz;
  begin
    insert into public.auftraege
      (company_id, auftrag_nummer, offer_id, lead_id, appointment_id, title, customer_name,
       scheduled_date, status, language, team_reminder_sent, reminder_sent_at)
    values
      ('a0000000-0000-4000-8000-0000000000c1', '', null, null, null, 'Before', 'Max',
       '2026-02-10', 'geplant', 'de', true, '2026-02-01T10:00:00Z')
    returning id, auftrag_nummer into v_id, v_nr;

    -- Reschedule update payload (client applyAuftragRescheduleReset): reminder fields reset.
    update public.auftraege
      set title = 'After', team_reminder_sent = false, reminder_sent_at = null,
          customer_reminder_sent = false, customer_reminder_sent_at = null
      where id = v_id
      returning auftrag_nummer, team_reminder_sent, reminder_sent_at into v_nr2, v_tr, v_rsa;

    -- 6) auftrag_nummer not changed by update.
    if v_nr2 <> v_nr then raise exception 'FAIL A6: update changed auftrag_nummer (% -> %)', v_nr, v_nr2; end if;
    -- 7) reschedule reset persisted.
    if v_tr <> false or v_rsa is not null then raise exception 'FAIL A7: reschedule reminder reset not persisted'; end if;
    raise notice 'PASS A6-A7: update keeps nummer, reschedule reset persists';
  end $$;
rollback;

-- Normal edit (no reminder fields in payload) leaves reminder state untouched.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  do $$
  declare
    v_id  uuid;
    v_tr  boolean;
    v_rsa timestamptz;
  begin
    insert into public.auftraege
      (company_id, auftrag_nummer, offer_id, lead_id, appointment_id, title, customer_name,
       scheduled_date, status, language, team_reminder_sent, reminder_sent_at)
    values
      ('a0000000-0000-4000-8000-0000000000c1', '', null, null, null, 'Before', 'Max',
       '2026-02-10', 'geplant', 'de', true, '2026-02-01T10:00:00Z')
    returning id into v_id;

    update public.auftraege set title = 'Only title' where id = v_id
      returning team_reminder_sent, reminder_sent_at into v_tr, v_rsa;

    -- 8) an unrelated edit does not clear a sent reminder.
    if v_tr <> true or v_rsa is null then raise exception 'FAIL A8: unrelated edit reset reminder state'; end if;
    raise notice 'PASS A8: normal edit preserves reminder state';
  end $$;
rollback;

-- Failure: an out-of-range status is rejected at the enum boundary (never persisted).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  do $$
  declare
    v_failed boolean := false;
  begin
    begin
      insert into public.auftraege
        (company_id, auftrag_nummer, offer_id, lead_id, appointment_id, title, customer_name,
         scheduled_date, status, language)
      values
        ('a0000000-0000-4000-8000-0000000000c1', '', null, null, null, 'Bad', 'Max',
         '2026-02-10', 'cancelled', 'de');
    exception when others then
      v_failed := true;
    end;
    -- 9) the invalid enum value must be refused by the DB.
    if not v_failed then raise exception 'FAIL A9: DB accepted an out-of-range status'; end if;
    raise notice 'PASS A9: DB rejects an out-of-range status';
  end $$;
rollback;

\echo 'ALL AUFTRAG CONTRACT ASSERTIONS PASSED'
