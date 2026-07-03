import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BoxRental {
  id: string;
  company_id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_plz: string | null;
  delivery_city: string | null;
  box_quantity: number;
  box_description: string | null;
  expected_return_date: string;
  reminder_days_before: number;
  reminder_sent: boolean;
  second_reminder_sent: boolean;
  assigned_team_member_id: string | null;
}

interface Company {
  id: string;
  company_name: string;
  email: string;
  phone: string | null;
  primary_color: string | null;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("[notify-box-pickup] Starting daily box pickup reminder job");

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    // Get all active rentals
    const { data: rentals, error: rentalsError } = await supabase
      .from("umzugsbox_rentals")
      .select("*")
      .in("status", ["delivered", "in_use", "pickup_requested"])
      .eq("is_rental", true)
      .not("expected_return_date", "is", null);

    if (rentalsError) {
      throw rentalsError;
    }

    if (!rentals || rentals.length === 0) {
      console.log("[notify-box-pickup] No active rentals found");
      return new Response(
        JSON.stringify({ success: true, message: "No active rentals", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[notify-box-pickup] Found ${rentals.length} active rentals`);

    // Group rentals by company
    const rentalsByCompany: Record<string, BoxRental[]> = {};
    const companyIds = new Set<string>();

    for (const rental of rentals as BoxRental[]) {
      const expectedDate = new Date(rental.expected_return_date);
      const daysUntil = Math.ceil((expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Check if reminder should be sent
      const shouldSendFirstReminder = daysUntil === rental.reminder_days_before && !rental.reminder_sent;
      const shouldSendSecondReminder = daysUntil === 0 && !rental.second_reminder_sent;
      const isOverdue = daysUntil < 0;

      if (shouldSendFirstReminder || shouldSendSecondReminder || isOverdue) {
        companyIds.add(rental.company_id);
        if (!rentalsByCompany[rental.company_id]) {
          rentalsByCompany[rental.company_id] = [];
        }
        rentalsByCompany[rental.company_id].push({
          ...rental,
          _shouldSendFirst: shouldSendFirstReminder,
          _shouldSendSecond: shouldSendSecondReminder,
          _isOverdue: isOverdue,
          _daysUntil: daysUntil,
        } as BoxRental & { _shouldSendFirst: boolean; _shouldSendSecond: boolean; _isOverdue: boolean; _daysUntil: number });
      }
    }

    if (companyIds.size === 0) {
      console.log("[notify-box-pickup] No reminders needed today");
      return new Response(
        JSON.stringify({ success: true, message: "No reminders needed", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch company info
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, company_name, email, phone, primary_color")
      .in("id", Array.from(companyIds));

    if (companiesError) {
      throw companiesError;
    }

    const companyMap: Record<string, Company> = {};
    for (const company of companies || []) {
      companyMap[company.id] = company;
    }

    // Fetch team members if needed
    const teamMemberIds = new Set<string>();
    for (const rentalList of Object.values(rentalsByCompany)) {
      for (const rental of rentalList) {
        if (rental.assigned_team_member_id) {
          teamMemberIds.add(rental.assigned_team_member_id);
        }
      }
    }

    const teamMemberMap: Record<string, TeamMember> = {};
    if (teamMemberIds.size > 0) {
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, email")
        .in("id", Array.from(teamMemberIds));

      for (const member of teamMembers || []) {
        teamMemberMap[member.id] = member;
      }
    }

    // Initialize Resend if API key exists
    let resend: Resend | null = null;
    if (resendApiKey) {
      resend = new Resend(resendApiKey);
    }

    let emailsSent = 0;
    let remindersProcessed = 0;

    // Process each company's rentals
    for (const [companyId, rentalList] of Object.entries(rentalsByCompany)) {
      const company = companyMap[companyId];
      if (!company) continue;

      const primaryColor = company.primary_color || "#F97316";

      // Group by urgency
      const overdue = (rentalList as (BoxRental & { _isOverdue: boolean })[]).filter(r => r._isOverdue);
      const dueToday = (rentalList as (BoxRental & { _shouldSendSecond: boolean })[]).filter(r => r._shouldSendSecond);
      const dueSoon = (rentalList as (BoxRental & { _shouldSendFirst: boolean })[]).filter(r => r._shouldSendFirst);

      // Build email content
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
          <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              📦 Umzugsbox Erinnerung
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">
              ${today.toLocaleDateString("de-CH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <p style="margin-top: 0;">Guten Tag,</p>
            <p>Hier ist Ihre tägliche Übersicht über ausstehende Umzugsbox-Abholungen:</p>
            
            ${overdue.length > 0 ? `
              <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="color: #B91C1C; margin: 0 0 10px;">⚠️ Überfällig (${overdue.length})</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  ${(overdue as (BoxRental & { _daysUntil: number })[]).map(r => `
                    <li style="margin: 5px 0;">
                      <strong>${r.customer_first_name} ${r.customer_last_name}</strong> - 
                      ${r.box_quantity} Boxen - ${r.delivery_city || "Unbekannt"}
                      <span style="color: #B91C1C;">(${Math.abs(r._daysUntil)} Tage überfällig)</span>
                      ${r.customer_phone ? `<br><a href="tel:${r.customer_phone}" style="color: #B91C1C;">${r.customer_phone}</a>` : ""}
                    </li>
                  `).join("")}
                </ul>
              </div>
            ` : ""}
            
            ${dueToday.length > 0 ? `
              <div style="background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="color: #C2410C; margin: 0 0 10px;">📅 Heute fällig (${dueToday.length})</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  ${dueToday.map(r => `
                    <li style="margin: 5px 0;">
                      <strong>${r.customer_first_name} ${r.customer_last_name}</strong> - 
                      ${r.box_quantity} Boxen - ${r.delivery_city || "Unbekannt"}
                      ${r.customer_phone ? `<br><a href="tel:${r.customer_phone}" style="color: #C2410C;">${r.customer_phone}</a>` : ""}
                    </li>
                  `).join("")}
                </ul>
              </div>
            ` : ""}
            
            ${dueSoon.length > 0 ? `
              <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="color: #B45309; margin: 0 0 10px;">🔔 Bald fällig (${dueSoon.length})</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  ${(dueSoon as (BoxRental & { _daysUntil: number })[]).map(r => `
                    <li style="margin: 5px 0;">
                      <strong>${r.customer_first_name} ${r.customer_last_name}</strong> - 
                      ${r.box_quantity} Boxen - ${r.delivery_city || "Unbekannt"}
                      <span style="color: #B45309;">(in ${r._daysUntil} Tagen)</span>
                      ${r.customer_phone ? `<br><a href="tel:${r.customer_phone}" style="color: #B45309;">${r.customer_phone}</a>` : ""}
                    </li>
                  `).join("")}
                </ul>
              </div>
            ` : ""}
            
            <p style="text-align: center; margin: 30px 0 20px;">
              <a href="${getDashAppUrl()}/firma/umzugsboxen"
                 style="display: inline-block; background: ${primaryColor}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Zur Boxen-Übersicht
              </a>
            </p>
            
            <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
              Mit freundlichen Grüssen<br>
              <strong>Ihr ${getAppName()} Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
            <p>Diese E-Mail wurde automatisch von ${getAppName()} gesendet.</p>
          </div>
        </body>
        </html>
      `;

      // Send email to company
      if (resend && company.email) {
        try {
          const { error: sendError } = await resend.emails.send({
            from: getDefaultFrom(),
            to: [company.email],
            subject: `📦 Umzugsbox Erinnerung: ${overdue.length > 0 ? `${overdue.length} überfällig!` : `${dueToday.length + dueSoon.length} bald fällig`}`,
            html: emailHtml,
          });
          if (sendError) throw sendError; // resend returns { error } instead of throwing
          emailsSent++;
          console.log(`[notify-box-pickup] Email sent to ${company.email}`);
        } catch (emailError) {
          console.error(`[notify-box-pickup] Failed to send email to ${company.email}:`, emailError);
        }
      }

      // Send individual emails to assigned team members
      for (const rental of rentalList) {
        if (rental.assigned_team_member_id) {
          const teamMember = teamMemberMap[rental.assigned_team_member_id];
          if (teamMember?.email && resend) {
            const memberEmailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
                <div style="background: ${primaryColor}; padding: 20px; border-radius: 8px 8px 0 0; color: white;">
                  <h2 style="margin: 0;">📦 Box-Abholung zugewiesen</h2>
                </div>
                <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <p>Hallo ${teamMember.first_name},</p>
                  <p>Folgende Box-Abholung wurde Ihnen zugewiesen:</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Kunde:</td>
                      <td style="padding: 8px 0; font-weight: bold;">${rental.customer_first_name} ${rental.customer_last_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Boxen:</td>
                      <td style="padding: 8px 0;">${rental.box_quantity} ${rental.box_description || ""}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Adresse:</td>
                      <td style="padding: 8px 0;">${rental.delivery_address || ""} ${rental.delivery_plz || ""} ${rental.delivery_city || ""}</td>
                    </tr>
                    ${rental.customer_phone ? `
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Telefon:</td>
                      <td style="padding: 8px 0;"><a href="tel:${rental.customer_phone}">${rental.customer_phone}</a></td>
                    </tr>
                    ` : ""}
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Fällig:</td>
                      <td style="padding: 8px 0; color: ${(rental as unknown as { _isOverdue: boolean })._isOverdue ? "#B91C1C" : "#C2410C"}; font-weight: bold;">
                        ${new Date(rental.expected_return_date).toLocaleDateString("de-CH")}
                      </td>
                    </tr>
                  </table>
                  <p style="margin-bottom: 0;">Beste Grüsse<br>${company.company_name}</p>
                </div>
              </body>
              </html>
            `;

            try {
              const { error: sendError } = await resend.emails.send({
                from: `${company.company_name} <${getSenderEmail()}>`,
                to: [teamMember.email],
                subject: `📦 Box-Abholung: ${rental.customer_first_name} ${rental.customer_last_name}`,
                html: memberEmailHtml,
              });
              if (sendError) throw sendError; // resend returns { error } instead of throwing
              emailsSent++;
              console.log(`[notify-box-pickup] Email sent to team member ${teamMember.email}`);
            } catch (emailError) {
              console.error(`[notify-box-pickup] Failed to send email to team member:`, emailError);
            }
          }
        }

        // Update reminder flags
        const typedRental = rental as unknown as { _shouldSendFirst: boolean; _shouldSendSecond: boolean };
        if (typedRental._shouldSendFirst || typedRental._shouldSendSecond) {
          const updateData: Record<string, unknown> = {};
          if (typedRental._shouldSendFirst) {
            updateData.reminder_sent = true;
            updateData.reminder_sent_at = new Date().toISOString();
          }
          if (typedRental._shouldSendSecond) {
            updateData.second_reminder_sent = true;
            updateData.second_reminder_sent_at = new Date().toISOString();
          }

          await supabase
            .from("umzugsbox_rentals")
            .update(updateData)
            .eq("id", rental.id);

          remindersProcessed++;
        }
      }
    }

    console.log(`[notify-box-pickup] Job completed. Emails sent: ${emailsSent}, Reminders processed: ${remindersProcessed}`);

    return new Response(
      JSON.stringify({
        success: true,
        emails_sent: emailsSent,
        reminders_processed: remindersProcessed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[notify-box-pickup] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

