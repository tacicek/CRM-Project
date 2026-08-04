/**
 * Die Adresse, die bei Resend als Webhook eingetragen wird.
 *
 * ── Warum das hier steht ───────────────────────────────────────────────────
 *
 * Der Anschluss des E-Mail-Eingangs besteht aus drei Teilen, und keiner davon
 * war bisher im CRM sichtbar: die Webhook-Adresse (Resend-Dashboard), das
 * Secret und die Alias-Zuordnung (beide in der Datenbank). Wer die Adresse
 * brauchte, musste sie aus der Dokumentation holen oder sich merken.
 *
 * Die Adresse ist keine Einstellung, sondern eine Ableitung: sie ergibt sich
 * aus der Supabase-Basisadresse und dem festen Namen der Edge Function. Sie
 * irgendwo zu speichern hiesse, zwei Wahrheiten zu fuehren — deshalb wird sie
 * berechnet und nicht abgelegt.
 */

/** Der Name der Edge Function, die Resend anruft. Fest, kein Konfigurationswert. */
export const INBOUND_WEBHOOK_FUNCTION = "inbound-email-lead";

/** Das Ereignis, das im Resend-Dashboard ausgewaehlt werden muss. */
export const INBOUND_WEBHOOK_EVENT = "email.received";

/**
 * Baut die Webhook-Adresse aus der Basisadresse.
 *
 * Gibt `null` zurueck, wenn die Basis fehlt oder unbrauchbar ist. Eine halb
 * geratene Adresse waere schlimmer als keine: sie wuerde bei Resend eingetragen
 * und die Mails liefen ins Leere, ohne dass jemand es merkt.
 *
 * Ein abschliessender Schraegstrich in der Basis wird geschluckt, damit die
 * Adresse nicht mit einem doppelten Trenner entsteht.
 */
export const buildInboundWebhookUrl = (basis: string | undefined | null): string | null => {
  const roh = (basis ?? "").trim();
  if (!roh) return null;

  let url: URL;
  try {
    url = new URL(roh);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const pfad = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pfad}/functions/v1/${INBOUND_WEBHOOK_FUNCTION}`;
};
