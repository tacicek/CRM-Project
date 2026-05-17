import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getDashboardAppBaseUrl } from "../_shared/dashboardAppUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  sendEmail?: boolean;
  role?: "admin" | "moderator"; // Optional role for admin users
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[admin-create-user] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    logStep("Checking authorization", { hasAuthHeader: !!authHeader });
    
    if (!authHeader) {
      logStep("No authorization header found");
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Getting user from token");
    
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError) {
      logStep("Auth error", { error: authError.message });
      throw new Error(`Unauthorized: ${authError.message}`);
    }
    
    if (!requestingUser) {
      logStep("No user found for token");
      throw new Error("Unauthorized: User not found");
    }
    
    logStep("User authenticated", { userId: requestingUser.id, email: requestingUser.email });

    const { email, password, firstName, lastName, companyName, sendEmail = false, role }: CreateUserRequest = await req.json();
    
    // Check permissions based on what is being created
    // Creating admin/moderator users requires super admin
    // Creating company users requires staff (admin or moderator)
    if (role) {
      // Creating an admin or moderator user - only super admin can do this
      const { data: isSuperAdmin, error: rpcError } = await supabaseAdmin.rpc("is_super_admin", { _user_id: requestingUser.id });
      
      if (rpcError) {
        logStep("RPC error checking super admin status", { error: rpcError.message });
        throw new Error(`Failed to verify super admin status: ${rpcError.message}`);
      }
      
      logStep("Super admin check result", { isSuperAdmin, role });
      
      if (!isSuperAdmin) {
        throw new Error("Only super admins can create admin/moderator users");
      }
    } else {
      // Creating a company user - staff (admin or moderator) can do this
      const { data: isStaff, error: rpcError } = await supabaseAdmin.rpc("is_staff", { _user_id: requestingUser.id });
      
      if (rpcError) {
        logStep("RPC error checking staff status", { error: rpcError.message });
        throw new Error(`Failed to verify staff status: ${rpcError.message}`);
      }
      
      logStep("Staff check result", { isStaff });
      
      if (!isStaff) {
        throw new Error("Only staff members can create users");
      }
    }
    
    logStep("Creating new user", { email, sendEmail, role });

    // Create the user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createError) {
      logStep("Error creating user", { error: createError.message });
      throw createError;
    }

    logStep("User created successfully", { userId: newUser.user?.id });

    // Ensure profile exists (in case trigger didn't run)
    if (newUser.user?.id) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: newUser.user.id,
          email: email,
          first_name: firstName || null,
          last_name: lastName || null,
        }, { onConflict: 'id' });

      if (profileError) {
        logStep("Error creating profile", { error: profileError.message });
      } else {
        logStep("Profile created/updated successfully", { userId: newUser.user.id });
      }
    }

    // If a role is specified, assign it to the user
    let roleAssigned = false;
    if (role && newUser.user?.id) {
      logStep("Assigning role to user", { userId: newUser.user.id, role });
      
      // First, delete any existing roles for this user
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", newUser.user.id);
      
      if (deleteError) {
        logStep("Warning: Error deleting existing roles", { error: deleteError.message });
      }
      
      // Insert the new role
      const { data: insertedRole, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: newUser.user.id,
          role: role,
        })
        .select()
        .single();

      if (roleError) {
        logStep("ERROR: Failed to assign role", { error: roleError.message, code: roleError.code });
        // This is critical - throw error so admin knows role wasn't assigned
        throw new Error(`User created but role assignment failed: ${roleError.message}`);
      } else {
        logStep("Role assigned successfully", { userId: newUser.user.id, role, insertedRole });
        roleAssigned = true;
      }
      
      // Verify the role was actually inserted
      const { data: verifyRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", newUser.user.id)
        .single();
      
      if (!verifyRole || verifyRole.role !== role) {
        logStep("ERROR: Role verification failed", { expected: role, actual: verifyRole });
        throw new Error(`Role verification failed. Expected: ${role}, Got: ${verifyRole?.role || 'nothing'}`);
      }
      
      logStep("Role verified successfully", { role: verifyRole.role });
    }

    // Send welcome email with credentials if RESEND_API_KEY is configured
    let emailSent = false;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey && sendEmail) {
      try {
        const resend = new Resend(resendApiKey);
        const siteUrl = getDashboardAppBaseUrl();
        
        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">
                  🎉 Willkommen bei LeadFlow!
                </h1>
              </div>
              
              <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
                <p style="margin-top: 0;">Hallo${companyName ? ` <strong>${companyName}</strong>` : ""},</p>
                
                <p>Ihr Firmen-Account wurde erfolgreich erstellt. Sie können sich ab sofort anmelden und Anfragen erhalten.</p>
                
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #667eea;">Ihre Login-Daten</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #64748b; width: 100px;">E-Mail:</td>
                      <td style="padding: 8px 0; font-weight: 600;">${email}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Passwort:</td>
                      <td style="padding: 8px 0; font-weight: 600; font-family: monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">${password}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0; color: #92400e; font-size: 14px;">
                    <strong>⚠️ Sicherheitshinweis:</strong> Bitte ändern Sie Ihr Passwort nach dem ersten Login in den Einstellungen.
                  </p>
                </div>
                
                <a href="${siteUrl}/auth" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 10px;">
                  Jetzt anmelden →
                </a>
                
                <p style="margin-bottom: 0; margin-top: 30px; color: #64748b; font-size: 14px;">
                  Mit freundlichen Grüssen<br>
                  <strong>Ihr LeadFlow Team</strong>
                </p>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
                <p>Diese E-Mail wurde automatisch von LeadFlow gesendet.</p>
              </div>
            </body>
          </html>
        `;

        const { error: emailError } = await resend.emails.send({
          from: "LeadFlow <onboarding@resend.dev>",
          to: [email],
          subject: "🎉 Willkommen bei LeadFlow - Ihre Login-Daten",
          html: emailHtml,
        });

        if (emailError) {
          logStep("Error sending welcome email", { error: emailError });
        } else {
          emailSent = true;
          logStep("Welcome email sent successfully");
        }
      } catch (emailErr: unknown) {
        const errorMessage = emailErr instanceof Error ? emailErr.message : "Unknown error";
        logStep("Failed to send welcome email", { error: errorMessage });
      }
    } else {
      logStep("Skipping email - RESEND_API_KEY not configured or sendEmail=false");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUser.user?.id,
        email: newUser.user?.email,
        role: role || null,
        roleAssigned: role ? roleAssigned : null,
        emailSent,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error in admin-create-user", { error: errorMessage });
    
    // Return proper status codes based on error type
    let statusCode = 400;
    if (errorMessage === "Unauthorized" || errorMessage === "No authorization header") {
      statusCode = 401;
    } else if (errorMessage === "Only admins can create users") {
      statusCode = 403;
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
