/**
 * Darf diese Zustellung verarbeitet werden?
 *
 * Die Eindeutigkeit erzwingt die Datenbank (`unique (provider, provider_message_id)`);
 * hier steht nur, was mit einer BEREITS BEKANNTEN Zeile geschieht. Diese Regel ist
 * die einzige Stelle zwischen "Resend stellt denselben Webhook nochmal zu" und
 * "der Kunde bekommt zwei Offerten" — deshalb liegt sie als reine Funktion hier
 * und nicht verstreut in zwei Request-Handlern.
 *
 * Zwei Aufrufer mit unterschiedlichen Rechten:
 *   - der Webhook (unauthentifiziert, signaturgeprüft): darf nur einen zuvor
 *     technisch gescheiterten Lauf wiederholen;
 *   - ein Operator in der Review-Oberfläche (angemeldet): darf zusätzlich eine
 *     abgelehnte Mail erneut prüfen lassen — eine bewusste menschliche Entscheidung.
 *
 * In beiden Fällen gilt dieselbe harte Grenze: existiert bereits ein Lead, wird
 * NICHTS mehr verarbeitet.
 */

export interface ExistingInboundRow {
  processing_status: string;
  processing_attempts: number | null;
  lead_id: string | null;
}

export type ClaimRefusal =
  | "lead_exists"
  | "already_processed"
  | "attempts_exhausted"
  | "status_not_retryable";

export type ClaimDecision =
  | { action: "process"; attempt: number }
  | { action: "refuse"; reason: ClaimRefusal };

/** Zustände, aus denen der WEBHOOK erneut starten darf. */
const WEBHOOK_RETRYABLE = ["failed"];

/** Zustände, aus denen ein MENSCH erneut starten darf. */
const OPERATOR_RETRYABLE = ["failed", "rejected"];

const decide = (
  row: ExistingInboundRow,
  maxAttempts: number,
  retryableStatuses: string[],
): ClaimDecision => {
  // Erste und wichtigste Prüfung: ein erzeugter Lead ist unwiderruflich.
  if (row.lead_id) return { action: "refuse", reason: "lead_exists" };

  if (!retryableStatuses.includes(row.processing_status)) {
    return {
      action: "refuse",
      // 'received' / 'processing' / 'needs_review' / 'lead_created' sind kein
      // Fehlerzustand — sie sind entweder in Arbeit oder erledigt.
      reason: row.processing_status === "lead_created"
        ? "already_processed"
        : "status_not_retryable",
    };
  }

  const attempts = row.processing_attempts ?? 0;
  if (attempts >= maxAttempts) return { action: "refuse", reason: "attempts_exhausted" };

  return { action: "process", attempt: attempts + 1 };
};

/** Wiederholte Webhook-Zustellung derselben Nachricht. */
export const decideOnDuplicateDelivery = (
  row: ExistingInboundRow,
  maxAttempts: number,
): ClaimDecision => decide(row, maxAttempts, WEBHOOK_RETRYABLE);

/** "Erneut verarbeiten" aus der Review-Oberfläche. */
export const decideOnOperatorRetry = (
  row: ExistingInboundRow,
  maxAttempts: number,
): ClaimDecision => decide(row, maxAttempts, OPERATOR_RETRYABLE);
