-- Zahlungsbuch, offener Betrag, Gutschriften, Mahnungen.
--
-- Prüft 20260729100000 bis 160000. Der Kern: der Rechnungsstatus behauptet
-- nichts mehr, er folgt dem Buch — und das Buch lässt sich nicht umschreiben.

\set ON_ERROR_STOP on

-- =============================================================================
-- A) Der Status folgt der Zahlung, nicht dem Knopf
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_r uuid; v_pay uuid; v_ok boolean; v_res jsonb;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    insert into public.rechnungen (company_id, datum, faellig_am, customer_name,
                                   positionen, zwischensumme, mwst_satz, mwst_betrag,
                                   total, rabatt, gesamttotal, status, language)
    values (v_c, current_date, current_date + 30, 'Zahltest',
            '[]'::jsonb, 1000, 8.1, 81, 1081, 0, 1081, 'versendet', 'de')
    returning id into v_r;

    if (select open_amount from public.rechnungen where id = v_r) <> 1081 then
      raise exception 'FAIL A1: offener Betrag stimmt nicht';
    end if;

    -- Von Hand auf bezahlt: das Buch gibt es nicht her.
    v_ok := false;
    begin update public.rechnungen set status = 'bezahlt' where id = v_r;
    exception when check_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL A2: bezahlt ohne Deckung angenommen'; end if;

    -- Teilzahlung: offen bleibt offen.
    v_res := public.record_payment(v_c, 400, current_date, 'bank', null, null, null,
               jsonb_build_array(jsonb_build_object('rechnung_id', v_r, 'amount', 400)));
    if (select open_amount from public.rechnungen where id = v_r) <> 681 then
      raise exception 'FAIL A3: Teilzahlung nicht verrechnet';
    end if;
    if (select status from public.rechnungen where id = v_r) <> 'versendet' then
      raise exception 'FAIL A4: Teilzahlung gilt schon als bezahlt';
    end if;

    -- Rest: jetzt folgt der Status von selbst.
    v_res := public.record_payment(v_c, 681, current_date, 'twint', null, null, null,
               jsonb_build_array(jsonb_build_object('rechnung_id', v_r, 'amount', 681)));
    v_pay := (v_res ->> 'payment_id')::uuid;
    if (select status from public.rechnungen where id = v_r) <> 'bezahlt' then
      raise exception 'FAIL A5: Status folgt der vollen Zahlung nicht';
    end if;

    -- Storno macht die Rechnung wieder offen.
    perform public.reverse_payment(v_pay, 'Testfall');
    if (select status from public.rechnungen where id = v_r) = 'bezahlt' then
      raise exception 'FAIL A6: bleibt nach Storno bezahlt';
    end if;
    if (select open_amount from public.rechnungen where id = v_r) <> 681 then
      raise exception 'FAIL A7: offener Betrag nach Storno falsch';
    end if;
  end $$;
rollback;

-- =============================================================================
-- B) Das Buch ist append-only
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_pay uuid; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    v_pay := (public.record_payment(v_c, 250, current_date, 'cash') ->> 'payment_id')::uuid;

    v_ok := false;
    begin update public.payments set amount = 999 where id = v_pay;
    exception when insufficient_privilege then v_ok := true; end;
    if not v_ok then raise exception 'FAIL B1: Betrag war aenderbar'; end if;

    v_ok := false;
    begin update public.payments set payment_date = current_date - 100 where id = v_pay;
    exception when insufficient_privilege then v_ok := true; end;
    if not v_ok then raise exception 'FAIL B2: Datum war aenderbar'; end if;

    v_ok := false;
    begin
      set local role service_role;
      delete from public.payments where id = v_pay;
      reset role;
    exception when insufficient_privilege then reset role; v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL B3: Zahlung war loeschbar'; end if;

    -- Was nach der Zahlung entsteht, bleibt aenderbar.
    update public.payments set reconciliation_status = 'reconciled', note = 'geprueft'
    where id = v_pay;

    -- Negativ ohne Storno-Bezug ist keine Zahlung.
    v_ok := false;
    begin
      insert into public.payments (company_id, payment_date, amount, method)
      values (v_c, current_date, -50, 'bank');
    exception when check_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL B4: negative Zahlung ohne Storno'; end if;
  end $$;
rollback;

-- =============================================================================
-- C) Anrechnung, Gutschrift, Mahnstufe
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_r uuid; v_pay uuid; v_gs uuid; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    insert into public.rechnungen (company_id, datum, faellig_am, customer_name,
                                   positionen, zwischensumme, mwst_satz, mwst_betrag,
                                   total, rabatt, gesamttotal, status, language)
    values (v_c, current_date, current_date - 40, 'Mahntest',
            '[]'::jsonb, 500, 0, 0, 500, 0, 500, 'versendet', 'fr')
    returning id into v_r;

    v_pay := (public.record_payment(v_c, 100, current_date, 'bank') ->> 'payment_id')::uuid;

    -- Mehr anrechnen, als gezahlt wurde.
    v_ok := false;
    begin
      insert into public.payment_allocations (company_id, payment_id, rechnung_id, amount)
      values (v_c, v_pay, v_r, 200);
    exception when check_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL C1: Ueberbuchung angenommen'; end if;

    -- Gutschrift: Entwurf wirkt nicht, versendet schon.
    insert into public.credit_notes (company_id, rechnung_id, amount, status)
    values (v_c, v_r, 50, 'entwurf') returning id into v_gs;
    if (select open_amount from public.rechnungen where id = v_r) <> 500 then
      raise exception 'FAIL C2: Gutschrift im Entwurf senkt den offenen Betrag';
    end if;
    update public.credit_notes set status = 'versendet' where id = v_gs;
    if (select open_amount from public.rechnungen where id = v_r) <> 450 then
      raise exception 'FAIL C3: versendete Gutschrift wirkt nicht';
    end if;
    -- Die Sprache kommt von der Rechnung, nicht von einem Vorgabewert.
    if (select language from public.credit_notes where id = v_gs) <> 'fr' then
      raise exception 'FAIL C4: Gutschrift spricht nicht die Sprache des Kunden';
    end if;

    v_ok := false;
    begin
      insert into public.credit_notes (company_id, rechnung_id, amount, status)
      values (v_c, v_r, 9999, 'versendet');
    exception when check_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL C5: Gutschrift ueber dem Rechnungsbetrag'; end if;

    -- Mahnstufe 2 ohne Stufe 1.
    v_ok := false;
    begin
      insert into public.invoice_reminders (company_id, rechnung_id, level, open_amount_snapshot)
      values (v_c, v_r, 2, 450);
    exception when check_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL C6: Mahnstufe uebersprungen'; end if;

    insert into public.invoice_reminders (company_id, rechnung_id, level)
    values (v_c, v_r, 1);
    -- Der Stand wird beim Mahnen festgehalten, nicht spaeter nachgeschlagen.
    if (select open_amount_snapshot from public.invoice_reminders
        where rechnung_id = v_r and level = 1) <> 450 then
      raise exception 'FAIL C7: Mahnung haelt den offenen Betrag nicht fest';
    end if;

    -- Die Automatik zieht den Status nach und legt genau eine Aufgabe an.
    perform public.run_invoice_automations();
    if (select status from public.rechnungen where id = v_r) <> 'ueberfaellig' then
      raise exception 'FAIL C8: ueberfaelliger Status nicht nachgezogen';
    end if;
    perform public.run_invoice_automations();
    if (select count(*) from public.crm_tasks
        where company_id = v_c and title like 'Rechnung%ueberfaellig') <> 1 then
      raise exception 'FAIL C9: Mahnaufgabe wiederholt sich';
    end if;
  end $$;
rollback;

-- =============================================================================
-- D) Mandantentrennung und Rechte
-- =============================================================================
begin;
  do $$
  declare
    v_a uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_b uuid := 'b0000000-0000-4000-8000-0000000000c2';
    v_r_b uuid; v_pay_a uuid; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
    insert into public.rechnungen (company_id, datum, customer_name, positionen,
                                   zwischensumme, mwst_satz, mwst_betrag, total,
                                   rabatt, gesamttotal, status, language)
    values (v_b, current_date, 'Fremd', '[]'::jsonb, 100, 0, 0, 100, 0, 100, 'versendet', 'de')
    returning id into v_r_b;

    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    v_pay_a := (public.record_payment(v_a, 100, current_date, 'bank') ->> 'payment_id')::uuid;

    -- Auf die Rechnung der anderen Firma buchen.
    v_ok := false;
    begin
      insert into public.payment_allocations (company_id, payment_id, rechnung_id, amount)
      values (v_a, v_pay_a, v_r_b, 100);
    exception when foreign_key_violation then v_ok := true; end;
    if not v_ok then raise exception 'FAIL D1: Anrechnung auf fremde Rechnung'; end if;

    -- Und ueber die RPC.
    v_ok := false;
    begin
      perform public.record_payment(v_a, 100, current_date, 'bank', null, null, null,
                jsonb_build_array(jsonb_build_object('rechnung_id', v_r_b, 'amount', 100)));
    exception when insufficient_privilege then v_ok := true; end;
    if not v_ok then raise exception 'FAIL D2: RPC bucht auf fremde Rechnung'; end if;

    -- Die Uebersicht der anderen Firma ist nicht lesbar.
    v_ok := false;
    begin perform public.finance_overview(v_b);
    exception when insufficient_privilege then v_ok := true; end;
    if not v_ok then raise exception 'FAIL D3: fremde Finanzuebersicht lesbar'; end if;
  end $$;
rollback;

-- =============================================================================
-- E) Rechte auf den Funktionen
-- =============================================================================
do $$
begin
  -- Die Regelfunktion gehoert dem Cron, nicht dem Browser.
  if (select has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'run_invoice_automations') then
    raise exception 'FAIL E1: Rechnungsautomatik aus dem Browser aufrufbar';
  end if;

  -- Zahlungen erfassen gehoert nicht dem anonymen Besucher.
  if (select has_function_privilege('anon', p.oid, 'EXECUTE')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'record_payment') then
    raise exception 'FAIL E2: record_payment fuer anon offen';
  end if;

  -- Gegenprobe: die App muss sie aufrufen koennen.
  if not (select has_function_privilege('authenticated', p.oid, 'EXECUTE')
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'finance_overview') then
    raise exception 'FAIL E3: Finanzuebersicht fuer die App gesperrt';
  end if;
end $$;

select 'PASS finanzen' as result;
