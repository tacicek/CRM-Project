-- Offerte-PDF Vorlage: firmenweite Wahl zwischen der Standard-Vorlage ('classic')
-- und dem v2-Design ('modern'). Auswahl in Einstellungen → Firmenprofil.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS pdf_template text NOT NULL DEFAULT 'classic'
  CONSTRAINT companies_pdf_template_check CHECK (pdf_template IN ('classic', 'modern'));

COMMENT ON COLUMN public.companies.pdf_template IS
  'Offerte-PDF Vorlage: classic (Standard-Layout) | modern (v2-Design). Firmenweite Einstellung.';

-- get_public_company_info liefert pdf_template mit, damit auch der öffentliche
-- Offerten-Download (OfferView, anon) dieselbe Vorlage rendert.
DROP FUNCTION IF EXISTS public.get_public_company_info(uuid);

CREATE OR REPLACE FUNCTION public.get_public_company_info(company_uuid uuid)
RETURNS TABLE (
  id uuid,
  company_name character varying,
  street character varying,
  house_number character varying,
  city character varying,
  plz character varying,
  phone character varying,
  email character varying,
  website text,
  logo_url text,
  primary_color character varying,
  slogan text,
  pdf_template text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    c.pdf_template
  FROM public.companies c
  WHERE c.id = company_uuid;
$$;

-- PostgREST-Schema-Cache neu laden, damit die neue Spalte sofort über die REST-API
-- sichtbar ist (sonst weiterhin 400 "column does not exist" bis zum Neustart).
NOTIFY pgrst, 'reload schema';
