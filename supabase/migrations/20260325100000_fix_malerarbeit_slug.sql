-- Fix malerarbeit slug to match the actual URL /anfrage/malerarbeiten
UPDATE lead_forms
SET slug = 'malerarbeiten'
WHERE slug = 'malerarbeit';
