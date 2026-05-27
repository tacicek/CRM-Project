import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderEmail, getAppName } from "../_shared/envConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
}

interface Appointment {
  id: string;
  company_id: string;
  lead_id: string;
  offer_id: string;
  appointment_type: string;
  status: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  location_address: string;
  location_plz: string;
  location_city: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  assigned_team_member_ids: string[];
  reminder_sent_team: boolean;
}

interface Company {
  id: string;
  company_name: string;
  email: string;
  phone: string;
  resend_enabled: boolean | null;
  resend_api_key: string | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
}

interface Lead {
  id: string;
  service_type: string;
  from_street: string;
  from_house_number: string;
  from_plz: string;
  from_city: string;
  to_street: string;
  to_house_number: string;
  to_plz: string;
  to_city: string;
  apartment_size: string;
  floor_from: number;
  floor_to: number;
  has_elevator_from: boolean;
  has_elevator_to: boolean;
  moving_date: string;
  additional_info: string;
}

interface Offer {
  id: string;
  title: string;
  total_price: number;
  status: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[TEAM-REMINDER] ${step}`, details ? JSON.stringify(details) : "");
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTime = (timeStr: string): string => {
  // Handle HH:MM:SS or HH:MM format
  const parts = timeStr.split(":");
  return `${parts[0]}:${parts[1]} Uhr`;
};

const getServiceTypeName = (type: string): string => {
  const types: Record<string, string> = {
    umzug: "Umzug",
    reinigung: "Reinigung",
    entsorgung: "Entsorgung",
    malerarbeit: "Malerarbeit",
    usm_transport: "USM Transport",
    wasserbett_transport: "Wasserbett Transport",
    moebelmontage: "Möbelmontage",
    lagerung: "Lagerung",
  };
  return types[type] || type;
};

const getAppointmentTypeName = (type: string): string => {
  const types: Record<string, string> = {
    besichtigung: "Besichtigung",
    service: "Service-Einsatz",
    follow_up: "Nachbesprechung",
    meeting: "Meeting",
    blocked: "Blockiert",
  };
  return types[type] || type;
};

const generateBesichtigungEmail = (
  teamMember: TeamMember,
  appointment: Appointment,
  company: Company,
  lead: Lead | null
): string => {
  const customerName = `${appointment.customer_first_name || ""} ${appointment.customer_last_name || ""}`.trim();
  const address = [
    appointment.location_address,
    `${appointment.location_plz} ${appointment.location_city}`,
  ]
    .filter(Boolean)
    .join(", ");

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminerinnerung - Besichtigung</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:100%;box-sizing:border-box;margin:0; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
          📋 Besichtigung morgen
        </h1>
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding: 40px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
          Hallo <strong>${teamMember.first_name}</strong>,
        </p>
        
        <p style="color: #374151; font-size: 16px; margin: 0 0 30px;">
          Sie haben morgen einen Besichtigungstermin. Hier sind die Details:
        </p>
        
        <!-- Appointment Card -->
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #6366f1;">
          <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px;">
            ${appointment.title}
          </h2>
          
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #6b7280;">📅 Datum:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${formatDate(appointment.appointment_date)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #6b7280;">🕐 Uhrzeit:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #6b7280;">📍 Adresse:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${address}</span>
              </td>
            </tr>
          </table>
        </div>
        
        <!-- Customer Card -->
        <div style="background: #ecfdf5; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #065f46; font-size: 16px; margin: 0 0 16px;">
            👤 Kundendaten
          </h3>
          
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">Name:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${customerName || "Nicht angegeben"}</span>
              </td>
            </tr>
            ${
              appointment.customer_phone
                ? `
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">Telefon:</strong>
                <a href="tel:${appointment.customer_phone}" style="color: #059669; margin-left: 8px; text-decoration: none;">${appointment.customer_phone}</a>
              </td>
            </tr>
            `
                : ""
            }
            ${
              appointment.customer_email
                ? `
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">E-Mail:</strong>
                <a href="mailto:${appointment.customer_email}" style="color: #059669; margin-left: 8px; text-decoration: none;">${appointment.customer_email}</a>
              </td>
            </tr>
            `
                : ""
            }
          </table>
        </div>
        
        ${
          lead
            ? `
        <!-- Service Details -->
        <div style="background: #fef3c7; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #92400e; font-size: 16px; margin: 0 0 16px;">
            📦 ${getServiceTypeName(lead.service_type)} - Details
          </h3>
          
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${
              lead.apartment_size
                ? `
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">Wohnungsgrösse:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${lead.apartment_size}</span>
              </td>
            </tr>
            `
                : ""
            }
            ${
              lead.from_street
                ? `
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">Von:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${lead.from_street} ${lead.from_house_number || ""}, ${lead.from_plz} ${lead.from_city}</span>
                ${lead.floor_from !== null ? `<span style="color: #6b7280; margin-left: 4px;">(${lead.floor_from}. Stock${lead.has_elevator_from ? ", mit Lift" : ", ohne Lift"})</span>` : ""}
              </td>
            </tr>
            `
                : ""
            }
            ${
              lead.to_street
                ? `
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">Nach:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${lead.to_street} ${lead.to_house_number || ""}, ${lead.to_plz} ${lead.to_city}</span>
                ${lead.floor_to !== null ? `<span style="color: #6b7280; margin-left: 4px;">(${lead.floor_to}. Stock${lead.has_elevator_to ? ", mit Lift" : ", ohne Lift"})</span>` : ""}
              </td>
            </tr>
            `
                : ""
            }
            ${
              lead.moving_date
                ? `
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">Gewünschtes Datum:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${formatDate(lead.moving_date)}</span>
              </td>
            </tr>
            `
                : ""
            }
            ${
              lead.additional_info
                ? `
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">Zusätzliche Infos:</strong>
                <p style="color: #1f2937; margin: 8px 0 0; font-style: italic;">"${lead.additional_info}"</p>
              </td>
            </tr>
            `
                : ""
            }
          </table>
        </div>
        `
            : ""
        }
        
        ${
          appointment.description
            ? `
        <!-- Notes -->
        <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #475569; font-size: 16px; margin: 0 0 12px;">
            📝 Notizen
          </h3>
          <p style="color: #1f2937; margin: 0; white-space: pre-wrap;">${appointment.description}</p>
        </div>
        `
            : ""
        }
        
        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0; text-align: center;">
          Bei Fragen kontaktieren Sie bitte das Büro: ${company.phone || company.email}
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background-color: #f3f4f6; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Diese E-Mail wurde automatisch von ${company.company_name} versendet.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const generateServiceEmail = (
  teamMember: TeamMember,
  appointment: Appointment,
  company: Company,
  lead: Lead | null,
  offer: Offer | null
): string => {
  const customerName = `${appointment.customer_first_name || ""} ${appointment.customer_last_name || ""}`.trim();
  const address = [
    appointment.location_address,
    `${appointment.location_plz} ${appointment.location_city}`,
  ]
    .filter(Boolean)
    .join(", ");

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminerinnerung - ${getAppointmentTypeName(appointment.appointment_type)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:100%;box-sizing:border-box;margin:0; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
          🚚 ${getAppointmentTypeName(appointment.appointment_type)} morgen
        </h1>
      </td>
    </tr>
    
    <!-- Main Content -->
    <tr>
      <td style="padding: 40px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
          Hallo <strong>${teamMember.first_name}</strong>,
        </p>
        
        <p style="color: #374151; font-size: 16px; margin: 0 0 30px;">
          Sie haben morgen einen Einsatz. Hier sind alle wichtigen Informationen:
        </p>
        
        <!-- Appointment Card -->
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #059669;">
          <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px;">
            ${appointment.title}
          </h2>
          
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #6b7280;">📅 Datum:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${formatDate(appointment.appointment_date)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #6b7280;">🕐 Startzeit:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${formatTime(appointment.start_time)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #6b7280;">📍 Adresse:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${address}</span>
              </td>
            </tr>
          </table>
        </div>
        
        <!-- Customer Card -->
        <div style="background: #dbeafe; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #1e40af; font-size: 16px; margin: 0 0 16px;">
            👤 Kunde
          </h3>
          
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">Name:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${customerName || "Nicht angegeben"}</span>
              </td>
            </tr>
            ${
              appointment.customer_phone
                ? `
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">Telefon:</strong>
                <a href="tel:${appointment.customer_phone}" style="color: #2563eb; margin-left: 8px; text-decoration: none; font-weight: 600;">${appointment.customer_phone}</a>
              </td>
            </tr>
            `
                : ""
            }
          </table>
        </div>
        
        ${
          lead
            ? `
        <!-- Service Details -->
        <div style="background: #fef3c7; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #92400e; font-size: 16px; margin: 0 0 16px;">
            📦 ${getServiceTypeName(lead.service_type)} - Details
          </h3>
          
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${
              lead.apartment_size
                ? `
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">Wohnungsgrösse:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${lead.apartment_size}</span>
              </td>
            </tr>
            `
                : ""
            }
            ${
              lead.from_street
                ? `
            <tr>
              <td style="padding: 6px 0;">
                <strong style="color: #6b7280;">📍 Von:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${lead.from_street} ${lead.from_house_number || ""}, ${lead.from_plz} ${lead.from_city}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; padding-left: 24px;">
                <span style="color: #6b7280;">${lead.floor_from !== null ? `${lead.floor_from}. Stock` : ""}${lead.has_elevator_from ? " • Mit Lift ✓" : " • Ohne Lift"}</span>
              </td>
            </tr>
            `
                : ""
            }
            ${
              lead.to_street
                ? `
            <tr>
              <td style="padding: 6px 0; padding-top: 12px;">
                <strong style="color: #6b7280;">📍 Nach:</strong>
                <span style="color: #1f2937; margin-left: 8px;">${lead.to_street} ${lead.to_house_number || ""}, ${lead.to_plz} ${lead.to_city}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; padding-left: 24px;">
                <span style="color: #6b7280;">${lead.floor_to !== null ? `${lead.floor_to}. Stock` : ""}${lead.has_elevator_to ? " • Mit Lift ✓" : " • Ohne Lift"}</span>
              </td>
            </tr>
            `
                : ""
            }
            ${
              lead.additional_info
                ? `
            <tr>
              <td style="padding: 12px 0 0;">
                <strong style="color: #6b7280;">⚠️ Besondere Hinweise:</strong>
                <p style="color: #1f2937; margin: 8px 0 0; padding: 12px; background: #fffbeb; border-radius: 8px; font-style: italic;">"${lead.additional_info}"</p>
              </td>
            </tr>
            `
                : ""
            }
          </table>
        </div>
        `
            : ""
        }
        
        ${
          offer
            ? `
        <!-- Offer Info -->
        <div style="background: #e0e7ff; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #3730a3; font-size: 16px; margin: 0 0 12px;">
            💰 Offerte: ${offer.title}
          </h3>
          <p style="color: #1f2937; margin: 0; font-size: 20px; font-weight: 600;">
            CHF ${offer.total_price?.toLocaleString("de-CH") || "0"}
          </p>
        </div>
        `
            : ""
        }
        
        ${
          appointment.description
            ? `
        <!-- Notes -->
        <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #475569; font-size: 16px; margin: 0 0 12px;">
            📝 Interne Notizen
          </h3>
          <p style="color: #1f2937; margin: 0; white-space: pre-wrap;">${appointment.description}</p>
        </div>
        `
            : ""
        }
        
        <!-- Contact -->
        <div style="background: #fce7f3; border-radius: 12px; padding: 20px; text-align: center;">
          <p style="color: #9d174d; margin: 0; font-size: 14px;">
            Bei Fragen oder Problemen kontaktieren Sie das Büro:<br>
            <a href="tel:${company.phone}" style="color: #be185d; font-weight: 600; text-decoration: none;">${company.phone || company.email}</a>
          </p>
        </div>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background-color: #f3f4f6; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Diese E-Mail wurde automatisch von ${company.company_name} versendet.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting team reminder check");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate time window: 11-13 hours from now (to catch 12 hours before)
    const now = new Date();
    const from11Hours = new Date(now.getTime() + 11 * 60 * 60 * 1000);
    const to13Hours = new Date(now.getTime() + 13 * 60 * 60 * 1000);

    logStep("Time window", {
      now: now.toISOString(),
      from11Hours: from11Hours.toISOString(),
      to13Hours: to13Hours.toISOString(),
    });

    // Get appointments that need team reminders
    // Looking for appointments where:
    // 1. Status is confirmed or pending
    // 2. Has assigned team members
    // 3. Appointment is within 11-13 hours from now
    // 4. Team reminder not yet sent

    const targetDate = from11Hours.toISOString().split("T")[0];
    
    const { data: appointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select("*")
      .in("status", ["confirmed", "pending"])
      .eq("appointment_date", targetDate)
      .not("assigned_team_member_ids", "is", null)
      .or("reminder_sent_team.is.null,reminder_sent_team.eq.false");

    if (appointmentsError) {
      throw new Error(`Failed to fetch appointments: ${appointmentsError.message}`);
    }

    logStep("Found appointments", { count: appointments?.length || 0 });

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No appointments need reminders", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter appointments by time
    const appointmentsToRemind = appointments.filter((apt) => {
      const [hours, minutes] = apt.start_time.split(":").map(Number);
      const appointmentDateTime = new Date(apt.appointment_date);
      appointmentDateTime.setHours(hours, minutes, 0, 0);

      return appointmentDateTime >= from11Hours && appointmentDateTime <= to13Hours;
    });

    logStep("Appointments in time window", { count: appointmentsToRemind.length });

    if (appointmentsToRemind.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No appointments in reminder window", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const appointment of appointmentsToRemind) {
      try {
        // Get company details
        const { data: company } = await supabase
          .from("companies")
          .select("*")
          .eq("id", appointment.company_id)
          .single();

        if (!company) {
          logStep("Company not found", { companyId: appointment.company_id });
          continue;
        }

        const activeResendKey = (company.resend_enabled && company.resend_api_key)
          ? company.resend_api_key
          : resendApiKey;

        const activeFrom = (company.resend_enabled && company.resend_from_email)
          ? `${company.resend_from_name || company.company_name} <${company.resend_from_email}>`
          : `${company.company_name} <${getSenderEmail()}>`;

        if (!activeResendKey) {
          logStep("No Resend key available", { companyId: appointment.company_id });
          continue;
        }

        // Get lead details if available
        let lead: Lead | null = null;
        if (appointment.lead_id) {
          const { data: leadData } = await supabase
            .from("leads")
            .select("*")
            .eq("id", appointment.lead_id)
            .single();
          lead = leadData;
        }

        // Get offer details if available
        let offer: Offer | null = null;
        if (appointment.offer_id) {
          const { data: offerData } = await supabase
            .from("offers")
            .select("*")
            .eq("id", appointment.offer_id)
            .single();
          offer = offerData;
        }

        // Get team members
        const teamMemberIds = appointment.assigned_team_member_ids || [];
        
        if (teamMemberIds.length === 0) {
          logStep("No team members assigned", { appointmentId: appointment.id });
          continue;
        }

        const { data: teamMembers } = await supabase
          .from("team_members")
          .select("*")
          .in("id", teamMemberIds)
          .eq("is_active", true);

        if (!teamMembers || teamMembers.length === 0) {
          logStep("No active team members found", { appointmentId: appointment.id });
          continue;
        }

        logStep("Sending reminders", {
          appointmentId: appointment.id,
          teamMemberCount: teamMembers.length,
        });

        // Send email to each team member
        for (const member of teamMembers) {
          if (!member.email) {
            logStep("Team member has no email", { memberId: member.id });
            continue;
          }

          // Generate appropriate email based on appointment type
          const htmlContent =
            appointment.appointment_type === "besichtigung"
              ? generateBesichtigungEmail(member, appointment, company, lead)
              : generateServiceEmail(member, appointment, company, lead, offer);

          const subject =
            appointment.appointment_type === "besichtigung"
              ? `📋 Besichtigung morgen - ${formatTime(appointment.start_time)}`
              : `🚚 Einsatz morgen - ${appointment.title}`;

          try {
            // Send via Resend
            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${activeResendKey}`,
              },
              body: JSON.stringify({
                from: activeFrom,
                to: [member.email],
                subject: subject,
                html: htmlContent,
              }),
            });

            if (!emailResponse.ok) {
              const errorText = await emailResponse.text();
              throw new Error(`Resend error: ${errorText}`);
            }

            // Log the reminder
            await supabase.from("appointment_reminders").insert({
              appointment_id: appointment.id,
              recipient_type: "team_member",
              recipient_id: member.id,
              recipient_email: member.email,
              reminder_type: "email",
              status: "sent",
            });

            sentCount++;
            logStep("Email sent", { memberId: member.id, email: member.email });
          } catch (emailError) {
            const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
            errors.push(`Failed to send to ${member.email}: ${errorMessage}`);
            
            // Log failed reminder
            await supabase.from("appointment_reminders").insert({
              appointment_id: appointment.id,
              recipient_type: "team_member",
              recipient_id: member.id,
              recipient_email: member.email,
              reminder_type: "email",
              status: "failed",
              error_message: errorMessage,
            });
          }
        }

        // Mark appointment as reminded
        await supabase
          .from("appointments")
          .update({
            reminder_sent_team: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", appointment.id);

      } catch (appointmentError) {
        const errorMessage = appointmentError instanceof Error ? appointmentError.message : "Unknown error";
        errors.push(`Appointment ${appointment.id}: ${errorMessage}`);
        logStep("Error processing appointment", { appointmentId: appointment.id, error: errorMessage });
      }
    }

    logStep("Reminder job completed", { sentCount, errors });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${sentCount} team reminders`,
        sent: sentCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Fatal error", { error: errorMessage });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

