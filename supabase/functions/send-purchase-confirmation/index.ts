import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod Schema für Input-Validierung
const PurchaseConfirmationSchema = z.object({
  companyName: z.string().min(1, "Firmenname erforderlich").max(200),
  email: z.string().email("Ungültige E-Mail-Adresse").max(255),
  tokenAmount: z.number().int().min(1, "Token-Anzahl muss mindestens 1 sein").max(100000),
  newBalance: z.number().int().min(0),
  packageName: z.string().max(100).optional(),
  check_only: z.boolean().optional(), // For config check without sending email
});

type PurchaseConfirmationRequest = z.infer<typeof PurchaseConfirmationSchema>;

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PURCHASE-CONFIRMATION] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      logStep("RESEND_API_KEY not configured, skipping email");
      return new Response(
        JSON.stringify({ success: false, skipped: true, message: "Email service not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const rawBody = await req.json();
    
    // Validiere Input mit Zod
    const parseResult = PurchaseConfirmationSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      logStep("Validation error", { errors: parseResult.error.flatten() });
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { companyName, email, tokenAmount, newBalance, packageName, check_only } = parseResult.data;

    // If this is just a config check, return success without sending email
    if (check_only) {
      logStep("Config check - email service is configured");
      return new Response(
        JSON.stringify({ success: true, configured: true, check_only: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Sending purchase confirmation", { email, tokenAmount, newBalance });

    const emailResponse = await resend.emails.send({
      from: "Offerio <noreply@offerio.ch>",
      to: [email],
      subject: `Kaufbestätigung: ${tokenAmount} Tokens gutgeschrieben`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Token-Kauf erfolgreich!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
            <p style="font-size: 16px; margin-top: 0;">Guten Tag,</p>
            
            <p>Ihr Token-Kauf war erfolgreich. Hier die Details:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Firma:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">${companyName}</td>
                </tr>
                ${packageName ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Paket:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">${packageName}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #666;">Tokens gekauft:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #22c55e;">+${tokenAmount}</td>
                </tr>
                <tr style="border-top: 1px solid #eee;">
                  <td style="padding: 12px 0 8px; color: #666;">Neuer Kontostand:</td>
                  <td style="padding: 12px 0 8px; font-weight: bold; font-size: 18px; text-align: right;">${newBalance} Tokens</td>
                </tr>
              </table>
            </div>
            
            <p>Sie können Ihre Tokens jetzt nutzen, um auf neue Anfragen zuzugreifen.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://dash.offerio.ch/firma/anfragen" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Zu meinen Anfragen
              </a>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>Diese E-Mail wurde automatisch gesendet. Bitte antworten Sie nicht auf diese Nachricht.</p>
            <p>© ${new Date().getFullYear()} Offerio. Alle Rechte vorbehalten.</p>
          </div>
        </body>
        </html>
      `,
    });

    logStep("Email sent successfully", { response: emailResponse });

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
