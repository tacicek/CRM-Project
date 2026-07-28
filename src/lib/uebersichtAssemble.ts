import { deriveWorkItemStatus, pickCurrentOffer } from "@/lib/uebersichtStatus";
import type { OfferForStatus, WorkItem } from "@/types/uebersicht";

const MS_PER_DAY = 86_400_000;

/** Nur die Spalten, die die Übersicht wirklich liest. */
export type LeadRow = {
  id: string;
  service_type: string | null;
  from_city: string | null;
  to_city: string | null;
  created_at: string;
};

export type OfferRow = OfferForStatus & {
  lead_id: string | null;
  total: number | null;
};

export type AuftragRow = {
  lead_id: string | null;
  offer_id: string | null;
  scheduled_date: string | null;
};

/**
 * Verbindet Anfragen, Offerten und Aufträge zum Ansichtsmodell.
 *
 * Rein und ohne Datenbank, damit die riskante Stelle prüfbar bleibt: die
 * Verknüpfung. `offers` ist versioniert, also darf hier **nicht** je Offerte
 * ein Vorgang entstehen, sondern je Anfrage genau einer — mit den Werten der
 * aktuellen Revision.
 *
 * Die Reihenfolge der Anfragen bleibt erhalten; sortiert wird in der Abfrage,
 * nicht hier.
 */
export const assembleWorkItems = (
  leads: readonly LeadRow[],
  offers: readonly OfferRow[],
  auftraege: readonly AuftragRow[],
  now: Date,
): WorkItem[] => {
  const offersByLead = new Map<string, OfferRow[]>();
  for (const offer of offers) {
    if (offer.lead_id === null) continue;
    const bucket = offersByLead.get(offer.lead_id);
    if (bucket) bucket.push(offer);
    else offersByLead.set(offer.lead_id, [offer]);
  }

  return leads.map((lead) => {
    const leadOffers = offersByLead.get(lead.id) ?? [];
    const current = pickCurrentOffer(leadOffers) as OfferRow | null;

    // Ein Auftrag hängt entweder an der Anfrage oder an der Offerte — je
    // nachdem, aus welchem Schritt er entstanden ist.
    const auftrag =
      auftraege.find(
        (candidate) =>
          (candidate.lead_id !== null && candidate.lead_id === lead.id) ||
          (current !== null && candidate.offer_id === current.id),
      ) ?? null;

    const status = deriveWorkItemStatus(current, auftrag !== null, now);

    const sentAt = current === null ? null : current.sent_at;
    const daysOpen =
      sentAt === null
        ? null
        : Math.floor((now.getTime() - new Date(sentAt).getTime()) / MS_PER_DAY);

    return {
      id: lead.id,
      leadId: lead.id,
      serviceType: lead.service_type,
      title: lead.service_type ?? "",
      from: lead.from_city,
      to: lead.to_city,
      status,
      amountChf: current?.total ?? null,
      daysOpen,
      jobDate: auftrag?.scheduled_date ?? null,
      createdAt: lead.created_at,
    };
  });
};
