-- =============================================================================
-- ROLLBACK für 20260802120000_super_admin_entzug.sql
-- NICHT als Migration ausführen.
-- =============================================================================
--
-- ⚠️ Dieser Rückbau stellt die mandantenübergreifende Sicht wieder her. Das
--    Konto, das die Rolle zurückbekommt, sieht danach erneut Kunden, Offerten,
--    Aufträge, Termine und eingehende E-Mails der ANDEREN Firma. Das ist kein
--    Nebeneffekt, sondern der ganze Inhalt dieser Zeile.
--
--    Nur ausführen, wenn sich zeigt, dass irgendetwas die Rolle doch braucht —
--    und dann bitte notieren, was genau, damit der zweite Anlauf sie gezielt
--    ersetzen kann statt sie pauschal zurückzuholen.
--
-- Wiederhergestellt wird die ursprüngliche Zeile mit derselben `id` und
-- demselben `created_at`, nicht eine neue: Fremdschlüssel und Verlaufsangaben
-- bleiben damit stimmig.
--
-- `ON CONFLICT DO NOTHING` deckt beide Schlüssel ab — Primärschlüssel `id` und
-- den zusammengesetzten `(user_id, role)`. Wurde die Rolle inzwischen von Hand
-- neu vergeben, bleibt die bestehende Zeile unangetastet.
--
-- Dieses Skript läuft als `postgres` und ist deshalb von der Policy
-- `Super admin can insert roles` nicht betroffen — über die Anwendung wäre der
-- Rückbau nach dem Entzug nicht mehr möglich.
--
-- Fehlt die Tabelle (Rückbau bereits gelaufen), übergeht der Block das INSERT.
-- Ohne diese Prüfung bräche ein zweiter Lauf mit "relation does not exist" ab.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.undo_20260802120000') IS NULL THEN
    RAISE NOTICE 'undo_20260802120000 fehlt — es gibt nichts zurückzugeben.';
    RETURN;
  END IF;

  INSERT INTO public.user_roles (id, user_id, role, created_at)
  SELECT id, user_id, role, created_at
  FROM public.undo_20260802120000
  ON CONFLICT DO NOTHING;
END $$;

DROP TABLE IF EXISTS public.undo_20260802120000;

COMMIT;
