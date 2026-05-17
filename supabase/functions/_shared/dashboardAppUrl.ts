/**
 * Base URL for the dashboard SPA (Login, /firma/*, /admin/*).
 *
 * Reads from environment variables (set via `supabase secrets set`):
 *   DASH_APP_URL — explicit dashboard origin
 *   FIRMA_APP_URL — alias for DASH_APP_URL
 *   APP_URL / SITE_URL — fallback (used as-is when not a known public domain)
 */
import { getDashAppUrl } from "./envConfig.ts";

export function getDashboardAppBaseUrl(): string {
  return getDashAppUrl();
}
