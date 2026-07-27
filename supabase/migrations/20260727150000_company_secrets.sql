-- =============================================================================
-- Zugangsdaten Dritter aus `companies` herauslösen  (Schritt 1 von 2)
-- =============================================================================
--
-- BEFUND
-- `companies` trägt `resend_api_key`, `twilio_account_sid` und
-- `twilio_auth_token` im Klartext. Die Einstellungsseite holt die Zeile mit
-- `select("*")` — die Schlüssel liegen damit im Browser, in der React-State, im
-- Netzwerk-Tab und in jedem HAR-Mitschnitt. RLS hilft hier nicht: sie wirkt auf
-- ZEILEN, nicht auf Spalten, und `companies_select_member` gibt jedem Mitglied
-- die ganze Zeile.
--
-- WARUM EINE EIGENE TABELLE UND KEIN SPALTEN-REVOKE
-- Ein `REVOKE SELECT (resend_api_key) FROM authenticated` wäre der kürzere Weg,
-- ist hier aber nicht haltbar: das Repo enthält ein pauschales
-- `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated`
-- (supabase-test/baseline/grants.sql). Ein einziger erneuter Lauf davon würde
-- die Spalte lautlos wieder öffnen. Eine Tabelle mit aktivierter RLS und KEINER
-- Policy übersteht dagegen jedes pauschale GRANT: ohne Policy liefert die
-- Zeilenprüfung nichts, egal welche Rechte vergeben sind. Der Service-Role-Key
-- der Edge Functions umgeht RLS ohnehin.
--
-- ZWEI SCHRITTE, DAMIT NICHTS AUSFÄLLT
-- Hier wird nur kopiert; die Spalten in `companies` bleiben zunächst bestehen.
-- Erst wenn alle Edge Functions aus der neuen Tabelle lesen (eigener Commit),
-- entfernt Schritt 2 sie. Andersherum stünde der E-Mail-Versand still.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.company_secrets (
  company_id         UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  resend_api_key     TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS an, KEINE Policy: für `authenticated` und `anon` ist die Tabelle damit
-- leer — unabhängig davon, welche GRANTs jemals vergeben werden.
ALTER TABLE public.company_secrets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.company_secrets IS
  'Zugangsdaten Dritter (Resend, Twilio) je Firma. Bewusst ohne RLS-Policy: '
  'nur serverseitiger Zugriff ueber den Service-Role-Key. Niemals an den Browser.';

DROP TRIGGER IF EXISTS trigger_company_secrets_updated_at ON public.company_secrets;
CREATE TRIGGER trigger_company_secrets_updated_at
  BEFORE UPDATE ON public.company_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Bestand übernehmen. Leere Zeichenketten werden dabei zu NULL — "nicht
-- konfiguriert" soll genau einen Wert haben, nicht zwei.
INSERT INTO public.company_secrets (company_id, resend_api_key, twilio_account_sid, twilio_auth_token)
SELECT
  id,
  NULLIF(TRIM(resend_api_key), ''),
  NULLIF(TRIM(twilio_account_sid), ''),
  NULLIF(TRIM(twilio_auth_token), '')
FROM public.companies
ON CONFLICT (company_id) DO UPDATE SET
  resend_api_key     = EXCLUDED.resend_api_key,
  twilio_account_sid = EXCLUDED.twilio_account_sid,
  twilio_auth_token  = EXCLUDED.twilio_auth_token,
  updated_at         = NOW();

COMMIT;
