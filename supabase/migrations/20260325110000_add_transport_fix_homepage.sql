-- Add General Transport (Spezialtransport) form
INSERT INTO lead_forms (name, slug, description, service_types, is_active, show_header, header_title, header_subtitle)
VALUES (
  'Transport Formular',
  'transport',
  'Formular für allgemeine Transportanfragen (Spezialtransporte, Tresore, Aquarien, etc.)',
  ARRAY['spezialtransport'],
  true,
  true,
  'Transport anfragen',
  'Erhalten Sie kostenlose Offerten für Ihren Transport'
)
ON CONFLICT (slug) DO NOTHING;

-- Fix Homepage form: ensure service_types is set to all standard services
-- and remove the placeholder "Alle" value
UPDATE lead_forms
SET
  service_types = ARRAY[
    'umzug_privat', 'umzug_firma', 'umzug_international',
    'reinigung_end', 'reinigung_grund',
    'raeumung_wohnung', 'entsorgung',
    'klaviertransport', 'moebellift', 'spezialtransport',
    'lagerung', 'malerarbeit', 'renovation'
  ],
  name = 'Homepage Formular',
  header_title = 'Kostenlose Offerten anfragen',
  header_subtitle = 'Bis zu 5 verifizierte Firmen melden sich innerhalb von 24h'
WHERE slug = 'homepage';
