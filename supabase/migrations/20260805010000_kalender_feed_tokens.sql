-- Kalender-Abo (webcal/ICS): Feed-Tokens.
--
-- ── Was das hier ist ───────────────────────────────────────────────────────
--
-- Mitarbeitende abonnieren ihre CRM-Termine in Apple/Google/Outlook. Ein
-- Kalender-Client kann keinen Authorization-Header schicken, also traegt die
-- Abo-URL ein Geheimnis: ein 32-Byte-Token. Diese Tabelle speichert davon
-- AUSSCHLIESSLICH den SHA-256-Hex-Hash — der Klartext existiert genau einmal,
-- im Rueckgabewert von `create_calendar_feed_token()`, und danach nur noch
-- beim Nutzer. Ein Dump dieser Tabelle oeffnet keinen einzigen Feed.
--
-- Der Lesepfad (Edge Function `calendar-feed`) laeuft unter service_role und
-- filtert IMMER explizit auf `company_id` der Token-Zeile — RLS traegt dort
-- nichts, die Zeile selbst ist die Mandanten-Grenze.
--
-- ── Warum die Erzeugung eine SECURITY-DEFINER-Funktion ist ─────────────────
--
-- `company_id` darf nie vom Client kommen. Die Funktion leitet sie aus der
-- Mitgliedschaft von `auth.uid()` ab (heute: genau eine pro Nutzer; mehr als
-- eine ist ein harter Fehler statt einer stillen Wahl). Direkte INSERTs der
-- Clients bleiben per RLS zwar auf die eigene Firma beschraenkt, aber nur die
-- Funktion garantiert Klartext-einmal + Hash-in-der-DB.
--
-- Kein `anon`-Zugang: weder Policy noch GRANT noch EXECUTE. Die Nachpruefung
-- unten besteht darauf.

BEGIN;

-- ── 1. Tabelle ─────────────────────────────────────────────────────────────

CREATE TABLE public.calendar_feed_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SHA-256 des Klartext-Tokens, hex, klein geschrieben. NIE der Klartext.
  token_hash   text NOT NULL UNIQUE,
  label        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Wird von der Edge Function hoechstens alle 15 Minuten fortgeschrieben —
  -- Anzeige "zuletzt benutzt", kein Audit-Log.
  last_used_at timestamptz,
  -- Widerruf ist ein UPDATE, kein DELETE: die Zeile bleibt als Beleg stehen,
  -- der Feed antwortet ab sofort mit 404.
  revoked_at   timestamptz
);

COMMENT ON TABLE public.calendar_feed_tokens IS
  'Tokens fuer das webcal/ICS-Abo der Termine. Enthaelt nur SHA-256-Hashes; '
  'der Klartext wird genau einmal von create_calendar_feed_token() zurueckgegeben.';

-- Der UNIQUE-Constraint auf token_hash liefert den Lookup-Index des Feeds.
-- Zusaetzlich einer fuer die Token-Liste in den Einstellungen:
CREATE INDEX idx_calendar_feed_tokens_company
  ON public.calendar_feed_tokens (company_id);

-- ── 2. Rechte und RLS ──────────────────────────────────────────────────────
--
-- Erst alles wegnehmen, dann gezielt vergeben, damit ein frueherer Lauf oder
-- DEFAULT PRIVILEGES nichts anderes hinterlassen koennen.

REVOKE ALL ON TABLE public.calendar_feed_tokens
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.calendar_feed_tokens TO authenticated;
GRANT ALL ON TABLE public.calendar_feed_tokens TO service_role;

ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

-- Kein DELETE: Widerruf setzt revoked_at. Kein anon: ein Feed-Client kennt
-- nur das Token, nie diese Tabelle.
CREATE POLICY calendar_feed_tokens_select ON public.calendar_feed_tokens
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY calendar_feed_tokens_insert ON public.calendar_feed_tokens
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id) AND user_id = auth.uid());

CREATE POLICY calendar_feed_tokens_update ON public.calendar_feed_tokens
  FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- ── 3. Token-Erzeugung ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_calendar_feed_token(p_label text DEFAULT NULL)
RETURNS TABLE (id uuid, token text, label text, created_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  k_max_label constant integer := 80;
  v_company   uuid;
  v_count     integer;
  v_label     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Firma AUS der Mitgliedschaft, nie vom Aufrufer. Heute hat jeder Nutzer
  -- genau eine; sollte das kippen, ist ein Fehler ehrlicher als eine
  -- willkuerliche Wahl der "ersten" Firma.
  SELECT count(*) INTO v_count
  FROM public.company_members cm
  WHERE cm.user_id = auth.uid();

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one company membership, found %', v_count;
  END IF;

  SELECT cm.company_id INTO v_company
  FROM public.company_members cm
  WHERE cm.user_id = auth.uid();

  v_label := nullif(btrim(coalesce(p_label, '')), '');
  IF length(v_label) > k_max_label THEN
    RAISE EXCEPTION 'label is longer than % characters', k_max_label;
  END IF;

  -- 32 Byte Zufall, hex → 64 Zeichen. In der DB landet nur der Hash; der
  -- Klartext verlaesst die Funktion genau einmal ueber die RETURNS-Spalte.
  token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.calendar_feed_tokens (company_id, user_id, token_hash, label)
  VALUES (
    v_company,
    auth.uid(),
    encode(extensions.digest(token, 'sha256'), 'hex'),
    v_label
  )
  RETURNING calendar_feed_tokens.id, calendar_feed_tokens.created_at
  INTO id, created_at;

  label := v_label;
  RETURN NEXT;
  RETURN;
END;
$function$;

COMMENT ON FUNCTION public.create_calendar_feed_token(text) IS
  'Erzeugt ein Kalender-Feed-Token fuer die Firma des angemeldeten Nutzers. '
  'Gibt den Klartext genau einmal zurueck; gespeichert wird nur der SHA-256-Hash. '
  'Nur fuer authenticated — anon und service_role haben kein EXECUTE.';

REVOKE ALL ON FUNCTION public.create_calendar_feed_token(text)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_calendar_feed_token(text)
  TO authenticated;

-- ── 4. Nachpruefung, fail-closed ───────────────────────────────────────────
--
-- Gemessen wird der Katalog, nicht die Absicht. Faellt eine Pruefung durch,
-- nimmt die Ausnahme die ganze Transaktion mit.
DO $$
DECLARE
  v_anzahl integer;
BEGIN
  -- 1. RLS ist wirklich an.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'calendar_feed_tokens'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Pruefung 1: RLS auf calendar_feed_tokens ist nicht aktiv';
  END IF;

  -- 2. Genau die drei Policies, alle nur fuer authenticated.
  SELECT count(*) INTO v_anzahl
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'calendar_feed_tokens';
  IF v_anzahl <> 3 THEN
    RAISE EXCEPTION 'Pruefung 2: erwartet genau 3 Policies, gefunden %', v_anzahl;
  END IF;

  SELECT count(*) INTO v_anzahl
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'calendar_feed_tokens'
    AND roles <> ARRAY['authenticated']::name[];
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Pruefung 2: % Policy/Policies gelten nicht ausschliesslich fuer authenticated', v_anzahl;
  END IF;

  -- 3. anon kommt an nichts heran.
  IF has_table_privilege('anon', 'public.calendar_feed_tokens', 'SELECT')
     OR has_table_privilege('anon', 'public.calendar_feed_tokens', 'INSERT')
     OR has_table_privilege('anon', 'public.calendar_feed_tokens', 'UPDATE')
     OR has_table_privilege('anon', 'public.calendar_feed_tokens', 'DELETE') THEN
    RAISE EXCEPTION 'Pruefung 3: anon hat Tabellenrechte auf calendar_feed_tokens';
  END IF;
  IF has_function_privilege('anon', 'public.create_calendar_feed_token(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Pruefung 3: anon kann create_calendar_feed_token ausfuehren';
  END IF;

  -- 4. authenticated kann genau das Vorgesehene.
  IF NOT has_function_privilege('authenticated', 'public.create_calendar_feed_token(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Pruefung 4: authenticated kann create_calendar_feed_token NICHT ausfuehren';
  END IF;
  IF has_table_privilege('authenticated', 'public.calendar_feed_tokens', 'DELETE') THEN
    RAISE EXCEPTION 'Pruefung 4: authenticated darf DELETE — Widerruf soll ein UPDATE sein';
  END IF;
END;
$$;

COMMIT;
