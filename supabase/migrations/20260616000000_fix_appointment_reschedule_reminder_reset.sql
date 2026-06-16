-- =============================================================================
-- FIX: Kalender (appointment) üzerinden reschedule'da reminder bayrakları
--      sıfırlanmıyordu.
--
-- Sorun: AuftragModal tarih değişince team_reminder_sent + customer_reminder_sent
-- bayraklarını FALSE'a çekiyor (AuftragModal.tsx ~804-811). Ancak tarih linkli
-- appointment üzerinden (Kalender) değişince sync_appointment_schedule_to_auftrag
-- trigger'ı yalnızca scheduled_* alanlarını aynalıyor, reminder bayraklarına
-- dokunmuyordu. Sonuç: zaten gönderilmiş bir hatırlatma yeni tarih için tekrar
-- gönderilmiyor; gönderilmemişse RPC'nin (scheduled_date = CURRENT_DATE +
-- reminder_days_before) koşulu yanlış güne kayıyordu.
--
-- Çözüm: trigger fonksiyonunu CREATE OR REPLACE ile güncelle — tarih VEYA saat
-- değişince hatırlatma bayraklarını sıfırla. Orijinal davranış (scheduled_date/
-- scheduled_time/estimated_duration_minutes aynalaması) aynen korunur.
--
-- NOT: appointments kolonları appointment_date/start_time/duration_minutes;
-- auftraege kolonları scheduled_date/scheduled_time/estimated_duration_minutes +
-- reminder bayrakları team_reminder_sent/reminder_sent_at/customer_reminder_sent/
-- customer_reminder_sent_at (team tarafı için "_at" kolonu reminder_sent_at'tir,
-- team_reminder_sent_at YOKTUR).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_appointment_schedule_to_auftrag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_datetime_changed boolean := (
    OLD.appointment_date IS DISTINCT FROM NEW.appointment_date
    OR OLD.start_time IS DISTINCT FROM NEW.start_time
  );
BEGIN
  UPDATE public.auftraege a
  SET
    scheduled_date              = NEW.appointment_date,
    scheduled_time              = NEW.start_time,
    estimated_duration_minutes  = COALESCE(NEW.duration_minutes, a.estimated_duration_minutes),
    -- Tarih/saat değişince hatırlatmaları sıfırla (yeni tarih için tekrar gönderilmeli).
    -- Sadece zaman değiştiğinde; duration-only değişimde bayraklar korunur.
    team_reminder_sent          = CASE WHEN v_datetime_changed THEN FALSE ELSE a.team_reminder_sent END,
    reminder_sent_at            = CASE WHEN v_datetime_changed THEN NULL  ELSE a.reminder_sent_at END,
    customer_reminder_sent      = CASE WHEN v_datetime_changed THEN FALSE ELSE a.customer_reminder_sent END,
    customer_reminder_sent_at   = CASE WHEN v_datetime_changed THEN NULL  ELSE a.customer_reminder_sent_at END
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

COMMENT ON FUNCTION public.sync_appointment_schedule_to_auftrag IS
  'Takvim randevusu (service) tarih/saat değişince linkli auftrag scheduled_* aynalanır. '
  'Tarih/saat değiştiğinde reminder bayrakları (team + customer) sıfırlanır.';
