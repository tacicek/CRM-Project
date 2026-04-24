-- Merge Räumung + Entsorgung into a single combined form entry.
-- The new RaeumungWizard handles both service types.

-- Update raeumung form to cover both service types
UPDATE lead_forms
SET
  name          = 'Räumung & Entsorgung',
  service_types = ARRAY['raeumung', 'entsorgung']
WHERE slug = 'raeumung';

-- Remove the standalone entsorgung form (now merged into raeumung)
DELETE FROM lead_forms
WHERE slug = 'entsorgung';
