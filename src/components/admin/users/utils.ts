import { AdminUser, EMAIL_REGEX } from "./types";

/**
 * Type guard for AdminUser
 */
export function isValidAdminUser(item: unknown): item is AdminUser {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    (obj.email === null || typeof obj.email === "string") &&
    typeof obj.role === "string"
  );
}

/**
 * Safe date formatting (de-CH locale)
 */
export function formatDateSafe(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Map raw errors to German user-facing messages
 */
export function getUserFriendlyError(error: unknown): string {
  if (!error) return "Ein unbekannter Fehler ist aufgetreten.";
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("duplicate") || message.includes("already exists")) {
    return "Ein Benutzer mit dieser E-Mail existiert bereits.";
  }
  if (message.includes("permission") || message.includes("not authorized")) {
    return "Keine Berechtigung für diese Aktion.";
  }
  if (message.includes("session") || message.includes("token")) {
    return "Sitzung abgelaufen. Bitte melden Sie sich erneut an.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.";
  }

  return "Aktion konnte nicht durchgeführt werden.";
}
