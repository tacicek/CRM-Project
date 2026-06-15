-- =============================================================================
-- Auftrag hatırlatma iyileştirmeleri
--
-- 1. Ekip hatırlatması artık 'bestaetigt' statüsünü de kapsar.
--    Önceki davranış: yalnızca status='geplant'. Kullanıcı "Als bestätigt
--    markieren" yapınca status='bestaetigt' oluyor ve ekip lideri bir gün
--    önceki hatırlatmayı ASLA almıyordu. Bu mantık hatasını düzeltir.
-- 2. Soft-delete edilmiş (deleted_at) auftraglar hatırlatma almaz.
-- 3. Müşteri hatırlatması: ekip liderinden bağımsız ayrı bayrak + RPC.
-- =============================================================================

-- ── Müşteri hatırlatma bayrakları ──────────────────────────────────────────
ALTER TABLE public.auftraege
  ADD COLUMN IF NOT EXISTS customer_reminder_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.auftraege
  ADD COLUMN IF NOT EXISTS customer_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.auftraege.customer_reminder_sent IS
  'Müşteriye yaklaşan iş hatırlatması gönderildi mi. Yeniden planlamada (reschedule) FALSE yapılır.';

-- ── 1+2. Ekip hatırlatma RPC: geplant + bestaetigt, deleted_at guard ───────
CREATE OR REPLACE FUNCTION public.get_auftraege_needing_reminders()
RETURNS TABLE (
  auftrag_id UUID,
  company_id UUID,
  company_name VARCHAR,
  company_email VARCHAR,
  auftrag_nummer VARCHAR,
  title VARCHAR,
  customer_name VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,
  from_address TEXT,
  to_address TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  estimated_duration_minutes INTEGER,
  description TEXT,
  special_instructions TEXT,
  team_leader_id UUID,
  team_leader_name VARCHAR,
  team_leader_email VARCHAR,
  assigned_team_members UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS auftrag_id,
    a.company_id,
    c.company_name,
    c.email AS company_email,
    a.auftrag_nummer,
    a.title,
    a.customer_name,
    a.customer_email,
    a.customer_phone,
    a.from_address,
    a.to_address,
    a.scheduled_date,
    a.scheduled_time,
    a.estimated_duration_minutes,
    a.description,
    a.special_instructions,
    a.team_leader_id,
    CONCAT(tm.first_name, ' ', tm.last_name)::VARCHAR AS team_leader_name,
    tm.email AS team_leader_email,
    a.assigned_team_members
  FROM public.auftraege a
  JOIN public.companies c ON c.id = a.company_id
  LEFT JOIN public.team_members tm ON tm.id = a.team_leader_id
  WHERE a.status IN ('geplant', 'bestaetigt')
    AND a.deleted_at IS NULL
    AND a.team_leader_id IS NOT NULL
    AND a.team_reminder_sent = FALSE
    AND a.scheduled_date = CURRENT_DATE + INTERVAL '1 day' * a.reminder_days_before;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 3. Müşteri hatırlatma RPC: team_leader şartı YOK ───────────────────────
CREATE OR REPLACE FUNCTION public.get_auftraege_needing_customer_reminders()
RETURNS TABLE (
  auftrag_id UUID,
  company_id UUID,
  company_name VARCHAR,
  auftrag_nummer VARCHAR,
  title VARCHAR,
  customer_name VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,
  from_address TEXT,
  to_address TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  estimated_duration_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS auftrag_id,
    a.company_id,
    c.company_name,
    a.auftrag_nummer,
    a.title,
    a.customer_name,
    a.customer_email,
    a.customer_phone,
    a.from_address,
    a.to_address,
    a.scheduled_date,
    a.scheduled_time,
    a.estimated_duration_minutes
  FROM public.auftraege a
  JOIN public.companies c ON c.id = a.company_id
  WHERE a.status IN ('geplant', 'bestaetigt')
    AND a.deleted_at IS NULL
    AND a.customer_email IS NOT NULL
    AND a.customer_email <> ''
    AND a.customer_reminder_sent = FALSE
    AND a.scheduled_date = CURRENT_DATE + INTERVAL '1 day' * a.reminder_days_before;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.get_auftraege_needing_customer_reminders IS
  'Yaklaşan işler için müşteriye gönderilecek hatırlatmaları döndürür. '
  'Ekip lideri atanmış olması şart değildir; müşteri e-postası olması yeterlidir.';
