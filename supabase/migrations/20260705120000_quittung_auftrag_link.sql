-- M3 (Auftrag analysis): quittungen linked to an order only indirectly via offer_id,
-- while rechnungen carry a direct auftrag_id. Add a tracking auftrag_id to quittungen
-- for traceability (which order a receipt belongs to). Deliberately NOT UNIQUE — a job
-- can have multiple receipts (partial/instalment payments; live data already shows this).
-- ON DELETE SET NULL, consistent with offer_id on all three billing tables.

ALTER TABLE public.quittungen
  ADD COLUMN IF NOT EXISTS auftrag_id uuid;

ALTER TABLE public.quittungen
  ADD CONSTRAINT quittungen_auftrag_id_fkey
  FOREIGN KEY (auftrag_id) REFERENCES public.auftraege(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quittungen_auftrag_id
  ON public.quittungen (auftrag_id) WHERE auftrag_id IS NOT NULL;
