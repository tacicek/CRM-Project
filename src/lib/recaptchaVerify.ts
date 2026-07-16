// recaptchaVerify.ts - Utility function for reCAPTCHA verification

import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/lib/devLog";

interface VerifyResult {
  success: boolean;
  score?: number;
  error?: string;
}

/**
 * Verify a reCAPTCHA token with the backend
 * 
 * @param token - The reCAPTCHA token from executeRecaptcha()
 * @param action - The action name (e.g., "submit_umzug_form")
 * @returns VerifyResult with success status
 */
export async function verifyRecaptchaToken(
  token: string | null,
  action: string
): Promise<VerifyResult> {
  // If no token provided (reCAPTCHA not enabled), consider it a pass
  if (!token) {
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke("verify-recaptcha", {
      body: { token, action },
    });

    if (error) {
      console.error("[reCAPTCHA] Verification error:", error);
      return { 
        success: false, 
        error: error.message || "Verification failed" 
      };
    }

    if (!data?.success) {
      console.error("[reCAPTCHA] Verification failed:", data);
      return { 
        success: false, 
        error: data?.error || "Verification failed",
        score: data?.score
      };
    }

    devLog("[reCAPTCHA] Verification passed with score:", data.score);
    return { 
      success: true, 
      score: data.score 
    };
  } catch (err) {
    console.error("[reCAPTCHA] Unexpected error:", err);
    return { 
      success: false, 
      error: "Verification service unavailable" 
    };
  }
}
