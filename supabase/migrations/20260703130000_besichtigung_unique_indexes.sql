-- M13 + M16: make besichtigung-appointment creation idempotent at the DB level.
--
-- Both creation paths use a non-atomic "count/check then insert", so a double-click or a
-- retried request (e.g. confirm-besichtigung retried after an email failure) can create two
-- identical confirmed besichtigung appointments. Partial unique indexes make the second
-- insert fail with 23505, which the edge functions now translate into an idempotent result.
--
-- M13: handle-proposal-response — one confirmed besichtigung per lead.
-- M16: confirm-besichtigung   — one confirmed besichtigung per offer.
--
-- ⚠️ APPLY NOTE: if the table already contains duplicate confirmed besichtigung rows for the
-- same lead_id / offer_id, index creation will fail. Deduplicate first, e.g.:
--   DELETE FROM public.appointments a USING public.appointments b
--   WHERE a.ctid < b.ctid AND a.lead_id = b.lead_id
--     AND a.appointment_type = 'besichtigung' AND a.status = 'confirmed'
--     AND b.appointment_type = 'besichtigung' AND b.status = 'confirmed';
-- (and the analogous statement for offer_id) before re-running.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_confirmed_besichtigung_per_lead
  ON public.appointments (lead_id)
  WHERE appointment_type = 'besichtigung' AND status = 'confirmed' AND lead_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_confirmed_besichtigung_per_offer
  ON public.appointments (offer_id)
  WHERE appointment_type = 'besichtigung' AND status = 'confirmed' AND offer_id IS NOT NULL;
