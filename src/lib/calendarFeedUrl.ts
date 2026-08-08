/**
 * Die Abo-Adressen des Kalender-Feeds (webcal/ICS).
 *
 * Wie bei `inboundEmailWebhook.ts`: die Adresse ist keine Einstellung, sondern
 * eine Ableitung aus der Supabase-Basisadresse und dem festen Namen der Edge
 * Function — berechnet, nie gespeichert.
 *
 * `webcal://` statt `https://`: dieses Schema sagt Apple Kalender und Outlook
 * "abonnieren, nicht herunterladen". Die Clients ersetzen es beim Abruf selbst
 * durch http(s).
 */

/** Der Name der Edge Function. Fest, kein Konfigurationswert. */
export const CALENDAR_FEED_FUNCTION = "calendar-feed";

/**
 * Ein Feed pro Termin-Typ plus `other` als Auffangbecken fuer kuenftige,
 * dem Feed noch unbekannte Typen. Muss mit KNOWN_TYPES in
 * supabase/functions/calendar-feed/index.ts uebereinstimmen.
 */
export const CALENDAR_FEED_TYPES = [
  "besichtigung",
  "service",
  "follow_up",
  "meeting",
  "blocked",
  "other",
] as const;

export type CalendarFeedType = (typeof CALENDAR_FEED_TYPES)[number];

/**
 * Baut die webcal-Abo-Adresse fuer ein Token und einen Termin-Typ.
 *
 * Gibt `null` zurueck, wenn Basis oder Token fehlen — eine halb geratene
 * Adresse landet sonst in einem Kalender-Client und liefert dort still 404.
 */
export const buildCalendarFeedUrl = (
  basis: string | undefined | null,
  token: string,
  typ: CalendarFeedType
): string | null => {
  const roh = (basis ?? "").trim();
  if (!roh || !token) return null;

  let url: URL;
  try {
    url = new URL(roh);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const pfad = url.pathname.replace(/\/+$/, "");
  return `webcal://${url.host}${pfad}/functions/v1/${CALENDAR_FEED_FUNCTION}?token=${token}&typ=${typ}`;
};
