-- Posteingang und Kennzahlen.
--
-- Prüft 20260801100000 / 110000. Zwei Dinge stehen im Mittelpunkt: es wird
-- KEIN Volltext gespeichert, und gezählt wird die Offertenserie statt der Zeile.

\set ON_ERROR_STOP on

-- =============================================================================
-- A) Datensparsamkeit — struktureller Nachweis
--
-- Kein Test auf Verhalten, sondern auf das Schema selbst: gäbe es eine Spalte
-- für den Volltext, könnte irgendwann jemand hineinschreiben. Es gibt keine.
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'communication_messages'
      and column_name in ('body', 'body_text', 'body_html', 'content', 'raw')
  ) then
    raise exception 'FAIL A1: communication_messages hat eine Volltextspalte';
  end if;

  -- Gegenprobe, damit A1 nicht bloss deshalb besteht, weil die Tabelle fehlt.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'communication_messages'
      and column_name = 'preview'
  ) then
    raise exception 'FAIL A2: es gibt nicht einmal die Vorschau';
  end if;

  if not (select relrowsecurity from pg_class
          where oid = 'public.communication_messages'::regclass) then
    raise exception 'FAIL A3: communication_messages ohne RLS';
  end if;
end $$;

-- =============================================================================
-- B) Der Faden entsteht aus den bestehenden Tabellen
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde uuid; v_lead uuid; v_faden uuid; v_n int;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    select id, customer_id into v_lead, v_kunde from public.leads
    where company_id = v_c limit 1;

    -- Eine ausgehende Mail landet im Faden, ohne dass jemand etwas ruft.
    insert into public.email_logs (company_id, lead_id, recipient_email, subject,
                                   email_type, status, language)
    values (v_c, v_lead, 'kunde-a@example.test', 'Ihre Offerte', 'offer', 'sent', 'de');

    select id into v_faden from public.communication_threads
    where company_id = v_c order by created_at desc limit 1;
    if v_faden is null then raise exception 'FAIL B1: kein Faden entstanden'; end if;

    select count(*) into v_n from public.communication_messages
    where thread_id = v_faden and direction = 'outbound';
    if v_n <> 1 then raise exception 'FAIL B2: ausgehende Nachricht fehlt (%)', v_n; end if;

    -- Nach dem Versand warten WIR nicht mehr.
    if (select first_unanswered_at from public.communication_threads where id = v_faden)
       is not null then
      raise exception 'FAIL B3: ausgehende Nachricht laesst den Faden unbeantwortet';
    end if;

    -- Eine eingehende Mail setzt die Wartemarke.
    insert into public.inbound_emails (company_id, lead_id, customer_id, provider,
                                       provider_message_id, from_email, subject,
                                       body_preview, processing_status, received_at)
    values (v_c, v_lead, v_kunde, 'resend', 'test-msg-rueckfrage',
            'kunde-a@example.test', 'Rueckfrage', 'Kurzer Ausschnitt',
            'lead_created', now());

    if (select first_unanswered_at from public.communication_threads where id = v_faden)
       is null then
      raise exception 'FAIL B4: eingehende Nachricht setzt keine Wartemarke';
    end if;
    if (select last_direction from public.communication_threads where id = v_faden)
       <> 'inbound' then
      raise exception 'FAIL B5: Richtung nicht fortgeschrieben';
    end if;

    -- Der Backfill liest dieselben Zeilen nicht ein zweites Mal ein.
    perform public.run_communication_backfill(v_c);
    select count(*) into v_n from public.communication_messages where company_id = v_c;
    perform public.run_communication_backfill(v_c);
    if (select count(*) from public.communication_messages where company_id = v_c) <> v_n then
      raise exception 'FAIL B6: Backfill liest doppelt ein';
    end if;
  end $$;
rollback;

-- =============================================================================
-- C) Ohne Bezug kein Faden
--
-- Eine abgewiesene Spam-Mail hat weder Kunde noch Anfrage. Sie soll in
-- inbound_emails bleiben und NICHT in einem Kundengespräch auftauchen.
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_vorher int;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    select count(*) into v_vorher from public.communication_threads where company_id = v_c;

    insert into public.inbound_emails (company_id, provider, provider_message_id,
                                       from_email, subject, body_preview,
                                       processing_status, received_at)
    values (v_c, 'resend', 'test-msg-spam', 'spam@example.invalid', 'Gewinn!',
            'Text', 'rejected', now());

    if (select count(*) from public.communication_threads where company_id = v_c) <> v_vorher then
      raise exception 'FAIL C1: Spam hat einen Kundenfaden erzeugt';
    end if;
  end $$;
rollback;

-- =============================================================================
-- D) Aufbewahrung
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_kunde uuid; v_faden uuid; v_msg uuid;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    select id into v_kunde from public.customers where company_id = v_c limit 1;
    v_faden := public.resolve_or_create_thread(v_c, v_kunde, 'email', 'Alt');

    insert into public.communication_messages
      (company_id, thread_id, direction, channel, subject, preview, occurred_at)
    values (v_c, v_faden, 'inbound', 'email', 'Alte Mail', 'Geheimer Ausschnitt',
            now() - interval '30 months')
    returning id into v_msg;

    perform public.communication_retention();

    if (select preview from public.communication_messages where id = v_msg) is not null then
      raise exception 'FAIL D1: alter Vorschautext nicht geleert';
    end if;
    -- Die Tatsache des Kontakts bleibt.
    if not exists (select 1 from public.communication_messages where id = v_msg) then
      raise exception 'FAIL D2: die Nachricht selbst wurde geloescht';
    end if;
  end $$;
rollback;

-- =============================================================================
-- E) Kennzahlen: die Serie zählt, nicht die Zeile
-- =============================================================================
begin;
  do $$
  declare
    v_c uuid := 'a0000000-0000-4000-8000-0000000000c1';
    v_lead uuid; v_o1 uuid; v_o2 uuid; v_serie uuid; v_k jsonb;
    v_vorher int; v_ok boolean;
  begin
    perform set_config('request.jwt.claims',
      '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

    insert into public.leads (company_id, customer_first_name, customer_last_name,
                              customer_email, customer_phone, service_type, from_plz, from_city)
    values (v_c,'KPI','Test','kpi@example.test','079 555 55 55','umzug','8000','Zürich')
    returning id into v_lead;

    v_k := public.lifecycle_kpis(v_c);
    v_vorher := (v_k -> 'trichter' ->> 'serien_versendet')::int;

    -- Erste Fassung, versendet.
    insert into public.offers (company_id, lead_id, customer_first_name, customer_last_name,
                               customer_email, title, status, service_date, subtotal, sent_at)
    values (v_c, v_lead,'KPI','Test','kpi@example.test','Fassung 1','sent',
            current_date + 20, 1000, now())
    returning id, offer_series_id into v_o1, v_serie;

    -- Zweite Fassung derselben Serie, angenommen.
    insert into public.offers (company_id, lead_id, offer_series_id, version_number,
                               customer_first_name, customer_last_name, customer_email,
                               title, status, service_date, subtotal, sent_at, accepted_at)
    values (v_c, v_lead, v_serie, 2,'KPI','Test','kpi@example.test','Fassung 2','accepted',
            current_date + 20, 1200, now(), now())
    returning id into v_o2;

    v_k := public.lifecycle_kpis(v_c);

    -- Zwei Zeilen, EINE Serie. Wer Zeilen zaehlte, kaeme auf +2.
    if (v_k -> 'trichter' ->> 'serien_versendet')::int <> v_vorher + 1 then
      raise exception 'FAIL E1: zwei Fassungen als zwei Offerten gezaehlt (% statt %)',
        (v_k -> 'trichter' ->> 'serien_versendet')::int, v_vorher + 1;
    end if;
    if (v_k -> 'trichter' ->> 'serien_angenommen')::int < 1 then
      raise exception 'FAIL E2: angenommene Fassung nicht als angenommene Serie gezaehlt';
    end if;

    -- Fremde Firma
    v_ok := false;
    begin perform public.lifecycle_kpis('b0000000-0000-4000-8000-0000000000c2');
    exception when insufficient_privilege then v_ok := true; end;
    if not v_ok then raise exception 'FAIL E3: fremde Kennzahlen lesbar'; end if;
  end $$;
rollback;

-- =============================================================================
-- F) Rechte
-- =============================================================================
do $$
begin
  if (select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('lifecycle_kpis','run_communication_backfill',
                          'resolve_or_create_thread','communication_retention')) then
    raise exception 'FAIL F1: eine Kommunikations- oder Kennzahlfunktion ist fuer anon offen';
  end if;
  if (select bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE'))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'communication_retention') then
    raise exception 'FAIL F2: die Aufbewahrungsregel ist aus dem Browser aufrufbar';
  end if;
  if not (select has_function_privilege('authenticated', p.oid, 'EXECUTE')
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'lifecycle_kpis') then
    raise exception 'FAIL F3: die App kann die Kennzahlen nicht lesen';
  end if;
end $$;

select 'PASS kommunikation' as result;
