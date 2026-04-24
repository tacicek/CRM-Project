-- Add source_form_id to leads table for tracking
ALTER TABLE public.leads 
ADD COLUMN source_form_id uuid REFERENCES public.lead_forms(id) ON DELETE SET NULL;

-- Add index for faster queries
CREATE INDEX idx_leads_source_form_id ON public.leads(source_form_id);