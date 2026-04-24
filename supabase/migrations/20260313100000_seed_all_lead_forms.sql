-- Ensure all embed forms exist with correct service_types.
-- Uses ON CONFLICT (slug) DO UPDATE so re-running is safe.

INSERT INTO lead_forms (name, slug, description, service_types, primary_color, show_header, header_title, header_subtitle, is_active)
VALUES
  -- ── Transport: general (all 5 sub-types) ─────────────────────────────────
  (
    'Transport Formular',
    'transport',
    'Allgemeines Formular für alle Transportanfragen',
    ARRAY['transport_moebel', 'klaviertransport', 'moebellift', 'usm_transport', 'wasserbett_transport'],
    '#6366f1', true,
    'Transport Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihren Transport',
    true
  ),
  -- ── Transport: specific sub-types ────────────────────────────────────────
  (
    'USM Transport Formular',
    'usm-transport',
    'Formular für USM Möbel Transport Anfragen',
    ARRAY['usm_transport'],
    '#6366f1', true,
    'USM Transport Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihren USM Transport',
    true
  ),
  (
    'Wasserbett Transport Formular',
    'wasserbett-transport',
    'Formular für Wasserbett Transport Anfragen',
    ARRAY['wasserbett_transport'],
    '#6366f1', true,
    'Wasserbett Transport Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihren Wasserbett Transport',
    true
  ),
  (
    'Möbeltransport Formular',
    'moebeltransport',
    'Formular für Möbeltransport Anfragen',
    ARRAY['transport_moebel'],
    '#6366f1', true,
    'Möbeltransport Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihren Möbeltransport',
    true
  ),
  -- ── Umzug: general + sub-types ───────────────────────────────────────────
  (
    'Umzug Formular',
    'umzug',
    'Allgemeines Formular für alle Umzugsanfragen',
    ARRAY['umzug_privat', 'umzug_firma'],
    '#6366f1', true,
    'Umzug Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihren Umzug',
    true
  ),
  (
    'Privatumzug Formular',
    'umzug-privat',
    'Formular für Privatumzug Anfragen',
    ARRAY['umzug_privat'],
    '#6366f1', true,
    'Privatumzug Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihren Privatumzug',
    true
  ),
  (
    'Firmenumzug Formular',
    'umzug-firma',
    'Formular für Firmenumzug Anfragen',
    ARRAY['umzug_firma'],
    '#6366f1', true,
    'Firmenumzug Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihren Firmenumzug',
    true
  ),
  -- ── Reinigung: general + sub-types ───────────────────────────────────────
  (
    'Reinigung Formular',
    'reinigung',
    'Allgemeines Formular für alle Reinigungsanfragen',
    ARRAY['reinigung_end', 'reinigung_grund'],
    '#6366f1', true,
    'Reinigung Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihre Reinigung',
    true
  ),
  (
    'Endreinigung Formular',
    'endreinigung',
    'Formular für Endreinigung Anfragen',
    ARRAY['reinigung_end'],
    '#6366f1', true,
    'Endreinigung Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihre Endreinigung',
    true
  ),
  (
    'Grundreinigung Formular',
    'grundreinigung',
    'Formular für Grundreinigung Anfragen',
    ARRAY['reinigung_grund'],
    '#6366f1', true,
    'Grundreinigung Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihre Grundreinigung',
    true
  ),
  -- ── Other services ────────────────────────────────────────────────────────
  (
    'Räumung Formular',
    'raeumung',
    'Formular für Räumungsanfragen',
    ARRAY['raeumung_wohnung'],
    '#6366f1', true,
    'Räumung Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihre Räumung',
    true
  ),
  (
    'Lagerung Formular',
    'lagerung',
    'Formular für Lagerungsanfragen',
    ARRAY['lagerung'],
    '#6366f1', true,
    'Lagerung Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihre Lagerung',
    true
  ),
  (
    'Entsorgung Formular',
    'entsorgung',
    'Formular für Entsorgungsanfragen',
    ARRAY['entsorgung'],
    '#6366f1', true,
    'Entsorgung Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihre Entsorgung',
    true
  ),
  (
    'Malerarbeit Formular',
    'malerarbeit',
    'Formular für Malerarbeits-Anfragen',
    ARRAY['malerarbeit'],
    '#6366f1', true,
    'Malerarbeit Anfrage',
    'Erhalten Sie kostenlose Offerten für Ihre Malerarbeiten',
    true
  )
ON CONFLICT (slug) DO UPDATE
  SET
    service_types = EXCLUDED.service_types,
    name          = EXCLUDED.name,
    description   = EXCLUDED.description,
    is_active     = EXCLUDED.is_active;
