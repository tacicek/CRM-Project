import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getDashboardAppBaseUrl } from "../_shared/dashboardAppUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod Schema für Input-Validierung
const NotifyAdminRequestSchema = z.object({
  leadId: z.string().uuid("Ungültige Lead-ID"),
});

interface Lead {
  id: string;
  slug: string;
  service_type: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  from_plz: string;
  from_city: string;
  to_plz?: string;
  to_city?: string;
  preferred_date?: string;
  created_at: string;
  spam_score?: number;
  ip_address?: string;
}

const getSpamBadge = (score: number): { text: string; color: string; bgColor: string } => {
  if (score >= 6) {
    return { text: `⚠️ Hoher Spam-Score: ${score}`, color: '#991b1b', bgColor: '#fef2f2' };
  } else if (score >= 3) {
    return { text: `⚠ Mittlerer Spam-Score: ${score}`, color: '#92400e', bgColor: '#fef3c7' };
  }
  return { text: `✓ Niedriger Spam-Score: ${score}`, color: '#166534', bgColor: '#f0fdf4' };
};

const getServiceLabel = (serviceType: string): string => {
  const labels: Record<string, string> = {
    umzug_privat: "Privatumzug",
    umzug_firma: "Firmenumzug",
    klaviertransport: "Klaviertransport",
    moebellift: "Möbellift",
    reinigung_end: "Endreinigung",
    reinigung_grund: "Grundreinigung",
    raeumung_wohnung: "Wohnungsräumung",
    transport_moebel: "Möbeltransport",
    lagerung: "Lagerung",
    entsorgung: "Entsorgung",
  };
  return labels[serviceType] || serviceType;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("[notify-admin-new-lead] Function started");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Validiere Input mit Zod
    const parseResult = NotifyAdminRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("[notify-admin-new-lead] Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { leadId } = parseResult.data;
    console.log("[notify-admin-new-lead] Processing lead:", leadId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      console.error("[notify-admin-new-lead] Lead not found:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[notify-admin-new-lead] Lead found:", lead.slug);

    // Get admin emails from user_roles
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      console.error("[notify-admin-new-lead] Error fetching admin roles:", rolesError);
    }

    // Always include main admin email
    const mainAdminEmail = "info@offerio.ch";
    const adminEmails: string[] = [mainAdminEmail];

    if (adminRoles && adminRoles.length > 0) {
      const adminUserIds = adminRoles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email")
        .in("id", adminUserIds);

      if (profiles) {
        for (const profile of profiles) {
          if (profile.email && !adminEmails.includes(profile.email)) {
            adminEmails.push(profile.email);
          }
        }
      }
    }

    console.log("[notify-admin-new-lead] Admin emails to notify:", adminEmails);

    console.log("[notify-admin-new-lead] Sending to admins:", adminEmails);

    if (!resendApiKey) {
      console.log("[notify-admin-new-lead] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: true, message: "Email not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format the date
    const createdAt = new Date(lead.created_at).toLocaleString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const preferredDate = lead.preferred_date
      ? new Date(lead.preferred_date).toLocaleDateString("de-CH")
      : "Nicht angegeben";

    // Build verification URL
    const appUrl = getDashboardAppBaseUrl();
    const verificationUrl = `${appUrl}/admin/verification`;

    // Get spam badge info
    const spamScore = lead.spam_score ?? 0;
    const spamBadge = getSpamBadge(spamScore);
    const isHighSpam = spamScore >= 6;

    // Send email notification
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8; }
    .header { background: linear-gradient(135deg, ${isHighSpam ? '#dc2626' : '#f97316'} 0%, ${isHighSpam ? '#b91c1c' : '#ea580c'} 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; }
    .content { background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 12px 12px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-right: 8px; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .spam-alert { background: ${spamBadge.bgColor}; color: ${spamBadge.color}; border: 1px solid ${spamBadge.color}20; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-weight: 500; }
    .info-box { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; font-size: 14px; }
    .info-value { font-weight: 500; font-size: 14px; }
    .button { display: inline-block; background: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
    .button:hover { background: #ea580c; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isHighSpam ? '⚠️ Spam-Verdacht!' : '🆕 Neue Anfrage zur Überprüfung'}</h1>
      <p>${getServiceLabel(lead.service_type)}</p>
    </div>
    <div class="content">
      <div class="spam-alert">${spamBadge.text}</div>
      <p><span class="badge badge-warning">⏳ Manuelle Überprüfung erforderlich</span></p>
      
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Referenz</span>
          <span class="info-value">${lead.slug || lead.id.substring(0, 8)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Service</span>
          <span class="info-value">${getServiceLabel(lead.service_type)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Kunde</span>
          <span class="info-value">${lead.customer_first_name} ${lead.customer_last_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">E-Mail</span>
          <span class="info-value">${lead.customer_email}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Telefon</span>
          <span class="info-value">${lead.customer_phone}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Von</span>
          <span class="info-value">${lead.from_plz} ${lead.from_city}</span>
        </div>
        ${lead.to_city ? `
        <div class="info-row">
          <span class="info-label">Nach</span>
          <span class="info-value">${lead.to_plz} ${lead.to_city}</span>
        </div>
        ` : ""}
        <div class="info-row">
          <span class="info-label">Wunschdatum</span>
          <span class="info-value">${preferredDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Eingegangen</span>
          <span class="info-value">${createdAt}</span>
        </div>
        ${lead.ip_address ? `
        <div class="info-row">
          <span class="info-label">IP-Adresse</span>
          <span class="info-value">${lead.ip_address}</span>
        </div>
        ` : ""}
      </div>

      <p style="text-align: center;">
        <a href="${verificationUrl}" class="button">
          ✅ Jetzt überprüfen
        </a>
      </p>

      <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px;">
        Diese Anfrage wartet auf Ihre Überprüfung, bevor sie an Firmen verteilt wird.
      </p>
    </div>
    <div class="footer">
      <p>Diese E-Mail wurde automatisch von Offerio gesendet.</p>
    </div>
  </div>
</body>
</html>
    `;

    const resend = new Resend(resendApiKey);

    const subjectPrefix = isHighSpam ? '⚠️ SPAM-VERDACHT' : '🆕 Neue Anfrage';
    const emailResponse = await resend.emails.send({
      from: "Offerio <noreply@offerio.ch>",
      to: adminEmails,
      subject: `${subjectPrefix} - ${getServiceLabel(lead.service_type)} (Score: ${spamScore})`,
      html: emailHtml,
    });

    console.log("[notify-admin-new-lead] Email sent:", emailResponse);

    // Log the email
    await supabase.from("email_logs").insert({
      email_type: "admin_new_lead_notification",
      recipient_email: adminEmails.join(", "),
      subject: `Neue Anfrage zur Überprüfung - ${getServiceLabel(lead.service_type)}`,
      status: "sent",
      lead_id: leadId,
      metadata: { adminEmails, leadSlug: lead.slug },
    });

    return new Response(
      JSON.stringify({ success: true, emailsSent: adminEmails.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[notify-admin-new-lead] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
