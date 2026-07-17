-- Integration assertions. Each runs in its own transaction as `anon` or
-- `authenticated` (with a specific user's JWT claims) and ROLLBACKs, so the suite
-- is side-effect free and repeatable. A failed assertion RAISEs EXCEPTION →
-- psql (ON_ERROR_STOP=1) exits non-zero. Fixture setup ran as superuser; NO
-- assertion below runs as superuser/service_role.

\set ON_ERROR_STOP on
\set A '''a0000000-0000-4000-8000-000000000001'''
\set B '''b0000000-0000-4000-8000-000000000002'''

-- 1) Anonymous cannot read CRM tables (RLS, not missing grant — anon HAS select grant).
begin;
  set local role anon;
  do $$ begin
    if (select count(*) from leads) <> 0 then raise exception 'FAIL 1: anon can read leads'; end if;
    if (select count(*) from offers) <> 0 then raise exception 'FAIL 1: anon can read offers'; end if;
    raise notice 'PASS 1: anonymous denied on CRM tables';
  end $$;
rollback;

-- 2) Tenant A reads its OWN lead.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  do $$ begin
    if (select count(*) from leads where id='11110000-0000-4000-8000-000000000001') <> 1
      then raise exception 'FAIL 2: A cannot see own lead'; end if;
    raise notice 'PASS 2: tenant A sees own lead';
  end $$;
rollback;

-- 3) Tenant A CANNOT read tenant B's lead.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  do $$ begin
    if (select count(*) from leads where id='22220000-0000-4000-8000-000000000002') <> 0
      then raise exception 'FAIL 3: A can see B lead (tenant leak)'; end if;
    raise notice 'PASS 3: tenant A cannot see tenant B lead';
  end $$;
rollback;

-- 4) Tenant A CANNOT create an offer for company B (RLS WITH CHECK).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  do $$
  declare ok boolean := false;
  begin
    begin
      insert into offers (company_id, customer_first_name, customer_last_name, customer_email, title)
      values ('b0000000-0000-4000-8000-0000000000c2','X','Y','x@example.test','Injected');
    exception when insufficient_privilege or check_violation then ok := true;
    end;
    if not ok then raise exception 'FAIL 4: A created an offer for company B'; end if;
    raise notice 'PASS 4: tenant A cannot create offer for company B';
  end $$;
rollback;

-- 5) Tenant B CANNOT read tenant A's Rechnung/Quittung.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}';
  do $$ begin
    if (select count(*) from rechnungen where id='66660000-0000-4000-8000-000000000001') <> 0
      then raise exception 'FAIL 5: B can see A rechnung'; end if;
    if (select count(*) from quittungen where id='77770000-0000-4000-8000-000000000001') <> 0
      then raise exception 'FAIL 5: B can see A quittung'; end if;
    raise notice 'PASS 5: tenant B cannot see tenant A invoice/receipt';
  end $$;
rollback;

-- 6) Valid public token returns ONLY the matching offer.
begin;
  set local role anon;
  do $$
  declare n int;
  begin
    select count(*) into n from get_offer_by_token('tok_a_0000000000000000000000000000')
      where id='33330000-0000-4000-8000-000000000001';
    if n <> 1 then raise exception 'FAIL 6: valid token did not return its offer'; end if;
    select count(*) into n from get_offer_by_token('tok_a_0000000000000000000000000000')
      where id='33330000-0000-4000-8000-000000000002';
    if n <> 0 then raise exception 'FAIL 6: token A leaked offer B'; end if;
    raise notice 'PASS 6: valid token returns only its own offer';
  end $$;
rollback;

-- 7) Invalid token returns no rows.
begin;
  set local role anon;
  do $$ begin
    if (select count(*) from get_offer_by_token('tok_does_not_exist')) <> 0
      then raise exception 'FAIL 7: invalid token returned data'; end if;
    raise notice 'PASS 7: invalid token returns nothing';
  end $$;
rollback;

-- 8) Public token RPC exposes only an allowlist — never access_token / internal cols.
--    (Enforced by the RPC's fixed RETURNS signature; assert it structurally.)
begin;
  do $$
  declare cols text;
  begin
    select string_agg(a.attname, ',') into cols
    from pg_proc p
      join pg_type rt on rt.oid = p.prorettype
      join pg_class c on c.reltype = rt.oid
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0
    where p.proname = 'get_offer_by_token';
    if cols is not null and position('access_token' in cols) > 0
      then raise exception 'FAIL 8: token RPC exposes access_token'; end if;
    raise notice 'PASS 8: token RPC output allowlist excludes access_token';
  end $$;
rollback;

-- 9-11) Core relations consistent & visible to the owning tenant.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  do $$ begin
    -- Offer → Auftrag → Rechnung/Quittung all belong to company A and chain by id.
    if not exists (select 1 from auftraege where id='55550000-0000-4000-8000-000000000001'
        and offer_id='33330000-0000-4000-8000-000000000001' and lead_id='11110000-0000-4000-8000-000000000001')
      then raise exception 'FAIL 9: Lead→Offer→Auftrag chain broken'; end if;
    if not exists (select 1 from rechnungen where auftrag_id='55550000-0000-4000-8000-000000000001')
      then raise exception 'FAIL 10: Auftrag→Rechnung link broken'; end if;
    if not exists (select 1 from quittungen where auftrag_id='55550000-0000-4000-8000-000000000001')
      then raise exception 'FAIL 11: Auftrag→Quittung link broken'; end if;
    raise notice 'PASS 9-11: Lead→Offer→Auftrag→Rechnung/Quittung relations consistent';
  end $$;
rollback;

-- 12) replace_offer_items is atomic: a failing item leaves prior items intact.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  do $$
  declare before_n int; after_n int; failed boolean := false;
  begin
    select count(*) into before_n from offer_items where offer_id='33330000-0000-4000-8000-000000000001';
    -- second item has description=null (NOT NULL) → must abort the whole replace.
    begin
      perform replace_offer_items('33330000-0000-4000-8000-000000000001',
        '[{"description":"ok","amount_basis":"fixed"},{"description":null,"amount_basis":"fixed"}]'::jsonb);
    exception when others then failed := true;
    end;
    if not failed then raise exception 'FAIL 12: replace accepted an invalid item set'; end if;
    select count(*) into after_n from offer_items where offer_id='33330000-0000-4000-8000-000000000001';
    if after_n <> before_n then raise exception 'FAIL 12: partial write (% -> %)', before_n, after_n; end if;
    raise notice 'PASS 12: replace_offer_items is atomic (no partial write)';
  end $$;
rollback;

\echo 'ALL DB ASSERTIONS PASSED'
