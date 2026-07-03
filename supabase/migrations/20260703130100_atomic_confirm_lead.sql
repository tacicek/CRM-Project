-- M14: atomic customer lead-confirmation.
--
-- confirm-lead-by-token did two separate writes: (1) set lead_confirmations.confirmed_at,
-- then (2) flip leads.status to 'pending_verification'. If (2) failed it was only logged and
-- the function still returned success, leaving the lead stuck in 'awaiting_customer_confirmation'
-- forever (the token then reports 'already_confirmed' on retry). This RPC runs both writes in
-- a single transaction so they either both apply or both roll back.
--
-- SECURITY DEFINER + fixed search_path: the edge function calls it with the service-role key;
-- it takes only the already-validated confirmation id + lead id.

CREATE OR REPLACE FUNCTION public.atomic_confirm_lead(
  p_confirmation_id uuid,
  p_lead_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lead_confirmations
     SET confirmed_at = now()
   WHERE id = p_confirmation_id;

  UPDATE public.leads
     SET status = 'pending_verification',
         updated_at = now()
   WHERE id = p_lead_id
     AND status = 'awaiting_customer_confirmation';
END;
$$;
