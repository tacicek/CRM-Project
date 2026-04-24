-- Create table for structured AGB sections
CREATE TABLE public.agb_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_type VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  content TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agb_sections ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Companies can manage their AGB sections"
ON public.agb_sections
FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = agb_sections.company_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all AGB sections"
ON public.agb_sections
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_agb_sections_company_service ON public.agb_sections(company_id, service_type);

-- Add updated_at trigger
CREATE TRIGGER update_agb_sections_updated_at
BEFORE UPDATE ON public.agb_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();