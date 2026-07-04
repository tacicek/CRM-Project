-- D (Quittung analysis): all financial fields are computed 100% client-side
-- (calculateTotals) with ZERO server validation — a manipulated/buggy client could
-- persist inconsistent totals silently (unlike offers/rechnungen where vat_amount/total
-- are GENERATED columns). Lock the internal money chain with CHECK constraints so the
-- DB rejects any inconsistency:
--   total       = max(zwischensumme - rabatt, 0)
--   mwst_betrag = round(total * mwst_satz / 100, 2)
--   gesamttotal = total + mwst_betrag
-- (The positionen→zwischensumme sum stays client-side — jsonb, checked-row logic — but the
--  zwischensumme→gesamttotal chain is now DB-enforced.) All existing rows already satisfy these.

ALTER TABLE public.quittungen
  ADD CONSTRAINT chk_quittung_total_from_rabatt
    CHECK (round(total, 2) = round(GREATEST(zwischensumme - rabatt, 0), 2)),
  ADD CONSTRAINT chk_quittung_mwst
    CHECK (round(mwst_betrag, 2) = round(total * mwst_satz / 100, 2)),
  ADD CONSTRAINT chk_quittung_gesamt
    CHECK (round(gesamttotal, 2) = round(total + mwst_betrag, 2));
