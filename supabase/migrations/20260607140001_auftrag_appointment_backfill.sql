-- =============================================================================
-- #7 — Backfill: mevcut auftrag ↔ appointment bağlarını kur ve uzlaştır
--
-- 1. offer_id üzerinden eşleştir (service appointment)
-- 2. Tarih/saat uzlaştır: appointment KAZANIR (kanonik zaman sahibi)
-- 3. Eşi olmayan (manuel veya appointment'sız) aktif auftrag için service
--    appointment üret ve linkle (PL/pgSQL döngüsü ile güvenli geri-link)
-- =============================================================================

-- ── 1. offer_id ile eşleştirme ──────────────────────────────────────────────
WITH ranked AS (
  SELECT
    a.id AS auftrag_id,
    (
      SELECT ap.id
      FROM public.appointments ap
      WHERE ap.offer_id = a.offer_id
        AND ap.appointment_type = 'service'
      ORDER BY ap.created_at ASC
      LIMIT 1
    ) AS appt_id
  FROM public.auftraege a
  WHERE a.offer_id IS NOT NULL
    AND a.appointment_id IS NULL
    AND a.deleted_at IS NULL
)
UPDATE public.auftraege a
SET appointment_id = ranked.appt_id
FROM ranked
WHERE a.id = ranked.auftrag_id
  AND ranked.appt_id IS NOT NULL;

-- ── 2. Tarih/saat uzlaştır: appointment kazanır ─────────────────────────────
UPDATE public.auftraege a
SET
  scheduled_date             = ap.appointment_date,
  scheduled_time             = ap.start_time,
  estimated_duration_minutes = COALESCE(ap.duration_minutes, a.estimated_duration_minutes)
FROM public.appointments ap
WHERE a.appointment_id = ap.id
  AND a.deleted_at IS NULL
  AND (
    a.scheduled_date IS DISTINCT FROM ap.appointment_date
    OR a.scheduled_time IS DISTINCT FROM ap.start_time
  );

-- ── 3. Eşi olmayan aktif auftraglar için appointment üret + geri linkle ─────
DO $$
DECLARE
  r RECORD;
  v_start TIME;
  v_appt_id UUID;
BEGIN
  FOR r IN
    SELECT a.id, a.company_id, a.offer_id, a.lead_id,
           a.title, a.customer_name, a.customer_email, a.customer_phone,
           a.from_address, a.scheduled_date, a.scheduled_time,
           a.estimated_duration_minutes, a.description, a.internal_notes,
           a.status
    FROM public.auftraege a
    WHERE a.appointment_id IS NULL
      AND a.deleted_at IS NULL
  LOOP
    v_start := COALESCE(r.scheduled_time, '09:00:00'::time);

    INSERT INTO public.appointments (
      company_id, lead_id, offer_id,
      appointment_type, status,
      appointment_date, start_time, end_time, duration_minutes, all_day,
      location_address,
      customer_first_name, customer_last_name, customer_email, customer_phone,
      title, description, internal_notes
    )
    VALUES (
      r.company_id, r.lead_id, r.offer_id,
      'service'::public.appointment_type,
      public.map_auftrag_to_appointment_status(r.status::text),
      r.scheduled_date,
      v_start,
      (v_start + (COALESCE(r.estimated_duration_minutes, 120) || ' minutes')::interval)::time,
      COALESCE(r.estimated_duration_minutes, 120),
      false,
      r.from_address,
      split_part(r.customer_name, ' ', 1),
      NULLIF(regexp_replace(r.customer_name, '^\S+\s*', ''), ''),
      r.customer_email, r.customer_phone,
      COALESCE(NULLIF(TRIM(r.title), ''), 'Auftrag'),
      r.description, r.internal_notes
    )
    RETURNING id INTO v_appt_id;

    UPDATE public.auftraege SET appointment_id = v_appt_id WHERE id = r.id;
  END LOOP;
END $$;
