-- Offertenversionierung: eine versendete Offerte wird nicht mehr verändert.
--
-- Prüft 20260728190000 / 200000 / 210000. Der Kern ist eine Zusage an den
-- Kunden: was er gesehen hat, bleibt nachlesbar — und was er annimmt, ist das,
-- was aktuell gilt.
--
-- Jeder Block läuft in begin/rollback und RAISEt bei Verstoss.

\set ON_ERROR_STOP on

-- =============================================================================
-- A) Entwurf offen, Versand sperrt
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_id uuid; v_ok boolean;
  begin
    -- Ohne diese Angabe ist auth.uid() NULL, RLS blendet die Zeile aus, das
    -- UPDATE trifft 0 Zeilen und der Trigger kommt gar nicht erst dran — die
    -- Zusicherung wuerde dann das Gegenteil dessen pruefen, was sie soll.
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    insert into public.offers (company_id, customer_first_name, customer_last_name,
                               customer_email, title, status, service_date, subtotal)
    values (v_c,'A','B','a@example.test','Entwurf','draft', current_date + 30, 1000)
    returning id into v_id;

    if (select locked_at from public.offers where id = v_id) is not null then
      raise exception 'FAIL A1: Entwurf ist gesperrt';
    end if;
    if (select offer_series_id from public.offers where id = v_id) <> v_id then
      raise exception 'FAIL A2: Entwurf eroeffnet keine eigene Serie';
    end if;

    update public.offers set title = 'Entwurf geaendert' where id = v_id;

    update public.offers set status = 'sent', sent_at = now() where id = v_id;
    if (select locked_at from public.offers where id = v_id) is null then
      raise exception 'FAIL A3: Versand setzt locked_at nicht';
    end if;

    -- Ab hier ist der Inhalt gesperrt — auch fuer die Rolle authenticated.
    v_ok := false;
    begin
      set local role authenticated;
      update public.offers set subtotal = 99 where id = v_id;
      reset role;
    exception when insufficient_privilege then reset role; v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL A4: Preis nach Versand aenderbar'; end if;

    -- Eine Zeile, die gleich als `sent` entsteht, muss ebenso gesperrt sein.
    insert into public.offers (company_id, customer_first_name, customer_last_name,
                               customer_email, title, status, service_date, subtotal)
    values (v_c,'A','B','a@example.test','Direkt versendet','sent', current_date + 30, 1000)
    returning id into v_id;
    if (select locked_at from public.offers where id = v_id) is null then
      raise exception 'FAIL A5: direkt als sent angelegte Offerte bleibt ungesperrt';
    end if;
  end $$;
rollback;

-- =============================================================================
-- B) Revision: Inhalt kommt mit, der Vorgänger bleibt stehen
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_v1 uuid; v_v2 uuid; v_res jsonb; v_n int;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    insert into public.offers (company_id, customer_first_name, customer_last_name,
                               customer_email, title, status, service_date, subtotal,
                               internal_notes)
    values (v_c,'A','B','a@example.test','Original','sent', current_date + 30, 1000, 'Notiz')
    returning id into v_v1;
    insert into public.offer_items (offer_id, position, description, quantity, unit, unit_price)
    values (v_v1, 1, 'Umzug', 2, 'Std', 120);

    v_res := public.create_offer_revision(v_v1, 'Preis angepasst');
    v_v2 := (v_res ->> 'neue_offerte_id')::uuid;

    if (v_res ->> 'version') <> '2' then
      raise exception 'FAIL B1: falsche Versionsnummer (%)', v_res ->> 'version';
    end if;

    -- Inhalt kopiert, Status zurückgesetzt, eigener Token, gleiche Nummer.
    if not exists (
      select 1 from public.offers n, public.offers a
      where n.id = v_v2 and a.id = v_v1
        and n.title = 'Original' and n.internal_notes = 'Notiz'
        and n.status = 'draft' and n.locked_at is null
        and n.access_token <> a.access_token
        and n.offer_number = a.offer_number
        and n.offer_series_id = a.offer_series_id
        and n.supersedes_offer_id = a.id
    ) then
      raise exception 'FAIL B2: Revision uebernimmt den Inhalt nicht korrekt';
    end if;

    select count(*) into v_n from public.offer_items where offer_id = v_v2;
    if v_n <> 1 then raise exception 'FAIL B3: Positionen nicht mitkopiert (%)', v_n; end if;

    -- Der Vorgaenger bleibt, was er war, und gilt als ueberholt.
    if not exists (select 1 from public.offers
                   where id = v_v1 and title = 'Original' and status = 'sent'
                     and superseded_at is not null) then
      raise exception 'FAIL B4: Vorgaenger veraendert oder nicht als ueberholt markiert';
    end if;
  end $$;
rollback;

-- =============================================================================
-- C) Der öffentliche Weg: alter Link lesbar, aber nicht mehr annehmbar
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_v1 uuid; v_v2 uuid; v_tok text; v_res jsonb; v_n int;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    insert into public.offers (company_id, customer_first_name, customer_last_name,
                               customer_email, title, status, service_date, subtotal)
    values (v_c,'A','B','a@example.test','V1','sent', current_date + 30, 1000)
    returning id, access_token into v_v1, v_tok;

    v_res := public.create_offer_revision(v_v1);
    v_v2 := (v_res ->> 'neue_offerte_id')::uuid;
    update public.offers set status = 'sent', sent_at = now() where id = v_v2;

    -- Der alte Link zeigt weiterhin die alte Fassung, aber als ueberholt.
    if not exists (select 1 from public.get_offer_by_token(v_tok)
                   where title = 'V1' and is_superseded and version_number = 1) then
      raise exception 'FAIL C1: alter Link zeigt die alte Fassung nicht als ueberholt';
    end if;

    -- Annehmen geht darueber nicht mehr …
    if public.update_offer_by_token(v_tok, 'accepted', null, now()) then
      raise exception 'FAIL C2: ueberholte Fassung liess sich annehmen';
    end if;
    select count(*) into v_n from public.auftraege where offer_id = v_v1;
    if v_n <> 0 then raise exception 'FAIL C3: Auftrag aus ueberholter Fassung entstanden'; end if;

    -- … Oeffnen aber schon (man will wissen, dass der alte Link benutzt wird).
    if not public.update_offer_by_token(v_tok, 'viewed', now()) then
      raise exception 'FAIL C4: alter Link laesst sich nicht mehr oeffnen';
    end if;

    -- Ueber den aktuellen Link geht es.
    if not public.update_offer_by_token(
         (select access_token from public.offers where id = v_v2), 'accepted', null, now()) then
      raise exception 'FAIL C5: aktuelle Fassung laesst sich nicht annehmen';
    end if;
  end $$;
rollback;

-- =============================================================================
-- D) Abgrenzungen
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_id uuid; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    -- Ein Entwurf braucht keine Revision.
    insert into public.offers (company_id, customer_first_name, customer_last_name,
                               customer_email, title, status, service_date, subtotal)
    values (v_c,'A','B','a@example.test','Entwurf','draft', current_date + 30, 1000)
    returning id into v_id;
    v_ok := false;
    begin perform public.create_offer_revision(v_id);
    exception when invalid_parameter_value then v_ok := true; end;
    if not v_ok then raise exception 'FAIL D1: Entwurf liess sich revidieren'; end if;

    -- Eine angenommene Offerte ist ein Nachtrag, keine Revision.
    update public.offers set status = 'sent', sent_at = now() where id = v_id;
    update public.offers set status = 'accepted', accepted_at = now() where id = v_id;
    v_ok := false;
    begin perform public.create_offer_revision(v_id);
    exception when invalid_parameter_value then v_ok := true; end;
    if not v_ok then raise exception 'FAIL D2: angenommene Offerte liess sich revidieren'; end if;

    -- Eine fremde Offerte gar nicht.
    perform set_config('request.jwt.claims',
      '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
    v_ok := false;
    begin perform public.create_offer_revision(v_id);
    exception when insufficient_privilege then v_ok := true; end;
    if not v_ok then raise exception 'FAIL D3: fremde Offerte liess sich revidieren'; end if;
  end $$;
rollback;

select 'PASS offerte-version' as result;
