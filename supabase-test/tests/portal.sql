-- Kundenportal: Zugang, Sicht, Änderungswunsch.
--
-- Prüft 20260730100000 / 110000 / 120000. Der Kern: der Kunde ergibt sich aus
-- dem Token und nie aus einem Argument, und der Klartext liegt nirgends.

\set ON_ERROR_STOP on

-- =============================================================================
-- A) Link, Sitzung, Einmaligkeit
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde uuid; v_link jsonb; v_tok text; v_st text; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    select id into v_kunde from public.customers
    where company_id = v_c and merged_into_customer_id is null limit 1;
    if v_kunde is null then raise exception 'FAIL A0: keine Testkunden'; end if;

    v_link := public.portal_create_magic_link(v_kunde, 14);
    v_tok := v_link ->> 'token';
    if length(v_tok) <> 64 then raise exception 'FAIL A1: Token falsch'; end if;

    -- Der Klartext darf in keiner Spalte auftauchen.
    if exists (select 1 from public.portal_magic_links
               where token_hash = v_tok or token_hash like '%' || v_tok || '%') then
      raise exception 'FAIL A2: Klartext liegt in der Tabelle';
    end if;

    v_st := public.portal_redeem_magic_link(v_tok) ->> 'session';
    if length(v_st) <> 64 then raise exception 'FAIL A3: keine Sitzung'; end if;
    if exists (select 1 from public.portal_sessions where token_hash = v_st) then
      raise exception 'FAIL A4: Sitzungsklartext liegt in der Tabelle';
    end if;

    -- Einmalig.
    v_ok := false;
    begin perform public.portal_redeem_magic_link(v_tok);
    exception when invalid_authorization_specification then v_ok := true; end;
    if not v_ok then raise exception 'FAIL A5: Link zweimal einloesbar'; end if;

    -- Abgelaufener Link.
    update public.portal_magic_links set expires_at = now() - interval '1 day', used_at = null
    where customer_id = v_kunde;
    v_ok := false;
    begin perform public.portal_redeem_magic_link(v_tok);
    exception when invalid_authorization_specification then v_ok := true; end;
    if not v_ok then raise exception 'FAIL A6: abgelaufener Link akzeptiert'; end if;
  end $$;
rollback;

-- =============================================================================
-- B) Die Sicht zeigt nur, was den Kunden angeht
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde uuid; v_st text; v_ov jsonb; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    select id into v_kunde from public.customers
    where company_id = v_c and merged_into_customer_id is null limit 1;

    -- Ein Auftrag mit internen Notizen: die duerfen nicht durchkommen.
    insert into public.auftraege (company_id, customer_id, customer_name, title,
                                  scheduled_date, internal_notes, status, language)
    values (v_c, v_kunde, 'Portal Test', 'Auftrag Portal', current_date + 7,
            'GEHEIM-INTERN-MARKE', 'geplant', 'de');

    v_st := public.portal_redeem_magic_link(
              public.portal_create_magic_link(v_kunde, 7) ->> 'token') ->> 'session';
    v_ov := public.portal_overview(v_st);

    if v_ov::text like '%GEHEIM-INTERN-MARKE%' then
      raise exception 'FAIL B1: interne Notiz in der Kundenansicht';
    end if;
    if v_ov -> 'auftraege' = '[]'::jsonb then
      raise exception 'FAIL B2: der Auftrag fehlt ganz';
    end if;
    if (v_ov -> 'kunde' ->> 'sprache') is null then
      raise exception 'FAIL B3: ohne Sprache kann das Portal nicht uebersetzen';
    end if;

    -- Erfundene Sitzung.
    v_ok := false;
    begin perform public.portal_overview(repeat('f', 64));
    exception when invalid_authorization_specification then v_ok := true; end;
    if not v_ok then raise exception 'FAIL B4: erfundene Sitzung akzeptiert'; end if;

    -- Widerruf wirkt sofort.
    perform public.portal_revoke_access(v_kunde);
    v_ok := false;
    begin perform public.portal_overview(v_st);
    exception when invalid_authorization_specification then v_ok := true; end;
    if not v_ok then raise exception 'FAIL B5: Sitzung ueberlebt den Widerruf'; end if;
  end $$;
rollback;

-- =============================================================================
-- C) Der Änderungswunsch schreibt nicht selbst
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde uuid; v_st text; v_alt text; v_id uuid; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    select id, primary_phone into v_kunde, v_alt from public.customers
    where company_id = v_c and merged_into_customer_id is null limit 1;

    v_st := public.portal_redeem_magic_link(
              public.portal_create_magic_link(v_kunde, 7) ->> 'token') ->> 'session';

    perform public.portal_request_change(v_st, 'primary_phone', '+41790009999');
    if (select primary_phone from public.customers where id = v_kunde)
       is distinct from v_alt then
      raise exception 'FAIL C1: das Portal hat den Stammsatz direkt geaendert';
    end if;

    -- Zweimal derselbe Wunsch ergibt einen, nicht zwei.
    perform public.portal_request_change(v_st, 'primary_phone', '+41790008888');
    if (select count(*) from public.customer_change_requests
        where customer_id = v_kunde and status = 'offen') <> 1 then
      raise exception 'FAIL C2: Wunsch mehrfach in der Warteschlange';
    end if;

    -- Nicht erlaubte Felder.
    v_ok := false;
    begin perform public.portal_request_change(v_st, 'status', 'vip');
    exception when check_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL C3: Kunde darf ein Firmenfeld aendern'; end if;

    -- Die Firma erfaehrt davon.
    if (select count(*) from public.crm_tasks
        where customer_id = v_kunde and title like 'Aenderungswunsch%') = 0 then
      raise exception 'FAIL C4: kein Eintrag in der Wiedervorlage';
    end if;

    -- Annahme uebernimmt, und zwar genau einmal.
    select id into v_id from public.customer_change_requests
    where customer_id = v_kunde and status = 'offen';
    perform public.decide_change_request(v_id, true, 'geprueft');
    if (select primary_phone from public.customers where id = v_kunde) <> '+41790008888' then
      raise exception 'FAIL C5: Annahme uebernimmt nicht';
    end if;
    v_ok := false;
    begin perform public.decide_change_request(v_id, true);
    exception when check_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL C6: zweimal entschieden'; end if;
  end $$;
rollback;

-- =============================================================================
-- D) Mandantentrennung und Rechte
-- =============================================================================
begin;
  do $$
  declare
    v_a uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde_b uuid; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    select id into v_kunde_b from public.customers
    where company_id = 'b0000000-0000-4000-8000-0000000000c2' limit 1;

    if v_kunde_b is not null then
      v_ok := false;
      begin perform public.portal_create_magic_link(v_kunde_b, 7);
      exception when insufficient_privilege then v_ok := true; end;
      if not v_ok then raise exception 'FAIL D1: Zugang fuer fremden Kunden erstellt'; end if;
    end if;
  end $$;
rollback;

do $$
begin
  -- Der Kunde ist nicht angemeldet: diese beiden MUESSEN fuer anon offen sein.
  if not (select has_function_privilege('anon', p.oid, 'EXECUTE')
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'portal_redeem_magic_link') then
    raise exception 'FAIL E1: der Kunde kann seinen Link nicht einloesen';
  end if;
  if not (select has_function_privilege('anon', p.oid, 'EXECUTE')
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'portal_overview') then
    raise exception 'FAIL E2: der Kunde sieht sein Portal nicht';
  end if;

  -- Und diese drei duerfen es unter keinen Umstaenden sein.
  if (select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('portal_session_customer','portal_create_magic_link',
                          'portal_revoke_access','decide_change_request','portal_cleanup')) then
    raise exception 'FAIL E3: eine Portalverwaltungsfunktion ist fuer anon offen';
  end if;

  -- Ohne RLS waere die Abdrucktabelle fuer jeden lesbar.
  if not (select relrowsecurity from pg_class where oid = 'public.portal_sessions'::regclass) then
    raise exception 'FAIL E4: portal_sessions ohne RLS';
  end if;
end $$;

select 'PASS portal' as result;
