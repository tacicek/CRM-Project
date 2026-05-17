import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verifies that a given userId is a member of the given companyId
 * via the company_members table.
 *
 * Replaces the old "companies.user_id = userId" ownership check.
 * Returns true if the user is a member (any role), false otherwise.
 */
export async function verifyCompanyMembership(
  supabase: SupabaseClient,
  userId: string,
  companyId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[verifyCompanyMembership] DB error:", error.message);
    return false;
  }

  return data !== null;
}

/**
 * Same as verifyCompanyMembership, but throws a Response on failure —
 * useful as a guard at the top of a handler.
 *
 * Usage:
 *   await assertCompanyMembership(supabase, userId, companyId, corsHeaders);
 */
export async function assertCompanyMembership(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  corsHeaders: Record<string, string>
): Promise<void> {
  const isMember = await verifyCompanyMembership(supabase, userId, companyId);
  if (!isMember) {
    throw new Response(
      JSON.stringify({
        error: "Keine Berechtigung für diese Firma",
        code: "not_company_member",
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
