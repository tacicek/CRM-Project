-- =============================================================================
-- #7 — appointments ↔ auftraege tek kaynak (Option B)
--
-- Tasarım (iki ayrık tek-yön senkron, döngüsüz):
--   • ZAMAN (tarih/saat/süre): appointments SAHİBİ → auftraege.scheduled_* aynalanır
--   • YAŞAM DÖNGÜSÜ (status):  auftraege SAHİBİ  → appointments.status aynalanır
--   • Adres/ekip/pricing: auftraege'de kalır (senkron edilmez)
--
-- 1:1 bağ: auftraege.appointment_id → appointments(id)
-- =============================================================================

-- ── 1. Bağ kolonu ──────────────────────────────────────────────────────────
ALTER TABLE public.auftraege
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Bir appointment en fazla bir auftrag ile (aktif) ilişkili olur
CREATE UNIQUE INDEX IF NOT EXISTS auftraege_appointment_id_unique
  ON public.auftraege (appointment_id)
  WHERE appointment_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.auftraege.appointment_id IS
  'Kanonik takvim randevusu (service). Zaman/saat bu randevuda sahiplenir, '
  'auftraege.scheduled_* trigger ile aynalanır.';

-- ── 2. Status eşleme fonksiyonu (auftrag → appointment) ─────────────────────
CREATE OR REPLACE FUNCTION public.map_auftrag_to_appointment_status(p_status text)
RETURNS public.appointment_status
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'geplant'        THEN 'pending'::public.appointment_status
    WHEN 'bestaetigt'     THEN 'confirmed'::public.appointment_status
    WHEN 'in_bearbeitung' THEN 'confirmed'::public.appointment_status
    WHEN 'abgeschlossen'  THEN 'completed'::public.appointment_status
    WHEN 'storniert'      THEN 'cancelled'::public.appointment_status
    ELSE 'pending'::public.appointment_status
  END;
$$;

-- ── 3. ZAMAN senkronu: appointments(service) → auftraege ────────────────────
CREATE OR REPLACE FUNCTION public.sync_appointment_schedule_to_auftrag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.auftraege a
  SET
    scheduled_date              = NEW.appointment_date,
    scheduled_time              = NEW.start_time,
    estimated_duration_minutes  = COALESCE(NEW.duration_minutes, a.estimated_duration_minutes)
  WHERE a.appointment_id = NEW.id
    AND a.deleted_at IS NULL
    AND (
      a.scheduled_date IS DISTINCT FROM NEW.appointment_date
      OR a.scheduled_time IS DISTINCT FROM NEW.start_time
      OR a.estimated_duration_minutes IS DISTINCT FROM COALESCE(NEW.duration_minutes, a.estimated_duration_minutes)
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_schedule_to_auftrag ON public.appointments;
CREATE TRIGGER trg_sync_appointment_schedule_to_auftrag
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (
    NEW.appointment_type = 'service'
    AND (
      OLD.appointment_date IS DISTINCT FROM NEW.appointment_date
      OR OLD.start_time IS DISTINCT FROM NEW.start_time
      OR OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
    )
  )
  EXECUTE FUNCTION public.sync_appointment_schedule_to_auftrag();

-- ── 4. YAŞAM DÖNGÜSÜ senkronu: auftraege.status/deleted_at → appointments ───
CREATE OR REPLACE FUNCTION public.sync_auftrag_status_to_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.appointment_status;
BEGIN
  IF NEW.appointment_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Soft-delete → randevu iptal
  IF NEW.deleted_at IS NOT NULL THEN
    v_target := 'cancelled'::public.appointment_status;
  ELSE
    v_target := public.map_auftrag_to_appointment_status(NEW.status::text);
  END IF;

  UPDATE public.appointments
  SET status = v_target
  WHERE id = NEW.appointment_id
    AND status IS DISTINCT FROM v_target;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_auftrag_status_to_appointment ON public.auftraege;
CREATE TRIGGER trg_sync_auftrag_status_to_appointment
  AFTER UPDATE ON public.auftraege
  FOR EACH ROW
  WHEN (
    NEW.appointment_id IS NOT NULL
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
    )
  )
  EXECUTE FUNCTION public.sync_auftrag_status_to_appointment();

COMMENT ON FUNCTION public.sync_appointment_schedule_to_auftrag IS
  'Takvim randevusu (service) tarih/saat değişince linkli auftrag scheduled_* aynalanır.';
COMMENT ON FUNCTION public.sync_auftrag_status_to_appointment IS
  'Auftrag status/deleted_at değişince linkli appointment.status aynalanır.';
