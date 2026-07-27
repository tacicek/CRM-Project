-- =============================================================================
-- ROLLBACK für 20260728090000_submit_lead_anon_entziehen.sql
--
-- NICHT als reguläre Migration ausführen.
--
-- ⚠️ Danach kann wieder jeder, der den oeffentlichen anon-Schluessel besitzt —
--    er steht im ausgelieferten Browser-Bundle — beliebig viele Leads anlegen.
--    Ohne Formular, ohne reCAPTCHA, ohne Ratenbegrenzung.
--
--    Nur ausfuehren, wenn tatsaechlich wieder ein oeffentliches Anfrageformular
--    gebaut wird. Dann aber besser gleich richtig: ein Edge Function davor, die
--    reCAPTCHA prueft und mit dem Service-Role-Key schreibt (Muster:
--    supabase/functions/import-manual-lead).
-- =============================================================================

BEGIN;

GRANT EXECUTE ON FUNCTION public.submit_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DATE, TEXT, TEXT, NUMERIC, INTEGER, JSONB, INTEGER
) TO anon;

GRANT EXECUTE ON FUNCTION public.submit_lead_json(JSONB) TO anon;

COMMIT;
