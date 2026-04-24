-- Add only_4 to lead_sharing_preference enum
-- Represents: receives leads with max_companies <= 4 (1, 3, 4 company leads)
-- Pricing tier: 1.15x multiplier (between premium only_3 and standard only_5)

ALTER TYPE lead_sharing_preference ADD VALUE IF NOT EXISTS 'only_4';
