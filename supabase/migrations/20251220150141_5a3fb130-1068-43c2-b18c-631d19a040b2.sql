-- Create table for custom lead forms
CREATE TABLE public.lead_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar NOT NULL,
  slug varchar NOT NULL UNIQUE,
  description text,
  service_types text[] DEFAULT '{}',
  primary_color varchar DEFAULT '#6366f1',
  show_header boolean DEFAULT true,
  header_title varchar,
  header_subtitle text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage all lead forms"
ON public.lead_forms
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Public read for active forms (needed for embed)
CREATE POLICY "Active lead forms are publicly readable"
ON public.lead_forms
FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_lead_forms_updated_at
  BEFORE UPDATE ON public.lead_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();