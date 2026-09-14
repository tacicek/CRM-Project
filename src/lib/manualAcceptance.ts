import { evaluateAcceptanceWindow } from "../../supabase/functions/_shared/offerAcceptanceWindow.ts";
import { arbeitsbeginn, type AcceptanceItemRow } from "../../supabase/functions/_shared/acceptanceTermine.ts";

/**
 * Was der Bediener VOR einer manuellen Zusage wissen muss.
 *
 * Die Firma darf auch nach Ablauf der Annahmefrist annehmen — der Kunde hat am
 * Telefon zugesagt, und entscheiden kann nur sie. Die Frist ist aber nicht
 * bedeutungslos: sie sagt, dass Termin und Preis womoeglich nicht mehr stimmen.
 * Deshalb eine Warnung statt einer Sperre, und die schaerfere zuerst: liegt der
 * erste Arbeitstag schon in der Vergangenheit, ist die Frist nebensaechlich.
 *
 * Gerechnet wird mit `arbeitsbeginn` — derselben Regel wie `offer_arbeitsbeginn()`
 * in der Datenbank, die das Auftragsdatum setzt.
 */
export type ManualAcceptanceWarning =
  | { kind: "none" }
  | { kind: "deadlinePassed"; deadline: string }
  | { kind: "workDatePassed"; workDate: string };

export const manualAcceptanceWarning = (
  validUntil: string | null,
  serviceDate: string | null,
  items: ReadonlyArray<AcceptanceItemRow>,
  today: string,
): ManualAcceptanceWarning => {
  const workDate = arbeitsbeginn(items, serviceDate);
  if (workDate && workDate < today) return { kind: "workDatePassed", workDate };

  const window = evaluateAcceptanceWindow(validUntil, workDate, today);
  if (!window.offen && window.frist) return { kind: "deadlinePassed", deadline: window.frist };

  return { kind: "none" };
};

/**
 * `accept_offer_manually` meldet ihre Absagen als feste Kennungen im
 * Fehlertext. Alles andere ist eine Stoerung, keine Absage.
 */
export type ManualAcceptanceFailure = "notOpen" | "superseded" | "notFound" | "failed";

export const manualAcceptanceFailure = (error: unknown): ManualAcceptanceFailure => {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (message.includes("offer_not_open")) return "notOpen";
  if (message.includes("offer_superseded")) return "superseded";
  if (message.includes("offer_not_found")) return "notFound";
  return "failed";
};
