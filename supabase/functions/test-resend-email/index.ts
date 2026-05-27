import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. JWT authentication — must be a logged-in user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Ungültige Sitzung" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Parse body — only accept company_id and to_email, NOT the API key
    const body = await req.json();
    const { company_id, to_email } = body as { company_id?: string; to_email?: string };

    if (!company_id || !to_email) {
      return new Response(
        JSON.stringify({ error: "company_id und to_email erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Verify the user belongs to the requested company
    const { data: membership } = await supabase
      .from("companies")
      .select("id")
      .eq("id", company_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      // Also check company_members for team access
      const { data: memberRow } = await supabase
        .from("company_members")
        .select("id")
        .eq("company_id", company_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!memberRow) {
        return new Response(
          JSON.stringify({ error: "Keine Berechtigung für diese Firma" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 5. Read Resend settings from DB — never from the client request
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("company_name, resend_enabled, resend_api_key, resend_from_email, resend_from_name")
      .eq("id", company_id)
      .single();

    if (companyErr || !company) {
      return new Response(
        JSON.stringify({ error: "Firma nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!company.resend_enabled || !company.resend_api_key || !company.resend_from_email) {
      return new Response(
        JSON.stringify({ error: "Resend ist nicht konfiguriert. Bitte zuerst speichern." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 6. Send test email using company's own credentials
    const resend = new Resend(company.resend_api_key);
    const fromName = company.resend_from_name || company.company_name;

    const emailResponse = await resend.emails.send({
      from: `${fromName} <${company.resend_from_email}>`,
      to: [to_email],
      subject: "Test-E-Mail – Resend Konfiguration",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 24px; background-color: #f3f4f6;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
              <h1 style="color: white; margin: 0; font-size: 22px;">✅ Test erfolgreich!</h1>
            </div>
            <p>Ihre Resend-Konfiguration für <strong>${company.company_name}</strong> funktioniert korrekt.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
              <tr><td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;"><strong>Absender:</strong></td>
                  <td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">${fromName} &lt;${company.resend_from_email}&gt;</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Zeitpunkt:</strong></td>
                  <td style="padding: 6px 0;">${new Date().toLocaleString("de-CH")}</td></tr>
            </table>
          </div>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      const domain = company.resend_from_email.split("@")[1];
      let errorMessage = emailResponse.error.message || "E-Mail konnte nicht gesendet werden";
      if (errorMessage.includes("domain") || errorMessage.includes("403")) {
        errorMessage = `Domain nicht verifiziert: "${domain}" muss in resend.com/domains verifiziert sein.`;
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Test-E-Mail erfolgreich gesendet!", id: emailResponse.data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
