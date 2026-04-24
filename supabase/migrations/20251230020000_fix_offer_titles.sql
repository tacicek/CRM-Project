-- Fix existing offer titles with proper German names
-- This migration updates offers that have technical service_type names in their titles

UPDATE offers SET title = CASE 
    WHEN title LIKE 'Offerte: reinigung_end%' THEN 'Übergabereinigung'
    WHEN title LIKE 'Offerte: reinigung_bau%' THEN 'Baureinigung'
    WHEN title LIKE 'Offerte: reinigung%' THEN 'Reinigungsofferte'
    WHEN title LIKE 'Offerte: umzug_privat%' THEN 'Privatumzug'
    WHEN title LIKE 'Offerte: umzug_buero%' THEN 'Büroumzug'
    WHEN title LIKE 'Offerte: umzug_firmen%' THEN 'Firmenumzug'
    WHEN title LIKE 'Offerte: umzug%' THEN 'Umzugsofferte'
    WHEN title LIKE 'Offerte: raeumung_haushalt%' THEN 'Haushaltsauflösung'
    WHEN title LIKE 'Offerte: raeumung_todesfall%' THEN 'Todesfallräumung'
    WHEN title LIKE 'Offerte: raeumung_messie%' THEN 'Messieräumung'
    WHEN title LIKE 'Offerte: raeumung_zwang%' THEN 'Zwangsräumung'
    WHEN title LIKE 'Offerte: raeumung%' THEN 'Räumungsofferte'
    WHEN title LIKE 'Offerte: entsorgung%' THEN 'Entsorgungsofferte'
    WHEN title LIKE 'Offerte: klaviertransport%' THEN 'Klaviertransport-Offerte'
    WHEN title LIKE 'Offerte: klavier%' THEN 'Klaviertransport-Offerte'
    WHEN title LIKE 'Offerte: moebellift%' THEN 'Möbellift-Offerte'
    WHEN title LIKE 'Offerte: lagerung%' THEN 'Lagerungsofferte'
    WHEN title LIKE 'Offerte: storage%' THEN 'Lagerungsofferte'
    WHEN title LIKE 'Offerte: moebeltransport%' THEN 'Möbeltransport-Offerte'
    WHEN title LIKE 'Offerte: maler%' THEN 'Malerofferte'
    WHEN title LIKE 'Offerte: painting%' THEN 'Malerofferte'
    ELSE title
END
WHERE title LIKE 'Offerte: %';

-- Add a comment to document this fix
COMMENT ON TABLE offers IS 'Offers table - Title naming convention updated 2025-12-30';


