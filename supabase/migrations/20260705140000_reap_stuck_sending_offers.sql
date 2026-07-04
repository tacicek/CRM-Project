-- #6 (Offerte analysis): send-offer claims status='sending', sends the email, then sets
-- status='sent'. If that FINAL update fails it is only logged — the offer is stranded in
-- 'sending' forever (re-send claim needs draft/sent/viewed, so 'sending' can never be
-- reclaimed). No self-heal, no reaper. This adds one.
--
-- Heuristic (safe): an offer stuck in 'sending' for >15 min means the claim happened. If
-- email_logs shows a successful 'offer_sent' for it → the customer got it → move to 'sent'
-- (idempotent, sets sent_at). Otherwise the email never went out → revert to 'viewed' so
-- the firm can resend (no duplicate email risk). 15 min is far beyond a real send (~seconds).

CREATE OR REPLACE FUNCTION public.reap_stuck_sending_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sent    integer;
  v_revert  integer;
BEGIN
  -- Email verifiably delivered → finish the transition to 'sent'.
  UPDATE public.offers o
  SET status = 'sent', sent_at = COALESCE(o.sent_at, now())
  WHERE o.status = 'sending'
    AND o.updated_at < now() - interval '15 minutes'
    AND EXISTS (
      SELECT 1 FROM public.email_logs el
      WHERE el.metadata->>'offer_id' = o.id::text
        AND el.email_type = 'offer_sent'
        AND el.status = 'sent'
    );
  GET DIAGNOSTICS v_sent = ROW_COUNT;

  -- No delivery record → the send never completed → revert so it can be resent.
  UPDATE public.offers
  SET status = 'viewed'
  WHERE status = 'sending'
    AND updated_at < now() - interval '15 minutes';
  GET DIAGNOSTICS v_revert = ROW_COUNT;

  IF v_sent + v_revert > 0 THEN
    RAISE LOG '[reap_stuck_sending_offers] recovered % (sent=% revert=%)', v_sent + v_revert, v_sent, v_revert;
  END IF;
  RETURN v_sent + v_revert;
END;
$function$;

SELECT cron.schedule('reap-stuck-sending-offers', '*/15 * * * *',
  $$SELECT public.reap_stuck_sending_offers()$$);
