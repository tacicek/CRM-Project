/**
 * Base URL for the dashboard SPA (Login, /firma/*, /admin/*).
 *
 * APP_URL / SITE_URL are often the public marketing site (e.g. https://offerio.ch),
 * which does not serve firm or admin routes — links would 404.
 *
 * Secrets (optional):
 * - DASH_APP_URL — explicit dashboard origin (e.g. https://dash.offerio.ch)
 * - FIRMA_APP_URL — alias for DASH_APP_URL
 */
export function getDashboardAppBaseUrl(): string {
  const explicit =
    Deno.env.get("DASH_APP_URL")?.trim() || Deno.env.get("FIRMA_APP_URL")?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const normalize = (raw: string | undefined): string | null => {
    if (!raw?.trim()) return null;
    const base = raw.trim().replace(/\/$/, "");
    try {
      const { hostname } = new URL(base);
      const h = hostname.toLowerCase();
      if (h === "offerio.ch" || h === "www.offerio.ch") {
        return "https://dash.offerio.ch";
      }
      return base;
    } catch {
      return null;
    }
  };

  return (
    normalize(Deno.env.get("APP_URL")) ??
    normalize(Deno.env.get("SITE_URL")) ??
    "https://dash.offerio.ch"
  );
}
