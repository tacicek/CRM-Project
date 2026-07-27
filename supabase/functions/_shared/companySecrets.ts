/**
 * Zugangsdaten Dritter (Resend, Twilio) je Firma.
 *
 * Sie standen früher als Spalten in `companies`. Die Einstellungsseite holt die
 * Firmenzeile mit `select("*")`, wodurch die Schlüssel im Browser landeten —
 * RLS konnte das nicht verhindern, weil sie auf Zeilen wirkt und nicht auf
 * Spalten. Jetzt liegen sie in `company_secrets`: RLS aktiv, keine einzige
 * Policy, also für `authenticated` grundsätzlich leer. Nur der Service-Role-Key
 * der Edge Functions kommt daran.
 *
 * ABSICHTLICH snake_case: die aufrufenden Funktionen lesen die Werte an vielen
 * Stellen als `company.resend_api_key`. Das Ergebnis lässt sich so unverändert
 * über die Firmenzeile legen —
 *
 *     const company = { ...row, ...(await loadCompanySecrets(supabase, row.id)) };
 *
 * — und keine einzige Verwendungsstelle muss angefasst werden. Weniger
 * Umschreibungen heisst weniger Gelegenheiten, eine zu übersehen.
 */

// deno-lint-ignore-file no-explicit-any -- der Supabase-Client ist hier bewusst
// nur strukturell typisiert; ein Import des generierten Modells existiert
// edge-seitig nicht.

export interface CompanySecrets {
  resend_api_key: string | null;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
}

const EMPTY: CompanySecrets = {
  resend_api_key: null,
  twilio_account_sid: null,
  twilio_auth_token: null,
};

interface SecretsReader {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: Partial<CompanySecrets> | null; error: unknown }>;
      };
    };
  };
}

/**
 * Liest die Zugangsdaten einer Firma. Fehlt die Zeile, kommen lauter `null`
 * zurück — "nicht konfiguriert" ist ein gültiger Zustand, kein Fehler. Die
 * aufrufenden Funktionen prüfen ohnehin auf `resend_enabled` und einen
 * vorhandenen Schlüssel, bevor sie versenden.
 */
export const loadCompanySecrets = async (
  supabase: SecretsReader,
  companyId: string | null | undefined,
): Promise<CompanySecrets> => {
  if (!companyId) return { ...EMPTY };

  const { data, error } = await supabase
    .from("company_secrets")
    .select("resend_api_key, twilio_account_sid, twilio_auth_token")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) return { ...EMPTY };

  return {
    resend_api_key: data.resend_api_key ?? null,
    twilio_account_sid: data.twilio_account_sid ?? null,
    twilio_auth_token: data.twilio_auth_token ?? null,
  };
};
