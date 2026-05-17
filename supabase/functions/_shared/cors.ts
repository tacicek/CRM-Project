/**
 * Shared CORS headers for edge functions.
 *
 * corsHeaders      — open wildcard, safe for fully-public endpoints (no auth required).
 * getCorsHeaders() — origin-restricted version for authenticated / sensitive endpoints.
 *                    Pass the incoming Request so the origin can be reflected when allowed.
 */

import { getAllowedOrigins, getDashAppUrl } from "./envConfig.ts";

/** Open CORS — use only for public, read-only or unauthenticated endpoints */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Origin-restricted CORS headers for authenticated / write endpoints.
 * Returns allowed origin if the request origin is in the allowlist,
 * otherwise falls back to the primary dashboard origin.
 */
export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") ?? "";
  const allowed = getAllowedOrigins();
  const allowedOrigin = allowed.includes(origin)
    ? origin
    : (getDashAppUrl() || "*");

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}
