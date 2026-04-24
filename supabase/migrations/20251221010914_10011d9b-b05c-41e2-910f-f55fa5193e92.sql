-- Create table for service-specific offer templates
CREATE TABLE public.company_offer_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_type character varying NOT NULL,
  terms_and_conditions text,
  payment_terms text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id, service_type)
);

-- Enable RLS
ALTER TABLE public.company_offer_templates ENABLE ROW LEVEL SECURITY;

-- Companies can manage their own templates
CREATE POLICY "Companies can manage their templates"
ON public.company_offer_templates
FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = company_offer_templates.company_id
  AND companies.user_id = auth.uid()
));

-- Admins can manage all templates
CREATE POLICY "Admins can manage all templates"
ON public.company_offer_templates
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_company_offer_templates_updated_at
BEFORE UPDATE ON public.company_offer_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();