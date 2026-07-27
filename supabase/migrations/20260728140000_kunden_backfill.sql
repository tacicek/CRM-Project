-- =============================================================================
-- Backfill: Bestandsdaten der kanonischen Kundenidentitaet zuordnen
-- =============================================================================
--
-- BEFUND
-- Ab 20260728130000 bekommt jeder NEUE Vorgang seinen Kunden. Der Bestand —
-- 68 Anfragen, 54 Offerten, 15 Auftraege, 43 Termine, 18 Rechnungen, 8
-- Quittungen — bleibt ohne. Eine Kundenkarte, die erst ab heute etwas zeigt,
-- beantwortet die Frage nicht, fuer die sie gebaut wurde.
--
-- ABHILFE — in zwei getrennten Schritten
-- Diese Datei legt NUR Funktionen an. Sie schreibt keine einzige Zeile.
--
--   1. preview_customer_backfill()  — Bericht, LANGUAGE plpgsql STABLE.
--      Dass sie nichts schreibt, ist keine Zusage im Kommentar: Postgres weist
--      in einer nicht-volatilen Funktion jedes INSERT zur Laufzeit ab.
--   2. run_customer_backfill()      — schreibt, wird VON HAND aufgerufen,
--      nachdem der Bericht gelesen wurde.
--
-- Der Umweg ueber BEGIN … ROLLBACK waere die naheliegende Alternative gewesen
-- und ist bewusst verworfen: Sequenzen laufen weiter, Trigger feuern, und ein
-- vergessenes ROLLBACK waere nicht mehr einzufangen.
--
-- WOHER DER KANONISCHE WERT KOMMT — je Feld, nicht je Zeile
-- Keine einzelne Zeile traegt alles: die Offerte kennt die Anrede, aber keine
-- Sprache aus erster Hand; die Anfrage kennt die Sprache, aber keine
-- Kundennummer. Deshalb wird jedes Feld einzeln bestimmt:
--
--   Vor-/Nachname  offers → leads → appointments, je das neueste, ohne
--                  Platzhalter. Auftrag, Rechnung und Quittung sind KEINE
--                  Namensquelle: ihr customer_name ist ein Feld, und es zu
--                  zerlegen waere genau der Fehler, den 20260728120000
--                  abgestellt hat.
--   Anzeigename    aus Vor-/Nachname; sonst auftraege.customer_name UNZERLEGT.
--   Anrede         offers → leads → rechnungen.anrede.
--   Telefon        das neueste nicht leere ueber alle Quellen (eine Nummer
--                  aendert sich; hier zaehlt Aktualitaet, nicht Herkunft).
--   Sprache        leads → offers, das neueste.
--   Herkunft       die AELTESTE Zeile (source ist der erste Kontakt).
--   first_seen_at  MIN(created_at) — created_at waere der Zeitpunkt des
--                  Backfills und damit wertlos.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Gemeinsame Quellsicht
--
-- Bericht und Ausfuehrung lesen dieselbe Funktion. Zwei Abfragen mit derselben
-- Absicht waeren zwei Wahrheiten — und der Bericht haette keinen Wert mehr.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.customer_backfill_quellen(p_company_id UUID)
RETURNS TABLE (
  quelle_tabelle  TEXT,
  quelle_id       UUID,
  company_id      UUID,
  erstellt_am     TIMESTAMPTZ,
  vorname         TEXT,
  nachname        TEXT,
  ganzer_name     TEXT,
  email_roh       TEXT,
  telefon_roh     TEXT,
  anrede          TEXT,
  sprache         TEXT,
  herkunft        TEXT,
  kundennummer    TEXT,
  customer_id     UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'leads',  l.id, l.company_id, l.created_at,
         l.customer_first_name, l.customer_last_name, NULL::TEXT,
         l.customer_email, l.customer_phone, l.customer_salutation,
         l.language, l.source, NULL::TEXT, l.customer_id
  FROM public.leads l WHERE l.company_id = p_company_id
  UNION ALL
  SELECT 'offers', o.id, o.company_id, o.created_at,
         o.customer_first_name, o.customer_last_name, NULL::TEXT,
         o.customer_email, o.customer_phone, o.customer_salutation,
         o.language, 'offer', o.customer_number, o.customer_id
  FROM public.offers o WHERE o.company_id = p_company_id
  UNION ALL
  -- Vor-/Nachname erst seit 20260728120000; ganzer_name ist der Altbestand.
  SELECT 'auftraege', a.id, a.company_id, a.created_at,
         a.customer_first_name, a.customer_last_name, a.customer_name,
         a.customer_email, a.customer_phone, NULL::TEXT,
         a.language, 'auftrag', NULL::TEXT, a.customer_id
  FROM public.auftraege a WHERE a.company_id = p_company_id
  UNION ALL
  SELECT 'appointments', t.id, t.company_id, t.created_at,
         t.customer_first_name, t.customer_last_name, NULL::TEXT,
         t.customer_email, t.customer_phone, NULL::TEXT,
         t.language, 'termin', NULL::TEXT, t.customer_id
  FROM public.appointments t WHERE t.company_id = p_company_id
  UNION ALL
  SELECT 'rechnungen', r.id, r.company_id, r.created_at,
         NULL::TEXT, NULL::TEXT, r.customer_name,
         r.customer_email, r.customer_phone, r.anrede,
         r.language, 'rechnung', NULL::TEXT, r.customer_id
  FROM public.rechnungen r WHERE r.company_id = p_company_id
  UNION ALL
  SELECT 'quittungen', q.id, q.company_id, q.created_at,
         NULL::TEXT, NULL::TEXT, q.customer_name,
         q.customer_email, q.customer_phone, NULL::TEXT,
         q.language, 'quittung', NULL::TEXT, q.customer_id
  FROM public.quittungen q WHERE q.company_id = p_company_id;
$$;

COMMENT ON FUNCTION public.customer_backfill_quellen(UUID) IS
  'Vereinheitlichte Sicht auf alle Zeilen mit Kundenangaben. Von '
  'preview_customer_backfill() UND run_customer_backfill() benutzt, damit '
  'Bericht und Ausfuehrung dasselbe sehen. inbound_emails fehlt hier bewusst: '
  'aus einer eingehenden Mail entsteht nie ein Kunde.';

-- -----------------------------------------------------------------------------
-- 2. Bericht
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.preview_customer_backfill(p_company_id UUID)
RETURNS TABLE (
  identitaet            TEXT,
  identitaet_art        TEXT,
  quelle_tabelle        TEXT,
  quelle_id             UUID,
  erstellt_am           TIMESTAMPTZ,
  email_roh             TEXT,
  email_norm            TEXT,
  telefon_roh           TEXT,
  telefon_norm          TEXT,
  vorname               TEXT,
  nachname              TEXT,
  ganzer_name           TEXT,
  sprache               TEXT,
  zeilen_je_identitaet  INTEGER,
  bestehender_kunde     UUID,
  flag_namenskonflikt   BOOLEAN,
  flag_telefonkonflikt  BOOLEAN,
  flag_sprachkonflikt   BOOLEAN,
  flag_telefon_quer     BOOLEAN,
  flag_platzhalter      BOOLEAN,
  flag_ohne_firma       BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Firma' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH q AS (
    SELECT s.*,
           public.normalize_customer_email(s.email_roh)   AS e_norm,
           public.normalize_customer_phone(s.telefon_roh) AS p_norm,
           NULLIF(NULLIF(TRIM(COALESCE(s.vorname,  '')), ''), 'Unbekannt') AS v_clean,
           NULLIF(NULLIF(TRIM(COALESCE(s.nachname, '')), ''), 'Unbekannt') AS n_clean
    FROM public.customer_backfill_quellen(p_company_id) s
  ),
  k AS (
    SELECT q.*,
           CASE WHEN q.e_norm IS NOT NULL THEN 'e:' || q.e_norm
                WHEN q.p_norm IS NOT NULL THEN 'p:' || q.p_norm END AS ident,
           CASE WHEN q.e_norm IS NOT NULL THEN 'email'
                WHEN q.p_norm IS NOT NULL THEN 'phone_only'
                ELSE 'none' END AS art
    FROM q
  ),
  -- Eine Telefonnummer, die unter MEHREREN Identitaeten auftaucht, ist genau
  -- der Fall, den resolve_or_create_customer als Duplikat-Verdacht markiert.
  -- Alle Spalten qualifiziert: die Namen der RETURNS-TABLE-Parameter kollidieren
  -- sonst mit den CTE-Spalten (sprache, vorname, nachname, …).
  quer AS (
    SELECT k.p_norm FROM k
    WHERE k.p_norm IS NOT NULL AND k.ident IS NOT NULL
    GROUP BY k.p_norm HAVING count(DISTINCT k.ident) > 1
  ),
  agg AS (
    SELECT k.ident AS a_ident,
           count(*)::INTEGER                                AS n,
           count(DISTINCT lower(TRIM(COALESCE(k.n_clean, ''))))
             FILTER (WHERE k.n_clean IS NOT NULL)           AS n_namen,
           count(DISTINCT k.p_norm) FILTER (WHERE k.p_norm IS NOT NULL)   AS n_tel,
           count(DISTINCT k.sprache) FILTER (WHERE k.sprache IS NOT NULL) AS n_sprachen,
           max(k.customer_id::TEXT)                         AS vorhandener
    FROM k WHERE k.ident IS NOT NULL GROUP BY k.ident
  )
  SELECT
    k.ident, k.art, k.quelle_tabelle, k.quelle_id, k.erstellt_am,
    k.email_roh, k.e_norm, k.telefon_roh, k.p_norm,
    k.v_clean, k.n_clean, k.ganzer_name, k.sprache,
    COALESCE(agg.n, 1),
    agg.vorhandener::UUID,
    COALESCE(agg.n_namen, 0)    > 1,
    COALESCE(agg.n_tel, 0)      > 1,
    COALESCE(agg.n_sprachen, 0) > 1,
    k.p_norm IN (SELECT quer.p_norm FROM quer),
    -- Platzhalter aus _shared/leadMapping.ts
    (TRIM(COALESCE(k.vorname, '')) = 'Unbekannt' OR TRIM(COALESCE(k.nachname, '')) = 'Unbekannt'),
    k.company_id IS NULL
  FROM k LEFT JOIN agg ON agg.a_ident = k.ident
  ORDER BY (k.ident IS NULL) DESC, k.ident, k.erstellt_am;
END;
$$;

COMMENT ON FUNCTION public.preview_customer_backfill(UUID) IS
  'Bericht VOR dem Backfill. STABLE — Postgres verhindert jedes Schreiben zur '
  'Laufzeit, die Zusage steht nicht nur im Kommentar. Zeilen mit identitaet = NULL '
  'stehen oben: sie tragen weder E-Mail noch Telefon und bekommen keinen Kunden.';

REVOKE ALL ON FUNCTION public.preview_customer_backfill(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_customer_backfill(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.customer_backfill_quellen(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_backfill_quellen(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Ausfuehrung
--
-- Idempotent: ruehrt nur Zeilen mit customer_id IS NULL an und sucht fuer jede
-- Identitaet zuerst nach einem bestehenden Kunden. Ein zweiter Lauf aendert
-- nichts. Das ist gleichzeitig das Sicherheitsnetz fuer die stillen
-- RAISE WARNING in den Triggern aus 20260728130000.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.run_customer_backfill(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ident      RECORD;
  v_id         UUID;
  v_angelegt   INTEGER := 0;
  v_verknuepft JSONB   := '{}'::JSONB;
  v_n          INTEGER;
  v_summe      INTEGER := 0;
  v_offen      INTEGER;
  v_mails      INTEGER := 0;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Der Backfill ist dem Eigentuemer vorbehalten'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- IF NOT EXISTS + leeren, damit zwei Firmen in derselben Transaktion
  -- nacheinander laufen koennen (ON COMMIT DROP raeumt erst beim Commit auf).
  CREATE TEMP TABLE IF NOT EXISTS _bf_zuordnung (ident TEXT PRIMARY KEY, kunde UUID) ON COMMIT DROP;
  DELETE FROM _bf_zuordnung;

  FOR v_ident IN
    WITH q AS (
      SELECT s.*,
             public.normalize_customer_email(s.email_roh)   AS e_norm,
             public.normalize_customer_phone(s.telefon_roh) AS p_norm,
             NULLIF(NULLIF(TRIM(COALESCE(s.vorname,  '')), ''), 'Unbekannt') AS v_clean,
             NULLIF(NULLIF(TRIM(COALESCE(s.nachname, '')), ''), 'Unbekannt') AS n_clean
      FROM public.customer_backfill_quellen(p_company_id) s
      WHERE s.company_id IS NOT NULL
    ),
    k AS (
      SELECT q.*,
             CASE WHEN q.e_norm IS NOT NULL THEN 'e:' || q.e_norm
                  WHEN q.p_norm IS NOT NULL THEN 'p:' || q.p_norm END AS ident
      FROM q
    )
    SELECT
      k.ident,
      -- Name: offers vor leads vor appointments, je das neueste.
      (SELECT x.v_clean FROM k x WHERE x.ident = k.ident AND x.v_clean IS NOT NULL
         AND x.quelle_tabelle IN ('offers','leads','appointments')
       ORDER BY CASE x.quelle_tabelle WHEN 'offers' THEN 1 WHEN 'leads' THEN 2 ELSE 3 END,
                x.erstellt_am DESC LIMIT 1) AS vorname,
      (SELECT x.n_clean FROM k x WHERE x.ident = k.ident AND x.n_clean IS NOT NULL
         AND x.quelle_tabelle IN ('offers','leads','appointments')
       ORDER BY CASE x.quelle_tabelle WHEN 'offers' THEN 1 WHEN 'leads' THEN 2 ELSE 3 END,
                x.erstellt_am DESC LIMIT 1) AS nachname,
      -- Anzeigename aus einem Beleg, falls es keine getrennte Quelle gibt. UNZERLEGT.
      (SELECT NULLIF(TRIM(x.ganzer_name), '') FROM k x WHERE x.ident = k.ident
         AND NULLIF(TRIM(COALESCE(x.ganzer_name, '')), '') IS NOT NULL
       ORDER BY x.erstellt_am DESC LIMIT 1) AS ganzer_name,
      (SELECT x.anrede FROM k x WHERE x.ident = k.ident AND x.anrede IS NOT NULL
         AND x.anrede IN ('Herr','Frau','Firma')
       ORDER BY CASE x.quelle_tabelle WHEN 'offers' THEN 1 WHEN 'leads' THEN 2 ELSE 3 END,
                x.erstellt_am DESC LIMIT 1) AS anrede,
      (SELECT x.email_roh FROM k x WHERE x.ident = k.ident AND x.e_norm IS NOT NULL
       ORDER BY x.erstellt_am DESC LIMIT 1) AS email,
      (SELECT x.telefon_roh FROM k x WHERE x.ident = k.ident AND x.p_norm IS NOT NULL
       ORDER BY x.erstellt_am DESC LIMIT 1) AS telefon,
      (SELECT x.sprache FROM k x WHERE x.ident = k.ident AND x.sprache IS NOT NULL
         AND x.quelle_tabelle IN ('leads','offers')
       ORDER BY CASE x.quelle_tabelle WHEN 'leads' THEN 1 ELSE 2 END,
                x.erstellt_am DESC LIMIT 1) AS sprache,
      -- Herkunft: die AELTESTE Zeile, nicht die neueste.
      (SELECT x.herkunft FROM k x WHERE x.ident = k.ident AND x.herkunft IS NOT NULL
       ORDER BY x.erstellt_am ASC LIMIT 1) AS herkunft,
      (SELECT x.kundennummer FROM k x WHERE x.ident = k.ident
         AND NULLIF(TRIM(COALESCE(x.kundennummer, '')), '') IS NOT NULL
       ORDER BY x.erstellt_am DESC LIMIT 1) AS kundennummer,
      min(k.erstellt_am) AS erster_kontakt
    FROM k
    WHERE k.ident IS NOT NULL
    GROUP BY k.ident
    ORDER BY min(k.erstellt_am)
  LOOP
    -- BEWUSST NICHT find_customer_by_identity(): die bindet auch bei einem
    -- reinen Telefon-Treffer. Im Backfill waere das eine stille Verschmelzung
    -- zweier Menschen, die sich einen Anschluss teilen (Ehepaar, Verwaltung) —
    -- und sie waere unpruefbar, weil der Bericht dann eine andere Zahl nennt
    -- als der Lauf. Hier wird auf den Identitaetsschluessel selbst gebunden:
    -- E-Mail-Identitaet auf die E-Mail, Telefon-Identitaet nur auf einen Kunden,
    -- der selbst keine E-Mail hat. Ueberschneidungen landen unten im
    -- Duplikat-Verdacht und werden von Hand entschieden.
    IF v_ident.ident LIKE 'e:%' THEN
      SELECT c.id INTO v_id FROM public.customers c
      WHERE c.company_id = p_company_id
        AND c.merged_into_customer_id IS NULL
        AND c.email_normalized = substr(v_ident.ident, 3)
      LIMIT 1;
    ELSE
      SELECT c.id INTO v_id FROM public.customers c
      WHERE c.company_id = p_company_id
        AND c.merged_into_customer_id IS NULL
        AND c.email_normalized IS NULL
        AND c.phone_normalized = substr(v_ident.ident, 3)
      LIMIT 1;
    END IF;

    IF v_id IS NULL THEN
      INSERT INTO public.customers (
        company_id, customer_type, salutation, first_name, last_name,
        display_name, primary_email, primary_phone, language, source,
        first_seen_at, created_via
      ) VALUES (
        p_company_id,
        CASE WHEN v_ident.anrede = 'Firma' THEN 'company' ELSE 'person' END,
        v_ident.anrede, v_ident.vorname, v_ident.nachname,
        -- Getrennte Namen zuerst; sonst der Belegname, unveraendert.
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', v_ident.vorname, v_ident.nachname)), ''),
          v_ident.ganzer_name,
          ''),
        v_ident.email, v_ident.telefon,
        COALESCE(NULLIF(v_ident.sprache, ''), 'de'),
        v_ident.herkunft, v_ident.erster_kontakt, 'backfill'
      )
      RETURNING id INTO v_id;
      v_angelegt := v_angelegt + 1;
    END IF;

    -- Kundennummer aus der Offerte nachtragen, ohne Bestehendes zu ueberschreiben.
    IF v_ident.kundennummer IS NOT NULL THEN
      UPDATE public.customers
      SET external_customer_number = COALESCE(external_customer_number, v_ident.kundennummer)
      WHERE id = v_id;
    END IF;

    INSERT INTO _bf_zuordnung (ident, kunde) VALUES (v_ident.ident, v_id)
    ON CONFLICT (ident) DO NOTHING;
  END LOOP;

  -- Zeilen verknuepfen. Nur was noch offen ist.
  WITH z AS (
    SELECT l.id,
           COALESCE('e:' || public.normalize_customer_email(l.customer_email),
                    'p:' || public.normalize_customer_phone(l.customer_phone)) AS ident
    FROM public.leads l WHERE l.company_id = p_company_id AND l.customer_id IS NULL
  )
  UPDATE public.leads t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('leads', v_n); v_summe := v_summe + v_n;

  WITH z AS (
    SELECT o.id,
           COALESCE('e:' || public.normalize_customer_email(o.customer_email),
                    'p:' || public.normalize_customer_phone(o.customer_phone)) AS ident
    FROM public.offers o WHERE o.company_id = p_company_id AND o.customer_id IS NULL
  )
  UPDATE public.offers t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('offers', v_n); v_summe := v_summe + v_n;

  WITH z AS (
    SELECT a.id,
           COALESCE('e:' || public.normalize_customer_email(a.customer_email),
                    'p:' || public.normalize_customer_phone(a.customer_phone)) AS ident
    FROM public.auftraege a WHERE a.company_id = p_company_id AND a.customer_id IS NULL
  )
  UPDATE public.auftraege t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('auftraege', v_n); v_summe := v_summe + v_n;

  WITH z AS (
    SELECT t.id,
           COALESCE('e:' || public.normalize_customer_email(t.customer_email),
                    'p:' || public.normalize_customer_phone(t.customer_phone)) AS ident
    FROM public.appointments t WHERE t.company_id = p_company_id AND t.customer_id IS NULL
  )
  UPDATE public.appointments t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('appointments', v_n); v_summe := v_summe + v_n;

  WITH z AS (
    SELECT r.id,
           COALESCE('e:' || public.normalize_customer_email(r.customer_email),
                    'p:' || public.normalize_customer_phone(r.customer_phone)) AS ident
    FROM public.rechnungen r WHERE r.company_id = p_company_id AND r.customer_id IS NULL
  )
  UPDATE public.rechnungen t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('rechnungen', v_n); v_summe := v_summe + v_n;

  WITH z AS (
    SELECT q.id,
           COALESCE('e:' || public.normalize_customer_email(q.customer_email),
                    'p:' || public.normalize_customer_phone(q.customer_phone)) AS ident
    FROM public.quittungen q WHERE q.company_id = p_company_id AND q.customer_id IS NULL
  )
  UPDATE public.quittungen t SET customer_id = b.kunde
  FROM z JOIN _bf_zuordnung b ON b.ident = z.ident WHERE t.id = z.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('quittungen', v_n); v_summe := v_summe + v_n;

  -- Posteingang zuletzt und NUR zuordnend: aus einer Mail entsteht kein Kunde.
  -- Das LATERAL steht im CTE, nicht in der FROM-Liste des UPDATE: dort darf die
  -- Zieltabelle nicht seitwaerts referenziert werden.
  WITH z AS (
    SELECT i.id, f.customer_id AS kunde
    FROM public.inbound_emails i
    CROSS JOIN LATERAL public.find_customer_by_identity(
      i.company_id,
      COALESCE(NULLIF(i.extracted_data ->> 'email', ''), i.from_email),
      i.extracted_data ->> 'phone') f
    WHERE i.company_id = p_company_id AND i.customer_id IS NULL
  )
  UPDATE public.inbound_emails t SET customer_id = z.kunde
  FROM z WHERE t.id = z.id AND z.kunde IS NOT NULL;
  GET DIAGNOSTICS v_mails = ROW_COUNT;
  v_verknuepft := v_verknuepft || jsonb_build_object('inbound_emails', v_mails);

  -- Telefon-Duplikate markieren, damit die Oberflaeche sie zur Pruefung anbietet.
  UPDATE public.customers c SET possible_duplicate = TRUE
  WHERE c.company_id = p_company_id
    AND c.merged_into_customer_id IS NULL
    AND c.phone_normalized IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.customers d
      WHERE d.company_id = c.company_id AND d.id <> c.id
        AND d.merged_into_customer_id IS NULL
        AND d.phone_normalized = c.phone_normalized);

  SELECT
    (SELECT count(*) FROM public.leads        WHERE company_id = p_company_id AND customer_id IS NULL)
  + (SELECT count(*) FROM public.offers       WHERE company_id = p_company_id AND customer_id IS NULL)
  + (SELECT count(*) FROM public.auftraege    WHERE company_id = p_company_id AND customer_id IS NULL)
  + (SELECT count(*) FROM public.appointments WHERE company_id = p_company_id AND customer_id IS NULL)
  + (SELECT count(*) FROM public.rechnungen   WHERE company_id = p_company_id AND customer_id IS NULL)
  + (SELECT count(*) FROM public.quittungen   WHERE company_id = p_company_id AND customer_id IS NULL)
  INTO v_offen;

  RETURN jsonb_build_object(
    'kunden_angelegt',    v_angelegt,
    'zeilen_verknuepft',  v_verknuepft,
    'zeilen_gesamt',      v_summe,
    'ohne_zuordnung',     v_offen,
    'duplikat_verdacht',  (SELECT count(*) FROM public.customers
                           WHERE company_id = p_company_id AND possible_duplicate
                             AND merged_into_customer_id IS NULL));
END;
$$;

COMMENT ON FUNCTION public.run_customer_backfill(UUID) IS
  'Ordnet Bestandszeilen der kanonischen Kundenidentitaet zu. Idempotent: '
  'ruehrt nur customer_id IS NULL an. Wird NICHT aus einer Migration heraus '
  'aufgerufen — erst nachdem preview_customer_backfill() gelesen wurde. '
  'Ruecknahme: ROLLBACK_20260728140000_kunden_backfill.sql.';

REVOKE ALL ON FUNCTION public.run_customer_backfill(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_customer_backfill(UUID) TO authenticated;

COMMIT;
