-- C1 (Auftrag analysis): auftraege.offer_id was ON DELETE CASCADE, so deleting an
-- accepted Offerte silently DESTROYED the linked Auftrag (and left Rechnung/Quittung
-- orphaned via their own SET NULL). rechnungen/quittungen already use SET NULL — this
-- aligns auftraege with them. The Auftrag holds a full financial snapshot (C2), so it
-- remains valid without the offer link. UI also blocks deleting accepted offers, but
-- this closes the hole structurally.

ALTER TABLE public.auftraege DROP CONSTRAINT auftraege_offer_id_fkey;
ALTER TABLE public.auftraege
  ADD CONSTRAINT auftraege_offer_id_fkey
  FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;
