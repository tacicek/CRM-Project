import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  resend_api_key: string;
  from_email: string;
  from_name: string;
  to_email: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[test-resend-email] Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let from_email = "";
  let rawBody = "";
  
  try {
    rawBody = await req.text();
    console.log("[test-resend-email] Raw body:", rawBody);
    
    const body: TestEmailRequest = JSON.parse(rawBody);
    console.log("[test-resend-email] Parsed body:", { 
      hasApiKey: !!body.resend_api_key, 
      apiKeyLength: body.resend_api_key?.length,
      from_email: body.from_email,
      to_email: body.to_email 
    });
    
    const { resend_api_key, from_name, to_email } = body;
    from_email = body.from_email;

    if (!resend_api_key || !from_email || !to_email) {
      return new Response(
        JSON.stringify({ error: "Fehlende Parameter: API-Key, Absender-E-Mail oder Empfänger-E-Mail" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`[test-resend-email] Testing email from ${from_email} to ${to_email}`);

    const resend = new Resend(resend_api_key);

    const emailResponse = await resend.emails.send({
      from: `${from_name || 'Test'} <${from_email}>`,
      to: [to_email],
      subject: "Test-E-Mail - Resend Konfiguration",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Test erfolgreich!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #111; margin-top: 0;">Ihre Resend-Konfiguration funktioniert!</h2>
            <p>Diese Test-E-Mail bestätigt, dass Ihre E-Mail-Einstellungen korrekt konfiguriert sind.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Absender:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${from_name} &lt;${from_email}&gt;</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Empfänger:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${to_email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Zeitpunkt:</strong></td>
                <td style="padding: 8px 0;">${new Date().toLocaleString('de-CH')}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            Diese E-Mail wurde über Ihre eigene Resend-Konfiguration gesendet.
          </p>
        </body>
        </html>
      `,
    });

    console.log(`[test-resend-email] Email sent successfully:`, emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Test-E-Mail erfolgreich gesendet!",
        id: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[test-resend-email] Error:", error);
    console.error("[test-resend-email] Error stack:", error.stack);
    console.error("[test-resend-email] Raw body was:", rawBody);
    
    let errorMessage = "Ein unbekannter Fehler ist aufgetreten";
    
    // Check for JSON parsing error
    if (error instanceof SyntaxError) {
      errorMessage = `JSON-Parsing-Fehler: ${error.message}`;
    }
    // Parse Resend error response
    else if (error.statusCode === 403) {
      const domain = from_email ? from_email.split('@')[1] : 'unbekannt';
      errorMessage = `Domain nicht verifiziert: Die Domain "${domain}" ist nicht in Ihrem Resend-Konto verifiziert. Bitte gehen Sie zu resend.com/domains und fügen Sie diese Domain hinzu.`;
    } else if (error.statusCode === 401 || (error.message && error.message.includes("API key"))) {
      errorMessage = "Ungültiger API-Key. Bitte überprüfen Sie Ihren Resend API-Key.";
    } else if (error.message && error.message.includes("domain")) {
      errorMessage = `Domain-Fehler: ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Return 200 with error in body so frontend can show the message
    return new Response(
      JSON.stringify({ error: errorMessage, details: error.message || error.statusCode }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
