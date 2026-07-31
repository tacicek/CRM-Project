-- =============================================================================
-- ROLLBACK für 20260802110000_email_logs_sicht_und_zuordnung.sql
-- NICHT als Migration ausführen.
-- =============================================================================
--
-- ⚠️ Was dieser Rückbau wiederherstellt, ist ein nachweislich kaputter Zustand:
--
--    - Ohne `email_logs_select_member` sieht die zweite Firma wieder 0 ihrer
--      eigenen E-Mail-Zeilen. Der Versandstatus in Offerten.tsx und der
--      E-Mail-Verlauf in OfferteDetail.tsx bleiben für sie leer.
--
--    - Die sechs Quittungs-Mails verlieren ihre Firma erneut und sind damit
--      für JEDES Konto unsichtbar, sobald die `super_admin`-Zeile fällt.
--
--    - Lead ANF-2026-712782 ist wieder herrenlos.
--
--    Vorher sichern, falls der Vorzustand belegt werden soll:
--      \copy (SELECT * FROM public.undo_20260802110000) TO 'undo.csv' CSV HEADER
--
-- REIHENFOLGE. Wurde die `super_admin`-Zeile inzwischen entfernt, macht dieser
-- Rückbau das E-Mail-Protokoll für alle Konten unlesbar. Dann zuerst die Rolle
-- zurückholen — oder den Rückbau lassen.
--
-- Die Zuordnungen werden aus `undo_20260802110000` zurückgenommen, nicht erneut
-- hergeleitet: nach einem weiteren Quittungsversand träfe eine Herleitung auch
-- Zeilen, die diese Migration nie angefasst hat.
--
-- Fehlt die Tabelle (Rückbau bereits gelaufen), übergeht der Block die beiden
-- UPDATEs. Ohne diese Prüfung bräche ein zweiter Lauf mit "relation does not
-- exist" ab — das Skript ist so oft ausführbar wie nötig.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS email_logs_select_member ON public.email_logs;

DO $$
BEGIN
  IF to_regclass('public.undo_20260802110000') IS NULL THEN
    RAISE NOTICE 'undo_20260802110000 fehlt — Zuordnungen bleiben, wie sie sind.';
    RETURN;
  END IF;

  UPDATE public.email_logs AS e
  SET company_id = u.old_company_id
  FROM public.undo_20260802110000 AS u
  WHERE u.table_name = 'email_logs'
    AND u.row_id     = e.id;

  UPDATE public.leads AS l
  SET company_id = u.old_company_id
  FROM public.undo_20260802110000 AS u
  WHERE u.table_name = 'leads'
    AND u.row_id     = l.id;
END $$;

DROP TABLE IF EXISTS public.undo_20260802110000;

COMMIT;
