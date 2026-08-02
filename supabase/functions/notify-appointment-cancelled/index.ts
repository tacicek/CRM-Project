import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getAppName, getCalendarFrom } from "../_shared/envConfig.ts";
import { toLocale } from "../_shared/i18n/index.ts";
import { loadCompanySecrets } from "../_shared/companySecrets.ts";
import {
  handleAppointmentCancellation,
  type AppointmentCancellationDeps,
  type AppointmentRow,
  type CancelResultRow,
  type CompanyRow,
  type EmailLogEntry,
} from "../_shared/appointmentCancellationGuard.ts";
import {
  renderCompanyCancellationEmail,
  renderCustomerCancellationEmail,
} from "../_shared/appointmentCancellationEmails.ts";

/**
 * Oeffentlicher Absage-Endpunkt.
 *
 * Diese Datei ist nur die Anbindung: sie stellt die echten Mitspieler bereit
 * (Datenbank, Resend, Protokoll) und reicht den rohen Koerper weiter. Was
 * geprueft wird und in welcher Reihenfolge etwas passieren darf, steht in
 * ../_shared/appointmentCancellationGuard.ts — dort laesst es sich ausfuehren
 * und testen, hier nicht (Deno-Globals, `https://`-Importe).
 *
 * Der Endpunkt braucht bewusst kein JWT: die Berechtigung IST das
 * Capability-Token aus dem Kundenlink. Geaendert wird trotzdem nichts direkt —
 * der Zustandsuebergang laeuft ausschliesslich ueber die service-role-RPC
 * `cancel_appointment_by_action_token`, die Token, Frist, Status und den
 * geplanten Beginn unter einer Zeilensperre prueft.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[notify-appointment-cancelled] ${step}`, details ? JSON.stringify(details) : "");
};

// deno-lint-ignore no-explicit-any -- der Supabase-Client ist edge-seitig nur
// strukturell verfuegbar; das generierte Modell existiert hier nicht.
type Client = any;

/**
 * Eigener, stiller Protokoll-Schreiber.
 *
 * `_shared/logEmail.ts` schreibt bei jedem Eintrag die EMPFAENGERADRESSE auf
 * die Konsole. Fuer einen oeffentlichen Endpunkt ist das eine Adresse pro
 * Aufruf im Log — deshalb hier eine eigene, wortkarge Fassung. `logEmail.ts`
 * bleibt unangetastet; es hat andere Aufrufer, und die gehoeren nicht in diese
 * Phase.
 */
const logEmailQuiet = (supabase: Client) => async (entry: EmailLogEntry): Promise<void> => {
  const { error } = await supabase.from("email_logs").insert({
    recipient_email: entry.recipientEmail,
    recipient_name: entry.recipientName ?? null,
    subject: entry.subject,
    email_type: entry.emailType,
    status: entry.status,
    error_message: entry.errorMessage ?? null,
    metadata: entry.metadata ?? {},
    company_id: entry.companyId ?? null,
    language: entry.language ?? null,
  });
  if (error) logStep("Could not write the email log", { emailType: entry.emailType });
};

const handler = async (req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const deps: AppointmentCancellationDeps = {
    cancelByToken: async ({ appointmentId, token, reason }) => {
      const { data, error } = await supabase.rpc("cancel_appointment_by_action_token", {
        p_appointment_id: appointmentId,
        p_token: token,
        p_reason: reason,
      });
      return { rows: (data as CancelResultRow[] | null) ?? null, error };
    },
    loadAppointment: async (appointmentId) => {
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, company_id, title, appointment_date, start_time, customer_first_name, customer_last_name, customer_email, language",
        )
        .eq("id", appointmentId)
        .maybeSingle();
      return (data as AppointmentRow | null) ?? null;
    },
    loadCompany: async (companyId) => {
      const { data } = await supabase
        .from("companies")
        .select(
          "id, company_name, email, notification_email, default_language, resend_enabled, resend_from_email, resend_from_name",
        )
        .eq("id", companyId)
        .maybeSingle();
      return (data as CompanyRow | null) ?? null;
    },
    loadSecrets: (companyId) => loadCompanySecrets(supabase, companyId),
    sendEmail: async ({ to, subject, html, apiKey, from }) => {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({ from, to: [to], subject, html });
      return { id: data?.id, error };
    },
    logEmail: logEmailQuiet(supabase),
    insertNotification: async (entry) => {
      const { error } = await supabase.from("notifications").insert(entry);
      if (error) logStep("Error creating in-app notification", { message: error.message });
    },
    renderCompanyEmail: renderCompanyCancellationEmail,
    renderCustomerEmail: renderCustomerCancellationEmail,
    toLocale,
    defaultResendApiKey: () => Deno.env.get("RESEND_API_KEY"),
    defaultFrom: () => getCalendarFrom(),
    appName: () => getAppName(),
    log: logStep,
  };

  // Die bequemen Sammel-Leser des Request-Objekts kommen hier bewusst nicht vor
  // (weder der fuer Text noch der fuer JSON): beide ziehen den GANZEN Koerper in
  // den Speicher, bevor irgendjemand ihn ablehnen kann. Uebergeben wird der
  // Datenstrom, und der Guard entscheidet erst nach der Methodenpruefung, ob
  // ueberhaupt ein Byte gelesen wird — und hoert nach 8 KiB auf.
  // (Diese Zeilen nennen die Aufrufe absichtlich nicht woertlich: ein Test
  // durchsucht die Datei danach, und ein Kommentar waere ein Fehlalarm.)
  const ergebnis = await handleAppointmentCancellation(deps, {
    method: req.method,
    contentLength: req.headers.get("content-length"),
    body: req.body,
  });

  if (ergebnis.body === null) {
    return new Response(null, { status: ergebnis.status, headers: { ...corsHeaders, ...ergebnis.headers } });
  }
  return new Response(JSON.stringify(ergebnis.body), {
    status: ergebnis.status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...ergebnis.headers },
  });
};

serve(handler);
