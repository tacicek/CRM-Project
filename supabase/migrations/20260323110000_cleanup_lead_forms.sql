-- Remove redundant lead_forms rows.
-- Keep only the 9 core forms that match the actual /anfrage/... routes:
--   umzug, reinigung, raeumung, klaviertransport, moebellift,
--   entsorgung, malerarbeit, renovation, lagerung
--
-- Forms that had 0 leads and duplicate coverage are removed.

DELETE FROM lead_forms
WHERE slug IN (
  'transport',           -- covered by individual service forms
  'usm-transport',       -- no /anfrage/usm-transport route exists
  'wasserbett-transport',-- no /anfrage/wasserbett-transport route exists
  'moebeltransport',     -- no /anfrage/moebeltransport route exists
  'umzug-privat',        -- redundant – umzug covers both umzug_privat + umzug_firma
  'umzug-firma',         -- redundant – umzug covers both
  'endreinigung',        -- redundant – reinigung covers reinigung_end + reinigung_grund
  'grundreinigung'       -- redundant – reinigung covers both
);

-- Ensure the 9 core forms have correct service_types
-- (update in case they were seeded with outdated values)
UPDATE lead_forms SET service_types = ARRAY['umzug_privat', 'umzug_firma']     WHERE slug = 'umzug';
UPDATE lead_forms SET service_types = ARRAY['reinigung_end', 'reinigung_grund'] WHERE slug = 'reinigung';
UPDATE lead_forms SET service_types = ARRAY['raeumung_wohnung']                 WHERE slug = 'raeumung';
UPDATE lead_forms SET service_types = ARRAY['klaviertransport']                 WHERE slug = 'klaviertransport';
UPDATE lead_forms SET service_types = ARRAY['moebellift']                       WHERE slug = 'moebellift';
UPDATE lead_forms SET service_types = ARRAY['entsorgung']                       WHERE slug = 'entsorgung';
UPDATE lead_forms SET service_types = ARRAY['malerarbeit']                      WHERE slug = 'malerarbeit';
UPDATE lead_forms SET service_types = ARRAY['renovation']                       WHERE slug = 'renovation';
UPDATE lead_forms SET service_types = ARRAY['lagerung']                         WHERE slug = 'lagerung';
