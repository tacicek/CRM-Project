/**
 * Zugangsdaten Dritter lesen und schreiben — ohne sie je auszuliefern.
 *
 * Die Einstellungsseite holte die Firmenzeile bisher mit `select("*")` und die
 * KI-Schlüssel mit `select("key_value")`. Beides brachte die Klartext-Schlüssel
 * in den Browser, wo sie in der React-State, im Netzwerk-Tab und in jedem
 * HAR-Mitschnitt landen. Ein Passwortfeld ändert daran nichts: der Wert steht
 * trotzdem im DOM.
 *
 * Diese Funktion ist der Ersatz. Sie gibt NIE einen Schlüssel zurück, sondern
 * nur "ist gesetzt" und die letzten vier Zeichen — genug, damit ein Mensch
 * erkennt, welcher Schlüssel hinterlegt ist, zu wenig, um ihn zu benutzen.
 *
 * Zwei Quellen, ein Endpunkt:
 *   • company_secrets — Resend, Twilio (RLS aktiv, keine Policy: nur hierüber)
 *   • api_keys        — KI-Anbieter, wie bisher
 *
 * Zugriff: angemeldetes Mitglied der Firma MIT Rolle owner oder admin.
 * Zugangsdaten sind Firmeneinstellungen; ein `member` hat dort nichts zu suchen.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCompanyRole } from "../_shared/verifyCompanyMembership.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = createLogger("company-secrets");

/** Schlüssel, die in `company_secrets` liegen. */
const SECRET_COLUMNS = ["resend_api_key", "twilio_account_sid", "twilio_auth_token"] as const;

/** Schlüssel, die in `api_keys` liegen (Name = key_name). */
const API_KEY_NAMES = [
  "anthropic_api_key",
  "openai_api_key",
  "gemini_api_key",
  // Das Secret, mit dem Resend seine Webhook-Aufrufe signiert. Es liegt aus
  // demselben Grund hier wie die uebrigen: der Edge-Container bekommt seine
  // Variablen aus einer festen Liste im Compose-File, ein Schalter dort waere
  // im Ernstfall nicht umzulegen.
  "inbound_webhook_secret",
] as const;

type SecretColumn = (typeof SECRET_COLUMNS)[number];
type ApiKeyName = (typeof API_KEY_NAMES)[number];

interface KeyStatus {
  configured: boolean;
  /** Letzte vier Zeichen — zur Wiedererkennung, nicht zur Verwendung. */
  last4: string | null;
}

const statusOf = (value: string | null | undefined): KeyStatus => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { configured: false, last4: null };
  return { configured: true, last4: trimmed.slice(-4) };
};

const json = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Aufrufer feststellen
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);

    const token = authHeader.replace(/^bearer /i, "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Invalid or expired token" }, 401);

    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const companyId = typeof body.company_id === "string"
      ? body.company_id
      : new URL(req.url).searchParams.get("company_id") ?? "";

    if (!companyId) return json({ error: "company_id fehlt" }, 400);

    // ── Zugangsdaten sind Firmeneinstellungen: owner|admin
    const allowed = await verifyCompanyRole(supabase, user.id, companyId, ["owner", "admin"]);
    if (!allowed) {
      log.warn("Denied", { userId: user.id, companyId });
      return json({ error: "Keine Berechtigung für diese Firma" }, 403);
    }

    const action = typeof body.action === "string" ? body.action : "status";

    // -------------------------------------------------------------------------
    // Status — die einzige Leseform. Kein Schlüssel verlässt den Server.
    // -------------------------------------------------------------------------
    if (req.method === "GET" || action === "status") {
      const [secretsRes, apiKeysRes] = await Promise.all([
        supabase
          .from("company_secrets")
          .select(SECRET_COLUMNS.join(", "))
          .eq("company_id", companyId)
          .maybeSingle(),
        supabase
          .from("api_keys")
          .select("key_name, key_value")
          .eq("company_id", companyId),
      ]);

      const secrets = (secretsRes.data ?? {}) as Partial<Record<SecretColumn, string>>;
      const status: Record<string, KeyStatus> = {};
      for (const column of SECRET_COLUMNS) status[column] = statusOf(secrets[column]);

      const rows = (apiKeysRes.data ?? []) as { key_name: string; key_value: string }[];
      for (const name of API_KEY_NAMES) {
        status[name] = statusOf(rows.find((r) => r.key_name === name)?.key_value);
      }

      // Kein Geheimnis, sondern eine Einstellung — der Wert darf raus.
      const provider = rows.find((r) => r.key_name === "ai_provider")?.key_value ?? "anthropic";

      // Ebenso die Empfangsadresse des E-Mail-Eingangs: sie ordnet eingehende
      // Mails der Firma zu und steht ohnehin in jeder Signatur. Ein Geheimnis
      // ist sie nicht — und ohne sie kann niemand nachsehen, welche Adresse
      // ueberhaupt angeschlossen ist.
      const alias = rows.find((r) => r.key_name === "inbound_email_alias")?.key_value ?? null;

      return json({ status, ai_provider: provider, inbound_email_alias: alias });
    }

    // -------------------------------------------------------------------------
    // Setzen / Löschen
    //
    // Ein fehlendes Feld heisst "unverändert", `null` heisst "löschen". Sonst
    // müsste die Oberfläche den alten Wert kennen, um ihn mitzuschicken — genau
    // das soll sie ja nicht mehr.
    // -------------------------------------------------------------------------
    if (action === "set") {
      const updates = (body.values ?? {}) as Record<string, string | null>;
      const secretPatch: Record<string, string | null> = {};
      let touched = 0;

      for (const column of SECRET_COLUMNS) {
        if (!(column in updates)) continue;
        const raw = updates[column];
        secretPatch[column] = raw === null ? null : String(raw).trim() || null;
        touched++;
      }

      if (touched > 0) {
        const { error } = await supabase
          .from("company_secrets")
          .upsert({ company_id: companyId, ...secretPatch }, { onConflict: "company_id" });
        if (error) {
          log.error("Secret upsert failed", { message: error.message });
          return json({ error: "Speichern fehlgeschlagen" }, 500);
        }
      }

      for (const name of API_KEY_NAMES) {
        if (!(name in updates)) continue;
        const raw = updates[name];
        const value = raw === null ? null : String(raw).trim() || null;

        if (value === null) {
          await supabase.from("api_keys").delete()
            .eq("company_id", companyId).eq("key_name", name);
        } else {
          await supabase.from("api_keys")
            .upsert({ company_id: companyId, key_name: name, key_value: value },
                    { onConflict: "company_id,key_name" });
        }
        touched++;
      }

      // ai_provider ist eine Einstellung, kein Schlüssel — gleiche Ablage, damit
      // die Oberfläche nur einen Endpunkt braucht.
      if (typeof updates.ai_provider === "string") {
        await supabase.from("api_keys")
          .upsert({ company_id: companyId, key_name: "ai_provider", key_value: updates.ai_provider },
                  { onConflict: "company_id,key_name" });
        touched++;
      }

      log.logStep("Secrets updated", { companyId, fields: touched });
      return json({ success: true, updated: touched });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (error) {
    log.error("Unexpected error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "Internal error" }, 500);
  }
});
