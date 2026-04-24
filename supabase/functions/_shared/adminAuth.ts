/**
 * Shared Admin Authentication & Authorization Utility
 * 
 * Standardized auth pattern for all admin edge functions.
 * Replaces inconsistent per-function auth implementations.
 * 
 * Role hierarchy (highest to lowest):
 *   super_admin > admin > moderator > staff
 * 
 * Usage:
 *   import { verifyAdminAccess } from "../_shared/adminAuth.ts";
 *   
 *   const auth = await verifyAdminAccess(req, supabaseAdmin, ["admin", "super_admin"]);
 *   if (auth.error) return auth.error;
 *   const user = auth.user;
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

export type AdminRole = "super_admin" | "admin" | "moderator" | "staff";

interface AuthSuccess {
  user: { id: string; email?: string };
  role: AdminRole;
  error: null;
}

interface AuthFailure {
  user: null;
  role: null;
  error: Response;
}

type AuthResult = AuthSuccess | AuthFailure;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Verify that the request comes from an authenticated admin user with the required role.
 * 
 * @param req - The incoming request
 * @param supabaseAdmin - Supabase client with service_role key
 * @param allowedRoles - Array of roles that are allowed (e.g., ["admin", "super_admin"])
 * @returns AuthResult with user info or an error Response
 */
export async function verifyAdminAccess(
  req: Request,
  supabaseAdmin: SupabaseClient,
  allowedRoles: AdminRole[] = ["admin", "super_admin"]
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  
  if (!authHeader) {
    return {
      user: null,
      role: null,
      error: new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const token = authHeader.replace("Bearer ", "").replace("bearer ", "");
  
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return {
      user: null,
      role: null,
      error: new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  // Fetch user role from user_roles table
  const { data: roleData, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || !roleData) {
    return {
      user: null,
      role: null,
      error: new Response(
        JSON.stringify({ error: "No admin role found for this user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const userRole = roleData.role as AdminRole;

  // Check if the user's role is in the allowed roles list
  if (!allowedRoles.includes(userRole)) {
    return {
      user: null,
      role: null,
      error: new Response(
        JSON.stringify({ 
          error: "Insufficient permissions",
          required_roles: allowedRoles,
          current_role: userRole,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return {
    user: { id: user.id, email: user.email },
    role: userRole,
    error: null,
  };
}
