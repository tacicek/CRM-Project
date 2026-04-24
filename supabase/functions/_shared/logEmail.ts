import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface LogEmailParams {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  emailType: string;
  status: "sent" | "failed" | "pending";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  companyId?: string;
  leadId?: string;
}

export async function logEmail(params: LogEmailParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase.from("email_logs").insert({
      recipient_email: params.recipientEmail,
      recipient_name: params.recipientName || null,
      subject: params.subject,
      email_type: params.emailType,
      status: params.status,
      error_message: params.errorMessage || null,
      metadata: params.metadata || {},
      company_id: params.companyId || null,
      lead_id: params.leadId || null,
    });

    if (error) {
      console.error("[logEmail] Failed to log email:", error);
    } else {
      console.log("[logEmail] Email logged:", params.emailType, params.recipientEmail);
    }
  } catch (error) {
    console.error("[logEmail] Error:", error);
  }
}
