-- Nachtrag: Änderungen am vereinbarten Umfang brauchen erneute Zustimmung.
--
-- Prüft 20260728220000 / 230000. Der Kern: die angenommene Offerte bleibt als
-- Beleg unberührt, der zusätzliche Umfang wirkt auf den AUFTRAG, und der Kunde
-- entscheidet getrennt.

\set ON_ERROR_STOP on

begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_off uuid; v_auf uuid; v_na uuid; v_tok text; v_res jsonb;
    v_sub numeric; v_tot numeric; v_ok boolean; v_n int;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    -- Angenommene Offerte mit Auftrag. Sprache bewusst fr: der Nachtrag geht an
    -- den Kunden und muss dessen Sprache erben, nicht die des Bedieners.
    insert into public.offers (company_id, customer_first_name, customer_last_name,
                               customer_email, title, status, service_date, subtotal, language)
    values (v_c,'A','B','a@example.test','Basis','sent', current_date + 30, 1000, 'fr')
    returning id, access_token into v_off, v_tok;
    perform public.update_offer_by_token(v_tok, 'accepted', null, now());
    select id, subtotal, total into v_auf, v_sub, v_tot
    from public.auftraege where offer_id = v_off;
    if v_auf is null then raise exception 'FAIL 1: kein Auftrag aus der Offerte'; end if;

    -- Anlegen: Nummer, Sprache und Auftrag kommen aus der Offerte.
    v_res := public.create_offer_amendment(v_off, 'Klavier', 'Beim Besichtigen aufgetaucht');
    v_na := (v_res ->> 'nachtrag_id')::uuid;
    if not exists (select 1 from public.offer_amendments
                   where id = v_na and amendment_number = 1
                     and language = 'fr' and auftrag_id = v_auf) then
      raise exception 'FAIL 2: Nachtrag erbt Nummer/Sprache/Auftrag nicht';
    end if;

    insert into public.offer_amendment_items (amendment_id, position, description, quantity, unit, unit_price)
    values (v_na, 1, 'Klaviertransport', 1, 'Pauschal', 300);
    update public.offer_amendments set subtotal = 300 where id = v_na;

    if not exists (select 1 from public.offer_amendments
                   where id = v_na and vat_amount = 24.30 and total = 324.30) then
      raise exception 'FAIL 3: MwSt wird anders gerechnet als bei der Offerte';
    end if;

    -- Ein Entwurf ist über den Link nicht sichtbar.
    select count(*) into v_n
    from public.get_amendment_by_token((select access_token from public.offer_amendments where id = v_na));
    if v_n <> 0 then raise exception 'FAIL 4: Entwurf ist oeffentlich sichtbar'; end if;

    update public.offer_amendments set status = 'sent', sent_at = now() where id = v_na;
    select access_token into v_tok from public.offer_amendments where id = v_na;

    if not exists (select 1 from public.get_amendment_by_token(v_tok)
                   where title = 'Klavier' and jsonb_array_length(positionen) = 1) then
      raise exception 'FAIL 5: versendeter Nachtrag ist nicht abrufbar';
    end if;

    -- Nach dem Versand inhaltlich gesperrt.
    v_ok := false;
    begin
      set local role authenticated;
      update public.offer_amendments set subtotal = 1 where id = v_na;
      reset role;
    exception when insufficient_privilege then reset role; v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL 6: Betrag nach Versand aenderbar'; end if;

    -- Zustimmung schreibt den AUFTRAG fort.
    if not public.update_amendment_by_token(v_tok, 'accepted', null, '203.0.113.5') then
      raise exception 'FAIL 7: Zustimmung abgewiesen';
    end if;
    if not exists (select 1 from public.auftraege
                   where id = v_auf and subtotal = v_sub + 300 and total = v_tot + 324.30
                     and items @> '[{"from_amendment": 1}]'::jsonb) then
      raise exception 'FAIL 8: Auftrag nicht fortgeschrieben';
    end if;

    -- Offerte und Nachtrag bleiben als Beleg stehen.
    if not exists (select 1 from public.offers where id = v_off and subtotal = 1000) then
      raise exception 'FAIL 9: Offerte wurde veraendert';
    end if;
    if not exists (select 1 from public.offer_amendments
                   where id = v_na and accepted_at is not null and accepted_ip = '203.0.113.5') then
      raise exception 'FAIL 10: Zeitpunkt/IP nicht festgehalten';
    end if;

    -- Einmal entschieden bleibt entschieden.
    if public.update_amendment_by_token(v_tok, 'rejected') then
      raise exception 'FAIL 11: zweite Entscheidung wurde angenommen';
    end if;
  end $$;
rollback;

-- Abgrenzung: ein Nachtrag setzt eine angenommene Offerte voraus, und die
-- Mandantengrenze gilt auch hier.
begin;
  do $$
  declare v_c uuid := 'a0000000-0000-4000-8000-0000000000c1'; v_off uuid; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    insert into public.offers (company_id, customer_first_name, customer_last_name,
                               customer_email, title, status, service_date, subtotal)
    values (v_c,'A','B','a@example.test','Nur versendet','sent', current_date + 30, 500)
    returning id into v_off;

    v_ok := false;
    begin perform public.create_offer_amendment(v_off, 'Test');
    exception when invalid_parameter_value then v_ok := true; end;
    if not v_ok then raise exception 'FAIL 12: Nachtrag zu nicht angenommener Offerte moeglich'; end if;

    update public.offers set status = 'accepted', accepted_at = now() where id = v_off;
    perform set_config('request.jwt.claims',
      '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
    v_ok := false;
    begin perform public.create_offer_amendment(v_off, 'Fremd');
    exception when insufficient_privilege then v_ok := true; end;
    if not v_ok then raise exception 'FAIL 13: fremde Offerte akzeptiert einen Nachtrag'; end if;
  end $$;
rollback;

select 'PASS nachtrag' as result;
