import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { buildCompanyLeadNotificationEmail } from "../_shared/emailTemplates.ts";
import { logEmail } from "../_shared/logEmail.ts";
import { getServiceDisplayLabel } from "../_shared/serviceLabels.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod Schema für Input-Validierung
const NotifyRequestSchema = z.object({
  leadId: z.string().uuid("Ungültige Lead-ID"),
});

interface CompanyMatch {
  company_id: string;
  company_name: string;
  email: string;
  notification_email: string | null;
  distance_km: number | null;
  coverage_plz: string;
  coverage_radius_km: number;
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Service labels now imported from shared module: getServiceDisplayLabel

// Simple rate limiting to prevent abuse (per leadId)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 300000; // 5 minutes
const RATE_LIMIT_MAX_REQUESTS = 2; // Max 2 notifications per lead per 5 minutes

const isRateLimited = (leadId: string): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(leadId);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(leadId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  
  record.count++;
  return false;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("notify-companies function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify caller is an admin or internal service
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    const providedSecret = req.headers.get("x-internal-secret");
    const isInternalCall = internalSecret && providedSecret && providedSecret === internalSecret;

    if (!isInternalCall) {
      const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Authorization required" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const token = authHeader.replace("Bearer ", "").replace("bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if user is admin/moderator
      const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
      const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: user.id });
      
      if (!isAdmin && !isStaff) {
        console.warn("notify-companies: Non-admin access attempt", { userId: user.id });
        return new Response(
          JSON.stringify({ error: "Admin or staff access required" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("notify-companies: Authorized admin/staff user", { userId: user.id });
    } else {
      console.log("notify-companies: Internal service call");
    }

    const rawBody = await req.json();
    
    // Validiere Input mit Zod
    const parseResult = NotifyRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("notify-companies: Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { leadId } = parseResult.data;
    
    // Rate limit check to prevent repeated notifications
    if (isRateLimited(leadId)) {
      console.warn("notify-companies: Rate limit exceeded for lead:", leadId);
      return new Response(
        JSON.stringify({ error: "Notifications already sent for this lead" }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    console.log("Processing lead:", leadId);

    // Fetch the lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      console.error("Error fetching lead:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Lead found:", lead.slug, "Service:", lead.service_type, "PLZ:", lead.from_plz, "Max companies:", lead.max_companies);

    // Use the database function to find matching companies with precise distance calculation
    const { data: matchingCompanies, error: matchError } = await supabase
      .rpc("find_companies_in_radius", {
        target_plz: lead.from_plz,
        service_type_filter: lead.service_type,
        max_results: lead.max_companies * 2,
      });

    if (matchError) {
      console.error("Error finding companies:", matchError);
      throw new Error("Error finding matching companies");
    }

    console.log("Matching companies found:", matchingCompanies?.length || 0);

    if (!matchingCompanies || matchingCompanies.length === 0) {
      console.log("No companies match the criteria");
      return new Response(
        JSON.stringify({ success: true, message: "No matching companies found", notified: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sort by distance (exact matches first, then by distance)
    const sortedCompanies = [...matchingCompanies].sort((a, b) => {
      if (a.distance_km === 0 && b.distance_km !== 0) return -1;
      if (a.distance_km !== 0 && b.distance_km === 0) return 1;
      return (a.distance_km || 999) - (b.distance_km || 999);
    });

    // Group by match type for fair distribution
    const exactMatches = shuffleArray(sortedCompanies.filter(c => c.distance_km === 0));
    const radiusMatches = shuffleArray(sortedCompanies.filter(c => c.distance_km !== null && c.distance_km > 0));
    
    // Combine and limit to max_companies
    const prioritizedCompanies = [...exactMatches, ...radiusMatches];
    const selectedCompanies = prioritizedCompanies.slice(0, lead.max_companies);

    console.log(`Selected ${selectedCompanies.length} companies (max: ${lead.max_companies})`);
    console.log("Selected companies:", selectedCompanies.map(c => 
      `${c.company_name} (${c.distance_km === 0 ? 'exact' : c.distance_km?.toFixed(1) + 'km'})`
    ).join(", "));

    // Check for existing distributions to avoid duplicates
    const { data: existingDists } = await supabase
      .from("lead_distributions")
      .select("company_id")
      .eq("lead_id", leadId);

    const alreadyDistributed = new Set((existingDists || []).map((d: { company_id: string }) => d.company_id));
    const newCompanies = selectedCompanies.filter((c: CompanyMatch) => !alreadyDistributed.has(c.company_id));

    if (newCompanies.length === 0) {
      console.log("notify-companies: all selected companies already received this lead");
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: "Lead already distributed to all selected companies" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create lead distributions for new companies only
    const distributions = newCompanies.map((company: CompanyMatch) => ({
      lead_id: leadId,
      company_id: company.company_id,
      status: "pending",
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      token_cost: lead.token_cost || 10,
    }));

    const { error: distributionError } = await supabase
      .from("lead_distributions")
      .insert(distributions);

    if (distributionError) {
      console.error("Error creating distributions:", distributionError);
      throw new Error("Error creating lead distributions");
    }

    console.log("Lead distributions created:", distributions.length);

    // Create in-app notifications for matched companies
    // Use the global getServiceDisplayLabel function for proper display names
    const serviceLabel = getServiceDisplayLabel(lead.service_type);
    const locationInfo = lead.to_city 
      ? `von ${lead.from_city} nach ${lead.to_city}` 
      : `in ${lead.from_city}`;

    const notifications = newCompanies.map((company: CompanyMatch) => ({
      company_id: company.company_id,
      type: "new_lead",
      title: `📥 Neue Anfrage: ${serviceLabel}`,
      body: `Sie haben eine neue ${serviceLabel}-Anfrage ${locationInfo} erhalten. Kosten: ${lead.token_cost || 10} Tokens`,
      metadata: {
        lead_id: leadId,
        service_type: lead.service_type,
        from_city: lead.from_city,
        to_city: lead.to_city,
        token_cost: lead.token_cost || 10,
      },
      read: false,
    }));

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (notificationError) {
      console.error("Error creating notifications (non-fatal):", notificationError);
    } else {
      console.log(`Created ${notifications.length} in-app notifications`);
    }

    // Send emails if Resend API key is configured
    let emailsSent = 0;
    
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      const emailPromises = newCompanies.map(async (company: CompanyMatch) => {
        const recipientEmail = company.notification_email || company.email;
        
        try {
          const distanceText = company.distance_km === 0 
            ? "Exakter PLZ-Treffer" 
            : `${company.distance_km?.toFixed(1)} km Entfernung`;

          const instLabels: Record<string, string> = {
            "klavier": "Klavier (aufrecht)",
            "flügel-klein": "Flügel (klein)",
            "flügel-gross": "Flügel (gross)",
            "sonstiges": "Sonstiges",
          };
          const dfd = lead.detailed_form_data as Record<string, unknown> | null;
          const instrumentType =
            lead.service_type === "klaviertransport" && dfd?.inst
              ? (instLabels[dfd.inst as string] ?? String(dfd.inst))
              : undefined;

          const html = buildCompanyLeadNotificationEmail({
            companyName: company.company_name,
            serviceLabel: getServiceDisplayLabel(lead.service_type),
            locationInfo: `in ${lead.from_city}`,
            distanceText,
            tokenCost: 0,
            dashboardUrl: "https://dash.offerio.ch/firma/anfragen",
            acceptUrl: "",
            lead: {
              from_plz: lead.from_plz,
              from_city: lead.from_city,
              to_plz: lead.to_plz ?? undefined,
              to_city: lead.to_city ?? undefined,
              preferred_date: lead.preferred_date ?? undefined,
              from_rooms: lead.from_rooms ?? undefined,
              from_living_space_m2: lead.from_living_space_m2 ?? undefined,
              instrument_type: instrumentType,
            },
            estimatedJobPrice: { min_price: 0, max_price: 0 },
            simpleNotify: true,
          });

          const emailResponse = await resend.emails.send({
            from: "Offerio <noreply@offerio.ch>",
            to: [recipientEmail],
            subject: `Neue Anfrage: ${getServiceDisplayLabel(lead.service_type)} in ${lead.from_city}`,
            html,
          });
          
          console.log(`Email sent to ${recipientEmail}:`, emailResponse);
          
          await logEmail({
            recipientEmail,
            recipientName: company.company_name,
            subject: `Neue Anfrage: ${getServiceDisplayLabel(lead.service_type)} in ${lead.from_city}`,
            emailType: "lead_notification",
            status: "sent",
            companyId: company.company_id,
            leadId: leadId,
            metadata: { serviceType: lead.service_type, fromCity: lead.from_city, distance: company.distance_km },
          });
          
          return { success: true, email: recipientEmail };
        } catch (emailError) {
          console.error(`Failed to send email to ${recipientEmail}:`, emailError);
          
          await logEmail({
            recipientEmail,
            recipientName: company.company_name,
            subject: `Neue Anfrage: ${getServiceDisplayLabel(lead.service_type)} in ${lead.from_city}`,
            emailType: "lead_notification",
            status: "failed",
            errorMessage: emailError instanceof Error ? emailError.message : "Unknown error",
            companyId: company.company_id,
            leadId: leadId,
          });
          
          return { success: false, email: recipientEmail, error: emailError };
        }
      });

      const emailResults = await Promise.all(emailPromises);
      emailsSent = emailResults.filter((r) => r.success).length;
      
      console.log(`Emails sent: ${emailsSent}/${newCompanies.length}`);
    } else {
      console.log("RESEND_API_KEY not configured - skipping email notifications");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: newCompanies.length,
        skipped_duplicates: alreadyDistributed.size,
        maxCompanies: lead.max_companies,
        matchBreakdown: {
          exact: newCompanies.filter((c: CompanyMatch) => c.distance_km === 0).length,
          radius: newCompanies.filter((c: CompanyMatch) => c.distance_km !== null && c.distance_km > 0).length,
        },
        distances: newCompanies.map((c: CompanyMatch) => ({
          company: c.company_name,
          distance_km: c.distance_km,
        })),
        emailsSent,
        message: resendApiKey ? undefined : "Distributions created, emails disabled (no RESEND_API_KEY)" 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-companies function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
