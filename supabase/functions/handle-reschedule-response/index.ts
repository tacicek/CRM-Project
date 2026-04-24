import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod Schema für Input-Validierung
const RescheduleResponseSchema = z.object({
  appointmentId: z.string().uuid("Ungültige Termin-ID"),
  action: z.enum(["confirm", "reject"], { errorMap: () => ({ message: "Aktion muss 'confirm' oder 'reject' sein" }) }),
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat (YYYY-MM-DD)"),
  proposedTime: z.string().regex(/^\d{2}:\d{2}$/, "Ungültiges Zeitformat (HH:MM)"),
  message: z.string().max(2000, "Nachricht zu lang (max. 2000 Zeichen)").optional(),
  customerEmail: z.string().email("Ungültige E-Mail-Adresse").max(255),
  customerName: z.string().min(1, "Name erforderlich").max(200),
  companyName: z.string().min(1, "Firmenname erforderlich").max(200),
  appointmentTitle: z.string().min(1, "Titel erforderlich").max(200),
});

type RescheduleResponseRequest = z.infer<typeof RescheduleResponseSchema>;

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
    console.log("[handle-reschedule-response] Request body:", body);

    const {
      appointmentId,
      action,
      proposedDate,
      proposedTime,
      message,
      customerEmail,
      customerName,
      companyName,
      appointmentTitle,
    } = body;

    // Prüfe, ob der Termin existiert
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, company_id, status")
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error("[handle-reschedule-response] Appointment not found:", appointmentError);
      return new Response(
        JSON.stringify({ error: "Termin nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
              <p>Guten Tag ${customerName},</p>
              <p>Tolle Neuigkeiten! ${companyName} hat Ihren Terminvorschlag akzeptiert.</p>
              
              <div class="info-box">
                <h2 style="margin: 0 0 15px; color: #1f2937;">${appointmentTitle}</h2>
                
                <div class="date-box">
                  <div class="label">Ihr neuer Termin</div>
                  <div class="value">${formatDateDisplay(proposedDate)}</div>
                  <div class="value">${proposedTime} Uhr</div>
                </div>
              </div>
              
              ${message ? `
              <div class="message-box">
                <div class="label">💬 Nachricht von ${companyName}</div>
                <p style="margin: 10px 0 0;">${message}</p>
              </div>
              ` : ""}
              
              <p style="margin-top: 25px;">
                Bitte erscheinen Sie pünktlich zum Termin. Bei Fragen können Sie sich jederzeit an ${companyName} wenden.
              </p>
              
              <div class="footer">
                <p style="color: #6b7280;">
                  Diese E-Mail wurde automatisch von Offerio gesendet.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      await resend.emails.send({
        from: "Offerio <termine@offerio.ch>",
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
              <p>Guten Tag ${customerName},</p>
              <p>Leider kann ${companyName} Ihren vorgeschlagenen Termin am ${formatDateDisplay(proposedDate)} um ${proposedTime} Uhr nicht annehmen.</p>
              
              ${message ? `
              <div class="message-box">
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">💬 Nachricht von ${companyName}</div>
                <p style="margin: 10px 0 0;">${message}</p>
              </div>
              ` : ""}
              
              <div class="info-box">
                <h3 style="margin: 0 0 10px; color: #1f2937;">Was können Sie tun?</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>Kontaktieren Sie ${companyName} direkt, um einen alternativen Termin zu finden</li>
                  <li>Der ursprüngliche Termin bleibt vorerst bestehen</li>
                </ul>
              </div>
              
              <div class="footer">
                <p style="color: #6b7280;">
                  Diese E-Mail wurde automatisch von Offerio gesendet.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      await resend.emails.send({
        from: "Offerio <termine@offerio.ch>",
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
