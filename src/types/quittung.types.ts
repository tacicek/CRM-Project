// ============================================================
// Quittung (Receipt) Types
// ============================================================
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";

export interface QuittungPosition {
  id: string;
  beschreibung: string;
  /** Text description of the rate, e.g. "3 Std. × CHF 50" */
  satz: string;
  betrag: number;
  /** Whether this position is included in the total */
  checked: boolean;
  menge?: number | null;
  einheit?: string | null;
  /** false = predefined from offer, true = custom row added on-site */
  is_custom: boolean;
}

export type QuittungStatus = 'draft' | 'signed' | 'sent' | 'paid';

export interface Quittung {
  id: string;
  company_id: string;
  offer_id?: string | null;
  auftrag_id?: string | null;
  /** Customer language, frozen from the lead/offer. Drives the PDF + e-mail locale. */
  language: string;
  quittung_nr: string;
  datum: string; // ISO date string
  customer_name: string;
  customer_address?: string | null;
  customer_destination?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  positionen: QuittungPosition[];
  zwischensumme: number;
  mwst_satz: number;
  mwst_betrag: number;
  total: number;
  rabatt: number;
  gesamttotal: number;
  kunde_unterschrift?: string | null;
  teamchef_unterschrift?: string | null;
  kunde_signed_at?: string | null;
  teamchef_signed_at?: string | null;
  status: QuittungStatus;
  betrag_noch_offen: boolean;
  pdf_url?: string | null;
  notiz?: string | null;
  created_at: string;
  updated_at: string;
}

// For creating/updating
export type QuittungInsert = Omit<Quittung, 'id' | 'quittung_nr' | 'created_at' | 'updated_at'>;
export type QuittungUpdate = Partial<QuittungInsert>;

// With company join for list view
export interface QuittungWithCompany extends Quittung {
  companies?: {
    company_name: string;
    logo_url?: string | null;
    primary_color?: string | null;
    email: string;
    phone?: string | null;
    street?: string | null;
    plz?: string | null;
    city?: string | null;
    mwst_number?: string | null;
    iban?: string | null;
    bank_name?: string | null;
    bewertungs_url?: string | null;
  };
}

/**
 * The eight rows a new receipt starts with.
 *
 * These are not UI chrome: whatever stands here is written into `quittungen.positionen`
 * and printed verbatim on the customer's receipt. They therefore follow the DOCUMENT
 * locale, not the operator's — a German operator writing a receipt for a French customer
 * gets (and sees) "Déménagement", which is exactly the text the customer will read.
 *
 * The receipt form shows these rows as read-only labels, so picker and document text are
 * the same string; there is no second, operator-language label to render.
 */
export const getPredefinedPositionen = (locale: Locale): Omit<QuittungPosition, 'id'>[] => {
  const { t } = documentI18nFor(locale);
  const row = (
    beschreibung: string,
    checked: boolean,
  ): Omit<QuittungPosition, 'id'> => ({
    beschreibung,
    satz: '',
    betrag: 0,
    checked,
    is_custom: false,
  });
  return [
    row(t('doc.receipt.item.umzug'), true),
    row(t('doc.receipt.item.reinigung'), false),
    row(t('doc.receipt.item.packingMaterial'), false),
    row(t('doc.receipt.item.liftRental'), false),
    row(t('doc.receipt.item.disposal'), false),
    row(t('doc.receipt.item.heavySurcharge'), false),
    row(t('doc.receipt.item.extraService'), false),
    row(t('doc.receipt.item.travelFlatRate'), false),
  ];
};

export const CUSTOM_ROW_COUNT = 5;

/** Calculate totals from positionen */
export function calculateTotals(
  positionen: QuittungPosition[],
  mwstSatz: number,
  rabatt: number,
): {
  zwischensumme: number;
  mwst_betrag: number;
  total: number;
  gesamttotal: number;
} {
  const zwischensumme = positionen
    .filter(p => p.checked)
    .reduce((sum, p) => sum + (p.betrag || 0), 0);

  const total = Math.max(0, zwischensumme - (rabatt || 0));
  const mwst_betrag = Math.round(total * (mwstSatz / 100) * 100) / 100;
  const gesamttotal = total + mwst_betrag;

  return { zwischensumme, mwst_betrag, total, gesamttotal };
}

/**
 * Colour/variant only — the label comes from `getQuittungStatusLabel(status, locale)`
 * (@/i18n/domain), because the same status is rendered in the operator's language on the
 * dashboard and in the customer's language on documents.
 */
export const STATUS_CONFIG: Record<QuittungStatus, {
  color: string;
  bg: string;
  border: string;
}> = {
  draft:  { color: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200' },
  signed: { color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  sent:   { color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200' },
  paid:   { color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
};
