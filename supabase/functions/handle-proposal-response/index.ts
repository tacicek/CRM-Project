import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getDefaultFrom, getAppName } from "../_shared/envConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod Schema für Input-Validierung
const ProposalResponseSchema = z.object({
  leadId: z.string().uuid("Ungültige Lead-ID"),
  companyId: z.string().uuid("Ungültige Firmen-ID"),
  action: z.enum(["accept", "reject"], { errorMap: () => ({ message: "Aktion muss 'accept' oder 'reject' sein" }) }),
  selectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat (YYYY-MM-DD)").optional(),
  selectedTime: z.string().regex(/^\d{2}:\d{2}$/, "Ungültiges Zeitformat (HH:MM)").optional(),
  customerMessage: z.string().max(2000, "Nachricht zu lang (max. 2000 Zeichen)").optional(),
  customerName: z.string().min(1, "Name erforderlich").max(200, "Name zu lang"),
  customerEmail: z.string().email("Ungültige E-Mail-Adresse").max(255),
  companyName: z.string().min(1, "Firmenname erforderlich").max(200),
  address: z.string().max(500).optional(),
  // SECURITY: Token must be a valid format (UUID or secure random string)
  token: z.string().min(32, "Token erforderlich").max(128, "Token zu lang"),
}).refine(
  (data) => {
    // Wenn action "accept" ist, müssen selectedDate und selectedTime vorhanden sein
    if (data.action === "accept") {
      return data.selectedDate && data.selectedTime;
    }
    return true;
  },
  { message: "Datum und Zeit erforderlich für Terminbestätigung" }
);

type ProposalResponseRequest = z.infer<typeof ProposalResponseSchema>;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Validiere Input mit Zod
    const parseResult = ProposalResponseSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const {
      leadId,
      companyId,
      action,
      selectedDate,
      selectedTime,
      customerMessage,
      customerName,
      customerEmail,
      companyName,
      address,
      token,
    } = parseResult.data;

    console.log("Processing proposal response:", { leadId, companyId, action });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY FIX: Validate token against the offer's access_token
    // First, find the offer associated with this lead and company
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("id, access_token")
      .eq("lead_id", leadId)
      .eq("company_id", companyId)
      .single();

    if (offerError || !offer) {
      console.error("Offer not found:", offerError);
      return new Response(
        JSON.stringify({ error: "Angebot nicht gefunden" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // SECURITY: Verify the provided token matches the offer's access_token
    if (offer.access_token !== token) {
      console.error("Token mismatch - potential unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Ungültiges Zugriffstoken" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Token validated - now check distribution
    const { data: distribution, error: distError } = await supabase
      .from("lead_distributions")
      .select("id, status")
      .eq("lead_id", leadId)
      .eq("company_id", companyId)
      .single();

    if (distError || !distribution) {
      console.error("Distribution not found:", distError);
      return new Response(
        JSON.stringify({ error: "Ungültiger Zugriff - Lead-Verteilung nicht gefunden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // BUG-2: Replay koruması — zaten işlenmiş ise ikinci kez randevu oluşturma
    if (distribution.status === "accepted") {
      return new Response(
        JSON.stringify({ success: true, message: "Bereits bestätigt" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get company info for notification
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("email, notification_email, company_name")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      console.error("Company not found:", companyError);
      return new Response(
        JSON.stringify({ error: "Firma nicht gefunden" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const companyEmail = company.notification_email || company.email;

    if (action === "accept" && selectedDate && selectedTime) {
      // Create appointment in calendar
      const { data: newAppointment, error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          company_id: companyId,
          lead_id: leadId,
          appointment_type: "besichtigung",
          title: `Besichtigung - ${customerName}`,
          appointment_date: selectedDate,
          start_time: selectedTime,
          end_time: calculateEndTime(selectedTime, 60),
          customer_first_name: customerName.split(" ")[0] || customerName,
          customer_last_name: customerName.split(" ").slice(1).join(" ") || "",
          customer_email: customerEmail,
          location_address: address,
          status: "confirmed",
          confirmed_by_customer: true,
          confirmed_at: new Date().toISOString(),
          description: customerMessage || undefined,
        })
        .select()
        .single();

      if (appointmentError) {
        console.error("Error creating appointment:", appointmentError);
        throw appointmentError;
      }

      console.log("Appointment created:", newAppointment.id);

      // Update lead distribution status
      await supabase
        .from("lead_distributions")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("lead_id", leadId)
        .eq("company_id", companyId);

      // Create notification for company
      await supabase.from("notifications").insert({
        company_id: companyId,
        type: "besichtigung_confirmed",
        title: "Besichtigungstermin bestätigt",
        body: `${customerName} hat den Termin am ${formatDateDE(selectedDate)} um ${selectedTime} Uhr bestätigt.`,
        metadata: {
          lead_id: leadId,
          appointment_id: newAppointment.id,
          customer_name: customerName,
          appointment_date: selectedDate,
          appointment_time: selectedTime,
        },
      });

      // Send confirmation email to company
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      
      await resend.emails.send({
        from: getDefaultFrom(),
        to: [companyEmail],
        subject: `✅ Besichtigungstermin bestätigt - ${customerName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Besichtigungstermin bestätigt</title>
          </head>
          <body style="margin: 0; padding: 0; background: #f3f4f6;">
          <div style="font-family: Arial, sans-serif; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Termin bestätigt!</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <p style="font-size: 16px; color: #333;">Gute Nachrichten!</p>
              <p style="font-size: 16px; color: #333;"><strong>${customerName}</strong> hat einen Besichtigungstermin bestätigt.</p>
              
              <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 15px 0; color: #166534;">Termindetails</h3>
                <p style="margin: 5px 0; color: #333;"><strong>📅 Datum:</strong> ${formatDateDE(selectedDate)}</p>
                <p style="margin: 5px 0; color: #333;"><strong>🕐 Uhrzeit:</strong> ${selectedTime} Uhr</p>
                ${address ? `<p style="margin: 5px 0; color: #333;"><strong>📍 Adresse:</strong> ${address}</p>` : ""}
              </div>

              ${customerMessage ? `
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Nachricht des Kunden:</strong></p>
                <p style="margin: 10px 0 0 0; color: #333;">${customerMessage}</p>
              </div>
              ` : ""}

              <p style="font-size: 14px; color: #666;">Der Termin wurde automatisch in Ihren Kalender eingetragen.</p>
            </div>
            <div style="padding: 20px; background: #f8fafc; text-align: center;">
              <p style="font-size: 12px; color: #666; margin: 0;">Diese E-Mail wurde automatisch versendet.</p>
            </div>
          </div>
          </body>
          </html>
        `,
      });

      // Send confirmation email to customer
      await resend.emails.send({
        from: getDefaultFrom(),
        to: [customerEmail],
        subject: `Ihr Besichtigungstermin bei ${companyName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ihr Besichtigungstermin</title>
          </head>
          <body style="margin: 0; padding: 0; background: #f3f4f6;">
          <div style="font-family: Arial, sans-serif; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Termin bestätigt</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <p style="font-size: 16px; color: #333;">Guten Tag ${customerName},</p>
              <p style="font-size: 16px; color: #333;">Ihr Besichtigungstermin wurde erfolgreich bestätigt.</p>
              
              <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1e40af;">Termindetails</h3>
                <p style="margin: 5px 0; color: #333;"><strong>🏢 Firma:</strong> ${companyName}</p>
                <p style="margin: 5px 0; color: #333;"><strong>📅 Datum:</strong> ${formatDateDE(selectedDate)}</p>
                <p style="margin: 5px 0; color: #333;"><strong>🕐 Uhrzeit:</strong> ${selectedTime} Uhr</p>
                ${address ? `<p style="margin: 5px 0; color: #333;"><strong>📍 Adresse:</strong> ${address}</p>` : ""}
              </div>

              <p style="font-size: 14px; color: #666;">Wir freuen uns auf Ihren Besuch!</p>
            </div>
            <div style="padding: 20px; background: #f8fafc; text-align: center;">
              <p style="font-size: 12px; color: #666; margin: 0;">Diese E-Mail wurde automatisch versendet.</p>
            </div>
          </div>
          </body>
          </html>
        `,
      });

      // Log emails
      await supabase.from("email_logs").insert([
        {
          company_id: companyId,
          lead_id: leadId,
          email_type: "besichtigung_confirmed_company",
          recipient_email: companyEmail,
          recipient_name: company.company_name,
          subject: `Besichtigungstermin bestätigt - ${customerName}`,
          status: "sent",
          metadata: { selectedDate, selectedTime },
        },
        {
          company_id: companyId,
          lead_id: leadId,
          email_type: "besichtigung_confirmed_customer",
          recipient_email: customerEmail,
          recipient_name: customerName,
          subject: `Ihr Besichtigungstermin bei ${companyName}`,
          status: "sent",
          metadata: { selectedDate, selectedTime },
        },
      ]);

    } else if (action === "reject") {
      // Create notification for company
      await supabase.from("notifications").insert({
        company_id: companyId,
        type: "besichtigung_rejected",
        title: "Terminvorschläge abgelehnt",
        body: `${customerName} hat die vorgeschlagenen Termine abgelehnt.${customerMessage ? ` Nachricht: "${customerMessage}"` : ""}`,
        metadata: {
          lead_id: leadId,
          customer_name: customerName,
          customer_message: customerMessage,
        },
      });

      // Send notification email to company
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      
      await resend.emails.send({
        from: getDefaultFrom(),
        to: [companyEmail],
        subject: `❌ Terminvorschläge abgelehnt - ${customerName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Terminvorschläge abgelehnt</title>
          </head>
          <body style="margin: 0; padding: 0; background: #f3f4f6;">
          <div style="font-family: Arial, sans-serif; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;">
            <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Terminvorschläge abgelehnt</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <p style="font-size: 16px; color: #333;"><strong>${customerName}</strong> hat die vorgeschlagenen Besichtigungstermine abgelehnt.</p>
              
              ${customerMessage ? `
              <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 14px; color: #9a3412;"><strong>Nachricht des Kunden:</strong></p>
                <p style="margin: 10px 0 0 0; color: #333;">${customerMessage}</p>
              </div>
              ` : ""}

              <p style="font-size: 14px; color: #666;">Sie können dem Kunden alternative Termine vorschlagen oder direkt Kontakt aufnehmen.</p>
            </div>
            <div style="padding: 20px; background: #f8fafc; text-align: center;">
              <p style="font-size: 12px; color: #666; margin: 0;">Diese E-Mail wurde automatisch versendet.</p>
            </div>
          </div>
          </body>
          </html>
        `,
      });

      // Log email
      await supabase.from("email_logs").insert({
        company_id: companyId,
        lead_id: leadId,
        email_type: "besichtigung_rejected",
        recipient_email: companyEmail,
        recipient_name: company.company_name,
        subject: `Terminvorschläge abgelehnt - ${customerName}`,
        status: "sent",
        metadata: { customerMessage },
      });
    }

    return new Response(
      JSON.stringify({ success: true, action }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in handle-proposal-response:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

function formatDateDE(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
