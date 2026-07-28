-- Rollenmodell: Mitgliedschaft statt Eigentum.
--
-- Prüft die Zusagen aus 20260728170000 und 20260728180000. Der springende Punkt
-- ist ein Benutzer, den die Fixtures NICHT haben: ein eingeladenes Mitglied, das
-- die Firma nicht besitzt. Genau für den war die Anwendung bis 2026-07-28 leer —
-- und zwar lautlos, als leere Seite statt als Fehler.
--
-- Jeder Block läuft in begin/rollback und RAISEt bei Verstoss, damit psql
-- (ON_ERROR_STOP=1) mit ungleich null endet.

\set ON_ERROR_STOP on

-- =============================================================================
-- A) Der Eigentümer ist immer auch Mitglied — vom Trigger, nicht von Hand
-- =============================================================================
begin;
  do $$
  declare
    v_user  uuid := 'a0000000-0000-4000-8000-000000000001';
    v_firma uuid;
    v_rolle text;
  begin
    insert into public.companies (company_name, email, city, plz, user_id)
    values ('Trigger Test AG', 'trigger@example.test', 'Zürich', '8000', v_user)
    returning id into v_firma;

    select role into v_rolle
    from public.company_members where company_id = v_firma and user_id = v_user;

    if v_rolle is distinct from 'owner' then
      raise exception 'FAIL A1: neue Firma ohne owner-Mitgliedschaft (Rolle: %)', coalesce(v_rolle, '<keine>');
    end if;

    -- Kein Eigentümer -> keine Mitgliedschaft, aber auch kein Fehler.
    insert into public.companies (company_name, email, city, plz, user_id)
    values ('Ohne Eigentuemer AG', 'ohne@example.test', 'Zürich', '8000', null)
    returning id into v_firma;
    if exists (select 1 from public.company_members where company_id = v_firma) then
      raise exception 'FAIL A2: Firma ohne Eigentuemer bekam eine Mitgliedschaft';
    end if;
  end $$;
rollback;

-- =============================================================================
-- B) Ein eingeladenes Mitglied sieht die Betriebsdaten seiner Firma
-- =============================================================================
begin;
  insert into auth.users (id, aud, role, email, is_sso_user, is_anonymous)
  values ('c0000000-0000-4000-8000-000000000003','authenticated','authenticated',
          'mitarbeiter-a@example.test', false, false)
  on conflict (id) do nothing;

  insert into public.company_members (company_id, user_id, role)
  values ('a0000000-0000-4000-8000-0000000000c1','c0000000-0000-4000-8000-000000000003','member')
  on conflict (company_id, user_id) do nothing;

  -- Je eine Zeile, gegen die geprüft werden kann.
  insert into public.rechnungen (company_id, rechnung_nr, customer_name, faellig_am, datum)
  values ('a0000000-0000-4000-8000-0000000000c1','RE-ROLLEN-A','Kunde A', current_date + 30, current_date);
  insert into public.checklist_templates (company_id, title, service_type)
  values ('a0000000-0000-4000-8000-0000000000c1','Vorlage A','umzug');

  do $$
  declare n int;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
    set local role authenticated;

    -- Die Firma selbst muss auflösbar sein — sonst ist alles andere sinnlos.
    select count(*) into n from public.companies;
    if n <> 1 then raise exception 'FAIL B1: Mitglied loest seine Firma nicht auf (%)', n; end if;

    -- Gezielt auf die eben angelegten Zeilen pruefen: die Fixtures bringen
    -- eigene mit, eine Gleichheitspruefung auf 1 waere nur zufaellig richtig.
    select count(*) into n from public.rechnungen where customer_name = 'Kunde A';
    if n <> 1 then raise exception 'FAIL B2: Mitglied sieht die Rechnung nicht (%)', n; end if;

    select count(*) into n from public.checklist_templates where title = 'Vorlage A';
    if n <> 1 then raise exception 'FAIL B3: Mitglied sieht die Checkliste nicht (%)', n; end if;

    reset role;
  end $$;
rollback;

-- =============================================================================
-- C) Tägliche Arbeit ja, Konfiguration nein
-- =============================================================================
begin;
  insert into auth.users (id, aud, role, email, is_sso_user, is_anonymous)
  values ('c0000000-0000-4000-8000-000000000003','authenticated','authenticated',
          'mitarbeiter-a@example.test', false, false)
  on conflict (id) do nothing;
  insert into public.company_members (company_id, user_id, role)
  values ('a0000000-0000-4000-8000-0000000000c1','c0000000-0000-4000-8000-000000000003','member')
  on conflict (company_id, user_id) do nothing;
  insert into public.checklist_templates (company_id, title, service_type)
  values ('a0000000-0000-4000-8000-0000000000c1','Vorlage A','umzug');
  insert into public.rechnungen (company_id, rechnung_nr, customer_name, faellig_am, datum)
  values ('a0000000-0000-4000-8000-0000000000c1','RE-ROLLEN-A','Kunde A', current_date + 30, current_date);

  do $$
  declare n int; ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
    set local role authenticated;

    -- C1: Rechnung schreiben ist tägliche Arbeit, kein Konfigurationsakt.
    ok := true;
    begin
      insert into public.rechnungen (company_id, rechnung_nr, customer_name, faellig_am, datum)
      values ('a0000000-0000-4000-8000-0000000000c1','RE-ROLLEN-C','Kunde B', current_date + 30, current_date);
    exception when others then ok := false;
    end;
    if not ok then raise exception 'FAIL C1: Mitglied darf keine Rechnung anlegen'; end if;

    -- C2: eine Vorlage zu ändern gehört dem Eigentümer/Administrator.
    update public.checklist_templates set updated_at = updated_at where title = 'Vorlage A';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL C2: Mitglied konnte % Vorlage(n) aendern', n; end if;

    -- C3: Belege löschen ebenfalls nicht.
    delete from public.rechnungen where customer_name in ('Kunde A','Kunde B');
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL C3: Mitglied konnte % Rechnung(en) loeschen', n; end if;

    reset role;
  end $$;

  -- C4: der Eigentümer darf die Vorlage weiterhin ändern.
  do $$
  declare n int;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    set local role authenticated;
    update public.checklist_templates set updated_at = updated_at where title = 'Vorlage A';
    get diagnostics n = row_count;
    if n = 0 then raise exception 'FAIL C4: Eigentuemer kann die Vorlage nicht mehr aendern'; end if;
    reset role;
  end $$;
rollback;

-- =============================================================================
-- D) Die Mandantengrenze hält auch für Mitglieder
-- =============================================================================
begin;
  insert into auth.users (id, aud, role, email, is_sso_user, is_anonymous)
  values ('c0000000-0000-4000-8000-000000000003','authenticated','authenticated',
          'mitarbeiter-a@example.test', false, false)
  on conflict (id) do nothing;
  insert into public.company_members (company_id, user_id, role)
  values ('a0000000-0000-4000-8000-0000000000c1','c0000000-0000-4000-8000-000000000003','member')
  on conflict (company_id, user_id) do nothing;
  insert into public.rechnungen (company_id, rechnung_nr, customer_name, faellig_am, datum)
  values ('b0000000-0000-4000-8000-0000000000c2','RE-ROLLEN-B','Kunde von B', current_date + 30, current_date);

  do $$
  declare n int;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
    set local role authenticated;
    select count(*) into n from public.rechnungen where customer_name = 'Kunde von B';
    if n <> 0 then raise exception 'FAIL D1: Mitglied von A sieht % Rechnung(en) von B', n; end if;
    reset role;
  end $$;
rollback;

-- =============================================================================
-- E) api_keys bleibt bewusst am Eigentum — Zugangsdaten, keine Betriebsdaten
-- =============================================================================
do $$
begin
  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'api_keys'
        and coalesce(qual,'') || coalesce(with_check,'') like '%user_id%') <> 4 then
    raise exception 'FAIL E1: api_keys-Policies wurden veraendert — das war eine bewusste Entscheidung';
  end if;
end $$;

select 'PASS rollen' as result;
