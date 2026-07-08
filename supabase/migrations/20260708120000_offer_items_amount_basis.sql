-- ============================================================
-- Offerte Preismodell — item-level Betrags-Achse amount_basis (Phase 2)
-- ============================================================
-- Eine additive Spalte auf offer_items:
--   amount_basis: fixed  = bestimmter Betrag (zaehlt zur Summe)
--                 rate   = nur Einheitspreis, Menge/Dauer unbestimmt (NIE in der Summe)
--                 range  = bestimmte Min/Max-Spanne (in der Summe)
-- Orthogonal zu price_type (Einheit/frei) und offers.price_model (offer-level).
--
-- ⚠ offer_items.total (GENERATED quantity*unit_price) und offers.total/vat_amount
--   (GENERATED aus subtotal/vat_rate) werden NICHT angefasst — die Summenlogik bleibt
--   App-seitig (schreibt nur offers.subtotal). Diese Migration setzt ausschliesslich amount_basis.
-- ⚠ RLS/Policies unveraendert — die neue Spalte erbt die bestehenden offer_items-Policies.
-- ⚠ Backfill NUR range↔fixed, NIEMALS rate. Gesendete/frozen Offerten werden nicht
--   umklassifiziert (rate wird ausschliesslich manuell im UI, Phase 3, gesetzt).
-- ⚠ Scope: NUR amount_basis. Item-level kostendach_max folgt in einer separaten Migration
--   zu Beginn von Phase 3 (kleine, einzweck-Migrationen, leichter rollback-bar).
-- ============================================================

ALTER TABLE public.offer_items
  ADD COLUMN IF NOT EXISTS amount_basis text NOT NULL DEFAULT 'fixed'
    CHECK (amount_basis IN ('fixed', 'rate', 'range'));

COMMENT ON COLUMN public.offer_items.amount_basis IS
  'Betrags-Achse: fixed = bestimmter Betrag (zaehlt zur Summe) | rate = nur Einheitspreis, '
  'Menge/Dauer unbestimmt (NIE in Summe) | range = bestimmte Min/Max-Spanne (in Summe). '
  'Orthogonal zu price_type und offers.price_model. Default fixed erhaelt Bestandsverhalten.';

-- ── Backfill: nur Zeilen mit GUELTIGEM time_estimate → range (Spiegel von hourlyRange) ──
-- CASE erzwingt Kurzschluss-Reihenfolge: der ::numeric-Cast laeuft NUR, wenn die drei
-- jsonb_typeof-Checks 'number' ergeben. Ein flaches AND wuerde von Postgres umsortiert werden
-- duerfen und koennte bei legacy/kaputtem jsonb mit 'invalid input syntax for type numeric'
-- die Migration abbrechen. Kriterium ist identisch zu offerPricing.hourlyRange
-- (minHours/maxHours/hourlyRate sind number, minHours > 0 UND hourlyRate > 0).
UPDATE public.offer_items
SET amount_basis = 'range'
WHERE amount_basis = 'fixed'                                 -- idempotent: nur Default-Zeilen
  AND time_estimate IS NOT NULL
  AND jsonb_typeof(time_estimate) = 'object'
  AND CASE
        WHEN jsonb_typeof(time_estimate -> 'minHours')   = 'number'
         AND jsonb_typeof(time_estimate -> 'maxHours')   = 'number'
         AND jsonb_typeof(time_estimate -> 'hourlyRate') = 'number'
        THEN (time_estimate ->> 'minHours')::numeric   > 0
         AND (time_estimate ->> 'hourlyRate')::numeric > 0
        ELSE false
      END;
