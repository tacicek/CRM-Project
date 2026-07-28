-- Serviceorte und Kundenfälle.
--
-- Prüft 20260731100000 / 110000. Der Kern: dieselbe Adresse ergibt einen Ort,
-- und ein Fall lässt sich nicht abschliessen, ohne zu sagen wie.

\set ON_ERROR_STOP on

-- =============================================================================
-- A) Orte
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde uuid; v_o1 uuid; v_o2 uuid; v_a uuid; v_res jsonb;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    select id into v_kunde from public.customers where company_id = v_c limit 1;

    v_o1 := public.resolve_or_create_location(v_c, v_kunde, 'Musterstrasse 12, 8000 Zürich');
    -- Anderer Wortlaut, dieselbe Adresse: Leerzeichen und Grossschreibung
    -- duerfen keinen zweiten Ort ergeben.
    v_o2 := public.resolve_or_create_location(v_c, v_kunde, '  musterstrasse 12, 8000 zürich ');
    if v_o1 is distinct from v_o2 then
      raise exception 'FAIL A1: gleiche Adresse ergibt zwei Orte';
    end if;

    -- Leere Adresse ergibt keinen Ort statt einen leeren.
    if public.resolve_or_create_location(v_c, v_kunde, '   ') is not null then
      raise exception 'FAIL A2: leere Adresse hat einen Ort erzeugt';
    end if;

    -- Ein neuer Auftrag verknuepft sich selbst.
    insert into public.auftraege (company_id, customer_id, customer_name, title,
                                  scheduled_date, from_address, to_address, status, language)
    values (v_c, v_kunde, 'Ortstest', 'Auftrag Ort', current_date + 3,
            'Musterstrasse 12, 8000 Zürich', 'Neugasse 5, 3000 Bern', 'geplant', 'de')
    returning id into v_a;

    if (select from_location_id from public.auftraege where id = v_a) is distinct from v_o1 then
      raise exception 'FAIL A3: Auftrag verknuepft sich nicht mit dem bestehenden Ort';
    end if;
    if (select to_location_id from public.auftraege where id = v_a) is null then
      raise exception 'FAIL A4: Zieladresse ohne Ort';
    end if;

    -- Der Backfill meldet beim zweiten Lauf keine Arbeit, die es nicht gab.
    perform public.run_location_backfill(v_c);
    v_res := public.run_location_backfill(v_c);
    if (v_res ->> 'auftraege')::int <> 0 then
      raise exception 'FAIL A5: Backfill meldet Arbeit im zweiten Lauf (%)', v_res::text;
    end if;
  end $$;
rollback;

-- =============================================================================
-- B) Mandantentrennung der Orte
-- =============================================================================
begin;
  do $$
  declare
    v_a uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde_a uuid; v_ort_a uuid; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    select id into v_kunde_a from public.customers where company_id = v_a limit 1;
    v_ort_a := public.resolve_or_create_location(v_a, v_kunde_a, 'Fremdgasse 1');

    -- Firma B haengt den Ort von Firma A an ihren Auftrag.
    v_ok := false;
    begin
      insert into public.auftraege (company_id, customer_name, title, scheduled_date,
                                    from_location_id, status, language)
      values ('b0000000-0000-4000-8000-0000000000c2', 'Fremd', 'Fremd', current_date,
              v_ort_a, 'geplant', 'de');
    exception when foreign_key_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL B1: fremder Ort an eigenem Auftrag'; end if;
  end $$;
rollback;

-- =============================================================================
-- C) Fälle
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde uuid; v_fall uuid; v_ok boolean; v_nr text;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    select id into v_kunde from public.customers where company_id = v_c limit 1;

    insert into public.customer_cases (company_id, customer_id, case_type, title, priority)
    values (v_c, v_kunde, 'complaint', 'Zu spät gekommen', 'high')
    returning id, case_number into v_fall, v_nr;

    if v_nr not like 'FA-%' then raise exception 'FAIL C1: keine Fallnummer'; end if;
    if (select count(*) from public.customer_case_events where case_id = v_fall) <> 1 then
      raise exception 'FAIL C2: kein Verlaufseintrag';
    end if;
    if (select count(*) from public.crm_tasks where title like v_nr || '%') <> 1 then
      raise exception 'FAIL C3: keine Aufgabe in der Wiedervorlage';
    end if;

    -- Ein unbekannter Typ ist kein Fall.
    v_ok := false;
    begin
      insert into public.customer_cases (company_id, case_type, title)
      values (v_c, 'irgendwas', 'Test');
    exception when check_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL C4: unbekannter Falltyp angenommen'; end if;

    -- Abschluss ohne Ergebnis.
    v_ok := false;
    begin update public.customer_cases set status = 'geloest' where id = v_fall;
    exception when check_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL C5: Abschluss ohne Ergebnis'; end if;

    -- Statuswechsel landet im Verlauf.
    update public.customer_cases set status = 'in_arbeit' where id = v_fall;
    if (select count(*) from public.customer_case_events
        where case_id = v_fall and event_type = 'status') <> 1 then
      raise exception 'FAIL C6: Statuswechsel nicht im Verlauf';
    end if;

    update public.customer_cases
    set status = 'geloest', closed_at = now(), resolution_type = 'kulanz',
        resolution = 'Rabatt gewaehrt'
    where id = v_fall;

    -- Der Verlauf ist ein Nachweis, auch gegen service_role.
    v_ok := false;
    begin
      set local role service_role;
      delete from public.customer_case_events where case_id = v_fall;
      reset role;
    exception when insufficient_privilege then reset role; v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL C7: Fallverlauf loeschbar'; end if;
  end $$;
rollback;

-- =============================================================================
-- D) Der Kunde meldet aus dem Portal — aber nur zu seinem eigenen Auftrag
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde uuid; v_st text; v_fremd uuid; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    select id into v_kunde from public.customers where company_id = v_c limit 1;

    -- Ein Auftrag, der einem ANDEREN Kunden gehoert.
    insert into public.auftraege (company_id, customer_name, title, scheduled_date,
                                  status, language)
    values (v_c, 'Jemand anders', 'Fremder Auftrag', current_date, 'geplant', 'de')
    returning id into v_fremd;

    v_st := public.portal_redeem_magic_link(
              public.portal_create_magic_link(v_kunde, 7) ->> 'token') ->> 'session';

    v_ok := false;
    begin
      perform public.portal_report_case(v_st, 'damage', 'Kratzer', null, v_fremd);
    exception when insufficient_privilege then v_ok := true; end;
    if not v_ok then raise exception 'FAIL D1: Fall an fremden Auftrag gehaengt'; end if;

    -- Ohne Auftragsbezug geht es.
    perform public.portal_report_case(v_st, 'complaint', 'Beschwerde aus dem Portal');
    if (select reported_by from public.customer_cases
        where customer_id = v_kunde and title = 'Beschwerde aus dem Portal') <> 'kunde' then
      raise exception 'FAIL D2: Portalmeldung nicht als Kundenmeldung gefuehrt';
    end if;
  end $$;
rollback;

-- =============================================================================
-- E) Rechte
-- =============================================================================
do $$
begin
  if (select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('run_location_backfill','resolve_or_create_location')) then
    raise exception 'FAIL E1: Ortsfunktionen fuer anon offen';
  end if;
  if not (select has_function_privilege('anon', p.oid, 'EXECUTE')
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'portal_report_case') then
    raise exception 'FAIL E2: der Kunde kann nichts melden';
  end if;
  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'customer_cases') < 4 then
    raise exception 'FAIL E3: customer_cases ohne vollstaendige Policies';
  end if;
end $$;

select 'PASS serviceorte-faelle' as result;
