import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BUG-8: PII maskeleme yardımcıları — loglar DSG/DSGVO uyumlu
const maskEmail = (e: string) => e.replace(/(?<=.{2}).+(?=@)/, "***");
const maskPhone = (p: string) => p.slice(0, 4) + "***";

interface Appointment {
  id: string;
  title: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: string;
  location_address: string | null;
  location_plz: string | null;
  location_city: string | null;
  location_notes: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  reminder_sent_firma: boolean;
  reminder_sent_customer: boolean;
  company_id: string;
}

interface Company {
  id: string;
  company_name: string;
  email: string;
  notification_email: string | null;
  twilio_enabled: boolean | null;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string | null;
  sms_reminders_enabled: boolean | null;
  resend_enabled: boolean | null;
  resend_api_key: string | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
}

// Generate ICS calendar file content
function generateIcsContent(appointment: Appointment, company: Company): string {
  const uid = `${appointment.id}@crm.internal`;
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  
  const dateClean = appointment.appointment_date.replace(/-/g, "");
  const startTimeClean = appointment.start_time.substring(0, 5).replace(":", "") + "00";
  const endTimeClean = appointment.end_time.substring(0, 5).replace(":", "") + "00";
  
  const dtstart = `${dateClean}T${startTimeClean}`;
  const dtend = `${dateClean}T${endTimeClean}`;
  
  const location = [
    appointment.location_address,
    appointment.location_plz,
    appointment.location_city,
  ].filter(Boolean).join(", ");
  
  const escapeText = (text: string) => text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
  
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRM//Termin//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeText(appointment.title)}`,
    `DESCRIPTION:${escapeText(`Termin bei ${company.company_name}`)}`,
  ];
  
  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`);
  }
  
  if (company.company_name && company.email) {
    lines.push(`ORGANIZER;CN=${escapeText(company.company_name)}:mailto:${company.email}`);
  }
  
  lines.push("END:VEVENT", "END:VCALENDAR");
  
  return lines.join("\r\n");
}

// Convert string to base64
function stringToBase64(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...data));
}

/**
 * Normalize a phone number to E.164 format, defaulting to Switzerland (+41).
 * Handles:
 *   +41 79 123 45 67  → +41791234567  (already E.164, strip spaces/dashes)
 *   0041791234567     → +41791234567  (IDD prefix)
 *   079 123 45 67     → +41791234567  (national format, leading 0)
 *   +49 170 1234567   → +491701234567 (other country, preserved)
 *   79 123 45 67      → null          (ambiguous, rejected)
 */
function normalizePhoneToE164(raw: string): string | null {
  // Strip everything except digits and leading +
  let phone = raw.trim().replace(/[\s\-().]/g, "");

  if (phone.startsWith("+")) {
    // Already has country code — strip any remaining non-digits after the +
    const digits = phone.slice(1).replace(/\D/g, "");
    return digits.length >= 7 ? `+${digits}` : null;
  }

  if (phone.startsWith("0041")) {
    // International dialling code for Switzerland
    const digits = phone.slice(4).replace(/\D/g, "");
    return digits.length >= 7 ? `+41${digits}` : null;
  }

  if (phone.startsWith("00")) {
    // Generic IDD prefix — strip "00" and treat remainder as E.164 digits
    const digits = phone.slice(2).replace(/\D/g, "");
    return digits.length >= 9 ? `+${digits}` : null;
  }

  if (phone.startsWith("0")) {
    // National format (Swiss mobile/landline starts with 0)
    const digits = phone.slice(1).replace(/\D/g, "");
    return digits.length >= 8 ? `+41${digits}` : null;
  }

  // No recognisable prefix — reject
  return null;
}

// Send SMS via Twilio
async function sendTwilioSms(
  company: Company,
  toPhone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!company.twilio_enabled || !company.sms_reminders_enabled) {
    return { success: false, error: "SMS not enabled for company" };
  }

  if (!company.twilio_account_sid || !company.twilio_auth_token || !company.twilio_phone_number) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  // Normalise to E.164 — handles Swiss 079/0041 formats and international numbers
  const cleanPhone = normalizePhoneToE164(toPhone);
  if (!cleanPhone) {
    console.log(`[sendTwilioSms] Could not normalise phone number: "${toPhone}" — skipping`);
    return { success: false, error: `Invalid phone format: ${toPhone}` };
  }

  try {
    const auth = btoa(`${company.twilio_account_sid}:${company.twilio_auth_token}`);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${company.twilio_account_sid}/Messages.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: company.twilio_phone_number,
        To: cleanPhone,
        Body: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[sendTwilioSms] Twilio API error:`, errorData);
      return { success: false, error: errorData };
    }

    const result = await response.json();
    console.log(`[sendTwilioSms] SMS sent successfully, SID: ${result.sid}`);
    return { success: true };
  } catch (error) {
    console.error(`[sendTwilioSms] Error sending SMS:`, error);
    return { success: false, error: String(error) };
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[notify-appointment-reminder] Function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const globalResendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Per-company Resend resolution: company key > global server key
    const resolveResend = (company: Company) => {
      const key = (company.resend_enabled && company.resend_api_key) ? company.resend_api_key : globalResendApiKey;
      if (!key) return null;
      const fromName = company.resend_from_name || company.company_name;
      const from = (company.resend_enabled && company.resend_from_email)
        ? `${fromName} <${company.resend_from_email}>`
        : getCalendarFrom();
      return { client: new Resend(key), from };
    };

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    
    // Calculate tomorrow's date for day-before reminders
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    console.log(`[notify-appointment-reminder] Checking appointments for today: ${todayStr}, tomorrow: ${tomorrowStr}`);

    // Get today's appointments that may need reminders (both 2-hour and 1-hour)
    const { data: todayAppointments, error: todayFetchError } = await supabase
      .from("appointments")
      .select(`
        id,
        title,
        appointment_date,
        start_time,
        end_time,
        appointment_type,
        location_address,
        location_plz,
        location_city,
        location_notes,
        customer_first_name,
        customer_last_name,
        customer_email,
        customer_phone,
        reminder_sent_firma,
        reminder_sent_customer,
        company_id
      `)
      .eq("appointment_date", todayStr)
      .in("status", ["pending", "confirmed"]);

    if (todayFetchError) {
      console.error("[notify-appointment-reminder] Error fetching today's appointments:", todayFetchError);
      throw todayFetchError;
    }

    // Get tomorrow's Besichtigung appointments for day-before reminders
    const { data: tomorrowBesichtigungen, error: tomorrowFetchError } = await supabase
      .from("appointments")
      .select(`
        id,
        title,
        appointment_date,
        start_time,
        end_time,
        appointment_type,
        location_address,
        location_plz,
        location_city,
        location_notes,
        customer_first_name,
        customer_last_name,
        customer_email,
        customer_phone,
        reminder_sent_firma,
        reminder_sent_customer,
        company_id
      `)
      .eq("appointment_date", tomorrowStr)
      .eq("appointment_type", "besichtigung")
      .in("status", ["pending", "confirmed"]);

    if (tomorrowFetchError) {
      console.error("[notify-appointment-reminder] Error fetching tomorrow's besichtigungen:", tomorrowFetchError);
      throw tomorrowFetchError;
    }

    // Combine for processing
    const appointments = todayAppointments || [];
    console.log(`[notify-appointment-reminder] Found ${appointments.length} today's appointments, ${tomorrowBesichtigungen?.length || 0} tomorrow's besichtigungen`);

    let remindersSent = 0;

    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "") || getDashAppUrl();
    const siteUrl = getSiteUrl();

    // Process today's appointments (2-hour and 1-hour reminders)
    for (const appointment of appointments as Appointment[]) {
      const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.start_time}`);
      const timeUntilMs = appointmentDateTime.getTime() - now.getTime();
      const hoursUntil = timeUntilMs / (1000 * 60 * 60);

      console.log(`[notify-appointment-reminder] Appointment ${appointment.id}: ${hoursUntil.toFixed(2)} hours until start`);

      // Get company info
      const { data: company } = await supabase
        .from("companies")
        .select("id, company_name, email, notification_email, twilio_enabled, twilio_account_sid, twilio_auth_token, twilio_phone_number, sms_reminders_enabled, resend_enabled, resend_api_key, resend_from_email, resend_from_name")
        .eq("id", appointment.company_id)
        .maybeSingle();

      if (!company) {
        console.error(`[notify-appointment-reminder] Company not found for appointment ${appointment.id}`);
        continue;
      }

      const activeResend = resolveResend(company as Company);
      if (!activeResend) {
        console.error(`[notify-appointment-reminder] No Resend key available for appointment ${appointment.id}`);
        continue;
      }

      const recipientEmail = (company as Company).notification_email || (company as Company).email;
      const appointmentTypeLabel = getAppointmentTypeLabel(appointment.appointment_type);
      const cancelUrl = `${siteUrl}/termin/${appointment.id}/absagen?email=${encodeURIComponent(appointment.customer_email || "")}`;
      const rescheduleUrl = `${siteUrl}/termin/${appointment.id}/verschieben?email=${encodeURIComponent(appointment.customer_email || "")}`;

      // 1-hour reminder with cancel option (between 0.5 and 1.5 hours before)
      if (hoursUntil > 0.5 && hoursUntil <= 1.5) {
        // Check if 1-hour reminder was already sent
        const { data: existingOneHourReminder } = await supabase
          .from("appointment_reminders")
          .select("id")
          .eq("appointment_id", appointment.id)
          .eq("reminder_type", "one_hour")
          .maybeSingle();

        if (!existingOneHourReminder && appointment.customer_email) {
          const timeUntilText = `${Math.round(hoursUntil * 60)} Minuten`;
          const icsContent = generateIcsContent(appointment, company as Company);
          const icsBase64 = stringToBase64(icsContent);

          try {
            await activeResend.client.emails.send({
              from: activeResend.from,
              to: [appointment.customer_email],
              subject: `⏰ Letzte Erinnerung: ${appointment.title} in ${timeUntilText}`,
              html: generateOneHourReminderEmail(appointment, company as Company, timeUntilText, appointmentTypeLabel, cancelUrl, rescheduleUrl),
              attachments: [
                {
                  filename: `termin-${appointment.appointment_date}.ics`,
                  content: icsBase64,
                },
              ],
            });

            console.log(`[notify-appointment-reminder] Sent 1-hour reminder to customer ${maskEmail(appointment.customer_email)}`);

            await supabase.from("appointment_reminders").insert({
              appointment_id: appointment.id,
              recipient_type: "customer",
              recipient_email: appointment.customer_email,
              reminder_type: "one_hour",
              status: "sent",
            });

            remindersSent++;

            // Send SMS reminder if enabled and phone available
            if (appointment.customer_phone && (company as Company).sms_reminders_enabled) {
              const smsMessage = `⏰ Erinnerung: ${appointment.title} in ${timeUntilText}. Ort: ${[appointment.location_address, appointment.location_plz, appointment.location_city].filter(Boolean).join(", ")}. ${(company as Company).company_name}`;
              
              const smsResult = await sendTwilioSms(company as Company, appointment.customer_phone, smsMessage);
              
              await supabase.from("appointment_reminders").insert({
                appointment_id: appointment.id,
                recipient_type: "customer",
                recipient_phone: appointment.customer_phone,
                reminder_type: "one_hour_sms",
                status: smsResult.success ? "sent" : "failed",
                error_message: smsResult.error || null,
              });

              if (smsResult.success) {
                console.log(`[notify-appointment-reminder] Sent 1-hour SMS reminder to ${maskPhone(appointment.customer_phone ?? "")}`);
              }
            }
          } catch (emailError) {
            console.error(`[notify-appointment-reminder] Failed to send 1-hour customer email:`, emailError);
            
            await supabase.from("appointment_reminders").insert({
              appointment_id: appointment.id,
              recipient_type: "customer",
              recipient_email: appointment.customer_email,
              reminder_type: "one_hour",
              status: "failed",
              error_message: String(emailError),
            });
          }
        }
      }

      // 2-hour reminder (between 1.5 and 2.5 hours before, and not already sent)
      if (hoursUntil > 1.5 && hoursUntil <= 2.5 && !appointment.reminder_sent_firma) {
        const timeUntilText = `${Math.round(hoursUntil)} Stunden`;
        const icsContent = generateIcsContent(appointment, company as Company);
        const icsBase64 = stringToBase64(icsContent);

        // Send reminder to firma
        try {
          await activeResend.client.emails.send({
            from: activeResend.from,
            to: [recipientEmail],
            subject: `⏰ Erinnerung: ${appointment.title} in ${timeUntilText}`,
            html: generateFirmaReminderEmail(appointment, company as Company, timeUntilText, appointmentTypeLabel),
            attachments: [
              {
                filename: `termin-${appointment.appointment_date}.ics`,
                content: icsBase64,
              },
            ],
          });

          console.log(`[notify-appointment-reminder] Sent reminder to firma ${recipientEmail} for appointment ${appointment.id}`);

          await supabase.from("appointment_reminders").insert({
            appointment_id: appointment.id,
            recipient_type: "firma",
            recipient_email: recipientEmail,
            reminder_type: "email",
            status: "sent",
          });
        } catch (emailError) {
          console.error(`[notify-appointment-reminder] Failed to send firma email:`, emailError);
          
          await supabase.from("appointment_reminders").insert({
            appointment_id: appointment.id,
            recipient_type: "firma",
            recipient_email: recipientEmail,
            reminder_type: "email",
            status: "failed",
            error_message: String(emailError),
          });
        }

        // Send reminder to customer if email available
        if (appointment.customer_email && !appointment.reminder_sent_customer) {
          try {
            await activeResend.client.emails.send({
              from: activeResend.from,
              to: [appointment.customer_email],
              subject: `⏰ Termin-Erinnerung: ${appointment.title} in ${timeUntilText}`,
              html: generateCustomerReminderEmail(appointment, company as Company, timeUntilText, appointmentTypeLabel),
              attachments: [
                {
                  filename: `termin-${appointment.appointment_date}.ics`,
                  content: icsBase64,
                },
              ],
            });

            console.log(`[notify-appointment-reminder] Sent reminder to customer ${maskEmail(appointment.customer_email)}`);

            await supabase.from("appointment_reminders").insert({
              appointment_id: appointment.id,
              recipient_type: "customer",
              recipient_email: appointment.customer_email,
              reminder_type: "email",
              status: "sent",
            });
          } catch (emailError) {
            console.error(`[notify-appointment-reminder] Failed to send customer email:`, emailError);
          }
        }

        // Send 2-hour SMS independently of email success/failure.
        // Uses appointment_reminders for deduplication so it can be retried
        // if the cron re-runs before the flag update below.
        if (appointment.customer_phone && (company as Company).sms_reminders_enabled) {
          const { data: existingTwoHourSms } = await supabase
            .from("appointment_reminders")
            .select("id")
            .eq("appointment_id", appointment.id)
            .eq("reminder_type", "two_hour_sms")
            .maybeSingle();

          if (!existingTwoHourSms) {
            const smsMessage = `Erinnerung: ${appointment.title} in ${timeUntilText}. ${formatDate(appointment.appointment_date)} um ${appointment.start_time.substring(0, 5)} Uhr. ${(company as Company).company_name}`;
            const smsResult = await sendTwilioSms(company as Company, appointment.customer_phone, smsMessage);

            await supabase.from("appointment_reminders").insert({
              appointment_id: appointment.id,
              recipient_type: "customer",
              recipient_phone: appointment.customer_phone,
              reminder_type: "two_hour_sms",
              status: smsResult.success ? "sent" : "failed",
              error_message: smsResult.error || null,
            });

            if (smsResult.success) {
              console.log(`[notify-appointment-reminder] Sent 2-hour SMS reminder to ${maskPhone(appointment.customer_phone ?? "")}`);
            }
          }
        }

        // Update appointment reminder flags
        await supabase
          .from("appointments")
          .update({
            reminder_sent_firma: true,
            reminder_sent_customer: !!appointment.customer_email,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", appointment.id);

        remindersSent++;
      }
    }

    // Process tomorrow's Besichtigung appointments (day-before reminders)
    for (const appointment of (tomorrowBesichtigungen || []) as Appointment[]) {
      // Check if day-before reminders were already sent for BOTH firma and customer
      const { data: existingFirmaReminder } = await supabase
        .from("appointment_reminders")
        .select("id")
        .eq("appointment_id", appointment.id)
        .eq("reminder_type", "day_before")
        .eq("recipient_type", "firma")
        .maybeSingle();

      const { data: existingCustomerReminder } = await supabase
        .from("appointment_reminders")
        .select("id")
        .eq("appointment_id", appointment.id)
        .eq("reminder_type", "day_before")
        .eq("recipient_type", "customer")
        .maybeSingle();

      // Skip if both reminders are already sent
      if (existingFirmaReminder && (existingCustomerReminder || !appointment.customer_email)) {
        console.log(`[notify-appointment-reminder] Day-before reminders already sent for ${appointment.id}`);
        continue;
      }

      // Get company info
      const { data: company } = await supabase
        .from("companies")
        .select("id, company_name, email, notification_email, twilio_enabled, twilio_account_sid, twilio_auth_token, twilio_phone_number, sms_reminders_enabled, resend_enabled, resend_api_key, resend_from_email, resend_from_name")
        .eq("id", appointment.company_id)
        .single();

      if (!company) {
        console.error(`[notify-appointment-reminder] Company not found for appointment ${appointment.id}`);
        continue;
      }

      const activeResend2 = resolveResend(company as Company);
      if (!activeResend2) {
        console.error(`[notify-appointment-reminder] No Resend key for tomorrow besichtigung ${appointment.id}`);
        continue;
      }

      const recipientEmail = (company as Company).notification_email || (company as Company).email;
      const icsContent = generateIcsContent(appointment, company as Company);
      const icsBase64 = stringToBase64(icsContent);

      // Send day-before reminder to firma (only if not already sent)
      if (!existingFirmaReminder) {
        try {
          await activeResend2.client.emails.send({
            from: activeResend2.from,
            to: [recipientEmail],
            subject: `📅 Morgen: Besichtigung "${appointment.title}"`,
            html: generateDayBeforeReminderEmail(appointment, company as Company, "firma"),
            attachments: [
              {
                filename: `termin-${appointment.appointment_date}.ics`,
                content: icsBase64,
              },
            ],
          });

          console.log(`[notify-appointment-reminder] Sent day-before reminder to firma ${recipientEmail}`);

          await supabase.from("appointment_reminders").insert({
            appointment_id: appointment.id,
            recipient_type: "firma",
            recipient_email: recipientEmail,
            reminder_type: "day_before",
            status: "sent",
          });
          
          remindersSent++;
        } catch (emailError) {
          console.error(`[notify-appointment-reminder] Failed to send day-before firma email:`, emailError);
          
          await supabase.from("appointment_reminders").insert({
            appointment_id: appointment.id,
            recipient_type: "firma",
            recipient_email: recipientEmail,
            reminder_type: "day_before",
            status: "failed",
            error_message: String(emailError),
          });
        }
      }

      // Send day-before reminder to customer if email available and not already sent
      if (appointment.customer_email && !existingCustomerReminder) {
        try {
          await activeResend2.client.emails.send({
            from: activeResend2.from,
            to: [appointment.customer_email],
            subject: `📅 Erinnerung: Ihre Besichtigung ist morgen`,
            html: generateDayBeforeReminderEmail(appointment, company as Company, "customer"),
            attachments: [
              {
                filename: `termin-${appointment.appointment_date}.ics`,
                content: icsBase64,
              },
            ],
          });

          console.log(`[notify-appointment-reminder] Sent day-before reminder to customer ${maskEmail(appointment.customer_email)}`);

          await supabase.from("appointment_reminders").insert({
            appointment_id: appointment.id,
            recipient_type: "customer",
            recipient_email: appointment.customer_email,
            reminder_type: "day_before",
            status: "sent",
          });
          
          remindersSent++;

          // Send SMS reminder if enabled and phone available
          if (appointment.customer_phone && (company as Company).sms_reminders_enabled) {
            const smsMessage = `📅 Erinnerung: ${appointment.title} ist morgen um ${appointment.start_time.substring(0, 5)} Uhr. ${[appointment.location_address, appointment.location_plz, appointment.location_city].filter(Boolean).join(", ")}. ${(company as Company).company_name}`;
            
            const smsResult = await sendTwilioSms(company as Company, appointment.customer_phone, smsMessage);
            
            await supabase.from("appointment_reminders").insert({
              appointment_id: appointment.id,
              recipient_type: "customer",
              recipient_phone: appointment.customer_phone,
              reminder_type: "day_before_sms",
              status: smsResult.success ? "sent" : "failed",
              error_message: smsResult.error || null,
            });

            if (smsResult.success) {
              console.log(`[notify-appointment-reminder] Sent day-before SMS reminder to ${maskPhone(appointment.customer_phone ?? "")}`);
            }
          }
        } catch (emailError) {
          console.error(`[notify-appointment-reminder] Failed to send day-before customer email:`, emailError);
        }
      }
    }

    console.log(`[notify-appointment-reminder] Sent ${remindersSent} reminders total`);

    return new Response(
      JSON.stringify({ success: true, remindersSent }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[notify-appointment-reminder] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

function getAppointmentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    besichtigung: "Besichtigung",
    service: "Auftrag",
    follow_up: "Nachkontrolle",
    meeting: "Besprechung",
    blocked: "Blockiert",
  };
  return labels[type] || type;
}

function formatTime(time: string): string {
  return time.substring(0, 5);
}

function generateDayBeforeReminderEmail(
  appointment: Appointment,
  company: Company,
  recipientType: "firma" | "customer"
): string {
  const isFirma = recipientType === "firma";
  const headerColor = isFirma ? "#3B82F6, #1D4ED8" : "#8B5CF6, #6D28D9";
  const accentColor = isFirma ? "#3B82F6" : "#8B5CF6";
  
  const greeting = isFirma 
    ? `Guten Tag,` 
    : `Guten Tag ${appointment.customer_first_name} ${appointment.customer_last_name},`;
  
  const intro = isFirma
    ? `Morgen findet eine Besichtigung statt. Hier sind die Details:`
    : `dies ist eine freundliche Erinnerung an Ihre Besichtigung morgen:`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8; }
        .header { background: linear-gradient(135deg, ${headerColor}); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${accentColor}; }
        .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
        .value { font-size: 16px; font-weight: 600; }
        .highlight-box { background: #FEF3C7; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid #F59E0B; }
        .customer-box { background: #EFF6FF; padding: 15px; border-radius: 8px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">📅 Besichtigung morgen</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Erinnerung für den morgigen Termin</p>
        </div>
        <div class="content">
          <p>${greeting}</p>
          <p>${intro}</p>
          
          <div class="info-box">
            <h2 style="margin: 0 0 15px; color: #1f2937;">${appointment.title}</h2>
            <div style="display: grid; gap: 15px;">
              <div class="highlight-box">
                <div class="label">📅 Datum & Uhrzeit</div>
                <div class="value" style="font-size: 18px;">${formatDate(appointment.appointment_date)}</div>
                <div class="value" style="color: ${accentColor};">${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)} Uhr</div>
              </div>
              ${appointment.location_address ? `
              <div>
                <div class="label">📍 Adresse</div>
                <div class="value">${appointment.location_address}<br>${appointment.location_plz} ${appointment.location_city}</div>
              </div>
              ` : ""}
              ${appointment.location_notes ? `
              <div>
                <div class="label">ℹ️ Hinweis</div>
                <div class="value" style="color: ${accentColor};">${appointment.location_notes}</div>
              </div>
              ` : ""}
            </div>
            
            ${isFirma && appointment.customer_first_name ? `
            <div class="customer-box">
              <div class="label">👤 Kunde</div>
              <div class="value">${appointment.customer_first_name} ${appointment.customer_last_name}</div>
              ${appointment.customer_phone ? `<div style="margin-top: 5px;">📞 <a href="tel:${appointment.customer_phone}" style="color: ${accentColor};">${appointment.customer_phone}</a></div>` : ""}
              ${appointment.customer_email ? `<div>✉️ <a href="mailto:${appointment.customer_email}" style="color: ${accentColor};">${appointment.customer_email}</a></div>` : ""}
            </div>
            ` : ""}
            
            ${!isFirma ? `
            <div class="customer-box">
              <div class="label">🏢 Firma</div>
              <div class="value">${company.company_name}</div>
            </div>
            ` : ""}
          </div>
          
          <div style="background: #DBEAFE; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #1E40AF;">
              ${isFirma 
                ? "💡 <strong>Tipp:</strong> Stellen Sie sicher, dass Sie alle notwendigen Unterlagen und Materialien für die Besichtigung vorbereitet haben."
                : "💡 <strong>Tipp:</strong> Halten Sie bitte relevante Unterlagen bereit und stellen Sie sicher, dass der Zugang zum Objekt gewährleistet ist."}
            </p>
          </div>
          
          <div class="footer">
            <p>Diese Erinnerung wurde automatisch versendet.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateOneHourReminderEmail(
  appointment: Appointment,
  company: Company,
  timeUntil: string,
  appointmentType: string,
  cancelUrl: string,
  rescheduleUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8; }
        .header { background: linear-gradient(135deg, #F59E0B, #D97706); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B; }
        .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
        .value { font-size: 16px; font-weight: 600; }
        .company-box { background: #FEF3C7; padding: 15px; border-radius: 8px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .action-section { background: #F3F4F6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .action-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .cancel-btn { display: inline-block; background: #EF4444; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .reschedule-btn { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">⏰ Letzte Erinnerung</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Ihr Termin beginnt in ${timeUntil}</p>
        </div>
        <div class="content">
          <p>Guten Tag ${appointment.customer_first_name} ${appointment.customer_last_name},</p>
          <p>Ihr Termin beginnt in Kürze. Bitte stellen Sie sicher, dass Sie bereit sind.</p>
          
          <div class="info-box">
            <h2 style="margin: 0 0 15px; color: #1f2937;">${appointment.title}</h2>
            <div style="display: grid; gap: 15px;">
              <div>
                <div class="label">Typ</div>
                <div class="value">${appointmentType}</div>
              </div>
              <div>
                <div class="label">Datum & Uhrzeit</div>
                <div class="value">${formatDate(appointment.appointment_date)} • ${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}</div>
              </div>
              ${appointment.location_address ? `
              <div>
                <div class="label">Adresse</div>
                <div class="value">${appointment.location_address}<br>${appointment.location_plz} ${appointment.location_city}</div>
              </div>
              ` : ""}
            </div>
            
            <div class="company-box">
              <div class="label">Firma</div>
              <div class="value">${company.company_name}</div>
            </div>
          </div>
          
          <div class="action-section">
            <p style="margin: 0 0 15px; color: #374151; font-weight: 600;">Können Sie den Termin nicht wahrnehmen?</p>
            <div class="action-btns">
              <a href="${rescheduleUrl}" class="reschedule-btn">📅 Termin verschieben</a>
              <a href="${cancelUrl}" class="cancel-btn">❌ Termin absagen</a>
            </div>
            <p style="margin: 15px 0 0; font-size: 12px; color: #6B7280;">Die Firma wird automatisch benachrichtigt.</p>
          </div>
          
          <div class="footer">
            <p>Diese Erinnerung wurde automatisch versendet.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateFirmaReminderEmail(
  appointment: Appointment,
  company: Company,
  timeUntil: string,
  appointmentType: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8; }
        .header { background: linear-gradient(135deg, #3B82F6, #1D4ED8); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3B82F6; }
        .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
        .value { font-size: 16px; font-weight: 600; }
        .customer-box { background: #EFF6FF; padding: 15px; border-radius: 8px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">⏰ Termin-Erinnerung</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">In ${timeUntil} beginnt Ihr Termin</p>
        </div>
        <div class="content">
          <div class="info-box">
            <h2 style="margin: 0 0 15px; color: #1f2937;">${appointment.title}</h2>
            <div style="display: grid; gap: 15px;">
              <div>
                <div class="label">Typ</div>
                <div class="value">${appointmentType}</div>
              </div>
              <div>
                <div class="label">Datum & Uhrzeit</div>
                <div class="value">${formatDate(appointment.appointment_date)} • ${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}</div>
              </div>
              ${appointment.location_address ? `
              <div>
                <div class="label">Adresse</div>
                <div class="value">${appointment.location_address}<br>${appointment.location_plz} ${appointment.location_city}</div>
              </div>
              ` : ""}
              ${appointment.location_notes ? `
              <div>
                <div class="label">Hinweis</div>
                <div class="value" style="color: #3B82F6;">ℹ️ ${appointment.location_notes}</div>
              </div>
              ` : ""}
            </div>
            
            ${appointment.customer_first_name ? `
            <div class="customer-box">
              <div class="label">Kunde</div>
              <div class="value">${appointment.customer_first_name} ${appointment.customer_last_name}</div>
              ${appointment.customer_phone ? `<div style="margin-top: 5px;">📞 ${appointment.customer_phone}</div>` : ""}
              ${appointment.customer_email ? `<div>✉️ ${appointment.customer_email}</div>` : ""}
            </div>
            ` : ""}
          </div>
          
          <div class="footer">
            <p>Diese Erinnerung wurde automatisch versendet.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCustomerReminderEmail(
  appointment: Appointment,
  company: Company,
  timeUntil: string,
  appointmentType: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8; }
        .header { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981; }
        .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
        .value { font-size: 16px; font-weight: 600; }
        .company-box { background: #ECFDF5; padding: 15px; border-radius: 8px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">⏰ Termin-Erinnerung</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Ihr Termin beginnt in ${timeUntil}</p>
        </div>
        <div class="content">
          <p>Guten Tag ${appointment.customer_first_name} ${appointment.customer_last_name},</p>
          <p>dies ist eine freundliche Erinnerung an Ihren bevorstehenden Termin:</p>
          
          <div class="info-box">
            <h2 style="margin: 0 0 15px; color: #1f2937;">${appointment.title}</h2>
            <div style="display: grid; gap: 15px;">
              <div>
                <div class="label">Typ</div>
                <div class="value">${appointmentType}</div>
              </div>
              <div>
                <div class="label">Datum & Uhrzeit</div>
                <div class="value">${formatDate(appointment.appointment_date)} • ${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}</div>
              </div>
              ${appointment.location_address ? `
              <div>
                <div class="label">Adresse</div>
                <div class="value">${appointment.location_address}<br>${appointment.location_plz} ${appointment.location_city}</div>
              </div>
              ` : ""}
            </div>
            
            <div class="company-box">
              <div class="label">Firma</div>
              <div class="value">${company.company_name}</div>
            </div>
          </div>
          
          <div class="footer">
            <p>Bei Fragen wenden Sie sich bitte direkt an die Firma.</p>
            <p style="margin-top: 20px; font-size: 12px;">Diese Erinnerung wurde automatisch versendet.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

serve(handler);
