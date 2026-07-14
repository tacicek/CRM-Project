-- =============================================================================
-- ROLLBACK für 20260714120000_multilingual_de_fr_en.sql
--
-- NICHT als reguläre Migration ausführen — dies ist die Notbremse, falls die
-- Dreisprachigkeit zurückgenommen werden muss.
--
-- ⚠️ Vorher lesen:
--   Diese Datei DROPPT die Sprachspalten. Damit gehen alle Kundensprachen
--   (leads.language, offers.language, …) und alle Inhalts-Übersetzungen
--   (translations JSONB: Katalog, AGB, Checklisten) UNWIDERRUFLICH verloren.
--   Bei zwei deutschsprachigen Firmen ist das heute folgenlos — sobald aber eine
--   französische Offerte existiert, ist es Datenverlust.
--
--   Vollständiges Backup vor der Migration: /root/pre_i18n_20260714_1356.dump
--   (pg_dump -Fc, auf dem Coolify-Host). Wiederherstellen ist dem hier vorzuziehen.
--
--   Der ANWENDUNGSCODE setzt diese Spalten voraus (CompanyProvider selektiert
--   companies.default_language). Ein Rollback der DB OHNE Rollback des Codes
--   führt exakt zum Fehler "Keine Firma gefunden".
-- =============================================================================

BEGIN;

-- 1. Public-RPCs auf den Stand vor der Migration zurücksetzen
--    (RETURNS TABLE lässt sich nicht per CREATE OR REPLACE ändern → DROP + CREATE)

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
  from_has_estrich boolean, from_has_keller boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    o.id, o.title, o.description,
    o.customer_first_name, o.customer_last_name, o.customer_email, o.customer_phone,
    o.service_date, o.valid_until,
    o.subtotal, o.vat_rate, o.vat_amount, o.total,
    o.status, o.created_at, o.sent_at, o.viewed_at, o.accepted_at, o.rejected_at,
    o.company_id, o.lead_id, o.agb_accepted_at,
    l.service_type,
    CASE
      WHEN o.valid_until IS NOT NULL AND o.valid_until < CURRENT_DATE THEN true
      ELSE false
    END AS is_expired,
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
    o.surcharges, o.price_model, o.hourly_rate, o.kostendach_max,
    o.offerte_type, o.discount_percent,
    COALESCE(o.frozen_has_estrich, l.from_has_estrich) AS from_has_estrich,
    COALESCE(o.frozen_has_keller, l.from_has_keller)   AS from_has_keller
  FROM public.offers o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.access_token = offer_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected');
$function$;
GRANT EXECUTE ON FUNCTION public.get_offer_by_token(text) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_public_company_info(uuid);
CREATE FUNCTION public.get_public_company_info(company_uuid uuid)
RETURNS TABLE(
  id uuid, company_name character varying,
  street character varying, house_number character varying,
  city character varying, plz character varying,
  phone character varying, email character varying,
  website text, logo_url text,
  primary_color character varying, slogan text, pdf_template text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.company_name, c.street, c.house_number, c.city, c.plz,
         c.phone, c.email, c.website, c.logo_url,
         c.primary_color, c.slogan, c.pdf_template
  FROM public.companies c
  WHERE c.id = company_uuid;
$function$;
GRANT EXECUTE ON FUNCTION public.get_public_company_info(uuid) TO anon, authenticated, service_role;

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
  SELECT a.id, a.company_id, a.title, a.content,
         a.service_type::text, a.display_order, a.is_active
  FROM public.agb_sections a
  INNER JOIN public.offers o ON o.company_id = a.company_id
  WHERE o.access_token = p_access_token
    AND o.status IN ('sent', 'viewed', 'accepted', 'rejected')
    AND a.is_active = true
    AND (p_service_type IS NULL OR a.service_type = p_service_type OR a.service_type IS NULL)
  ORDER BY a.display_order;
$function$;
GRANT EXECUTE ON FUNCTION public.get_agb_sections_by_offer_token(text, text) TO anon, authenticated, service_role;

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
  SELECT ct.id, ct.title, ct.subtitle, ct.sections, ct.service_type::text
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

-- 2. Inhalts-Übersetzungen entfernen  ⚠️ DATENVERLUST
ALTER TABLE public.company_service_items         DROP COLUMN IF EXISTS translations;
ALTER TABLE public.agb_sections                  DROP COLUMN IF EXISTS translations;
ALTER TABLE public.checklist_templates           DROP COLUMN IF EXISTS translations;
ALTER TABLE public.leistungsuebersicht_templates DROP COLUMN IF EXISTS translations;
ALTER TABLE public.companies                     DROP COLUMN IF EXISTS translations;

-- 3. Sprachspalten entfernen  ⚠️ DATENVERLUST (Kundensprachen)
ALTER TABLE public.email_logs   DROP COLUMN IF EXISTS language;
ALTER TABLE public.quittungen   DROP COLUMN IF EXISTS language;
ALTER TABLE public.rechnungen   DROP COLUMN IF EXISTS language;
ALTER TABLE public.auftraege    DROP COLUMN IF EXISTS language;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS language;
ALTER TABLE public.offers       DROP COLUMN IF EXISTS language;
ALTER TABLE public.leads        DROP COLUMN IF EXISTS language;
ALTER TABLE public.companies    DROP COLUMN IF EXISTS default_language;

-- 4. Helfer entfernen
DROP FUNCTION IF EXISTS public.i18n_text(text, jsonb, text, text);
DROP FUNCTION IF EXISTS public.i18n_jsonb(jsonb, jsonb, text, text);

COMMIT;
