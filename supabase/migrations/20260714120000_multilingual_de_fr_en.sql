-- =============================================================================
-- Dreisprachigkeit (DE / FR / EN)
-- =============================================================================
--
-- Zwei unabhängige Sprach-Achsen:
--
--   1. DASHBOARD-Sprache  — companies.default_language
--      In welcher Sprache die Firma selbst arbeitet. Betrifft nur /firma/*.
--
--   2. DOKUMENT-Sprache   — <tabelle>.language
--      In welcher Sprache der KUNDE angesprochen wird. Entsteht am Lead und wird
--      auf die Offerte eingefroren (wie frozen_from_street & Co.), von dort an
--      Termine, Aufträge, Rechnungen und Quittungen vererbt.
--
-- Warum die Sprache PERSISTIERT werden muss und nicht als Parameter reicht:
-- notify-appointment-reminder und notify-auftrag-reminder laufen per pg_cron.
-- Sie haben keinen Aufrufer, der eine Sprache mitgeben könnte — sie können sie
-- ausschliesslich aus der Zeile lesen.
--
-- Inhalte (Katalog, AGB, Checklisten) tragen eine `translations` JSONB-Spalte
-- der Form  {"fr": {"name": "…"}, "en": {"name": "…"}}.  Die deutschen
-- Basis-Spalten bleiben die Quelle der Wahrheit und der Fallback. Eine vierte
-- Sprache (it) braucht damit kein DDL mehr.
--
-- Offerten-Positionen (offer_items) bekommen KEINE Übersetzungsspalte: sie sind
-- bereits ein Snapshot des Katalogs zum Erstellungszeitpunkt. Die Offerte wird in
-- der Kundensprache aus dem Katalog befüllt und ist damit von Haus aus korrekt.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Helfer: eine übersetzte Textspalte auflösen (mit Fallback auf die Basis)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.i18n_text(
  p_base         text,
  p_translations jsonb,
  p_locale       text,
  p_field        text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    NULLIF(p_translations -> p_locale ->> p_field, ''),
    p_base
  );
$$;

COMMENT ON FUNCTION public.i18n_text(text, jsonb, text, text) IS
  'Löst ein übersetztes Textfeld auf. Leere oder fehlende Übersetzung fällt auf die deutsche Basisspalte zurück — ein Kunde sieht nie einen leeren Text.';

-- Gleiches für JSONB-Inhalte (checklist_templates.sections)
CREATE OR REPLACE FUNCTION public.i18n_jsonb(
  p_base         jsonb,
  p_translations jsonb,
  p_locale       text,
  p_field        text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    NULLIF(p_translations -> p_locale -> p_field, 'null'::jsonb),
    p_base
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Dashboard-Sprache der Firma
-- -----------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS default_language text NOT NULL DEFAULT 'de';

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_default_language_check;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_default_language_check
  CHECK (default_language IN ('de', 'fr', 'en'));

COMMENT ON COLUMN public.companies.default_language IS
  'Sprache des Firmen-Dashboards UND Fallback-Sprache für Leads, die ohne Sprache eintreffen.';

-- -----------------------------------------------------------------------------
-- 3. Dokument-Sprache: die Kette lead → offer → {appointment, auftrag, rechnung, quittung}
-- -----------------------------------------------------------------------------
ALTER TABLE public.leads        ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de';
ALTER TABLE public.offers       ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de';
ALTER TABLE public.auftraege    ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de';
ALTER TABLE public.rechnungen   ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de';
ALTER TABLE public.quittungen   ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads', 'offers', 'appointments', 'auftraege', 'rechnungen', 'quittungen']
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_language_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (language IN (''de'', ''fr'', ''en''))',
      t, t || '_language_check'
    );
  END LOOP;
END $$;

COMMENT ON COLUMN public.leads.language IS
  'Sprache, in der die Anfrage gestellt wurde. Ursprung der gesamten Kundenkommunikation.';
COMMENT ON COLUMN public.offers.language IS
  'Eingefroren aus leads.language beim Erstellen — die Offerte bleibt korrekt, auch wenn der Lead gelöscht wird.';

-- email_logs: nullable, damit historische Zeilen ehrlich bleiben (unbekannte Sprache
-- ist nicht dasselbe wie "war Deutsch"). resend-email liest die Spalte, um einen
-- erneuten Versand in derselben Sprache zu wiederholen.
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_language_check;
ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_language_check
  CHECK (language IS NULL OR language IN ('de', 'fr', 'en'));

-- -----------------------------------------------------------------------------
-- 4. Übersetzbare Inhalte
-- -----------------------------------------------------------------------------
ALTER TABLE public.company_service_items
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.agb_sections
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.leistungsuebersicht_templates
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.company_service_items.translations IS
  'Form: {"fr": {"name": "…", "description": "…"}, "en": {…}}. Deutsche Basisspalten bleiben Quelle der Wahrheit.';
COMMENT ON COLUMN public.companies.translations IS
  'Übersetzte Firmen-Textbausteine: slogan, default_payment_terms, default_terms_and_conditions.';

-- -----------------------------------------------------------------------------
-- 5. Public-RPCs neu erstellen
--
--    RETURNS TABLE lässt sich nicht per CREATE OR REPLACE ändern → DROP + CREATE.
--    Neue Felder kommen ans ENDE (positionelle Stabilität), GRANTs werden explizit
--    neu gesetzt — dieselbe Disziplin wie 20260704110000 und 20260709120000.
-- -----------------------------------------------------------------------------

-- 5a. get_offer_by_token: + language (letzte Spalte)
DROP FUNCTION IF EXISTS public.get_offer_by_token(text);
CREATE FUNCTION public.get_offer_by_token(offer_access_token text)
RETURNS TABLE(
  id uuid, title character varying, description text,
  customer_first_name character varying, customer_last_name character varying,
  customer_email character varying, customer_phone character varying,
  service_date date, valid_until date,
  subtotal numeric, vat_rate numeric, vat_amount numeric, total numeric,
  status character varying, created_at timestamp with time zone,
  sent_at timestamp with time zone, viewed_at timestamp with time zone,
  accepted_at timestamp with time zone, rejected_at timestamp with time zone,
  company_id uuid, lead_id uuid, agb_accepted_at timestamp with time zone,
  service_type character varying, is_expired boolean,
  from_street character varying, from_house_number character varying,
  from_plz character varying, from_city character varying,
  from_floor integer, from_has_lift boolean,
  to_street character varying, to_house_number character varying,
  to_plz character varying, to_city character varying,
  to_floor integer, to_has_lift boolean,
  surcharges jsonb, price_model text, hourly_rate numeric, kostendach_max numeric,
  offerte_type text, discount_percent numeric,
  from_has_estrich boolean, from_has_keller boolean,
  language text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    o.id,
    o.title,
    o.description,
    o.customer_first_name,
    o.customer_last_name,
    o.customer_email,
    o.customer_phone,
    o.service_date,
    o.valid_until,
    o.subtotal,
    o.vat_rate,
    o.vat_amount,
    o.total,
    o.status,
    o.created_at,
    o.sent_at,
    o.viewed_at,
    o.accepted_at,
    o.rejected_at,
    o.company_id,
    o.lead_id,
    o.agb_accepted_at,
    l.service_type,
    CASE
      WHEN o.valid_until IS NOT NULL AND o.valid_until < CURRENT_DATE THEN true
      ELSE false
    END AS is_expired,
    -- Frozen öncelik, lead fallback (LEFT JOIN leads korunur)
    COALESCE(o.frozen_from_street, l.from_street)::character varying             AS from_street,
    COALESCE(o.frozen_from_house_number, l.from_house_number)::character varying AS from_house_number,
    COALESCE(o.frozen_from_plz, l.from_plz)::character varying                   AS from_plz,
    COALESCE(o.frozen_from_city, l.from_city)::character varying                 AS from_city,
    COALESCE(o.frozen_from_floor, l.from_floor)                                  AS from_floor,
    COALESCE(o.frozen_from_has_lift, l.from_has_lift)                            AS from_has_lift,
    COALESCE(o.frozen_to_street, l.to_street)::character varying                 AS to_street,
    COALESCE(o.frozen_to_house_number, l.to_house_number)::character varying     AS to_house_number,
    COALESCE(o.frozen_to_plz, l.to_plz)::character varying                       AS to_plz,
    COALESCE(o.frozen_to_city, l.to_city)::character varying                     AS to_city,
    COALESCE(o.frozen_to_floor, l.to_floor)                                      AS to_floor,
    COALESCE(o.frozen_to_has_lift, l.to_has_lift)                                AS to_has_lift,
    o.surcharges,
    o.price_model,
    o.hourly_rate,
    o.kostendach_max,
    o.offerte_type,
    o.discount_percent,
    COALESCE(o.frozen_has_estrich, l.from_has_estrich) AS from_has_estrich,
    COALESCE(o.frozen_has_keller, l.from_has_keller)   AS from_has_keller,
    o.language
  FROM public.offers o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.access_token = offer_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected');
$function$;

GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO anon, authenticated, service_role;

-- 5b. get_public_company_info: + default_language (letzte Spalte)
DROP FUNCTION IF EXISTS public.get_public_company_info(uuid);
CREATE FUNCTION public.get_public_company_info(company_uuid uuid)
RETURNS TABLE(
  id uuid, company_name character varying,
  street character varying, house_number character varying,
  city character varying, plz character varying,
  phone character varying, email character varying,
  website text, logo_url text,
  primary_color character varying, slogan text, pdf_template text,
  default_language text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.company_name,
    c.street,
    c.house_number,
    c.city,
    c.plz,
    c.phone,
    c.email,
    c.website,
    c.logo_url,
    c.primary_color,
    c.slogan,
    c.pdf_template,
    c.default_language
  FROM public.companies c
  WHERE c.id = company_uuid;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_company_info(uuid) TO anon, authenticated, service_role;

-- 5c. get_agb_sections_by_offer_token: liefert Titel/Inhalt bereits in der Sprache
--     der Offerte. Die öffentliche Seite muss nichts über Übersetzungen wissen.
DROP FUNCTION IF EXISTS public.get_agb_sections_by_offer_token(text, text);
CREATE FUNCTION public.get_agb_sections_by_offer_token(
  p_access_token text,
  p_service_type text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid, company_id uuid, title text, content text,
  service_type text, display_order integer, is_active boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    a.id,
    a.company_id,
    public.i18n_text(a.title, a.translations, o.language, 'title')     AS title,
    public.i18n_text(a.content, a.translations, o.language, 'content') AS content,
    a.service_type::text,
    a.display_order,
    a.is_active
  FROM public.agb_sections a
  INNER JOIN public.offers o ON o.company_id = a.company_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
    AND a.is_active = true
    AND (p_service_type IS NULL OR a.service_type = p_service_type OR a.service_type IS NULL)
  ORDER BY a.display_order;
$function$;

GRANT EXECUTE ON FUNCTION public.get_agb_sections_by_offer_token(text, text) TO anon, authenticated, service_role;

-- 5d. get_checklist_by_offer_token: dito
DROP FUNCTION IF EXISTS public.get_checklist_by_offer_token(text, text);
CREATE FUNCTION public.get_checklist_by_offer_token(
  p_access_token text,
  p_service_type text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, title text, subtitle text, sections jsonb, service_type text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    ct.id,
    public.i18n_text(ct.title, ct.translations, o.language, 'title')        AS title,
    public.i18n_text(ct.subtitle, ct.translations, o.language, 'subtitle')  AS subtitle,
    public.i18n_jsonb(ct.sections, ct.translations, o.language, 'sections') AS sections,
    ct.service_type::text
  FROM public.checklist_templates ct
  INNER JOIN public.offers o ON o.company_id = ct.company_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
    AND ct.is_active = true
    AND ct.include_in_offerte = true
    AND (p_service_type IS NULL OR ct.service_type = p_service_type)
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_checklist_by_offer_token(text, text) TO anon, authenticated, service_role;

COMMIT;
