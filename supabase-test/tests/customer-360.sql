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

select 'PASS customer-360' as result;
