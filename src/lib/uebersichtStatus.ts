import type { OfferForStatus, WorkItemStatus } from "@/types/uebersicht";

/** Nach so vielen Tagen ohne Antwort gilt eine Offerte als überfällig. */
export const OFFER_OVERDUE_DAYS = 2;

const MS_PER_DAY = 86_400_000;

/**
 * Die eine gültige Offerte einer Anfrage.
 *
 * `offers` ist versioniert: eine Revision setzt `superseded_at` auf ihre
 * Vorgängerin. Ohne diesen Filter erschiene jede Anfrage so oft in der
 * Übersicht, wie ihre Offerte überarbeitet wurde.
 */
export const pickCurrentOffer = (offers: readonly OfferForStatus[]): OfferForStatus | null => {
  const open = offers.filter((offer) => offer.superseded_at === null);
  if (open.length === 0) return null;
  return open.reduce((best, offer) =>
    (offer.version_number ?? 0) > (best.version_number ?? 0) ? offer : best,
  );
};

const daysBetween = (from: string, now: Date): number =>
  (now.getTime() - new Date(from).getTime()) / MS_PER_DAY;

/**
 * Der Zustand eines Vorgangs.
 *
 * Die Reihenfolge der Prüfungen ist bedeutungstragend: eine angenommene
 * Offerte bleibt gewonnen, auch wenn ihre Gültigkeit inzwischen abgelaufen ist.
 *
 * `hasAuftrag` entscheidet **nicht** über `gewonnen`, solange eine Offerte
 * vorliegt — das Anlegen des Auftrags ist der nächste Arbeitsschritt, nicht die
 * Bedingung für den Abschluss. Nur wenn keine gültige Offerte mehr existiert,
 * ist ein vorhandener Auftrag der einzige verbliebene Beleg für den Gewinn.
 */
export const deriveWorkItemStatus = (
  offer: OfferForStatus | null,
  hasAuftrag: boolean,
  now: Date,
): WorkItemStatus => {
  if (offer === null) return hasAuftrag ? "gewonnen" : "neu";
  if (offer.accepted_at !== null) return "gewonnen";
  if (offer.rejected_at !== null) return "abgelehnt";
  if (offer.valid_until !== null && new Date(offer.valid_until).getTime() < now.getTime()) {
    return "abgelehnt";
  }
  // Ein Entwurf war nie beim Kunden; ohne Versanddatum ist keine Frist berechenbar.
  if (offer.status === "draft" || offer.sent_at === null) return "neu";
  return daysBetween(offer.sent_at, now) > OFFER_OVERDUE_DAYS ? "ueberfaellig" : "offeriert";
};
