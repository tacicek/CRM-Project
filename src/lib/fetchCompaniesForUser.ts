import { supabase } from "@/integrations/supabase/client";

/**
 * Returns all companies a user belongs to via the company_members table.
 * Replaces the old "one company per user" assumption.
 */
export async function fetchCompaniesForUser<T>(params: {
  userId: string;
  select?: string;
}): Promise<{ companies: T[]; memberships: { company_id: string; role: string }[] }> {
  const selectCols = params.select ?? "id, company_name, logo_url, is_verified";

  const { data, error } = await supabase
    .from("company_members")
    .select(`company_id, role, companies!inner(${selectCols})`)
    .eq("user_id", params.userId);

  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    company_id: string;
    role: string;
    companies: T;
  }>;

  return {
    companies: rows.map((r) => r.companies),
    memberships: rows.map((r) => ({ company_id: r.company_id, role: r.role })),
  };
}
