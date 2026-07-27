-- =============================================================================
-- Zugangsdaten aus `companies` entfernen  (Schritt 2 von 2)
-- =============================================================================
--
-- Schritt 1 (20260727150000) hat die Werte nach `company_secrets` kopiert und
-- alle 13 Edge Functions dorthin umgehängt. Die Spalten blieben absichtlich
-- stehen, bis ein echter Mailversand über den neuen Lesepfad bestätigt war —
-- das System ist produktiv im Einsatz, und die umgekehrte Reihenfolge hätte
-- jeden Kundenversand gestoppt.
--
-- Bestätigt: Test-Mail über `test-resend-email` ist beim Empfänger angekommen,
-- nachdem die Funktion ihren Schlüssel aus `company_secrets` liest.
--
-- Erst dieser Schritt schliesst das Leck. Vorher lieferte jedes `select("*")`
-- auf `companies` die Schlüssel weiterhin über die Leitung — auch wenn keine
-- Zeile Anwendungscode sie mehr las, hätte jedes Mitglied sie mit den
-- Entwicklerwerkzeugen abrufen können.
--
-- Nebenwirkung, die hier gewollt ist: die beiden verbliebenen `select("*")` auf
-- companies (OfferteDetail, buildOfferEmailAttachments) hören damit von selbst
-- auf, Geheimnisse zu übertragen. Sie beliefern PDF-Vorlagen; eine von Hand
-- gepflegte Spaltenliste hätte dort beim kleinsten Vergessen ein Feld im PDF
-- leer gelassen.
-- =============================================================================

BEGIN;

-- Sicherheitsnetz: nur weiterfahren, wenn wirklich jeder gesetzte Schlüssel
-- drüben angekommen ist. Ohne diese Prüfung würde ein unvollständiger Umzug
-- unbemerkt Zugangsdaten vernichten.
DO $$
DECLARE
  v_fehlend INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_fehlend
  FROM public.companies c
  LEFT JOIN public.company_secrets s ON s.company_id = c.id
  WHERE (NULLIF(TRIM(c.resend_api_key), '')     IS NOT NULL AND s.resend_api_key     IS NULL)
     OR (NULLIF(TRIM(c.twilio_account_sid), '') IS NOT NULL AND s.twilio_account_sid IS NULL)
     OR (NULLIF(TRIM(c.twilio_auth_token), '')  IS NOT NULL AND s.twilio_auth_token  IS NULL);

  IF v_fehlend > 0 THEN
    RAISE EXCEPTION 'Abbruch: % Firma(en) haben Zugangsdaten, die nicht in company_secrets stehen', v_fehlend;
  END IF;
END;
$$;

ALTER TABLE public.companies
  DROP COLUMN IF EXISTS resend_api_key,
  DROP COLUMN IF EXISTS twilio_account_sid,
  DROP COLUMN IF EXISTS twilio_auth_token;

COMMIT;
