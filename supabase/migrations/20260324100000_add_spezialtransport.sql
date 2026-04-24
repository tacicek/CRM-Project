-- Migration: Add spezialtransport service type
-- Adds spezialtransport to service_catalog (so companies can select it)
-- and to lead_forms (so admin Formulare page shows lead count correctly)

-- 1. service_catalog — firmaların seçebileceği servis tipi
INSERT INTO public.service_catalog (service_type, name_de, category, base_token_cost, sort_order, is_active)
VALUES ('spezialtransport', 'Spezialtransport', 'transport', 14.00, 20, true)
ON CONFLICT (service_type) DO NOTHING;

-- 2. lead_forms — admin Formulare sayfasında gösterim için
INSERT INTO public.lead_forms (name, slug, service_types, is_active)
VALUES ('Spezialtransport', 'spezialtransport', ARRAY['spezialtransport'], true)
ON CONFLICT (slug) DO UPDATE
  SET service_types = ARRAY['spezialtransport'],
      is_active = true;
