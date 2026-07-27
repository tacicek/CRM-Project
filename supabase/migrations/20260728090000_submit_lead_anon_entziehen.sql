-- =============================================================================
-- submit_lead / submit_lead_json: Ausfuehrungsrecht fuer anon entziehen
-- =============================================================================
--
-- BEFUND
-- Beide Funktionen stammen aus dem Marktplatz-Fork, in dem ein oeffentliches
-- Formular Leads ohne Anmeldung einreichte. In diesem CRM ruft sie NIEMAND mehr
-- auf — weder `src/` noch `supabase/functions/` enthaelt einen Aufruf; die
-- einzigen Treffer sind Kommentare (sendCustomerConfirmation.ts,
-- triggerLeadQualityValidation.ts). Leads entstehen heute ueber drei Wege, die
-- alle serverseitig laufen: inbound-email-lead, import-manual-lead und der
-- Review-Import aus dem Posteingang.
--
-- Die GRANTs aus 20260324160000 stehen aber unveraendert:
--
--     GRANT EXECUTE ON FUNCTION public.submit_lead(...)      TO anon;
--     GRANT EXECUTE ON FUNCTION public.submit_lead_json(...) TO anon;
--
-- `anon` ist der Schluessel, der in jedem Browser liegt. Wer ihn hat — und er
-- steht im ausgelieferten Bundle — kann damit beliebig viele Leads in die
-- Datenbank schreiben. Kein Formular davor, kein reCAPTCHA, keine Ratenbegrenzung.
--
-- ABHILFE
-- Das Recht wird `PUBLIC` und `anon` entzogen. `authenticated` und `service_role`
-- behalten es: fuer sie war der Aufruf noch nie ein Ausbruch aus der eigenen
-- Firma, und ein Entzug wuerde einen kuenftigen Aufrufer ohne Not blockieren.
--
-- Die Funktionen bleiben stehen. Sie zu loeschen waere die groessere Aenderung
-- (Ruecknahme schwerer, Signaturen in types.ts), und ohne Ausfuehrungsrecht sind
-- sie von aussen ohnehin nicht erreichbar.
-- =============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.submit_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DATE, TEXT, TEXT, NUMERIC, INTEGER, JSONB, INTEGER
) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.submit_lead_json(JSONB) FROM PUBLIC, anon;

COMMENT ON FUNCTION public.submit_lead_json(JSONB) IS
  'Altlast aus dem Marktplatz-Fork. KEIN Aufrufer im Repo. Ausfuehrungsrecht fuer '
  'anon 2026-07-28 entzogen — Leads entstehen ausschliesslich serverseitig.';

COMMIT;
