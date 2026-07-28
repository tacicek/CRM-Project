-- =============================================================================
-- Kundenportal: Zugang ueber einen Link, der nicht im Klartext liegt
-- =============================================================================
--
-- BEFUND
-- Ein Kunde sieht heute genau das, wofuer ihm jemand einen Link geschickt hat:
-- eine Offerte, einen Termin, einen Nachtrag. Jede dieser Seiten hat ihren
-- eigenen Token, und jeder dieser Token steht IM KLARTEXT in der Datenbank —
-- `offers.access_token`, `appointments.token`, `offer_amendments.access_token`.
-- Wer die Tabelle lesen kann, kann jede geteilte Seite oeffnen.
--
-- Ausserdem gilt jeder Token fuer genau ein Dokument. Es gibt keinen Ort, an
-- dem ein Kunde sieht, was insgesamt laeuft: welche Offerten offen sind, wann
-- der Termin ist, was noch zu zahlen ist.
--
-- ABHILFE
-- Zwei Tabellen, beide OHNE Klartext:
--
--   portal_magic_links  der verschickte Link — einmalig, befristet
--   portal_sessions     die daraus entstandene Sitzung — befristet, widerrufbar
--
-- Gespeichert wird nur `encode(digest(token,'sha256'),'hex')`. Der Klartext
-- verlaesst die Datenbank genau einmal: als Rueckgabewert der erzeugenden
-- Funktion. Danach existiert er dort nicht mehr, auch nicht fuer den
-- Eigentuemer. Ein Backup-Dump enthaelt keine gueltigen Zugaenge.
--
-- WARUM ZWEI STUFEN
-- Der Link steht in einer E-Mail und liegt damit ausserhalb unserer Kontrolle —
-- in Postfaechern, in Weiterleitungen, in Suchindizes von Mailclients. Deshalb
-- ist er EINMALIG: beim ersten Oeffnen wird er eingeloest und ist verbraucht.
-- Was danach traegt, ist die Sitzung im Browser des Kunden, die nie durch eine
-- E-Mail gegangen ist.
--
-- DIE PORTAL-ANMELDUNG HAT NICHTS MIT `company_members` ZU TUN. Ein Kunde ist
-- kein Benutzer dieses Systems; er hat keine Zeile in `auth.users` und bekommt
-- keine. `auth.uid()` ist im Portal immer NULL — die Zugehoerigkeit kommt
-- ausschliesslich aus dem Sitzungstoken.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Der verschickte Link
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.portal_magic_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,

  -- NIE der Token selbst. sha256, hex.
  token_hash  TEXT NOT NULL UNIQUE,

  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,

  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT portal_magic_links_hash_laenge CHECK (length(token_hash) = 64)
);

ALTER TABLE public.portal_magic_links
  DROP CONSTRAINT IF EXISTS portal_magic_links_customer_fk,
  ADD  CONSTRAINT portal_magic_links_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id) ON DELETE CASCADE;

COMMENT ON TABLE public.portal_magic_links IS
  'Einmal-Links fuer das Kundenportal. Enthaelt NUR den sha256-Abdruck; der '
  'Klartext verlaesst die DB einmalig als Rueckgabewert und wird nie abgelegt.';

CREATE INDEX IF NOT EXISTS idx_portal_magic_links_kunde
  ON public.portal_magic_links (customer_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. Die Sitzung
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.portal_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL,
  magic_link_id UUID REFERENCES public.portal_magic_links(id) ON DELETE SET NULL,

  token_hash   TEXT NOT NULL UNIQUE,

  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT portal_sessions_hash_laenge CHECK (length(token_hash) = 64)
);

ALTER TABLE public.portal_sessions
  DROP CONSTRAINT IF EXISTS portal_sessions_customer_fk,
  ADD  CONSTRAINT portal_sessions_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id) ON DELETE CASCADE;

COMMENT ON TABLE public.portal_sessions IS
  'Portal-Sitzungen. Wie die Links nur als Abdruck gespeichert. Widerruf durch '
  'revoked_at — die Sitzung ist damit sofort tot, ohne dass jemand einen '
  'Browser erreichen muesste.';

CREATE INDEX IF NOT EXISTS idx_portal_sessions_kunde
  ON public.portal_sessions (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_gueltig
  ON public.portal_sessions (expires_at) WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Link erzeugen — nur die Firma
--
-- Gibt den Klartext zurueck. Das ist die einzige Gelegenheit, ihn zu sehen;
-- der Aufrufer muss ihn weitergeben, sonst ist er verloren (was kein Schaden
-- ist — dann erzeugt man einen neuen).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_create_magic_link(
  p_customer_id UUID,
  p_gueltig_tage INTEGER DEFAULT 14
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_kunde  RECORD;
  v_token  TEXT;
  v_id     UUID;
BEGIN
  SELECT * INTO v_kunde FROM public.customers WHERE id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kunde nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_company_role(v_kunde.company_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen Portalzugaenge erstellen.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_kunde.merged_into_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Dieser Kunde wurde zusammengefuehrt — Zugang beim aktuellen Kunden erstellen.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 32 zufaellige Bytes, hex. Nicht aus der Kunden-ID abgeleitet und nicht
  -- ratbar; gen_random_bytes kommt aus pgcrypto und nicht aus random().
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.portal_magic_links
    (company_id, customer_id, token_hash, expires_at, created_by)
  VALUES (
    v_kunde.company_id, p_customer_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    NOW() + (GREATEST(1, LEAST(p_gueltig_tage, 90)) || ' days')::INTERVAL,
    auth.uid()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',         v_id,
    'token',      v_token,
    'expires_at', (SELECT expires_at FROM public.portal_magic_links WHERE id = v_id),
    'sprache',    v_kunde.language
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.portal_create_magic_link(UUID,INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.portal_create_magic_link(UUID,INTEGER) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Link einloesen — der Kunde, ohne Anmeldung
--
-- Diese Funktion MUSS von `anon` aufrufbar sein: der Kunde hat keine Sitzung
-- in diesem System und bekommt auch keine. Sie prueft selbst, wer sie aufruft —
-- ueber den Token, nicht ueber ein Argument.
--
-- Wichtig: keine unterscheidbaren Fehlermeldungen. Ob der Token nie existiert
-- hat, abgelaufen, verbraucht oder widerrufen ist, geht den Aufrufer nichts an;
-- der Unterschied waere ein Weg, gueltige Token zu erraten.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_redeem_magic_link(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_link    RECORD;
  v_session TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) <> 64 THEN
    RAISE EXCEPTION 'Zugang ungueltig oder abgelaufen.' USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  SELECT * INTO v_link
  FROM public.portal_magic_links
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
  FOR UPDATE;

  IF NOT FOUND
     OR v_link.used_at IS NOT NULL
     OR v_link.revoked_at IS NOT NULL
     OR v_link.expires_at < NOW() THEN
    RAISE EXCEPTION 'Zugang ungueltig oder abgelaufen.'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  UPDATE public.portal_magic_links SET used_at = NOW() WHERE id = v_link.id;

  v_session := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.portal_sessions
    (company_id, customer_id, magic_link_id, token_hash, expires_at, last_seen_at)
  VALUES (
    v_link.company_id, v_link.customer_id, v_link.id,
    encode(digest(v_session, 'sha256'), 'hex'),
    NOW() + INTERVAL '30 days', NOW()
  );

  RETURN jsonb_build_object(
    'session',  v_session,
    'sprache',  (SELECT language FROM public.customers WHERE id = v_link.customer_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_redeem_magic_link(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Sitzung aufloesen
--
-- Der Baustein, auf dem jede Portal-Lesefunktion steht. Gibt die Kunden-ID
-- zurueck oder NULL. Kein RAISE — die aufrufende Funktion entscheidet, was
-- eine ungueltige Sitzung bedeutet.
--
-- STABLE, damit sie in jeder Lesefunktion mehrfach vorkommen darf; das
-- Fortschreiben von last_seen_at passiert deshalb NICHT hier, sondern in
-- portal_touch_session.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_session_customer(p_session TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT s.customer_id
  FROM public.portal_sessions s
  WHERE p_session IS NOT NULL
    AND length(p_session) = 64
    AND s.token_hash = encode(digest(p_session, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > NOW();
$$;

REVOKE EXECUTE ON FUNCTION public.portal_session_customer(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_touch_session(p_session TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  UPDATE public.portal_sessions
  SET last_seen_at = NOW()
  WHERE token_hash = encode(digest(p_session, 'sha256'), 'hex')
    AND revoked_at IS NULL AND expires_at > NOW();
$$;

REVOKE EXECUTE ON FUNCTION public.portal_touch_session(TEXT) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Widerruf
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_revoke_access(p_customer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company UUID;
  v_links   INTEGER;
  v_sess    INTEGER;
BEGIN
  SELECT company_id INTO v_company FROM public.customers WHERE id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kunde nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_company_role(v_company, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentuemer oder Administrator koennen Zugaenge widerrufen.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.portal_magic_links SET revoked_at = NOW()
  WHERE customer_id = p_customer_id AND revoked_at IS NULL AND used_at IS NULL;
  GET DIAGNOSTICS v_links = ROW_COUNT;

  UPDATE public.portal_sessions SET revoked_at = NOW()
  WHERE customer_id = p_customer_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_sess = ROW_COUNT;

  RETURN jsonb_build_object('links', v_links, 'sitzungen', v_sess);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.portal_revoke_access(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.portal_revoke_access(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Aufraeumen
--
-- Abgelaufene Sitzungen und verbrauchte Links haben keinen Wert mehr. Sie
-- stehen zu lassen hiesse, eine wachsende Liste von Abdruecken zu fuehren,
-- die niemand mehr braucht.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_s INTEGER; v_l INTEGER;
BEGIN
  DELETE FROM public.portal_sessions
  WHERE expires_at < NOW() - INTERVAL '30 days'
     OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days');
  GET DIAGNOSTICS v_s = ROW_COUNT;

  DELETE FROM public.portal_magic_links
  WHERE expires_at < NOW() - INTERVAL '30 days'
    AND NOT EXISTS (SELECT 1 FROM public.portal_sessions s WHERE s.magic_link_id = portal_magic_links.id);
  GET DIAGNOSTICS v_l = ROW_COUNT;

  RETURN jsonb_build_object('sitzungen', v_s, 'links', v_l);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.portal_cleanup() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('portal-cleanup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'portal-cleanup');

SELECT cron.schedule('portal-cleanup', '45 3 * * *',
                     $cron$SELECT public.portal_cleanup();$cron$);

-- -----------------------------------------------------------------------------
-- 8. RLS
--
-- Die Firma sieht ihre Zugaenge, um sie widerrufen zu koennen. Geschrieben
-- wird ausschliesslich durch die Funktionen oben — deshalb keine INSERT- oder
-- UPDATE-Policy. `anon` bekommt gar nichts: das Portal liest nie direkt aus
-- diesen Tabellen, sondern immer ueber eine Funktion, die den Token prueft.
-- -----------------------------------------------------------------------------

ALTER TABLE public.portal_magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_magic_links_select_member ON public.portal_magic_links;
CREATE POLICY portal_magic_links_select_member ON public.portal_magic_links FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS portal_sessions_select_member ON public.portal_sessions;
CREATE POLICY portal_sessions_select_member ON public.portal_sessions FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

COMMIT;
