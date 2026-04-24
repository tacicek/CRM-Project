/**
 * n8n → Offerio Webhook Handler
 * 
 * Receives AI voice conversation data from n8n (originally from Vapi.ai)
 * Flow: Vapi.ai → n8n (transform) → This webhook → Supabase
 * 
 * n8n is responsible for:
 * - Receiving raw Vapi.ai data
 * - Transforming to Offerio JSON format
 * - Sending to this webhook
 * 
 * Swiss-specific validations:
 * - PLZ: 4-digit (1000-9999)
 * - Phone: +41 format or international
 * - Language: German (Swiss German dialect aware)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import {
  EMAIL_BODY_PADDING,
  EMAIL_CARD_OUTER,
  EMAIL_HEADER_BAND,
  wrapEmailDocument,
} from "../_shared/emailLayout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-signature, x-webhook-secret",
};

// Swiss PLZ validation (4 digits, 1000-9999)
const swissPlzRegex = /^[1-9][0-9]{3}$/;

// Phone validation (Swiss +41 or international format)
const phoneRegex = /^\+[1-9][0-9]{7,14}$/;

/**
 * n8n Payload Schema
 * This is the format n8n should send after transforming Vapi.ai data
 * 
 * n8n Workflow Example:
 * 1. Vapi.ai Webhook Trigger
 * 2. Set Node (transform data to this format)
 * 3. HTTP Request to Offerio webhook
 */
const N8nPayloadSchema = z.object({
  // === METADATA (from n8n/Vapi) ===
  source: z.literal("ai_voice").default("ai_voice"),
  vapi_call_id: z.string().optional(),
  n8n_execution_id: z.string().optional(),
  
  // === SERVICE TYPE ===
  service_type: z.string().default("umzug"),
  
  // === FROM ADDRESS (Auszug) ===
  from_plz: z.string().regex(swissPlzRegex, "Ungültige PLZ"),
  from_city: z.string().min(1),
  from_street: z.string().optional().nullable(),
  from_house_number: z.string().optional().nullable(),
  from_floor: z.number().int().min(0).optional().nullable(),
  from_has_lift: z.boolean().optional().default(false),
  
  // === TO ADDRESS (Einzug) - optional ===
  to_plz: z.string().regex(swissPlzRegex).optional().nullable(),
  to_city: z.string().optional().nullable(),
  to_street: z.string().optional().nullable(),
  to_house_number: z.string().optional().nullable(),
  to_floor: z.number().int().min(0).optional().nullable(),
  to_has_lift: z.boolean().optional().default(false),
  
  // === PROPERTY DETAILS ===
  from_rooms: z.number().positive().optional().nullable(),
  from_living_space_m2: z.number().positive().optional().nullable(),
  
  // === DATE & TIME ===
  preferred_date: z.string().optional().nullable(), // YYYY-MM-DD or ISO
  preferred_time: z.string().optional().nullable(),
  flexibility: z.string().optional().nullable(), // "flexibel", "fix", etc.
  
  // === CUSTOMER INFO ===
  customer_first_name: z.string().min(1),
  customer_last_name: z.string().optional().default(""),
  customer_phone: z.string().regex(phoneRegex, "Ungültige Telefonnummer"),
  customer_email: z.string().email(),
  
  // === ADDITIONAL SERVICES ===
  packing_service_needed: z.boolean().optional().default(false),
  cleaning_service_needed: z.boolean().optional().default(false),
  storage_needed: z.boolean().optional().default(false),
  piano_transport_needed: z.boolean().optional().default(false),
  furniture_assembly_needed: z.boolean().optional().default(false),
  
  // === AI CONVERSATION DATA ===
  conversation_transcript: z.string().optional().nullable(),
  conversation_duration: z.number().optional().nullable(), // seconds
  ai_confidence_score: z.number().min(0).max(100).optional().nullable(),
  
  // === NOTES ===
  special_requirements: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  
  // === EXTRA DATA (flexible) ===
  extra_data: z.record(z.unknown()).optional(),
});

type N8nPayload = z.infer<typeof N8nPayloadSchema>;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[n8n-webhook] ${step}${detailsStr}`);
};

/**
 * Calculate lead score based on completeness and quality
 * Score: 0-100
 */
function calculateLeadScore(data: N8nPayload): number {
  let score = 0;
  
  // === COMPLETENESS (40 points max) ===
  // Address completeness
  if (data.from_street) score += 5;
  if (data.to_street) score += 5;
  if (data.to_plz && data.to_city) score += 10;
  
  // Conversation quality
  if (data.conversation_duration && data.conversation_duration > 60) score += 5;
  if (data.conversation_duration && data.conversation_duration > 120) score += 5;
  if (data.conversation_duration && data.conversation_duration > 180) score += 5;
  if (data.ai_confidence_score && data.ai_confidence_score > 80) score += 5;
  
  // === QUALITY (40 points max) ===
  // Property details
  if (data.from_living_space_m2 && data.from_living_space_m2 > 0) score += 10;
  if (data.from_rooms && data.from_rooms > 0) score += 10;
  
  // Contact quality
  if (data.customer_email) score += 5;
  if (data.customer_phone) score += 5;
  if (data.customer_first_name && data.customer_last_name) score += 5;
  if (data.special_requirements && data.special_requirements.length > 20) score += 5;
  
  // === URGENCY (20 points max) ===
  if (data.preferred_date) {
    const movingDate = new Date(data.preferred_date);
    const today = new Date();
    const daysUntilMove = Math.floor(
      (movingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilMove <= 7) score += 20;      // Very urgent
    else if (daysUntilMove <= 14) score += 15; // Urgent
    else if (daysUntilMove <= 30) score += 10; // Normal
    else if (daysUntilMove <= 60) score += 5;  // Not urgent
  }
  
  return Math.min(score, 100);
}

/**
 * Verify webhook secret from n8n
 * Simple bearer token or shared secret verification
 */
function verifyN8nSecret(req: Request): boolean {
  const webhookSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
  
  // If no secret configured, allow all (for development)
  if (!webhookSecret) {
    logStep("Warning: N8N_WEBHOOK_SECRET not configured, allowing request");
    return true;
  }
  
  // Check x-webhook-secret header
  const headerSecret = req.headers.get("x-webhook-secret");
  if (headerSecret === webhookSecret) return true;
  
  // Check Authorization bearer token
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === webhookSecret) return true;
  }
  
  return false;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    logStep("Received webhook request from n8n", { bodyLength: rawBody.length });

    // 1. Verify n8n webhook secret
    if (!verifyN8nSecret(req)) {
      logStep("Invalid n8n secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid webhook secret" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    logStep("n8n authentication verified");

    // 2. Parse and validate payload
    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Ungültiges JSON-Format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parseResult = N8nPayloadSchema.safeParse(data);
    
    if (!parseResult.success) {
      logStep("Validation error", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Validierungsfehler",
          details: parseResult.error.flatten().fieldErrors,
          expected_format: {
            service_type: "umzug | reinigung | raeumung | ...",
            from_plz: "4-digit Swiss PLZ (e.g., 8001)",
            from_city: "City name",
            customer_first_name: "First name",
            customer_phone: "+41... format",
            customer_email: "email@example.com",
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = parseResult.data;
    logStep("Payload validated", { 
      service_type: payload.service_type, 
      customer: payload.customer_email,
      n8n_execution: payload.n8n_execution_id 
    });

    // 3. Calculate lead score
    const leadScore = calculateLeadScore(payload);
    logStep("Lead score calculated", { score: leadScore });

    // 4. Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Insert lead into database
    const leadData = {
      // Service type
      service_type: payload.service_type,
      
      // From address (Auszug)
      from_plz: payload.from_plz,
      from_city: payload.from_city,
      from_street: payload.from_street || null,
      from_house_number: payload.from_house_number || null,
      from_floor: payload.from_floor ?? null,
      from_has_lift: payload.from_has_lift ?? false,
      
      // To address (Einzug)
      to_plz: payload.to_plz || null,
      to_city: payload.to_city || null,
      to_street: payload.to_street || null,
      to_house_number: payload.to_house_number || null,
      to_floor: payload.to_floor ?? null,
      to_has_lift: payload.to_has_lift ?? false,
      
      // Property details
      from_living_space_m2: payload.from_living_space_m2 || null,
      from_rooms: payload.from_rooms || null,
      
      // Date & time
      preferred_date: payload.preferred_date || null,
      preferred_time: payload.preferred_time || null,
      
      // Customer
      customer_first_name: payload.customer_first_name,
      customer_last_name: payload.customer_last_name || "",
      customer_phone: payload.customer_phone,
      customer_email: payload.customer_email,
      
      // Additional services
      packing_service_needed: payload.packing_service_needed || false,
      cleaning_service_needed: payload.cleaning_service_needed || false,
      storage_needed: payload.storage_needed || false,
      piano_transport_needed: payload.piano_transport_needed || false,
      
      // AI voice specific
      source: 'ai_voice',
      conversation_transcript: payload.conversation_transcript || null,
      conversation_duration: payload.conversation_duration || null,
      lead_score: leadScore,
      ai_confidence_score: payload.ai_confidence_score || null,
      vapi_call_id: payload.vapi_call_id || null,
      
      // Special notes
      special_requirements: payload.special_requirements || null,
      
      // Status
      status: "pending_verification",
    };

    const { data: insertedLead, error: insertError } = await supabase
      .from("leads")
      .insert(leadData)
      .select()
      .single();

    if (insertError) {
      logStep("Insert error", insertError);
      return new Response(
        JSON.stringify({ error: "Fehler beim Speichern", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Lead created", { leadId: insertedLead.id, slug: insertedLead.slug });

    // 6. Send customer confirmation email (async, don't block)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      Promise.resolve().then(async () => {
        try {
          const resend = new Resend(resendApiKey);
          
          const serviceLabels: Record<string, string> = {
            umzug: "Umzug",
            umzug_privat: "Privater Umzug",
            umzug_firma: "Firmenumzug",
            reinigung: "Reinigung",
            reinigung_end: "Endreinigung",
            reinigung_grund: "Grundreinigung",
            raeumung: "Räumung",
            entsorgung: "Entsorgung",
            lagerung: "Lagerung",
            klaviertransport: "Klaviertransport",
            moebellift: "Möbellift",
          };
          
          const serviceLabel = serviceLabels[payload.service_type] || payload.service_type;
          
          const vapiCustomerInner = `
              <div style="${EMAIL_CARD_OUTER}">
                <div style="${EMAIL_HEADER_BAND};text-align:center;">
                  <h1 style="margin:0;font-size:20px;font-weight:600;color:#18181b;">Grüezi ${payload.customer_first_name}</h1>
                  <p style="margin:8px 0 0;font-size:14px;color:#52525b;">Vielen Dank für Ihre Anfrage</p>
                </div>
                <div style="${EMAIL_BODY_PADDING}">
                  <p>Vielen Dank für die Nutzung unseres KI-Assistenten für Ihre <strong>${serviceLabel}</strong>-Anfrage.</p>
                  <div style="background:#ffffff;padding:16px;border-radius:6px;border:1px solid #d4d4d8;margin:16px 0;">
                    <h3 style="margin-top:0;color:#18181b;font-size:15px;">Ihre Anfrage-Details</h3>
                    <table style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td style="padding:8px 0;color:#52525b;">Referenznummer:</td>
                        <td style="padding:8px 0;font-weight:600;">${insertedLead.slug || insertedLead.id.substring(0, 8)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#52525b;">Service:</td>
                        <td style="padding:8px 0;font-weight:500;">${serviceLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#52525b;">Von:</td>
                        <td style="padding:8px 0;font-weight:500;">${payload.from_plz} ${payload.from_city}</td>
                      </tr>
                      ${payload.to_city ? `
                      <tr>
                        <td style="padding:8px 0;color:#52525b;">Nach:</td>
                        <td style="padding:8px 0;font-weight:500;">${payload.to_plz} ${payload.to_city}</td>
                      </tr>
                      ` : ""}
                      ${payload.preferred_date ? `
                      <tr>
                        <td style="padding:8px 0;color:#52525b;">Wunschtermin:</td>
                        <td style="padding:8px 0;font-weight:500;">${new Date(payload.preferred_date).toLocaleDateString("de-CH")}</td>
                      </tr>
                      ` : ""}
                    </table>
                  </div>
                  <div style="background:#f4f4f5;padding:14px;border-radius:6px;border:1px solid #d4d4d8;margin:16px 0;">
                    <p style="margin:0;color:#3f3f46;font-size:14px;">
                      Ihr Gespräch wurde erfasst. Nach Prüfung leiten wir Ihre Anfrage an passende Firmen weiter.
                    </p>
                  </div>
                  <h3 style="color:#18181b;font-size:16px;">Was passiert jetzt?</h3>
                  <ul style="color:#3f3f46;padding-left:20px;">
                    <li>Passende Firmen werden informiert</li>
                    <li>Sie erhalten unverbindliche Offerten</li>
                    <li>Sie vergleichen und entscheiden frei</li>
                  </ul>
                  <p style="margin-top:24px;text-align:center;">
                    <a href="https://offerio.ch/anfrage/${insertedLead.slug || insertedLead.id}"
                       style="display:inline-block;background:#2d2d2d;color:#ffffff;padding:14px 24px;text-decoration:none;border-radius:8px;font-weight:600;">
                      Anfrage-Status prüfen
                    </a>
                  </p>
                </div>
              </div>
              <div style="text-align:center;padding:14px 0 0;font-size:12px;color:#71717a;">
                <p style="margin:0;">© ${new Date().getFullYear()} Offerio</p>
                <p style="margin:6px 0 0 0;">
                  <a href="https://offerio.ch/datenschutz" style="color:#52525b;">Datenschutz</a> ·
                  <a href="https://offerio.ch/impressum" style="color:#52525b;">Impressum</a>
                </p>
              </div>`;

          await resend.emails.send({
            from: "Offerio <noreply@offerio.ch>",
            to: [payload.customer_email],
            subject: `Ihre ${serviceLabel}-Anfrage bei Offerio.ch`,
            html: wrapEmailDocument(vapiCustomerInner),
          });
          logStep("Customer confirmation email sent", { email: payload.customer_email });
        } catch (emailError) {
          logStep("Failed to send customer email", emailError);
        }
      });
    }

    // 7. Distribution only after admin verification (no auto match-lead)
    logStep("Lead awaits admin verification", {
      leadId: insertedLead.id,
      ai_confidence: payload.ai_confidence_score ?? null,
    });

    // 9. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Anfrage erfolgreich erfasst",
        leadId: insertedLead.id,
        slug: insertedLead.slug,
        leadScore: leadScore,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    logStep("Unexpected error", error);
    return new Response(
      JSON.stringify({ 
        error: "Unerwarteter Fehler",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
