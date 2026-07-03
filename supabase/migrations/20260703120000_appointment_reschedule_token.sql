-- C1: Secure the customer-reschedule response flow.
--
-- The confirm/reject links mailed to the company (via notify-appointment-reschedule)
-- carried a `token` URL param that was never persisted or validated server-side, so
-- handle-reschedule-response trusted a raw appointmentId plus attacker-controlled body
-- fields (customerEmail, message, ...) — an open appointment-tampering + email-relay hole.
--
-- We persist a per-appointment secret token when the reschedule request is created and
-- require it in handle-reschedule-response. The token is single-use (cleared on
-- confirm/reject) and expires so stale links stop working.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reschedule_token uuid,
  ADD COLUMN IF NOT EXISTS reschedule_token_expires_at timestamptz;

-- Look up by token during validation.
CREATE INDEX IF NOT EXISTS idx_appointments_reschedule_token
  ON public.appointments (reschedule_token)
  WHERE reschedule_token IS NOT NULL;

COMMENT ON COLUMN public.appointments.reschedule_token IS
  'Single-use secret validated by handle-reschedule-response; set by notify-appointment-reschedule, cleared once the firma confirms/rejects.';
COMMENT ON COLUMN public.appointments.reschedule_token_expires_at IS
  'Expiry for reschedule_token; requests older than this are rejected.';
