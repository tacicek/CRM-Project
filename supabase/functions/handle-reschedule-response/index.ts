import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getCalendarFrom, getAppName } from "../_shared/envConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Escape user-supplied text before interpolating it into email HTML. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Input validation. Recipient/company identity is NOT trusted from the body — it is
// derived from the appointment row after the reschedule token has been validated.
const RescheduleResponseSchema = z.object({
  appointmentId: z.string().uuid("Ungültige Termin-ID"),
  action: z.enum(["confirm", "reject"], { errorMap: () => ({ message: "Aktion muss 'confirm' oder 'reject' sein" }) }),
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat (YYYY-MM-DD)"),
  proposedTime: z.string().regex(/^\d{2}:\d{2}$/, "Ungültiges Zeitformat (HH:MM)"),
  message: z.string().max(2000, "Nachricht zu lang (max. 2000 Zeichen)").optional(),
  token: z.string().uuid("Ungültiges Token"),
});

const handler = async (req: Request): Promise<Response> => {
  console.log("[handle-reschedule-response] Function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!resendApiKey) {
      console.error("[handle-reschedule-response] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    
    // Validiere Input mit Zod
    const parseResult = RescheduleResponseSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("[handle-reschedule-response] Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = parseResult.data;

    const { appointmentId, action, proposedDate, proposedTime, message, token } = body;

    // Load the appointment via service role. Identity fields (recipient, names, title)
    // come from this row — never from the request body.
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(
        "id, company_id, status, title, customer_email, customer_first_name, customer_last_name, reschedule_token, reschedule_token_expires_at"
      )
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error("[handle-reschedule-response] Appointment not found:", appointmentError);
      return new Response(
        JSON.stringify({ error: "Termin nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the single-use reschedule token: must exist, match, and not be expired.
    const tokenValid =
      !!appointment.reschedule_token &&
      appointment.reschedule_token === token &&
      (!appointment.reschedule_token_expires_at ||
        new Date(appointment.reschedule_token_expires_at).getTime() > Date.now());

    if (!tokenValid) {
      console.warn("[handle-reschedule-response] Invalid/expired token for appointment:", appointmentId);
      return new Response(
        JSON.stringify({ error: "Ungültiger oder abgelaufener Link" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Derive recipient identity from the DB row.
    const customerEmail = appointment.customer_email;
    if (!customerEmail) {
      console.error("[handle-reschedule-response] No customer email on appointment:", appointmentId);
      return new Response(
        JSON.stringify({ error: "Keine Kunden-E-Mail hinterlegt" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const customerName =
      `${appointment.customer_first_name ?? ""} ${appointment.customer_last_name ?? ""}`.trim() || "Kunde";
    const appointmentTitle = appointment.title;

    const { data: company } = await supabase
      .from("companies")
      .select("company_name")
      .eq("id", appointment.company_id)
      .maybeSingle();
    const companyName = company?.company_name ?? getAppName();

    // Escaped variants for interpolation into the email HTML.
    const cName = escapeHtml(customerName);
    const coName = escapeHtml(companyName);
    const aTitle = escapeHtml(appointmentTitle);
    const msg = message ? escapeHtml(message) : "";

    // Format dates for display
    const formatDateDisplay = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString("de-CH", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    };

    if (action === "confirm") {
      // Update the appointment with new date and time
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          appointment_date: proposedDate,
          start_time: proposedTime + ":00",
          status: "confirmed",
          confirmed_by_firma: true,
          confirmed_at: new Date().toISOString(),
          // Single-use: invalidate the token so the link can't be replayed.
          reschedule_token: null,
          reschedule_token_expires_at: null,
        })
        .eq("id", appointmentId);

      if (updateError) {
        console.error("[handle-reschedule-response] Error updating appointment:", updateError);
        throw updateError;
      }

      // Send confirmation email to customer
      const confirmEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8; }
            .header { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981; }
            .date-box { background: #D1FAE5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
            .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
            .value { font-size: 18px; font-weight: 600; color: #059669; }
            .message-box { background: #F3F4F6; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 3px solid #6B7280; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">✅ Termin bestätigt!</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">Ihr neuer Termin wurde akzeptiert</p>
            </div>
            <div class="content">
              <p>Guten Tag ${cName},</p>
              <p>Tolle Neuigkeiten! ${coName} hat Ihren Terminvorschlag akzeptiert.</p>

              <div class="info-box">
                <h2 style="margin: 0 0 15px; color: #1f2937;">${aTitle}</h2>

                <div class="date-box">
                  <div class="label">Ihr neuer Termin</div>
                  <div class="value">${formatDateDisplay(proposedDate)}</div>
                  <div class="value">${proposedTime} Uhr</div>
                </div>
              </div>

              ${msg ? `
              <div class="message-box">
                <div class="label">💬 Nachricht von ${coName}</div>
                <p style="margin: 10px 0 0;">${msg}</p>
              </div>
              ` : ""}

              <p style="margin-top: 25px;">
                Bitte erscheinen Sie pünktlich zum Termin. Bei Fragen können Sie sich jederzeit an ${coName} wenden.
              </p>
              
              <div class="footer">
                <p style="color: #6b7280;">
                  Diese E-Mail wurde automatisch von ${getAppName()} gesendet.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      await resend.emails.send({
        from: getCalendarFrom(),
        to: [customerEmail],
        subject: `✅ Termin bestätigt: ${appointmentTitle}`,
        html: confirmEmailHtml,
      });

      console.log(`[handle-reschedule-response] Sent confirmation to customer: ${customerEmail}`);

    } else {
      // Reject - just update status and notify customer
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "pending",
          // Single-use: invalidate the token so the link can't be replayed.
          reschedule_token: null,
          reschedule_token_expires_at: null,
        })
        .eq("id", appointmentId);

      if (updateError) {
        console.error("[handle-reschedule-response] Error updating appointment:", updateError);
      }

      // Send rejection email to customer
      const rejectEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8; }
            .header { background: linear-gradient(135deg, #F59E0B, #D97706); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B; }
            .message-box { background: #FEF3C7; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 3px solid #F59E0B; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">📅 Terminvorschlag nicht möglich</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">Leider konnte Ihr Vorschlag nicht angenommen werden</p>
            </div>
            <div class="content">
              <p>Guten Tag ${cName},</p>
              <p>Leider kann ${coName} Ihren vorgeschlagenen Termin am ${formatDateDisplay(proposedDate)} um ${proposedTime} Uhr nicht annehmen.</p>

              ${msg ? `
              <div class="message-box">
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">💬 Nachricht von ${coName}</div>
                <p style="margin: 10px 0 0;">${msg}</p>
              </div>
              ` : ""}

              <div class="info-box">
                <h3 style="margin: 0 0 10px; color: #1f2937;">Was können Sie tun?</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>Kontaktieren Sie ${coName} direkt, um einen alternativen Termin zu finden</li>
                  <li>Der ursprüngliche Termin bleibt vorerst bestehen</li>
                </ul>
              </div>
              
              <div class="footer">
                <p style="color: #6b7280;">
                  Diese E-Mail wurde automatisch von ${getAppName()} gesendet.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      await resend.emails.send({
        from: getCalendarFrom(),
        to: [customerEmail],
        subject: `📅 Terminvorschlag nicht möglich: ${appointmentTitle}`,
        html: rejectEmailHtml,
      });

      console.log(`[handle-reschedule-response] Sent rejection to customer: ${customerEmail}`);
    }

    // Log the email
    await supabase.from("email_logs").insert({
      email_type: action === "confirm" ? "reschedule_confirmed" : "reschedule_rejected",
      recipient_email: customerEmail,
      recipient_name: customerName,
      subject: action === "confirm" 
        ? `Termin bestätigt: ${appointmentTitle}` 
        : `Terminvorschlag nicht möglich: ${appointmentTitle}`,
      status: "sent",
      metadata: {
        appointment_id: appointmentId,
        action,
        proposed_date: proposedDate,
        proposed_time: proposedTime,
      },
    });

    return new Response(
      JSON.stringify({ success: true, action }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[handle-reschedule-response] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
