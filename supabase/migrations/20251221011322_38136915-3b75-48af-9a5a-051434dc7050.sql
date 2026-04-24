-- Create checklist_templates table
CREATE TABLE public.checklist_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  subtitle text,
  service_type character varying NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  include_in_offerte boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id, service_type)
);

-- Enable RLS
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

-- Companies can manage their own templates
CREATE POLICY "Companies can manage their templates"
ON public.checklist_templates
FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = checklist_templates.company_id
  AND companies.user_id = auth.uid()
));

-- Admins can manage all templates
CREATE POLICY "Admins can manage all templates"
ON public.checklist_templates
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_checklist_templates_updated_at
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add checklist_url to offers table
ALTER TABLE public.offers ADD COLUMN checklist_url text;

-- Create index
CREATE INDEX idx_checklist_company ON public.checklist_templates(company_id);
CREATE INDEX idx_checklist_service ON public.checklist_templates(service_type);