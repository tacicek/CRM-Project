-- S1: Anonyme Schreibrechte auf `leads` und `raeumung_anfragen` schliessen
--
-- ── Befund ─────────────────────────────────────────────────────────────────
--
-- Beide Tabellen tragen eine INSERT-Policy, die `anon` ausdruecklich einschliesst
-- und `WITH CHECK (true)` sagt — also: jeder darf schreiben, was er will.
--
--   leads              : leads_public_insert_v2            TO anon, authenticated
--   raeumung_anfragen  : "Anyone can insert raeumung requests" TO anon, authenticated
--
-- Das war im Offerio-Marktplatz richtig: dort gab es oeffentliche
-- Anfrage-Formulare, die ohne Anmeldung einen Lead anlegten. In diesem Fork
-- gibt es sie nicht mehr. Gemessen:
--
--   * Kein `.rpc("submit_lead…")` im Frontend — die Funktion hat null Aufrufer.
--   * Von 16 Zugriffen auf `leads` im Frontend sind 14 SELECT, einer UPDATE
--     (AnfrageEditDialog) und einer DELETE (Anfragen). KEIN einziger INSERT.
--   * `raeumung_anfragen` kommt im gesamten `src/` nur in der generierten
--     Typdatei vor — kein Leser, kein Schreiber.
--   * Leads entstehen ausschliesslich serverseitig: `import-manual-lead`
--     (JWT + Firmenzugehoerigkeit) und `inbound-email-lead` (Svix-Signatur).
--     Beide arbeiten mit dem Service-Role-Schluessel und umgehen RLS ohnehin.
--
-- Dazu kommen Tabellenrechte, die niemand je vergeben wollte. `anon` hat auf
-- beiden Tabellen das volle Programm:
--
--   DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--
-- Das ist der bekannte Rueckstand eines `--no-privileges`-Restores. Bei den
-- meisten davon greift RLS und die Zeilen bleiben unsichtbar — bei EINEM aber
-- nicht: TRUNCATE unterliegt keiner Row-Level-Security. Wer die Rolle `anon`
-- erreicht, koennte damit die Tabelle leeren. Ueber PostgREST ist TRUNCATE
-- nicht ansprechbar; ueber eine direkte Verbindung schon.
--
-- ── Was hier passiert ──────────────────────────────────────────────────────
--
-- Die beiden INSERT-Policies fallen weg, nicht nur der `anon`-Teil: eine
-- Policy ohne Aufrufer ist keine Regel, sondern eine offene Tuer, die niemand
-- benutzt. `authenticated` verliert damit einen Weg, den es nie gegangen ist.
--
-- Und `anon` verliert JEDES Recht auf beiden Tabellen. Auch SELECT — das ist
-- gesondert geprueft und keine Nebenwirkung: es gibt keine SELECT-Policy fuer
-- `anon`, keine oeffentliche Seite liest die Tabellen direkt, keine Sicht und
-- keine SECURITY-INVOKER-Funktion mit `anon`-Recht greift darauf zu. Vor der
-- Migration sieht `anon` null Zeilen, nachher ebenfalls; die Rechte waren
-- schlicht totes Gewicht.
--
-- `authenticated`, `service_role` und `postgres` werden NICHT angefasst.
--
-- Wiederholbar: alles mit IF EXISTS bzw. REVOKE, ein zweiter Lauf ist ein No-op.

BEGIN;

-- ── 1. Die beiden INSERT-Policies ohne Aufrufer ────────────────────────────

DROP POLICY IF EXISTS "leads_public_insert_v2" ON public.leads;
DROP POLICY IF EXISTS "Anyone can insert raeumung requests" ON public.raeumung_anfragen;

-- Historische Namen desselben Wegs. Sie sollten laengst weg sein, aber ein
-- `DROP … IF EXISTS` kostet nichts und schliesst den Fall, dass eine aeltere
-- Installation noch einen davon traegt.
DROP POLICY IF EXISTS "leads_insert_public"          ON public.leads;
DROP POLICY IF EXISTS "Public lead submission"       ON public.leads;
DROP POLICY IF EXISTS "Public can submit leads"      ON public.leads;
DROP POLICY IF EXISTS "Anyone can submit a lead"     ON public.leads;
DROP POLICY IF EXISTS "Allow public lead submissions" ON public.leads;

-- ── 2. Alle Tabellenrechte von `anon` ──────────────────────────────────────
--
-- Einzeln aufgezaehlt statt `REVOKE ALL`, damit im Text steht, was gemeint ist
-- — und damit die Nachpruefung unten dieselbe Liste noch einmal einzeln
-- durchgeht.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, SELECT
  ON public.leads FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, SELECT
  ON public.raeumung_anfragen FROM anon;

-- ── 3. Nachpruefung, fail-closed ───────────────────────────────────────────
--
-- Gemessen wird der Katalog, nicht die Absicht. Faellt eine Pruefung durch,
-- nimmt die Ausnahme die ganze Transaktion mit.
DO $$
DECLARE
  k_tabellen constant text[] := ARRAY['leads','raeumung_anfragen'];
  k_rechte   constant text[] := ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','SELECT'];
  v_tabelle  text;
  v_recht    text;
  v_anzahl   integer;
  v_namen    text[];
BEGIN
  FOREACH v_tabelle IN ARRAY k_tabellen LOOP
    -- (1) Keine Policy auf dieser Tabelle darf `anon` noch nennen.
    SELECT count(*), array_agg(p.polname ORDER BY p.polname)
      INTO v_anzahl, v_namen
      FROM pg_catalog.pg_policy p
     WHERE p.polrelid = format('public.%I', v_tabelle)::regclass
       AND EXISTS (
             SELECT 1 FROM unnest(p.polroles) r
              WHERE r = 'anon'::regrole
           );
    IF v_anzahl <> 0 THEN
      RAISE EXCEPTION 'Pruefung 1 (%): % Policy(s) nennen anon: %', v_tabelle, v_anzahl, v_namen;
    END IF;

    -- (2) Kein einziges Tabellenrecht mehr fuer `anon` — jedes einzeln.
    FOREACH v_recht IN ARRAY k_rechte LOOP
      IF pg_catalog.has_table_privilege('anon', format('public.%I', v_tabelle), v_recht) THEN
        RAISE EXCEPTION 'Pruefung 2 (%): anon hat weiterhin %', v_tabelle, v_recht;
      END IF;
    END LOOP;

    -- (3) Und in der ACL steht `anon` gar nicht mehr. `has_table_privilege`
    --     allein wuerde einen Eintrag mit null Rechten nicht bemerken.
    SELECT count(*) INTO v_anzahl
      FROM pg_catalog.pg_class c,
           LATERAL aclexplode(c.relacl) acl
     WHERE c.oid = format('public.%I', v_tabelle)::regclass
       AND acl.grantee = 'anon'::regrole;
    IF v_anzahl <> 0 THEN
      RAISE EXCEPTION 'Pruefung 3 (%): % ACL-Eintrag/-Eintraege fuer anon', v_tabelle, v_anzahl;
    END IF;

    -- (4) Gegenrichtung: die Rollen, die arbeiten muessen, behalten ihre
    --     Rechte. Ohne diese Pruefung koennte ein zu breites REVOKE das
    --     Dashboard lahmlegen, und die Migration meldete trotzdem Erfolg.
    FOREACH v_recht IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF NOT pg_catalog.has_table_privilege('authenticated', format('public.%I', v_tabelle), v_recht) THEN
        RAISE EXCEPTION 'Pruefung 4 (%): authenticated hat % verloren', v_tabelle, v_recht;
      END IF;
      IF NOT pg_catalog.has_table_privilege('service_role', format('public.%I', v_tabelle), v_recht) THEN
        RAISE EXCEPTION 'Pruefung 4 (%): service_role hat % verloren', v_tabelle, v_recht;
      END IF;
    END LOOP;

    -- (5) RLS bleibt an. Ein `anon` ohne Rechte und eine Tabelle ohne RLS
    --     waeren zusammen wieder offen, sobald jemand ein Recht zurueckgibt.
    PERFORM 1 FROM pg_catalog.pg_class c
      WHERE c.oid = format('public.%I', v_tabelle)::regclass AND c.relrowsecurity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pruefung 5 (%): RLS ist nicht aktiv', v_tabelle;
    END IF;
  END LOOP;

  -- (6) Die Policies, die bleiben sollen, sind noch da — sonst haette ein zu
  --     weiter DROP das Dashboard mitgenommen.
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_policy
   WHERE polrelid = 'public.leads'::regclass
     AND polname IN ('leads_select_company_or_admin','leads_update_company_or_admin','leads_delete_company_or_admin');
  IF v_anzahl <> 3 THEN
    RAISE EXCEPTION 'Pruefung 6: von den drei leads-Policies sind nur % uebrig', v_anzahl;
  END IF;

  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_policy
   WHERE polrelid = 'public.raeumung_anfragen'::regclass
     AND polname IN ('Admins can view all raeumung requests','Admins can update raeumung requests');
  IF v_anzahl <> 2 THEN
    RAISE EXCEPTION 'Pruefung 6: von den zwei raeumung-Policies sind nur % uebrig', v_anzahl;
  END IF;

  RAISE NOTICE 'S1: anon hat auf leads und raeumung_anfragen kein Recht und keine Policy mehr.';
END
$$;

COMMIT;
