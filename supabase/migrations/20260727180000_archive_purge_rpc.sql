-- =============================================================================
-- Archivieren und Löschen als EINE serverseitige Operation
-- =============================================================================
--
-- BEFUND
-- Die Archiv-Seite löschte direkt aus dem Browser: erst lead_distributions, dann
-- offer_items + offers, dann appointment_history + appointments — vier bis sechs
-- einzelne Anweisungen, ohne Transaktion und ohne dass vorher irgendetwas
-- gesichert wurde. Bricht es in der Mitte ab, ist ein Teil weg und der Rest
-- steht noch. Der Export ist ein SEPARATER Knopf; niemand erzwingt ihn vorher.
--
-- Zwei Dinge, die dabei besonders wiegen:
--
--   1. Gelöscht wurden auch Offerten im Status 'accepted'. Deren
--      Fremdschlüssel stehen auf ON DELETE SET NULL — eine Rechnung, eine
--      Quittung oder ein Auftrag verliert damit die Verbindung zu der Offerte,
--      aus der sie entstanden ist. Das ist ein Riss im Prüfpfad der
--      Buchhaltung, ausgelöst durch ein Häkchen in einem Dialog.
--
--   2. lead_distributions ist eine Fork-Altlast mit 0 Zeilen (siehe
--      docs/SISTEM_PRD.md). Der Zweig lief ins Leere, während die beiden
--      anderen echte Daten entfernten.
--
-- ABHILFE
-- Eine Funktion, eine Transaktion: Log anlegen, Sicherung schreiben, löschen.
-- Bricht ein Schritt ab, ist nichts geschehen. Die Sicherungen tragen jetzt die
-- Log-ID (bisher `archive_log_id: null` und nie nachgetragen) und eine
-- SHA-256-Summe statt der bisherigen 32-Bit-Bastelei.
--
-- Offerten mit Buchhaltungsbezug werden ÜBERSPRUNGEN statt stillschweigend
-- entkoppelt. Sie tauchen in der Rückgabe als `uebersprungen` auf, damit der
-- Unterschied sichtbar ist.
--
-- Archivieren ist laut Rechtematrix Sache des Eigentümers.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.archive_and_purge_company_data(
  p_company_id     UUID,
  p_retention_days INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cutoff        TIMESTAMPTZ;
  v_log_id        UUID;
  v_offer_ids     UUID[];
  v_appt_ids      UUID[];
  v_skipped       INTEGER := 0;
  v_offers_data   JSONB;
  v_appts_data    JSONB;
  v_offers_count  INTEGER := 0;
  v_appts_count   INTEGER := 0;
BEGIN
  IF NOT public.is_company_role(p_company_id, ARRAY['owner']) THEN
    RAISE EXCEPTION 'Nur der Eigentuemer darf archivieren'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_retention_days IS NULL OR p_retention_days < 30 THEN
    RAISE EXCEPTION 'Aufbewahrung muss mindestens 30 Tage betragen'
      USING ERRCODE = 'check_violation';
  END IF;

  v_cutoff := NOW() - (p_retention_days || ' days')::INTERVAL;

  -- Offerten OHNE Buchhaltungsbezug. Die uebrigen bleiben stehen: ein
  -- SET-NULL-Fremdschluessel wuerde die Rechnung von ihrer Offerte trennen.
  SELECT array_agg(o.id) INTO v_offer_ids
  FROM public.offers o
  WHERE o.company_id = p_company_id
    AND o.created_at < v_cutoff
    AND o.status IN ('sent', 'rejected', 'expired')
    AND NOT EXISTS (SELECT 1 FROM public.rechnungen r WHERE r.offer_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM public.quittungen q WHERE q.offer_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM public.auftraege a WHERE a.offer_id = o.id);

  SELECT COUNT(*) INTO v_skipped
  FROM public.offers o
  WHERE o.company_id = p_company_id
    AND o.created_at < v_cutoff
    AND o.status IN ('sent', 'rejected', 'expired', 'accepted')
    AND NOT (o.id = ANY(COALESCE(v_offer_ids, ARRAY[]::UUID[])));

  SELECT array_agg(a.id) INTO v_appt_ids
  FROM public.appointments a
  WHERE a.company_id = p_company_id
    AND a.created_at < v_cutoff
    AND a.status IN ('completed', 'cancelled');

  IF v_offer_ids IS NULL AND v_appt_ids IS NULL THEN
    RETURN jsonb_build_object('offerten', 0, 'termine', 0, 'uebersprungen', v_skipped, 'log_id', NULL);
  END IF;

  -- Werte aus den CHECK-Constraints der Tabelle: archive_type ∈ {…, custom},
  -- triggered_by ∈ {manual, auto, scheduled}, storage_type ist NOT NULL.
  -- Die Sicherung liegt als JSONB in archive_snapshots, also 'local'.
  INSERT INTO public.archive_logs (
    archive_name, archive_type, storage_type, status, triggered_by,
    triggered_by_user_id, data_to_date, source_data_deleted, deleted_at
  )
  VALUES (
    'Manuelle Archivierung ' || to_char(NOW(), 'YYYY-MM-DD HH24:MI'),
    'custom', 'local', 'in_progress', 'manual',
    auth.uid(), v_cutoff, true, NOW()
  )
  RETURNING id INTO v_log_id;

  -- Sicherung VOR dem Loeschen, mit Bezug zum Log und kryptografischer Summe.
  IF v_offer_ids IS NOT NULL THEN
    SELECT jsonb_agg(to_jsonb(o)), COUNT(*) INTO v_offers_data, v_offers_count
    FROM public.offers o WHERE o.id = ANY(v_offer_ids);

    INSERT INTO public.archive_snapshots (archive_log_id, chunk_number, total_chunks, data, record_count, checksum)
    VALUES (v_log_id, 1, 1, v_offers_data, v_offers_count,
            encode(sha256(convert_to(v_offers_data::text, 'UTF8')), 'hex'));

    DELETE FROM public.offers WHERE id = ANY(v_offer_ids);
  END IF;

  IF v_appt_ids IS NOT NULL THEN
    SELECT jsonb_agg(to_jsonb(a)), COUNT(*) INTO v_appts_data, v_appts_count
    FROM public.appointments a WHERE a.id = ANY(v_appt_ids);

    INSERT INTO public.archive_snapshots (archive_log_id, chunk_number, total_chunks, data, record_count, checksum)
    VALUES (v_log_id, 2, 2, v_appts_data, v_appts_count,
            encode(sha256(convert_to(v_appts_data::text, 'UTF8')), 'hex'));

    DELETE FROM public.appointments WHERE id = ANY(v_appt_ids);
  END IF;

  UPDATE public.archive_logs
  SET status = 'completed', records_archived = v_offers_count + v_appts_count
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'offerten',      v_offers_count,
    'termine',       v_appts_count,
    'uebersprungen', v_skipped,
    'log_id',        v_log_id
  );
END;
$$;

COMMENT ON FUNCTION public.archive_and_purge_company_data(UUID, INTEGER) IS
  'Sichert und loescht alte Offerten und Termine EINER Firma in einer '
  'Transaktion. Offerten mit Rechnung, Quittung oder Auftrag bleiben stehen. '
  'Nur fuer die Rolle owner.';

REVOKE ALL ON FUNCTION public.archive_and_purge_company_data(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_and_purge_company_data(UUID, INTEGER) TO authenticated;

COMMIT;
