-- Add missing lead forms for Klaviertransport, Renovation, and Möbellift

INSERT INTO lead_forms (name, slug, description, service_types, primary_color, show_header, header_title, header_subtitle, is_active)
VALUES 
  ('Klaviertransport Formular', 'klaviertransport', 'Formular für Klaviertransport Anfragen', ARRAY['klaviertransport'], '#6366f1', true, 'Klaviertransport Anfrage', 'Erhalten Sie kostenlose Offerten für Ihren Klaviertransport', true),
  ('Renovation Formular', 'renovation', 'Formular für Renovations Anfragen', ARRAY['renovation'], '#6366f1', true, 'Renovation Anfrage', 'Erhalten Sie kostenlose Offerten für Ihre Renovation', true),
  ('Möbellift Formular', 'moebellift', 'Formular für Möbellift Anfragen', ARRAY['moebellift'], '#6366f1', true, 'Möbellift Anfrage', 'Erhalten Sie kostenlose Offerten für Ihren Möbellift', true)
ON CONFLICT (slug) DO NOTHING;

