-- =============================================================================
-- #7 — İptal propagasyonu: appointment(service) iptal → linkli auftrag storniert
--
-- Müşteri (public sayfa), takvim veya edge function nereden iptal ederse etsin,
-- linkli auftrag da storniert olur. Tek noktadan tüm yolları kapsar.
--
-- Döngü güvenliği: bu trigger sadece status 'cancelled'a GEÇİŞTE çalışır ve
-- auftrag zaten storniert/abgeschlossen ise dokunmaz. Ters trigger
-- (auftrag.status → appointment.status) DISTINCT guard'lı olduğu için 2 hop'ta durur.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_appointment_cancel_to_auftrag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.auftraege a
  SET status = 'storniert'::public.auftrag_status
  WHERE a.appointment_id = NEW.id
    AND a.deleted_at IS NULL
    AND a.status NOT IN ('abgeschlossen', 'storniert');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_cancel_to_auftrag ON public.appointments;
CREATE TRIGGER trg_sync_appointment_cancel_to_auftrag
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  WHEN (
    NEW.appointment_type = 'service'
    AND NEW.status = 'cancelled'
    AND OLD.status IS DISTINCT FROM 'cancelled'
  )
  EXECUTE FUNCTION public.sync_appointment_cancel_to_auftrag();

COMMENT ON FUNCTION public.sync_appointment_cancel_to_auftrag IS
  'Service randevusu iptal edilince linkli auftrag storniert olur (terminal auftraglar hariç).';
