-- =============================================================================
-- ROLLBACK für 20260731100000_serviceorte.sql — NICHT als Migration ausführen.
--
-- ⚠️ Löscht alle Serviceorte samt Zugangswissen: Stockwerk, Lift, Parksituation,
--    Zugangsnotiz, Fläche. Die reinen Adressen stehen weiterhin als Text in
--    `auftraege.from_address` / `to_address` — alles, was jemand ZUSÄTZLICH
--    erfasst hat, ist danach weg und lässt sich nicht rekonstruieren.
--
--    Vorher sichern:
--      \copy (SELECT * FROM public.service_locations) TO 'orte.csv' CSV HEADER
--
--    Reihenfolge: erst ROLLBACK_20260731110000 (customer_cases zeigt hierher),
--    dann diese Datei.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trigger_auftraege_set_locations ON public.auftraege;
DROP FUNCTION IF EXISTS public.auftraege_set_locations();
DROP FUNCTION IF EXISTS public.run_location_backfill(UUID);
DROP FUNCTION IF EXISTS public.resolve_or_create_location(UUID, UUID, TEXT, TEXT, TEXT);

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_location_fk;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS location_id;

ALTER TABLE public.auftraege DROP CONSTRAINT IF EXISTS auftraege_from_location_fk;
ALTER TABLE public.auftraege DROP CONSTRAINT IF EXISTS auftraege_to_location_fk;
ALTER TABLE public.auftraege DROP COLUMN IF EXISTS from_location_id;
ALTER TABLE public.auftraege DROP COLUMN IF EXISTS to_location_id;

DROP TABLE IF EXISTS public.service_locations;

COMMIT;
