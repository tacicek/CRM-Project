/**
 * Fire-and-forget trigger for AI + deterministic lead quality validation.
 *
 * Call this immediately after `submit_lead_json` RPC returns successfully.
 * The edge function will:
 *   - Run deterministic validation (free, fast)
 *   - For ambiguous cases: call Claude Haiku with VALIDATE_LEAD_QUALITY_PROMPT
 *   - Route the lead:
 *     - pending_verification        → valid, goes to super-admin
 *     - awaiting_customer_confirmation → suspicious but email valid → double opt-in sent
 *     - unconfirmed_risky           → suspicious + email can't receive → riskli leads bucket
 *
 * This call is fire-and-forget on purpose — the user's success page should not
 * be blocked while validation runs in the background. Errors are logged only.
 */

import { supabase } from "@/integrations/supabase/client";

export function triggerLeadQualityValidation(leadId: string | null | undefined): void {
  if (!leadId) return;

  supabase.functions
    .invoke("validate-lead-quality", { body: { lead_id: leadId } })
    .then(({ error, data }) => {
      if (error) {
        console.warn("[validate-lead-quality] Non-blocking error:", error.message);
        return;
      }
      if (data?.status === "awaiting_customer_confirmation") {
        console.info("[validate-lead-quality] Double opt-in email sent for lead", leadId);
      } else if (data?.status === "unconfirmed_risky") {
        console.info("[validate-lead-quality] Lead moved to risky bucket:", leadId);
      }
    })
    .catch((e) => {
      console.warn("[validate-lead-quality] Invocation failed:", (e as Error).message);
    });
}
