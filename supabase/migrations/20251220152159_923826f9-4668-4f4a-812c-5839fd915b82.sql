-- Create offers table for company quotes
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  lead_distribution_id UUID REFERENCES public.lead_distributions(id) ON DELETE SET NULL,
  
  -- Customer info (copied from lead for reference)
  customer_first_name VARCHAR NOT NULL,
  customer_last_name VARCHAR NOT NULL,
  customer_email VARCHAR NOT NULL,
  customer_phone VARCHAR,
  
  -- Offer details
  title VARCHAR NOT NULL,
  description TEXT,
  service_date DATE,
  valid_until DATE,
  
  -- Pricing
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 8.1,
  vat_amount NUMERIC GENERATED ALWAYS AS (subtotal * vat_rate / 100) STORED,
  total NUMERIC GENERATED ALWAYS AS (subtotal + (subtotal * vat_rate / 100)) STORED,
  
  -- Status
  status VARCHAR NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create offer items table for line items
CREATE TABLE public.offer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  description VARCHAR NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit VARCHAR DEFAULT 'Stk.',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for offers
CREATE POLICY "Companies can view their own offers"
ON public.offers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = offers.company_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Companies can insert their own offers"
ON public.offers FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = offers.company_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Companies can update their own offers"
ON public.offers FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = offers.company_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Companies can delete their own offers"
ON public.offers FOR DELETE
USING (EXISTS (
  SELECT 1 FROM companies
  WHERE companies.id = offers.company_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Admins can view all offers"
ON public.offers FOR SELECT
USING (is_admin(auth.uid()));

-- RLS Policies for offer_items
CREATE POLICY "Companies can manage their offer items"
ON public.offer_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM offers
  JOIN companies ON companies.id = offers.company_id
  WHERE offers.id = offer_items.offer_id
  AND companies.user_id = auth.uid()
));

CREATE POLICY "Admins can view all offer items"
ON public.offer_items FOR SELECT
USING (is_admin(auth.uid()));

-- Create indexes
CREATE INDEX idx_offers_company_id ON public.offers(company_id);
CREATE INDEX idx_offers_lead_id ON public.offers(lead_id);
CREATE INDEX idx_offers_status ON public.offers(status);
CREATE INDEX idx_offer_items_offer_id ON public.offer_items(offer_id);

-- Add trigger for updated_at
CREATE TRIGGER update_offers_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();