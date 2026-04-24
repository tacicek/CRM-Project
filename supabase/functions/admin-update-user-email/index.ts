import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdminAccess } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateEmailRequest {
  userId: string;
  newEmail: string;
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[admin-update-user-email] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase server configuration");
    }

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // SECURITY: Use shared admin auth - admin and super_admin can update emails
    const auth = await verifyAdminAccess(req, supabaseAdmin, ["admin", "super_admin"]);
    if (auth.error) return auth.error;
    
    logStep("Authorized", { userId: auth.user.id, role: auth.role });

    // Parse request body
    const { userId, newEmail }: UpdateEmailRequest = await req.json();

    if (!userId || !newEmail) {
      throw new Error("userId and newEmail are required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new Error("Invalid email format");
    }

    logStep("Updating user email", { userId, newEmail });

    // Read current company email first (for better sync logic)
    const { data: currentCompany } = await supabaseAdmin
      .from("companies")
      .select("email, notification_email")
      .eq("user_id", userId)
      .maybeSingle();

    // Update user email in auth.users
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email: newEmail, email_confirm: true }
    );

    if (updateError) {
      logStep("Error updating user email", { error: updateError.message });
      throw new Error(updateError.message);
    }

    // Verify: email changed OR pending new_email matches (Supabase may keep it in new_email until confirmed)
    const updatedAuthEmail = updatedUser.user.email?.toLowerCase();
    const pendingNewEmail = (updatedUser.user as Record<string, unknown>).new_email as string | undefined;
    const emailApplied =
      updatedAuthEmail === newEmail.toLowerCase() ||
      pendingNewEmail?.toLowerCase() === newEmail.toLowerCase();

    if (!emailApplied) {
      logStep("Email verification failed", { updatedAuthEmail, pendingNewEmail, newEmail });
      throw new Error("Auth email update could not be verified");
    }

    logStep("User email updated successfully", { userId, newEmail });

    // Also update company-facing emails.
    // Keep notification email aligned if it was previously equal to company email.
    const shouldSyncNotificationEmail =
      !currentCompany?.notification_email ||
      currentCompany.notification_email === currentCompany.email;

    const companyUpdatePayload: Record<string, string> = { email: newEmail };
    if (shouldSyncNotificationEmail) {
      companyUpdatePayload.notification_email = newEmail;
    }

    const { error: companyUpdateError } = await supabaseAdmin
      .from("companies")
      .update(companyUpdatePayload)
      .eq("user_id", userId);

    if (companyUpdateError) {
      logStep("Warning: Could not update company email", { error: companyUpdateError.message });
      // Don't throw here, the main operation succeeded
    }

    // Update the email in the profiles table if it exists
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ email: newEmail })
      .eq("id", userId);

    if (profileUpdateError) {
      logStep("Warning: Could not update profile email", { error: profileUpdateError.message });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User email updated successfully",
        userId: updatedUser.user.id,
        newEmail: updatedUser.user.email,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    logStep("Error in admin-update-user-email", { error: errorMessage });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
