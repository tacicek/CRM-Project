/**
 * Notify Support Ticket Edge Function
 * Sends email notification when a new support ticket is created
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketPayload {
  ticketId: string;
  companyName: string;
  companyEmail: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  contactName?: string;
  contactPhone?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const payload: TicketPayload = await req.json();
    const resend = new Resend(resendApiKey);

    const priorityColors: Record<string, string> = {
      low: "#22c55e",
      medium: "#f59e0b",
      high: "#ef4444",
      urgent: "#dc2626",
    };

    const priorityLabels: Record<string, string> = {
      low: "Niedrig",
      medium: "Mittel",
      high: "Hoch",
      urgent: "Dringend",
    };

    const categoryLabels: Record<string, string> = {
      technical: "Technisch",
      billing: "Abrechnung",
      feature_request: "Feature-Anfrage",
      bug_report: "Fehlerbericht",
      general: "Allgemein",
      account: "Konto",
    };

    const priorityColor = priorityColors[payload.priority] || "#6b7280";
    const priorityLabel = priorityLabels[payload.priority] || payload.priority;
    const categoryLabel = categoryLabels[payload.category] || payload.category;

    // Send email to admin
    const emailResult = await resend.emails.send({
      from: "Offerio Support <info@offerio.ch>",
      to: "info@offerio.ch",
      replyTo: payload.companyEmail,
      subject: `🎫 Neues Support-Ticket: ${payload.subject}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 25px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">🎫 Neues Support-Ticket</h1>
    </div>
    
    <div style="background: white; padding: 25px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      
      <!-- Priority & Category Badges -->
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: ${priorityColor}20; color: ${priorityColor}; margin-right: 8px;">
          ${priorityLabel}
        </span>
        <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #e0e7ff; color: #4f46e5;">
          ${categoryLabel}
        </span>
      </div>

      <!-- Subject -->
      <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">${payload.subject}</h2>

      <!-- Company Info -->
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0 0 5px 0; font-size: 14px; color: #64748b;">Von:</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600;">${payload.companyName}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">
          ${payload.contactName ? `${payload.contactName} • ` : ""}
          <a href="mailto:${payload.companyEmail}" style="color: #3b82f6;">${payload.companyEmail}</a>
          ${payload.contactPhone ? ` • ${payload.contactPhone}` : ""}
        </p>
      </div>

      <!-- Message -->
      <div style="border-left: 4px solid #e2e8f0; padding-left: 15px; margin-bottom: 25px;">
        <p style="margin: 0; color: #374151; white-space: pre-wrap;">${payload.message}</p>
      </div>

      <!-- Action Button -->
      <div style="text-align: center;">
        <a href="https://dash.offerio.ch/admin/support?ticket=${payload.ticketId}" 
           style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Ticket bearbeiten
        </a>
      </div>
      
      <!-- Quick Reply -->
      <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 13px; color: #64748b;">
          💡 Schnellantwort: Antworten Sie direkt auf diese E-Mail, um dem Kunden zu antworten.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `,
    });

    console.log("Support ticket notification sent:", emailResult);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending support ticket notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

