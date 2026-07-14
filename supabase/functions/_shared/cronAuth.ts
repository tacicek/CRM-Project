/**
 * Auth guard for the pg_cron-invoked functions.
 *
 * These functions run with `verify_jwt = false` and Kong exposes
 * `/functions/v1/*` without an auth plugin, so the endpoint is reachable by
 * anyone — each function has to authenticate its caller itself.
 *
 * `public.invoke_edge_function()` (see the reminder-cron migration) reads the
 * service_role key from the vault and sends it as a bearer token. The key never
 * leaves the server side — the browser only ever gets the anon key — so a
 * matching bearer token identifies the cron job.
 *
 * Fails closed: no service_role key in the environment means no request can be
 * authenticated.
 */
export const isCronRequest = (req: Request): boolean => {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    console.error("[cronAuth] SUPABASE_SERVICE_ROLE_KEY not set — refusing to run (fail closed)");
    return false;
  }

  return req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`;
};

export const unauthorizedResponse = (corsHeaders: Record<string, string>): Response =>
  new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
