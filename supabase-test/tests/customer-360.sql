-- Customer 360: Mandantentrennung und Zuordnungsregel.
--
-- Prueft die Zusagen, die der Umbau vom 2026-07-28 gibt (Migrationen 20260728100000
-- bis 20260728160000). Jeder Block laeuft in begin/rollback und RAISEt bei
-- Verstoss, damit psql (ON_ERROR_STOP=1) mit ungleich null endet.
--
-- Die Firmen- und Benutzer-IDs stammen aus supabase-test/seed/fixtures.sql
-- (Mandant A = …c1, Mandant B = …c2).

\set ON_ERROR_STOP on

-- =============================================================================
-- A) Zuordnungsregel: E-Mail bindet, reines Telefon nicht
-- =============================================================================
begin;
  do $$
  declare
    r1 jsonb; r2 jsonb; r3 jsonb;
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
  begin
    r1 := public.resolve_or_create_customer(v_c, 'Anna@Example.COM ', '079 123 45 67', 'Anna', 'Muster');
    if (r1 ->> 'customer_id') is null or (r1 ->> 'created')::boolean is not true then
      raise exception 'FAIL A1: erster Aufruf legt keinen Kunden an: %', r1;
    end if;

    -- Dieselbe Adresse anders geschrieben trifft denselben Kunden.
    r2 := public.resolve_or_create_customer(v_c, ' anna@example.com', '+41 79 123 45 67', 'Anna', 'Muster');
    if (r2 ->> 'customer_id') is distinct from (r1 ->> 'customer_id') then
      raise exception 'FAIL A2: gleiche E-Mail ergibt zweiten Kunden (% vs %)',
        r2 ->> 'customer_id', r1 ->> 'customer_id';
    end if;
    if (r2 ->> 'created')::boolean then
      raise exception 'FAIL A2: zweiter Aufruf meldet created=true';
    end if;

    -- Gleiche Nummer, ANDERE Adresse: neuer Kunde, beide als Verdacht markiert.
    r3 := public.resolve_or_create_customer(v_c, 'rita@example.com', '079 123 45 67', 'Rita', 'Muster');
    if (r3 ->> 'customer_id') = (r1 ->> 'customer_id') then
      raise exception 'FAIL A3: reiner Telefontreffer hat gebunden statt zu trennen';
    end if;
    if not (select bool_and(possible_duplicate) from public.customers
            where id in ((r1 ->> 'customer_id')::uuid, (r3 ->> 'customer_id')::uuid)) then
      raise exception 'FAIL A3: Duplikat-Verdacht nicht auf beiden Seiten gesetzt';
    end if;

    -- Ohne jedes Merkmal entsteht KEIN Kunde.
    if (public.resolve_or_create_customer(v_c, '', '', 'Unbekannt', 'Unbekannt') ->> 'customer_id') is not null then
      raise exception 'FAIL A4: Kunde ohne Kontaktkanal angelegt';
    end if;
  end $$;
rollback;

-- =============================================================================
-- B) Der Kunde wird beim Anlegen gesetzt und die Kette entlang vererbt
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_lead uuid; v_kunde uuid; v_offer uuid;
  begin
    insert into public.leads (company_id, customer_first_name, customer_last_name,
                              customer_email, customer_phone, service_type, from_plz, from_city)
    values (v_c, 'Kette', 'Test', 'kette@example.com', '079 222 33 44', 'umzug', '8004', 'Zuerich')
    returning id, customer_id into v_lead, v_kunde;

    if v_kunde is null then
      raise exception 'FAIL B1: leads-Trigger hat keinen Kunden gesetzt';
    end if;

    insert into public.offers (company_id, lead_id, customer_first_name, customer_last_name,
                               customer_email, title, access_token, status)
    values (v_c, v_lead, 'Kette', 'Test', 'kette@example.com', 'Offerte', 'contract-kette', 'sent')
    returning id into v_offer;

    if (select customer_id from public.offers where id = v_offer) is distinct from v_kunde then
      raise exception 'FAIL B2: Offerte hat den Kunden des Leads nicht geerbt';
    end if;
  end $$;
rollback;

-- =============================================================================
-- C) Der Name wird nicht mehr zerschnitten
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_auftrag uuid; v_first text; v_last text;
  begin
    insert into public.auftraege (company_id, auftrag_nummer, title, customer_name,
                                  customer_first_name, customer_last_name, scheduled_date, status)
    values (v_c, '', 'Namenstest', 'Anna Maria von Gunten',
            'Anna Maria', 'von Gunten', current_date + 7, 'geplant')
    returning id into v_auftrag;

    select customer_first_name, customer_last_name into v_first, v_last
    from public.auftraege where id = v_auftrag;

    if v_first <> 'Anna Maria' or v_last <> 'von Gunten' then
      raise exception 'FAIL C1: Namenstrennung nicht gespeichert (% / %)', v_first, v_last;
    end if;
  end $$;
rollback;

-- =============================================================================
-- D) Mandantentrennung — die Zusage aus dem Abnahmekriterium
-- =============================================================================
begin;
  do $$
  declare
    v_a uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_b uuid := 'a0000000-0000-4000-8000-0000000000c2';
    v_kunde_a uuid;
    v_ok boolean;
  begin
    v_kunde_a := (public.resolve_or_create_customer(v_a, 'fremd@example.com', null, 'Fremd', 'Kunde') ->> 'customer_id')::uuid;

    -- Als Mitglied von Firma B auftreten.
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

    v_ok := false;
    begin
      perform public.customer_summary(v_kunde_a);
    exception when insufficient_privilege then v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL D1: customer_summary gibt fremden Kunden preis'; end if;

    v_ok := false;
    begin
      perform count(*) from public.customer_timeline(v_kunde_a);
    exception when insufficient_privilege then v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL D2: customer_timeline gibt fremden Kunden preis'; end if;

    v_ok := false;
    begin
      perform count(*) from public.search_customers(v_a);
    exception when insufficient_privilege then v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL D3: search_customers gibt fremde Firma preis'; end if;

    v_ok := false;
    begin
      perform count(*) from public.duplicate_candidates(v_a);
    exception when insufficient_privilege then v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL D4: duplicate_candidates gibt fremde Firma preis'; end if;

    perform set_config('request.jwt.claims', null, true);
  end $$;
rollback;

-- =============================================================================
-- E) Der zusammengesetzte Fremdschluessel haelt die Mandanten auseinander
-- =============================================================================
begin;
  do $$
  declare
    v_a uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_b uuid := 'a0000000-0000-4000-8000-0000000000c2';
    v_kunde_a uuid; v_ok boolean := false;
  begin
    v_kunde_a := (public.resolve_or_create_customer(v_a, 'fk@example.com', null, 'FK', 'Test') ->> 'customer_id')::uuid;
    begin
      insert into public.auftraege (company_id, auftrag_nummer, title, customer_name,
                                    scheduled_date, status, customer_id)
      values (v_b, '', 'Fremdzuordnung', 'X', current_date + 7, 'geplant', v_kunde_a);
    exception when foreign_key_violation then v_ok := true;
    end;
    if not v_ok then
      raise exception 'FAIL E1: Kunde von Firma A liess sich an einen Auftrag von Firma B haengen';
    end if;
  end $$;
rollback;

-- =============================================================================
-- F) Schutzmechanismen
-- =============================================================================
begin;
  do $$
  declare
    v_a uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde uuid; v_ok boolean := false;
  begin
    v_kunde := (public.resolve_or_create_customer(v_a, 'guard@example.com', null, 'Guard', 'Test') ->> 'customer_id')::uuid;

    -- Die Zusammenfuehrungsfelder gehen nur ueber merge_customers().
    begin
      set local role service_role;
      update public.customers set merged_at = now() where id = v_kunde;
      reset role;
    exception when insufficient_privilege then
      reset role; v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL F1: merge-Felder direkt setzbar'; end if;

    -- preview_customer_backfill ist STABLE: Postgres muss ein Schreiben verhindern.
    -- (Hier nur die Deklaration pruefen — der Beweis waere sonst eine Fehlermeldung.)
    if (select provolatile from pg_proc where proname = 'preview_customer_backfill') <> 's' then
      raise exception 'FAIL F2: preview_customer_backfill ist nicht STABLE und koennte schreiben';
    end if;
  end $$;
rollback;

-- =============================================================================
-- G) Der Marktplatz-Rest ist weg
-- =============================================================================
do $$
begin
  if to_regclass('public.lead_distributions') is not null then
    raise exception 'FAIL G1: lead_distributions existiert noch';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'offers'
               and column_name = 'lead_distribution_id') then
    raise exception 'FAIL G2: offers.lead_distribution_id existiert noch';
  end if;
  -- Die einzige SELECT-Policy auf leads darf beim Aufraeumen nicht verlorengegangen sein.
  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'leads' and cmd = 'SELECT') <> 1 then
    raise exception 'FAIL G3: leads hat nicht genau eine SELECT-Policy';
  end if;
  -- Views duerfen RLS nicht umgehen (20260728080000).
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind = 'v'
               and not ('security_invoker=on' = any(coalesce(c.reloptions, '{}')))) then
    raise exception 'FAIL G4: mindestens eine View laeuft ohne security_invoker und umgeht RLS';
  end if;
end $$;

-- =============================================================================
-- H) Anschriften: eine Hauptadresse je Art, von der Datenbank gehalten
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_k uuid; v_a1 uuid; v_a2 uuid; v_ok boolean := false;
  begin
    v_k := (public.resolve_or_create_customer(v_c, 'anschrift@example.com', null, 'An', 'Schrift') ->> 'customer_id')::uuid;

    insert into public.customer_addresses (company_id, customer_id, address_raw, address_type, city, plz)
    values (v_c, v_k, 'Teststrasse 1, 8000 Zuerich', 'correspondence', 'Zuerich', '8000')
    returning id into v_a1;

    -- Eine zweite Hauptadresse derselben Art loest die erste ab, statt zu scheitern.
    insert into public.customer_addresses (company_id, customer_id, address_raw, address_type, city, plz)
    values (v_c, v_k, 'Neugasse 9, 9000 St. Gallen', 'correspondence', 'St. Gallen', '9000')
    returning id into v_a2;

    if (select count(*) from public.customer_addresses
        where customer_id = v_k and address_type = 'correspondence' and is_primary) <> 1 then
      raise exception 'FAIL H1: mehr oder weniger als eine Hauptadresse je Art';
    end if;
    if not (select is_primary from public.customer_addresses where id = v_a2) then
      raise exception 'FAIL H2: die zuletzt gesetzte Hauptadresse ist nicht die aktuelle';
    end if;

    -- Rechnungsadresse ist eine EIGENE Art und verdraengt die Korrespondenz nicht.
    insert into public.customer_addresses (company_id, customer_id, address_raw, address_type)
    values (v_c, v_k, 'Postfach 12, 8001 Zuerich', 'billing');
    if (select count(*) from public.customer_addresses
        where customer_id = v_k and is_primary) <> 2 then
      raise exception 'FAIL H3: Rechnungsadresse hat die Korrespondenzadresse verdraengt';
    end if;

    -- Faellt die Hauptadresse weg, rueckt die verbliebene nach.
    delete from public.customer_addresses where id = v_a2;
    if not (select is_primary from public.customer_addresses where id = v_a1) then
      raise exception 'FAIL H4: nach dem Loeschen ist keine Hauptadresse nachgerueckt';
    end if;

    -- Kein Kunde einer fremden Firma.
    begin
      insert into public.customer_addresses (company_id, customer_id, address_raw)
      values ('a0000000-0000-4000-8000-0000000000c2', v_k, 'Fremdgasse 1');
    exception when foreign_key_violation then v_ok := true;
    end;
    if not v_ok then
      raise exception 'FAIL H5: Anschrift liess sich firmenfremd anlegen';
    end if;
  end $$;
rollback;

-- =============================================================================
-- I) Zusammenfuehren laesst NICHTS stehen
--
-- Der Befund, der 20260807100000 ausgeloest hat: die alte Fassung haengte sieben
-- Tabellen um. Dieser Block legt an der Quelle je einen Datensatz in den seither
-- hinzugekommenen Tabellen an und verlangt, dass danach keiner mehr dort haengt.
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_q uuid; v_z uuid; v_erg jsonb; v_vor jsonb; v_rechnung uuid;
    v_rest text;
    v_ref record; v_n bigint;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    v_q := (public.resolve_or_create_customer(v_c, 'quelle@example.com', '+41790000101', 'Quelle', 'Test') ->> 'customer_id')::uuid;
    v_z := (public.resolve_or_create_customer(v_c, 'ziel@example.com',   '+41790000102', 'Ziel',   'Test') ->> 'customer_id')::uuid;

    insert into public.payments (company_id, customer_id, payment_date, amount, method)
      values (v_c, v_q, current_date, 250.00, 'bank');
    insert into public.rechnungen (company_id, customer_id, customer_name, datum, faellig_am,
                                   positionen, zwischensumme, mwst_satz, mwst_betrag,
                                   total, rabatt, gesamttotal, status, language)
      values (v_c, v_q, 'Quelle Test', current_date, current_date + 30,
              '[{"beschreibung":"Umzug","menge":1,"einheit":"Pauschal","einzelpreis":500,"betrag":500}]'::jsonb,
              500, 8.1, 40.50, 540.50, 0, 540.50, 'versendet', 'de')
      returning id into v_rechnung;
    insert into public.credit_notes (company_id, customer_id, rechnung_id, amount, status)
      values (v_c, v_q, v_rechnung, 40.00, 'versendet');
    insert into public.crm_tasks (company_id, customer_id, title, task_type, status)
      values (v_c, v_q, 'Rueckruf', 'call', 'open');
    insert into public.customer_cases (company_id, customer_id, case_type, title)
      values (v_c, v_q, 'complaint', 'Kratzer am Schrank');
    insert into public.service_locations (company_id, customer_id, address_raw, kind)
      values (v_c, v_q, 'Quellenweg 3, 8400 Winterthur', 'from');
    insert into public.customer_addresses (company_id, customer_id, address_raw, address_type)
      values (v_c, v_q, 'Quellenweg 3, 8400 Winterthur', 'correspondence');
    insert into public.communication_threads (company_id, customer_id, channel, subject)
      values (v_c, v_q, 'email', 'Anfrage');

    -- Die Vorschau muss diese Tabellen NENNEN, sonst verspricht sie zu wenig.
    v_vor := public.customer_merge_preview(v_c, v_q, v_z);
    if (v_vor -> 'moves' -> 'payments') is null
       or (v_vor -> 'moves' -> 'customer_cases') is null
       or (v_vor -> 'moves' -> 'crm_tasks') is null
       or (v_vor -> 'moves' -> 'customer_addresses') is null then
      raise exception 'FAIL I1: Vorschau zaehlt die neuen Tabellen nicht: %', v_vor -> 'moves';
    end if;

    v_erg := public.merge_customers(v_c, v_q, v_z, 'Test');
    if (v_erg ->> 'target_customer_id')::uuid <> v_z then
      raise exception 'FAIL I2: falsches Ziel gemeldet';
    end if;

    -- Die eigentliche Zusicherung: KEINE Spalte zeigt mehr auf die Quelle.
    for v_ref in select * from public.customer_reference_columns() loop
      execute format('select count(*) from %s where %I = $1', v_ref.tabelle, v_ref.spalte)
        into v_n using v_q;
      if v_n > 0 then
        v_rest := coalesce(v_rest || ', ', '') || v_ref.tabelle || '.' || v_ref.spalte || '=' || v_n;
      end if;
    end loop;
    if v_rest is not null then
      raise exception 'FAIL I3: nach dem Zusammenfuehren haengt noch etwas an der Quelle: %', v_rest;
    end if;

    -- Und die Kundenkarte des Ziels zeigt es auch.
    if (public.customer_summary(v_z) -> 'finanzen' ->> 'bezahlt')::numeric <> 250.00 then
      raise exception 'FAIL I4: Zahlung der Quelle fehlt in der Zusammenfassung des Ziels';
    end if;
    if (public.customer_summary(v_z) -> 'offen' ->> 'faelle')::int < 1 then
      raise exception 'FAIL I5: Fall der Quelle fehlt beim Ziel';
    end if;
    if (public.customer_summary(v_z) -> 'anzahl' ->> 'adressen')::int < 1 then
      raise exception 'FAIL I6: Anschrift der Quelle fehlt beim Ziel';
    end if;

    perform set_config('request.jwt.claims', null, true);
  end $$;
rollback;

-- =============================================================================
-- I2) Das Zahlungsbuch bleibt geschlossen — die Merge-Ausnahme ist eng
--
-- 20260807100000 laesst `payments.customer_id` einer Zusammenfuehrung folgen.
-- Dieser Block prueft, dass die Ausnahme NUR dafuer gilt: ohne Marke, mit
-- falscher Marke und fuer jede andere Spalte bleibt das Buch anhaengend.
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_a uuid; v_b uuid; v_p uuid; v_ok boolean;
  begin
    v_a := (public.resolve_or_create_customer(v_c, 'zb-a@example.com', null, 'ZB', 'A') ->> 'customer_id')::uuid;
    v_b := (public.resolve_or_create_customer(v_c, 'zb-b@example.com', null, 'ZB', 'B') ->> 'customer_id')::uuid;

    insert into public.payments (company_id, customer_id, payment_date, amount, method)
      values (v_c, v_a, current_date, 99.00, 'bank') returning id into v_p;

    -- 1. ohne Marke
    v_ok := false;
    begin
      update public.payments set customer_id = v_b where id = v_p;
    exception when insufficient_privilege then v_ok := true;
    end;
    if not v_ok then raise exception 'FAIL I7: Zahlung ohne Zusammenfuehrung umgehaengt'; end if;

    -- 2. mit einer Marke, die einen ANDEREN Wechsel meint
    v_ok := false;
    begin
      perform set_config('crm.merging_customers', v_b::text || '>' || v_a::text, true);
      update public.payments set customer_id = v_b where id = v_p;
    exception when insufficient_privilege then v_ok := true;
    end;
    perform set_config('crm.merging_customers', '', true);
    if not v_ok then raise exception 'FAIL I8: falsche Marke hat das Umhaengen erlaubt'; end if;

    -- 3. der Betrag bleibt unveraenderlich, auch waehrend einer Zusammenfuehrung
    v_ok := false;
    begin
      perform set_config('crm.merging_customers', v_a::text || '>' || v_b::text, true);
      update public.payments set amount = 1.00 where id = v_p;
    exception when insufficient_privilege then v_ok := true;
    end;
    perform set_config('crm.merging_customers', '', true);
    if not v_ok then raise exception 'FAIL I9: der Betrag liess sich waehrend einer Zusammenfuehrung aendern'; end if;
  end $$;
rollback;

-- =============================================================================
-- J) Gleiche Anschrift wird zusammengelegt, nicht verdoppelt
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_q uuid; v_z uuid; v_ort_q uuid; v_auftrag uuid;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    v_q := (public.resolve_or_create_customer(v_c, 'dq@example.com', null, 'D', 'Q') ->> 'customer_id')::uuid;
    v_z := (public.resolve_or_create_customer(v_c, 'dz@example.com', null, 'D', 'Z') ->> 'customer_id')::uuid;

    -- Beide kennen dieselbe Wohnung; nur die Quelle weiss vom Lift.
    insert into public.service_locations (company_id, customer_id, address_raw, has_elevator)
      values (v_c, v_q, 'Doppelweg 5, 3000 Bern', true) returning id into v_ort_q;
    insert into public.service_locations (company_id, customer_id, address_raw, floor)
      values (v_c, v_z, ' doppelweg 5, 3000 bern ', '3. OG');

    insert into public.auftraege (company_id, auftrag_nummer, title, customer_name,
                                  scheduled_date, status, customer_id, from_location_id)
      values (v_c, '', 'Dublette', 'D Q', current_date + 7, 'geplant', v_q, v_ort_q)
      returning id into v_auftrag;

    perform public.merge_customers(v_c, v_q, v_z, null);

    if (select count(*) from public.service_locations where customer_id = v_z) <> 1 then
      raise exception 'FAIL J1: dieselbe Adresse steht nach dem Zusammenfuehren doppelt';
    end if;
    if not (select has_elevator from public.service_locations where customer_id = v_z) then
      raise exception 'FAIL J2: das Wissen der Quelle (Lift) ist beim Zusammenlegen verlorengegangen';
    end if;
    if (select floor from public.service_locations where customer_id = v_z) is distinct from '3. OG' then
      raise exception 'FAIL J3: der Wert des Ziels wurde ueberschrieben';
    end if;
    if (select from_location_id from public.auftraege where id = v_auftrag)
       <> (select id from public.service_locations where customer_id = v_z) then
      raise exception 'FAIL J4: der Auftrag zeigt auf einen geloeschten Ort';
    end if;

    perform set_config('request.jwt.claims', null, true);
  end $$;
rollback;

-- =============================================================================
-- K) "Letzte Aktion" ist Vergangenheit — ein Termin naechste Woche ist es nicht
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_k uuid; v_s jsonb;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    v_k := (public.resolve_or_create_customer(v_c, 'zukunft@example.com', null, 'Zu', 'Kunft') ->> 'customer_id')::uuid;

    insert into public.appointments (company_id, customer_id, appointment_date, start_time,
                                     end_time, title, appointment_type, status)
    values (v_c, v_k, current_date + 14, time '09:00', time '12:00', 'Umzug', 'service', 'confirmed');

    v_s := public.customer_summary(v_k);

    if (v_s -> 'aktivitaet' ->> 'letzte_aktion') is not null
       and (v_s -> 'aktivitaet' ->> 'letzte_aktion')::timestamptz > now() then
      raise exception 'FAIL K1: ein zukuenftiger Termin gilt als letzte Aktion (%)',
        v_s -> 'aktivitaet' ->> 'letzte_aktion';
    end if;
    if (v_s -> 'aktivitaet' -> 'naechster_termin' ->> 'id') is null then
      raise exception 'FAIL K2: der zukuenftige Termin fehlt unter naechster_termin';
    end if;
    -- Die Uhrzeit gehoert dazu: "am 21." ohne "09:00" beantwortet die Frage nicht.
    if (v_s -> 'aktivitaet' -> 'naechster_termin' ->> 'start') is null then
      raise exception 'FAIL K3: der naechste Termin kommt ohne Uhrzeit';
    end if;

    -- Und der stattgefundene Termin zaehlt sehr wohl.
    insert into public.appointments (company_id, customer_id, appointment_date, start_time,
                                     end_time, title, appointment_type, status)
    values (v_c, v_k, current_date - 3, time '14:00', time '15:00', 'Besichtigung', 'besichtigung', 'completed');

    v_s := public.customer_summary(v_k);
    if (v_s -> 'aktivitaet' ->> 'letzte_aktion') is null then
      raise exception 'FAIL K4: ein vergangener Termin zaehlt nicht als letzte Aktion';
    end if;

    perform set_config('request.jwt.claims', null, true);
  end $$;
rollback;

-- =============================================================================
-- L) Kundenliste: der Ort kommt aus der Anschrift, nicht aus dem Auszug
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_k uuid; v_ort text; v_quelle text; v_kz jsonb;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    insert into public.leads (company_id, customer_first_name, customer_last_name,
                              customer_email, customer_phone, service_type, from_plz, from_city)
    values (v_c, 'Orts', 'Test', 'ort@example.com', '+41790000201', 'umzug_privat', '8004', 'Zuerich')
    returning customer_id into v_k;

    select s.ort, s.ort_quelle into v_ort, v_quelle
    from public.search_customers(v_c, 'ort@example.com') s;
    if v_quelle is distinct from 'einsatzort' then
      raise exception 'FAIL L1: ohne Anschrift muss der Ort als Einsatzort gekennzeichnet sein (%)', v_quelle;
    end if;

    insert into public.customer_addresses (company_id, customer_id, address_raw, plz, city)
    values (v_c, v_k, 'Wohngasse 2, 3000 Bern', '3000', 'Bern');

    select s.ort, s.ort_quelle into v_ort, v_quelle
    from public.search_customers(v_c, 'ort@example.com') s;
    if v_ort is distinct from '3000 Bern' or v_quelle is distinct from 'adresse' then
      raise exception 'FAIL L2: die Anschrift schlaegt den Auszugsort nicht (% / %)', v_ort, v_quelle;
    end if;

    -- Suche nach dem Wohnort findet den Kunden.
    if not exists (select 1 from public.search_customers(v_c, 'Bern')) then
      raise exception 'FAIL L3: Suche nach dem Ort der Anschrift findet nichts';
    end if;

    -- Inaktiv zaehlt fehlende AKTIVITAET, nicht ein altes first_seen_at.
    update public.customers set first_seen_at = now() - interval '400 days' where id = v_k;
    v_kz := public.customer_kennzahlen(v_c);
    if (v_kz ->> 'inaktiv90')::int > 0 then
      raise exception 'FAIL L4: ein Kunde mit frischer Anfrage gilt als inaktiv (%)', v_kz;
    end if;

    perform set_config('request.jwt.claims', null, true);
  end $$;
rollback;

select 'PASS customer-360' as result;
