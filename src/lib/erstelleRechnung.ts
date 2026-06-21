/**
 * Auftrag → Rechnung map — Katman 4 (saf, test edilebilir; Faz 4a / S4).
 *
 * Guard: yalnızca status='abgeschlossen' Auftrag fakturalanır.
 * Kalem kaynağı offer_items (Soll/Ist yok — doküman kararı; faturada manuel düzeltilebilir).
 * Pozisyonlar RechnungPosition şeklinde → generateRechnungPdf doğrudan tüketir.
 *
 * DB/React bilmez: düz veri alır, düz NeueRechnung döner. rechnung_nr + faellig_am
 * DB trigger'ında üretilir; qr_referenz insert sonrası gerçek rechnung_nr ile
 * computeQrReference ile hesaplanır.
 */
import { isQRIBAN, generateQRRReference } from "@/lib/swiss-qr/core";
import type { RechnungPosition } from "@/lib/generateRechnungPdf";

export interface OfferItemInput {
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total: number | null;
}

export interface AuftragInput {
  id: string;
  company_id: string;
  offer_id: string | null;
  status: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  from_address: string | null;
  to_address: string | null;
  vat_rate: number | null;
}

export interface CompanyRefInput {
  iban: string;
}

export interface NeueRechnung {
  company_id: string;
  auftrag_id: string;
  offer_id: string | null;
  customer_name: string;
  customer_address: string | null;
  customer_destination: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  positionen: RechnungPosition[];
  zwischensumme: number;
  mwst_satz: number;
  mwst_betrag: number;
  total: number;
  rabatt: number;
  gesamttotal: number;
  qr_iban: string;
  qr_referenz: string | null;
  status: "entwurf";
}

const DEFAULT_MWST = 8.1;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const erstelleRechnungAusAuftrag = (
  auftrag: AuftragInput,
  offerItems: OfferItemInput[],
  company: CompanyRefInput,
): NeueRechnung => {
  if (auftrag.status !== "abgeschlossen") {
    throw new Error("Nur abgeschlossene Aufträge können fakturiert werden.");
  }
  if (!company.iban?.trim()) {
    throw new Error("Firmen-IBAN fehlt — QR-Rechnung nicht möglich.");
  }

  const positionen: RechnungPosition[] = offerItems
    .filter((it) => (it.description ?? "").trim().length > 0)
    .map((it) => {
      const menge = it.quantity ?? 1;
      const einzelpreis = it.unit_price ?? 0;
      return {
        beschreibung: it.description,
        menge,
        einheit: it.unit,
        einzelpreis,
        betrag: round2(it.total ?? menge * einzelpreis),
      };
    });

  const zwischensumme = round2(positionen.reduce((sum, p) => sum + p.betrag, 0));
  const mwst_satz = auftrag.vat_rate ?? DEFAULT_MWST;
  const mwst_betrag = round2((zwischensumme * mwst_satz) / 100);
  const total = round2(zwischensumme + mwst_betrag);

  return {
    company_id: auftrag.company_id,
    auftrag_id: auftrag.id,
    offer_id: auftrag.offer_id,
    customer_name: auftrag.customer_name,
    customer_address: auftrag.from_address,
    customer_destination: auftrag.to_address,
    customer_email: auftrag.customer_email,
    customer_phone: auftrag.customer_phone,
    positionen,
    zwischensumme,
    mwst_satz,
    mwst_betrag,
    total,
    rabatt: 0,
    gesamttotal: total,
    qr_iban: company.iban.trim(),
    qr_referenz: null, // insert sonrası gerçek rechnung_nr ile hesaplanır
    status: "entwurf",
  };
};

/**
 * Insert sonrası gerçek rechnung_nr ile QR referansı üretir.
 * QR-IBAN → QRR (zorunlu). Normal IBAN → NON (null) — SCOR opsiyonel, MVP'de kullanılmaz.
 */
export const computeQrReference = (rechnungNr: string, iban: string): string | null => {
  if (!isQRIBAN(iban)) return null;
  const base = rechnungNr.replace(/\D/g, "");
  return generateQRRReference(base.length > 0 ? base : "0");
};
