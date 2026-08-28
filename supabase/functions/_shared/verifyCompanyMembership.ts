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

/**
 * Wie verifyCompanyMembership, prüft aber zusätzlich die ROLLE.
 *
 * `company_members.role` (owner | admin | member) existiert seit langem, wurde
 * bisher aber von keiner einzigen Autorisierungsentscheidung gelesen — weder in
 * SQL noch hier. Wer Mitglied war, durfte alles. Diese Funktion ist die
 * serverseitige Hälfte der Rechtematrix; das Gegenstück in der Datenbank heisst
 * `is_company_role()`.
 *
 * Rolle unbekannt oder Zeile fehlt → false. Fail closed.
 */
export async function verifyCompanyRole(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  allowedRoles: string[]
): Promise<boolean> {
  const { data, error } = await supabase
    .from("company_members")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[verifyCompanyRole] DB error:", error.message);
    return false;
  }

  return data !== null && allowedRoles.includes(data.role);
}

/**
 * Mitgliedschaft aus dem `Authorization`-Header heraus prüfen.
 *
 * WARUM ES DIESE FASSUNG BRAUCHT
 *
 * `assertCompanyMembership` erwartet eine `userId`. `translate-content` reichte
 * ihr stattdessen den rohen Header („Bearer eyJ…") durch — die Abfrage lief
 * damit als `company_members.user_id = 'Bearer eyJ…'` und traf nie eine Zeile.
 * Die Function verweigerte also JEDEN Aufruf. Fail closed, aber kaputt: sie ist
 * nicht ausgerollt, deshalb ist es nie jemandem aufgefallen.
 *
 * Aufgefallen ist es dem Auth-Manifest-Tor, das `jwt-member` ohne `auth.getUser`
 * im Handler bemängelte. Diese Fassung schliesst die Lücke an der Wurzel: wer
 * einen Header hat, soll ihn übergeben dürfen, ohne die Auflösung abzuschreiben.
 */
export async function assertCompanyMembershipFromAuthHeader(
  supabase: SupabaseClient,
  authHeader: string | null,
  companyId: string,
  corsHeaders: Record<string, string>
): Promise<string> {
  const abweisen = (nachricht: string, code: string, status: number): never => {
    throw new Response(JSON.stringify({ error: nachricht, code }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  if (!authHeader) abweisen("Nicht authentifiziert.", "no_auth_header", 401);

  const token = (authHeader as string).replace(/^bearer\s+/i, "").trim();
  if (!token) abweisen("Nicht authentifiziert.", "no_bearer_token", 401);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) abweisen("Ungültige Sitzung.", "invalid_session", 401);

  await assertCompanyMembership(supabase, data.user!.id, companyId, corsHeaders);
  return data.user!.id;
}
