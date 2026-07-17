import { supabase } from "@/integrations/supabase/client";

/** A JSON object — lets the email match read `email`/`notification_email` off a generic row
 * without casting `T` to an index-signature type. */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

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

/**
 * Legacy compatibility: returns the first company for a user (same behavior
 * as the old fetchSingleCompanyForUser). Useful during the migration.
 */
export async function fetchFirstCompanyForUser<T>(params: {
  userId: string;
  userEmail?: string | null;
  select?: string;
}): Promise<T | null> {
  const { companies } = await fetchCompaniesForUser<T>({
    userId: params.userId,
    select: params.select,
  });

  if (!companies.length) return null;

  // If user has an email, prefer the one whose email matches. The guard narrows the generic
  // row to an object so we can read the optional email fields without casting.
  if (params.userEmail) {
    const match = companies.find(
      (c) => isRecord(c) && (c.email === params.userEmail || c.notification_email === params.userEmail),
    );
    if (match) return match;
  }

  return companies[0];
}
