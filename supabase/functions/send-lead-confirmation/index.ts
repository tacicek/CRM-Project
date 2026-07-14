import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDefaultFrom, getCalendarFrom, getAppName, getSiteUrl, getDashAppUrl, getAdminEmail } from "../_shared/envConfig.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  EMAIL_BODY_PADDING,
  EMAIL_CARD_OUTER,
  EMAIL_HEADER_BAND,
  wrapEmailDocument,
} from "../_shared/emailLayout.ts";
import { logEmail } from "../_shared/logEmail.ts";
import {
  createTranslator,
  LOCALES,
  toLocale,
  translateServiceType,
  type Translator,
} from "../_shared/i18n/index.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * This function has NO DB read — it is invoked straight from the public request wizard with a
 * plain body. The customer's language therefore has to be threaded IN through that body; there
 * is no leads row to read it back from at this point. Anything unrecognised falls back to 'de'.
 */
const LeadConfirmationSchema = (t: Translator) =>
  z.object({
    customerFirstName: z.string().min(1, t("validation.firstNameRequired")).max(100),
    customerLastName: z.string().min(1, t("validation.lastNameRequired")).max(100),
    customerEmail: z.string().email(t("validation.emailInvalid")).max(255),
    serviceType: z.string().min(1, t("validation.serviceTypeRequired")).max(50),
    fromCity: z.string().min(1, t("validation.cityRequired")).max(100),
    toCity: z.string().max(100).optional(),
    maxCompanies: z.number().int().min(1).max(20),
    language: z.enum(LOCALES).optional(),
  });

type LeadConfirmationRequest = z.infer<ReturnType<typeof LeadConfirmationSchema>>;

// Rate limiting with memory cleanup and IP support
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = parseInt(Deno.env.get("RATE_LIMIT_WINDOW_MS") || "60000"); // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(Deno.env.get("RATE_LIMIT_MAX_REQUESTS") || "5");
const MAX_MAP_SIZE = 10000; // Prevent memory overflow
let requestCount = 0;

// Cleanup old entries to prevent memory leak
const cleanupOldEntries = () => {
  const now = Date.now();
  const entriesToDelete: string[] = [];
  
  for (const [key, record] of rateLimitMap.entries()) {
    // Delete entries that are 2x past their reset time
    if (now > record.resetTime + RATE_LIMIT_WINDOW_MS) {
      entriesToDelete.push(key);
    }
  }
  
  entriesToDelete.forEach(key => rateLimitMap.delete(key));
  
  // If still too large, delete oldest entries
  if (rateLimitMap.size > MAX_MAP_SIZE) {
    const sortedEntries = Array.from(rateLimitMap.entries())
      .sort((a, b) => a[1].resetTime - b[1].resetTime);
    
    const toDelete = sortedEntries.slice(0, rateLimitMap.size - MAX_MAP_SIZE);
    toDelete.forEach(([key]) => rateLimitMap.delete(key));
  }
};

// Get client IP address
const getClientIP = (req: Request): string => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
};

// Check rate limit for email or IP
const isRateLimited = (key: string, req: Request): { limited: boolean; retryAfter?: number } => {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  // Cleanup every 1000 requests
  if (++requestCount % 1000 === 0) {
    cleanupOldEntries();
  }
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false };
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { limited: true, retryAfter };
  }
  
  // Atomic increment
  const newCount = record.count + 1;
  rateLimitMap.set(key, { ...record, count: newCount });
  return { limited: false };
};

// Decrement rate limit counter (for error rollback)
const decrementRateLimit = (key: string) => {
  const record = rateLimitMap.get(key);
  if (record && record.count > 0) {
    rateLimitMap.set(key, { ...record, count: record.count - 1 });
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-lead-confirmation: Received request");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("send-lead-confirmation: RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);
    const rawBody = await req.json();

    // The customer's locale must be known BEFORE validation, because the 400/429 payloads are
    // themselves customer-facing. toLocale() never throws — an absent/garbage value yields 'de'.
    const customerLocale = toLocale((rawBody as { language?: unknown } | null)?.language);
    const tCustomer = createTranslator(customerLocale);

    // CRITICAL FIX: Rate limit check BEFORE validation to prevent CPU abuse
    const clientIP = getClientIP(req);
    const email = rawBody?.customerEmail;

    if (email) {
      const emailKey = `email:${email.toLowerCase()}`;
      const ipKey = `ip:${clientIP}`;
      
      // Check both email and IP rate limits
      const emailLimit = isRateLimited(emailKey, req);
      const ipLimit = isRateLimited(ipKey, req);
      
      if (emailLimit.limited || ipLimit.limited) {
        const retryAfter = emailLimit.retryAfter || ipLimit.retryAfter || 60;
        console.warn("send-lead-confirmation: Rate limit exceeded", {
          email: email,
          ip: clientIP,
          emailLimited: emailLimit.limited,
          ipLimited: ipLimit.limited
        });
        
        return new Response(
          JSON.stringify({
            error: tCustomer("error.rateLimited"),
            retryAfter
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": retryAfter.toString(),
              ...corsHeaders
            }
          }
        );
      }
    }

    // Validiere Input mit Zod (after rate limit check) — messages in the customer's language
    const parseResult = LeadConfirmationSchema(tCustomer).safeParse(rawBody);

    if (!parseResult.success) {
      console.error("send-lead-confirmation: Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({
          error: tCustomer("error.invalidInput"),
          details: parseResult.error.flatten().fieldErrors
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data = parseResult.data;
    
    // Store keys for potential rollback
    const emailKey = `email:${data.customerEmail.toLowerCase()}`;
    const ipKey = `ip:${clientIP}`;
    
    console.log("send-lead-confirmation: Processing for", data.customerEmail);

    // This is a PUBLIC endpoint: every one of these values is attacker-controlled and lands in
    // an HTML email, so each is escaped before interpolation. An unknown serviceType falls back
    // to the raw request value, which makes escaping mandatory rather than merely prudent.
    const serviceLabel = escapeHtml(translateServiceType(data.serviceType, tCustomer));
    const locationInfo = data.toCity
      ? tCustomer("email.leadConfirmation.locationFromTo", {
          fromCity: escapeHtml(data.fromCity),
          toCity: escapeHtml(data.toCity),
        })
      : tCustomer("email.leadConfirmation.locationIn", { fromCity: escapeHtml(data.fromCity) });
    const customerName = `${data.customerFirstName} ${data.customerLastName}`;
    // Subject lines are plain text — the un-escaped label belongs here, not the HTML-escaped one.
    const subject = tCustomer("email.leadConfirmation.subject", {
      service: translateServiceType(data.serviceType, tCustomer),
    });

    let emailResponse;
    try {
      // {service} and {location} stay separate tokens so each language can order them to suit
      // its own grammar; the service name is emphasised inside the sentence.
      const intro = tCustomer("email.leadConfirmation.intro", {
        appName: getAppName(),
        service: `<strong>${serviceLabel}</strong>`,
        location: locationInfo,
      });

      const inner = `
        <div style="${EMAIL_CARD_OUTER}">
          <div style="${EMAIL_HEADER_BAND};text-align:center;">
            <h1 style="margin:0;font-size:20px;font-weight:600;color:#18181b;">${tCustomer("email.leadConfirmation.headerTitle")}</h1>
          </div>
          <div style="${EMAIL_BODY_PADDING}">
            <p style="font-size:16px;margin-top:0;">${tCustomer("common.greeting", { name: escapeHtml(customerName) })}</p>
            <p>${intro}</p>
            <div style="background:#ffffff;padding:16px;border-radius:6px;border:1px solid #d4d4d8;margin:16px 0;">
              <h3 style="margin-top:0;color:#18181b;font-size:15px;">${tCustomer("email.leadConfirmation.nextStepsTitle")}</h3>
              <ul style="padding-left:20px;margin-bottom:0;">
                <li style="margin-bottom:8px;">${tCustomer("email.leadConfirmation.step1", { maxCompanies: `<strong>${data.maxCompanies}</strong>` })}</li>
                <li style="margin-bottom:8px;">${tCustomer("email.leadConfirmation.step2")}</li>
                <li style="margin-bottom:8px;">${tCustomer("email.leadConfirmation.step3")}</li>
                <li>${tCustomer("email.leadConfirmation.step4")}</li>
              </ul>
            </div>
            <p style="color:#52525b;font-size:14px;">${tCustomer("email.leadConfirmation.help")}</p>
            <p style="margin-bottom:0;">${tCustomer("common.regardsFriendly")},<br><strong>${tCustomer("common.teamSignature", { appName: getAppName() })}</strong></p>
          </div>
        </div>
        <div style="text-align:center;padding:14px 0 0;font-size:12px;color:#71717a;">
          <p style="margin:0;">${tCustomer("common.copyright", { year: new Date().getFullYear(), appName: getAppName() })}</p>
        </div>`;

      emailResponse = await resend.emails.send({
        from: getDefaultFrom(),
        to: [data.customerEmail],
        subject,
        html: wrapEmailDocument(inner, customerLocale),
      });

      // Verify email was actually sent
      if (!emailResponse.data?.id) {
        throw new Error("Email send failed: No email ID returned");
      }
    } catch (emailError) {
      // CRITICAL FIX: Rollback rate limit if email sending failed
      console.error("send-lead-confirmation: Email send failed, rolling back rate limit", emailError);
      decrementRateLimit(emailKey);
      decrementRateLimit(ipKey);
      throw emailError;
    }

    console.log("send-lead-confirmation: Email sent successfully:", emailResponse);

    await logEmail({
      recipientEmail: data.customerEmail,
      recipientName: customerName,
      subject,
      emailType: "lead_confirmation",
      status: "sent",
      language: customerLocale,
      metadata: { serviceType: data.serviceType, fromCity: data.fromCity, toCity: data.toCity },
    });

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("send-lead-confirmation: Error:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
