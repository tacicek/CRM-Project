import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getAppName } from "../_shared/envConfig.ts";
import { logEmail } from "../_shared/logEmail.ts";
import {
  createTranslator,
  formatCurrency,
  formatDateLong,
  toLocale,
} from "../_shared/i18n/index.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";
import { loadCompanySecrets } from "../_shared/companySecrets.ts";
import {
  handleNotifyBesichtigung,
  type CompanyRow,
  type NotifyBesichtigungDeps,
  type OfferRow,
  type RenderContext,
} from "../_shared/notifyBesichtigungGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Diese Datei ist nur noch die Anbindung: sie stellt die echten Mitspieler
 * (Datenbank, Resend, Protokoll) bereit und rendert die beiden Mails. Was
 * geprueft wird und in welcher REIHENFOLGE etwas passieren darf, steht in
 * ../_shared/notifyBesichtigungGuard.ts — dort laesst es sich ausfuehren und
 * testen, hier nicht (Deno-Globals, https-Importe).
 *
 * Der Vertrauensgrenzwechsel in einem Satz: frueher glaubte diese Funktion dem
 * Anfragekoerper, wer die Firma ist und an wen die Mail geht. Jetzt glaubt sie
 * nur dem Offer-Token — und liest alles Weitere aus der Zeile, die dieser Token
 * aufschliesst.
 */
const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[notify-besichtigung] ${step}`, details ? JSON.stringify(details) : "");
};

// ── Renderer ────────────────────────────────────────────────────────────────
// Unveraendert uebernommen, nur die Quellen der Werte sind andere: alles kommt
// jetzt aus `offer` und `company`, nicht mehr aus dem Anfragekoerper.

const renderCompanyEmail = (ctx: RenderContext) => {
  const { offer, company, request, isCompanyEmail, companyLocale } = ctx;
  const tCompany = createTranslator(companyLocale);
  const kundenName = `${offer.customer_first_name} ${offer.customer_last_name}`.trim();

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            👀 Besichtigungsanfrage
          </h1>
        </div>

        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin-top: 0;">Guten Tag,</p>

          <p>Der Kunde <strong>${escapeHtml(kundenName)}</strong> möchte vor der Auftragserteilung eine <strong>Besichtigung</strong> durchführen.</p>

          <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 16px;">📅 Gewünschter Termin</h3>
            <p style="margin: 0; font-size: 18px; font-weight: 600; color: #1e3a8a;">
              ${formatDateLong(request.besichtigungDate, companyLocale)}${request.besichtigungTime ? ` ${tCompany("common.timeAt", { time: request.besichtigungTime })}` : ""}
            </p>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${tCompany("common.offer")}:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${escapeHtml(offer.title)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${tCompany("email.besichtigungRequest.offerAmount")}:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formatCurrency((offer.total ?? 0), companyLocale)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${tCompany("common.customer")}:</td>
                <td style="padding: 8px 0; text-align: right;">${escapeHtml(kundenName)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${tCompany("common.email")}:</td>
                <td style="padding: 8px 0; text-align: right;">
                  <a href="mailto:${encodeURIComponent(offer.customer_email)}" style="color: #3b82f6;">${escapeHtml(offer.customer_email)}</a>
                </td>
              </tr>
              ${offer.customer_phone ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${tCompany("common.phone")}:</td>
                <td style="padding: 8px 0; text-align: right;">
                  <a href="tel:${encodeURIComponent(offer.customer_phone)}" style="color: #3b82f6;">${escapeHtml(offer.customer_phone)}</a>
                </td>
              </tr>
              ` : ""}
            </table>
          </div>

          ${request.customerNote ? `
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">📝 Nachricht des Kunden:</p>
              <p style="margin: 0; color: #78350f;">${escapeHtml(request.customerNote)}</p>
            </div>
          ` : ""}

          <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #15803d;">
              <strong>💡 Empfehlung:</strong> Kontaktieren Sie den Kunden zeitnah, um den Besichtigungstermin zu bestätigen oder einen alternativen Termin vorzuschlagen.
            </p>
          </div>

          <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
            ${tCompany("common.regards")}<br>
            <strong>${escapeHtml(isCompanyEmail ? company.company_name : tCompany("common.teamSignature", { appName: getAppName() }))}</strong>
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
          <p>${tCompany("common.autoSentBy", { sender: escapeHtml(isCompanyEmail ? company.company_name : getAppName()) })}</p>
        </div>
      </body>
    </html>
  `;


  const emailSubject = `👀 Besichtigungsanfrage für "${offer.title}" von ${kundenName}`;
  return { subject: emailSubject, html: emailHtml };
};

const renderCustomerEmail = (ctx: RenderContext) => {
  const { offer, company, request, isCompanyEmail, customerLocale } = ctx;
  const tCustomer = createTranslator(customerLocale);
  const kundenName = `${offer.customer_first_name} ${offer.customer_last_name}`.trim();

  const customerEmailHtml = `
    <!DOCTYPE html>
    <html lang="${customerLocale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            ✅ ${tCustomer("email.besichtigungRequest.headerTitle")}
          </h1>
        </div>

        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin-top: 0;">${tCustomer("common.greeting", { name: escapeHtml(kundenName) })}</p>

          <p>${tCustomer("email.besichtigungRequest.intro")}</p>

          <div style="background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px;">📅 ${tCustomer("email.besichtigungRequest.slotTitle")}</h3>
            <p style="margin: 0; font-size: 18px; font-weight: 600; color: #14532d;">
              ${formatDateLong(request.besichtigungDate, customerLocale)}${request.besichtigungTime ? ` ${tCustomer("common.timeAt", { time: request.besichtigungTime })}` : ""}
            </p>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${tCustomer("common.offer")}:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${escapeHtml(offer.title)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${tCustomer("common.provider")}:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${escapeHtml(company.company_name)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">${tCustomer("email.besichtigungRequest.offerAmount")}:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formatCurrency((offer.total ?? 0), customerLocale)}</td>
              </tr>
            </table>
          </div>

          <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af;">
              <strong>📞 ${tCustomer("email.besichtigungRequest.nextStepsTitle")}</strong><br>
              ${tCustomer("email.besichtigungRequest.nextStepsBody", { companyName: `<strong>${escapeHtml(company.company_name)}</strong>` })}
            </p>
          </div>

          <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
            ${tCustomer("common.regards")}<br>
            <strong>${escapeHtml(isCompanyEmail ? company.company_name : tCustomer("common.teamSignature", { appName: getAppName() }))}</strong>
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
          <p>${tCustomer("common.autoSentBy", { sender: escapeHtml(isCompanyEmail ? company.company_name : getAppName()) })}</p>
        </div>
      </body>
    </html>
  `;

  // Emoji prefix preserved (the catalog values are emoji-free by design).
  const customerEmailSubject = `✅ ${tCustomer("email.besichtigungRequest.subject", {
    companyName: company.company_name,
  })}`;
  return { subject: customerEmailSubject, html: customerEmailHtml };
};

// ── Anbindung ───────────────────────────────────────────────────────────────

const OFFER_SPALTEN =
  "id, company_id, status, superseded_at, valid_until, service_date, language, title, total, " +
  "customer_first_name, customer_last_name, customer_email, customer_phone";

const COMPANY_SPALTEN =
  "id, company_name, email, notification_email, default_language, resend_enabled, " +
  "resend_from_email, resend_from_name";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // Nur POST. Ein GET mit Query-Parametern waere ein Link, den man jemandem
  // schicken kann — und ein Link, der Mail ausloest, ist eine Waffe.
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Der service-role-Client darf entstehen; benutzt wird er erst, nachdem der
    // Token eine Zeile aufgeschlossen hat (siehe Reihenfolge im Guard).
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Ungültige Anfrage." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const deps: NotifyBesichtigungDeps = {
      loadOffer: async (offerId, accessToken) => {
        const { data } = await supabase
          .from("offers")
          .select(OFFER_SPALTEN)
          .eq("id", offerId)
          .eq("access_token", accessToken)
          .maybeSingle();
        return (data as OfferRow | null) ?? null;
      },
      loadCompany: async (companyId) => {
        const { data } = await supabase
          .from("companies")
          .select(COMPANY_SPALTEN)
          .eq("id", companyId)
          .maybeSingle();
        return (data as CompanyRow | null) ?? null;
      },
      countRecentBesichtigungEmails: async (offerId, sinceIso) => {
        const { count, error } = await supabase
          .from("email_logs")
          .select("id", { count: "exact", head: true })
          .eq("email_type", "besichtigung_request")
          .eq("status", "sent")
          .gte("created_at", sinceIso)
          .filter("metadata->>offerId", "eq", offerId);
        return { count: count ?? null, error: error ?? null };
      },
      loadSecrets: (companyId) => loadCompanySecrets(supabase, companyId),
      sendEmail: async ({ to, subject, html, apiKey, from }) => {
        // Schluessel und Absender kommen aus dem Guard, der sie aus der
        // geprueften Firmenzeile aufgeloest hat. Hier wird nichts erraten und
        // nichts zwischengespeichert.
        const { data, error } = await new Resend(apiKey).emails.send({
          from,
          to: [to],
          subject,
          html,
        });
        return { id: data?.id, error: error ?? undefined };
      },
      logEmail: (entry) => logEmail(entry),
      insertNotification: async (entry) => {
        const { error } = await supabase.from("notifications").insert(entry);
        if (error) logStep("Error creating in-app notification", { error: error.message });
      },
      renderCompanyEmail,
      renderCustomerEmail,
      toLocale,
      defaultResendApiKey: () => Deno.env.get("RESEND_API_KEY"),
      defaultFrom: () => getDefaultFrom(),
      now: () => Date.now(),
      log: logStep,
    };


    const ergebnis = await handleNotifyBesichtigung(deps, rawBody);
    return new Response(JSON.stringify(ergebnis.body), {
      status: ergebnis.status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    // Keine Fremdtexte nach aussen: eine Fehlermeldung aus der Tiefe kann
    // Spaltennamen, Ids oder den Token enthalten.
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error in notify-besichtigung", { error: errorMessage });
    return new Response(JSON.stringify({ error: "Interner Fehler." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
