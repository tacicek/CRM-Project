/**
 * Central environment configuration for Edge Functions.
 *
 * Set these secrets via:
 *   supabase secrets set KEY=value
 *
 * Required:
 *   SENDER_EMAIL   — default "from" email address (e.g. noreply@mycompany.com)
 *   ADMIN_EMAIL    — admin notification recipient (e.g. admin@mycompany.com)
 *
 * Optional:
 *   APP_NAME       — brand name shown in emails / footers (default: "CRM")
 *   SITE_URL       — public site URL                    (default: DASH_APP_URL)
 *   DASH_APP_URL   — dashboard/CRM URL                 (default: SITE_URL)
 *   SENDER_NAME    — display name for default sender   (default: APP_NAME)
 *   CALENDAR_EMAIL — from address for appointment mails (default: SENDER_EMAIL)
 */

export function getAppName(): string {
  return Deno.env.get("APP_NAME")?.trim() || "CRM";
}

export function getSiteUrl(): string {
  return (
    Deno.env.get("SITE_URL")?.trim().replace(/\/$/, "") ||
    Deno.env.get("APP_URL")?.trim().replace(/\/$/, "") ||
    getDashAppUrl()
  );
}

export function getDashAppUrl(): string {
  return (
    Deno.env.get("DASH_APP_URL")?.trim().replace(/\/$/, "") ||
    Deno.env.get("FIRMA_APP_URL")?.trim().replace(/\/$/, "") ||
    Deno.env.get("SITE_URL")?.trim().replace(/\/$/, "") ||
    Deno.env.get("APP_URL")?.trim().replace(/\/$/, "") ||
    // Last resort: prod app domain. If env (DASH_APP_URL etc.) is set, that takes priority.
    // An empty string would make email links relative (/offerte/…) and break them.
    "https://crm-hirschen.ch"
  );
}

export function getSenderEmail(): string {
  return Deno.env.get("SENDER_EMAIL")?.trim() || "noreply@example.com";
}

export function getSenderName(): string {
  return (
    Deno.env.get("SENDER_NAME")?.trim() ||
    getAppName()
  );
}

/** Default "from" string, e.g. "CRM <noreply@mycompany.com>" */
export function getDefaultFrom(): string {
  return `${getSenderName()} <${getSenderEmail()}>`;
}

/**
 * Appointment/calendar "from" address.
 * Falls back to the default sender email.
 */
export function getCalendarFrom(): string {
  const calEmail = Deno.env.get("CALENDAR_EMAIL")?.trim() || getSenderEmail();
  return `${getSenderName()} <${calEmail}>`;
}

export function getAdminEmail(): string {
  return Deno.env.get("ADMIN_EMAIL")?.trim() || getSenderEmail();
}

/** Allowed CORS origins derived from env */
export function getAllowedOrigins(): string[] {
  const origins: string[] = [];
  const site = getSiteUrl();
  if (site) origins.push(site);
  const dash = getDashAppUrl();
  if (dash && dash !== site) origins.push(dash);
  // Always allow localhost for local dev
  origins.push("http://localhost:5173");
  origins.push("http://localhost:3000");
  return [...new Set(origins)];
}
