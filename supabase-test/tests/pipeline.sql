-- Verkaufsstufen, Wiedervorlage und die Regeln dahinter.
--
-- Prüft 20260728240000 / 250000 / 260000. Der Kern: die Stufe bewegt sich von
-- selbst, wo sie beobachtbar ist, und die Regeln wiederholen sich nicht.

\set ON_ERROR_STOP on

-- =============================================================================
-- A) Die Stufe folgt der Offerte — vorwärts, nie zurück
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_lead uuid; v_off uuid; v_n int;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    insert into public.leads (company_id, customer_first_name, customer_last_name,
                              customer_email, customer_phone, service_type, from_plz, from_city)
    values (v_c,'P','L','pl@example.test','079 111 11 11','umzug','8000','Zürich')
    returning id into v_lead;
    if (select sales_stage from public.leads where id = v_lead) <> 'new' then
      raise exception 'FAIL A1: neue Anfrage startet nicht auf new';
    end if;

    insert into public.offers (company_id, lead_id, customer_first_name, customer_last_name,
                               customer_email, title, status, service_date, subtotal)
    values (v_c, v_lead,'P','L','pl@example.test','O','draft', current_date + 30, 900)
    returning id into v_off;
    if (select sales_stage from public.leads where id = v_lead) <> 'offer_draft' then
      raise exception 'FAIL A2: Offerte angelegt, Stufe folgt nicht';
    end if;

    update public.offers set status = 'sent', sent_at = now() where id = v_off;
    if (select sales_stage from public.leads where id = v_lead) <> 'offer_sent' then
      raise exception 'FAIL A3: Versand bewegt die Stufe nicht';
    end if;

    -- Handeinstellung darf der Trigger nicht überschreiben.
    update public.leads set sales_stage = 'negotiating' where id = v_lead;
    update public.offers set status = 'viewed', viewed_at = now() where id = v_off;
    if (select sales_stage from public.leads where id = v_lead) <> 'negotiating' then
      raise exception 'FAIL A4: Handeinstellung wurde zurueckgedreht';
    end if;

    update public.offers set status = 'accepted', accepted_at = now() where id = v_off;
    if (select sales_stage from public.leads where id = v_lead) <> 'won' then
      raise exception 'FAIL A5: Annahme fuehrt nicht zu won';
    end if;

    select count(*) into v_n from public.sales_stage_history where lead_id = v_lead;
    if v_n < 4 then raise exception 'FAIL A6: Verlauf unvollstaendig (%)', v_n; end if;
  end $$;
rollback;

-- =============================================================================
-- B) Abgrenzungen
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_lead uuid; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    insert into public.leads (company_id, customer_first_name, customer_last_name,
                              customer_email, customer_phone, service_type, from_plz, from_city)
    values (v_c,'P','L','pl@example.test','079 111 11 11','umzug','8000','Zürich')
    returning id into v_lead;

    -- `lost` ohne Grund ergibt eine Zahl, mit der niemand etwas anfangen kann.
    v_ok := false;
    begin update public.leads set sales_stage = 'lost' where id = v_lead;
    exception when check_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL B1: lost ohne Grund angenommen'; end if;

    update public.leads set sales_stage = 'lost', lost_reason_code = 'price' where id = v_lead;

    -- Der Verlauf ist ein Nachweis, auch gegenüber service_role.
    v_ok := false;
    begin
      set local role service_role;
      delete from public.sales_stage_history where lead_id = v_lead;
      reset role;
    exception when insufficient_privilege then reset role; v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL B2: Verlauf loeschbar'; end if;
  end $$;
rollback;

-- =============================================================================
-- C) Die Regeln füllen die Wiedervorlage — und wiederholen sich nicht
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_lead uuid; v_off uuid; v_res jsonb; v_n int;
  begin
    insert into public.leads (company_id, customer_first_name, customer_last_name,
                              customer_email, customer_phone, service_type, from_plz, from_city)
    values (v_c,'Alt','Offen','ao@example.test','079 222 22 22','umzug','8000','Zürich')
    returning id into v_lead;
    insert into public.offers (company_id, lead_id, customer_first_name, customer_last_name,
                               customer_email, title, status, service_date, subtotal, sent_at)
    values (v_c, v_lead,'Alt','Offen','ao@example.test','Alte Offerte','sent',
            current_date + 30, 700, now() - interval '9 days')
    returning id into v_off;

    v_res := public.run_pipeline_automations();
    if (v_res ->> 'offer_no_response')::int < 1 then
      raise exception 'FAIL C1: liegengebliebene Offerte nicht erfasst';
    end if;
    select count(*) into v_n from public.crm_tasks where offer_id = v_off;
    if v_n <> 1 then raise exception 'FAIL C2: keine oder mehrere Aufgaben (%)', v_n; end if;

    -- Zweiter Lauf darf nichts wiederholen.
    v_res := public.run_pipeline_automations();
    select count(*) into v_n from public.crm_tasks where offer_id = v_off;
    if v_n <> 1 then raise exception 'FAIL C3: Regel hat wiederholt (%)', v_n; end if;

    -- Eine überholte Fassung wird nicht nachgefasst.
    update public.offers set superseded_at = now() where id = v_off;
    delete from public.automation_deliveries where entity_id = v_off;
    delete from public.crm_tasks where offer_id = v_off;
    perform public.run_pipeline_automations();
    select count(*) into v_n from public.crm_tasks where offer_id = v_off;
    if v_n <> 0 then raise exception 'FAIL C4: ueberholte Fassung nachgefasst'; end if;
  end $$;
rollback;

-- =============================================================================
-- D) Aufgaben sind Betrieb, die Regelfunktion nicht aufrufbar
-- =============================================================================
do $$
begin
  -- Die Frage ist nicht, ob eine Rechtezeile existiert, sondern ob die
  -- Browser-Rolle die Funktion tatsaechlich ausfuehren darf. has_function_privilege
  -- beantwortet genau das und rechnet PUBLIC mit ein.
  if (select has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'run_pipeline_automations') then
    raise exception 'FAIL D1: Regelfunktion ist aus dem Browser aufrufbar';
  end if;
  -- Gegenprobe: die Lesefunktionen der Kundenkarte muessen es sein, sonst
  -- beweist D1 nur, dass die Rechte pauschal fehlen.
  if not (select has_function_privilege('authenticated', p.oid, 'EXECUTE')
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'search_customers') then
    raise exception 'FAIL D1b: Kundensuche fuer die App gesperrt — Rechte pauschal entzogen';
  end if;
  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'crm_tasks') < 4 then
    raise exception 'FAIL D2: crm_tasks hat keine vollstaendigen Policies';
  end if;
end $$;

select 'PASS pipeline' as result;
