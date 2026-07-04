-- K2 (Kalender analysis 2026-07-04): sync_auftrag_status_to_appointment only touched
-- the PRIMARY appointment (auftraege.appointment_id). Since the per-service accept
-- trigger (20260704151000) creates ONE appointment per service group, the 2nd+ group
-- appointments were never updated when the Auftrag was cancelled/completed — they stayed
-- 'pending' forever (ghost calendar entries, reminders still fired for them).
--
-- Fix: when the Auftrag is linked to an offer, propagate its status to EVERY 'service'
-- appointment of that offer; manual Aufträge (offer_id IS NULL) keep the single-primary
-- path. An already-'cancelled' appointment is never revived (e.g. a single group cancelled
-- earlier must stay cancelled when the Auftrag later completes) — only a real cancel
-- cascades to all.
--
-- The reverse direction (appointment→auftrag) is deliberately UNCHANGED: cancelling ONE
-- group's appointment must not storniere the whole Auftrag (cleanup can be dropped while
-- the move goes ahead). Only the primary appointment's cancel still storniert's the
-- Auftrag — which then, via this function, cancels all groups (auftrag = source of truth).

CREATE OR REPLACE FUNCTION public.sync_auftrag_status_to_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_target public.appointment_status;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    v_target := 'cancelled'::public.appointment_status;
  ELSE
    v_target := public.map_auftrag_to_appointment_status(NEW.status::text);
  END IF;

  IF NEW.offer_id IS NOT NULL THEN
    -- Multi-service: every service appointment of this offer.
    UPDATE public.appointments
    SET status = v_target
    WHERE offer_id = NEW.offer_id
      AND appointment_type = 'service'
      AND status IS DISTINCT FROM v_target
      -- Don't revive an already-cancelled group unless this IS a cancel.
      AND (v_target = 'cancelled' OR status <> 'cancelled');
  ELSIF NEW.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET status = v_target
    WHERE id = NEW.appointment_id
      AND status IS DISTINCT FROM v_target;
  END IF;

  RETURN NEW;
END;
$function$;

-- WHEN clause must also fire when the Auftrag has an offer but no primary appointment_id
-- linked (belt-and-suspenders; the accept trigger always links one, but a manual/edge
-- path might not).
DROP TRIGGER IF EXISTS trg_sync_auftrag_status_to_appointment ON public.auftraege;
CREATE TRIGGER trg_sync_auftrag_status_to_appointment
AFTER UPDATE ON public.auftraege
FOR EACH ROW
WHEN (
  (NEW.appointment_id IS NOT NULL OR NEW.offer_id IS NOT NULL)
  AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
)
EXECUTE FUNCTION public.sync_auftrag_status_to_appointment();
