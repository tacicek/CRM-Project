-- ============================================================
-- offers.surcharges (Zuschläge / surcharges) — Z2
-- Surcharge kırılımı jsonb dizisi olarak saklanır:
--   [{ label, type: 'percent'|'fixed'|'per_km', value, amount }]
-- Vergi tabanı (kalemler + surcharge'lar) offers.subtotal'e yazılır →
-- GENERATED vat_amount/total değişmeden doğru kalır (offerSurcharges.computeOfferTotals).
-- Nullable, default yok → mevcut offer'lar etkilenmez (surcharges NULL = surcharge yok).
-- offers RLS tüm kolonları kapsar; ek policy gerekmez.
-- ============================================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS surcharges jsonb;

COMMENT ON COLUMN offers.surcharges IS
  'Zuschläge dizisi: [{label, type(percent|fixed|per_km), value, amount}]. '
  'amount kaydetme anı snapshot; vergi tabanı subtotal''e dahildir.';
