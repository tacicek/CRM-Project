-- Hotfix: send-offer's atomic send claim (H5, e03e7bba) sets the transient status
-- 'sending' (claim -> send e-mail -> 'sent'; revert on failure). The edge code shipped
-- on 2026-07-04, but the DB counterpart was never written: chk_offers_status did not
-- include 'sending', so every send attempt failed with 23514 (HTTP 500).
-- This adds 'sending' to the allowed set — everything else unchanged.

ALTER TABLE public.offers DROP CONSTRAINT chk_offers_status;
ALTER TABLE public.offers ADD CONSTRAINT chk_offers_status CHECK (
  (status)::text = ANY ((ARRAY[
    'draft'::character varying,
    'sending'::character varying,
    'sent'::character varying,
    'viewed'::character varying,
    'accepted'::character varying,
    'rejected'::character varying,
    'expired'::character varying,
    'job_confirmed'::character varying,
    'completed'::character varying
  ])::text[])
);
