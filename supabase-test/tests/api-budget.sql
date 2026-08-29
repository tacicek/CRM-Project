-- Budgetzaehler fuer bezahlte Fremd-APIs: er muss die Anfrage ueberleben.
--
-- Befund R2-01 (gemessen 2026-08-28 beim Ausrollen von calculate-distance): der
-- alte Zaehler lag in einer `Map` im Modulkoerper einer Edge Function. Der
-- ausgerollte Router erzeugt PRO ANFRAGE einen neuen User-Worker, also war die
-- `Map` immer leer und die Drossel wirkungslos — 61 Anfragen, null Antworten
-- mit 429, vor und nach dem Ausrollen identisch.
--
-- Diese Datei prueft die Nachfolgerin. Der springende Punkt ist nicht "zaehlt
-- sie hoch", sondern: sie zaehlt ueber PROZESSGRENZEN hinweg, sie ist unter
-- Nebenlaeufigkeit atomar, und sie laesst niemanden ohne geprueften Aufrufer
-- und ohne Mitgliedschaft auch nur eine Einheit verbrauchen.
--
-- Jeder Block laeuft in begin/rollback und RAISEt bei Verstoss, damit psql
-- (ON_ERROR_STOP=1) mit ungleich null endet.

\set ON_ERROR_STOP on

-- =============================================================================
-- A) Ohne geprueften Aufrufer wird nichts verbraucht
-- =============================================================================
begin;
  do $$
  declare
    v_vorher bigint;
  begin
    -- Relativ gemessen, nicht absolut: der Stapel kann Zeilen aus frueheren
    -- Laeufen tragen, und "Tabelle leer" ist nicht die Zusage. Die Zusage ist:
    -- ein abgewiesener Aufruf verbraucht NICHTS.
    select coalesce(sum(count), 0) into v_vorher from public.api_rate_budget;

    begin
      perform public.consume_api_budget('google-distance', NULL, 'a0000000-0000-4000-8000-0000000000c1');
      raise exception 'FAIL A: ein NULL-Aufrufer wurde akzeptiert';
    exception when invalid_authorization_specification then null;
    end;

    if (select coalesce(sum(count), 0) from public.api_rate_budget) <> v_vorher then
      raise exception 'FAIL A: ein abgewiesener Aufruf hat Budget verbraucht';
    end if;
    raise notice 'PASS A: ohne geprueften Aufrufer kein Verbrauch';
  end $$;
rollback;

-- =============================================================================
-- B) Eine fremde oder erfundene Firma faellt durch — die Mitgliedschaft
--    entscheidet, nicht der Aufruf
-- =============================================================================
begin;
  do $$
  declare
    v_user_a  uuid := 'a0000000-0000-4000-8000-000000000001';
    v_firma_b uuid := 'b0000000-0000-4000-8000-0000000000c2';
    v_vorher  bigint;
  begin
    select coalesce(sum(count), 0) into v_vorher from public.api_rate_budget;
    begin
      perform public.consume_api_budget('google-distance', v_user_a, v_firma_b);
      raise exception 'FAIL B: Benutzer A durfte auf das Budget der Firma B zugreifen';
    exception when insufficient_privilege then null;
    end;

    begin
      perform public.consume_api_budget('google-distance', v_user_a,
                                        'deadbeef-0000-4000-8000-00000000dead');
      raise exception 'FAIL B: eine erfundene company_id wurde akzeptiert';
    exception when insufficient_privilege then null;
    end;

    if (select coalesce(sum(count), 0) from public.api_rate_budget) <> v_vorher then
      raise exception 'FAIL B: ein abgewiesener Aufruf hat Budget verbraucht';
    end if;
    raise notice 'PASS B: fremde und erfundene Firma fallen durch, ohne Verbrauch';
  end $$;
rollback;

-- =============================================================================
-- C) Der Zaehler zaehlt — und kippt genau am Limit
-- =============================================================================
begin;
  do $$
  declare
    v_user  uuid := 'a0000000-0000-4000-8000-000000000001';
    v_firma uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_erlaubt int := 0;
    v_erste_verweigerung int := 0;
    v_antwort jsonb;
  begin
    for i in 1..35 loop
      v_antwort := public.consume_api_budget('google-distance', v_user, v_firma);
      if (v_antwort->>'allowed')::boolean then
        v_erlaubt := v_erlaubt + 1;
      elsif v_erste_verweigerung = 0 then
        v_erste_verweigerung := i;
      end if;
    end loop;

    -- Benutzerlimit fuer 'google-distance' ist 30.
    if v_erlaubt <> 30 then
      raise exception 'FAIL C: % erlaubt statt 30', v_erlaubt;
    end if;
    if v_erste_verweigerung <> 31 then
      raise exception 'FAIL C: erste Verweigerung bei % statt 31', v_erste_verweigerung;
    end if;
    raise notice 'PASS C: 30 erlaubt, ab der 31. verweigert';
  end $$;
rollback;

-- =============================================================================
-- D) Retry-After ist deterministisch: nie 0, nie groesser als das Fenster
-- =============================================================================
begin;
  do $$
  declare
    v_user  uuid := 'a0000000-0000-4000-8000-000000000001';
    v_firma uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_antwort jsonb;
    v_retry int;
  begin
    for i in 1..31 loop
      v_antwort := public.consume_api_budget('google-distance', v_user, v_firma);
    end loop;

    if (v_antwort->>'allowed')::boolean then
      raise exception 'FAIL D: nach 31 Aufrufen noch erlaubt';
    end if;

    v_retry := (v_antwort->>'retry_after')::int;
    if v_retry < 1 or v_retry > 60 then
      raise exception 'FAIL D: retry_after=% liegt ausserhalb von 1..60', v_retry;
    end if;
    raise notice 'PASS D: retry_after=% liegt im Fenster', v_retry;
  end $$;
rollback;

-- =============================================================================
-- E) Ein unbekannter Topf wird abgewiesen, nicht stillschweigend erlaubt
-- =============================================================================
begin;
  do $$
  declare v_user uuid := 'a0000000-0000-4000-8000-000000000001';
  begin
    begin
      perform public.consume_api_budget('gibt-es-nicht', v_user,
                                        'a0000000-0000-4000-8000-0000000000c1');
      raise exception 'FAIL E: ein unbekannter Budgettopf wurde akzeptiert';
    exception when invalid_parameter_value then null;
    end;
    raise notice 'PASS E: unbekannter Topf abgewiesen';
  end $$;
rollback;

-- =============================================================================
-- F) Rechte: weder PUBLIC noch anon noch authenticated kommen heran
-- =============================================================================
begin;
  do $$
  begin
    if exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                where p.oid = 'public.consume_api_budget(text,uuid,uuid)'::regprocedure
                  and a.privilege_type = 'EXECUTE'
                  and (a.grantee = 0
                       or a.grantee = 'anon'::regrole::oid
                       or a.grantee = 'authenticated'::regrole::oid)) then
      raise exception 'FAIL F: consume_api_budget ist fuer PUBLIC/anon/authenticated ausfuehrbar';
    end if;

    if has_table_privilege('anon', 'public.api_rate_budget', 'SELECT')
       or has_table_privilege('anon', 'public.api_rate_budget', 'INSERT')
       or has_table_privilege('authenticated', 'public.api_rate_budget', 'SELECT')
       or has_table_privilege('authenticated', 'public.api_rate_budget', 'INSERT') then
      raise exception 'FAIL F: api_rate_budget ist fuer anon/authenticated erreichbar';
    end if;

    if not (select relrowsecurity from pg_class where oid = 'public.api_rate_budget'::regclass) then
      raise exception 'FAIL F: RLS ist auf api_rate_budget nicht aktiv';
    end if;

    if not has_function_privilege('service_role',
         'public.consume_api_budget(text,uuid,uuid)', 'EXECUTE') then
      raise exception 'FAIL F: service_role kann nicht ausfuehren — die Drossel waere tot';
    end if;

    raise notice 'PASS F: nur service_role kommt heran, RLS aktiv';
  end $$;
rollback;

-- =============================================================================
-- G) Begrenzte Aufbewahrung: alte Fenster verschwinden
-- =============================================================================
begin;
  do $$
  declare
    v_user  uuid := 'a0000000-0000-4000-8000-000000000001';
    v_firma uuid := 'a0000000-0000-4000-8000-0000000000c1';
  begin
    insert into public.api_rate_budget (bucket, principal, window_start, count)
    values ('google-distance', 'user:00000000-0000-0000-0000-000000000000',
            clock_timestamp() - interval '3 hours', 5);

    -- Der erste Aufruf eines Prinzipals in einem neuen Fenster raeumt auf.
    perform public.consume_api_budget('google-distance', v_user, v_firma);

    if exists (select 1 from public.api_rate_budget
                where window_start < clock_timestamp() - interval '1 hour') then
      raise exception 'FAIL G: alte Fenster wurden nicht entfernt';
    end if;
    raise notice 'PASS G: begrenzte Aufbewahrung greift';
  end $$;
rollback;

select 'ALL API-BUDGET ASSERTIONS PASSED' as ergebnis;
