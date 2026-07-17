// ============================================================
// Quittung (Receipt) Types
// ============================================================
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import type { Database } from "@/integrations/supabase/types";

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

export type QuittungPositionenResult =
  | { ok: true; value: QuittungPosition[] }
  | { ok: false };

const isPositionRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isFinitePositionNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const isQuittungPosition = (p: unknown): p is QuittungPosition =>
  isPositionRecord(p) &&
  typeof p.id === "string" &&
  typeof p.beschreibung === "string" &&
  typeof p.satz === "string" &&
  isFinitePositionNumber(p.betrag) &&
  typeof p.checked === "boolean" &&
  typeof p.is_custom === "boolean" &&
  (p.menge === null || p.menge === undefined || isFinitePositionNumber(p.menge)) &&
  (p.einheit === null || p.einheit === undefined || typeof p.einheit === "string");

/**
 * Fail-closed validation of the `quittungen.positionen` JSON column.
 * null/undefined → valid empty list; non-array or ANY malformed row → failure (never
 * silently coerced to [] or filtered). Pure; no mutation; amounts unchanged.
 */
export const validateQuittungPositionen = (raw: unknown): QuittungPositionenResult => {
  if (raw === null || raw === undefined) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false };
  const valid = raw.filter(isQuittungPosition);
  return valid.length === raw.length ? { ok: true, value: valid } : { ok: false };
};

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

type QuittungRow = Database["public"]["Tables"]["quittungen"]["Row"];

export type QuittungMapResult =
  | { ok: true; value: Quittung }
  | { ok: false; reason: "invalid_status" | "invalid_positionen" };

/**
 * Type guard for the receipt status. The DB enforces exactly these four values
 * (`quittungen_status_check`), so an out-of-range value is a data-integrity signal —
 * never coerced to 'draft'.
 */
export const isQuittungStatus = (value: unknown): value is QuittungStatus =>
  value === "draft" || value === "signed" || value === "sent" || value === "paid";

/**
 * Narrow a raw `quittungen` DB row into the validated Quittung view-model. Fails closed
 * on an out-of-range status or malformed positionen (both DB-impossible under the CHECK /
 * NOT NULL constraints, so this guards against schema drift / corruption). Financial
 * snapshot fields, nullable `auftrag_id`/`offer_id`, and `quittung_nr` pass through
 * unchanged — no zeroing, no fake document number. Pure; does not mutate the row.
 */
export const mapQuittungRow = (row: QuittungRow): QuittungMapResult => {
  if (!isQuittungStatus(row.status)) return { ok: false, reason: "invalid_status" };
  const positionen = validateQuittungPositionen(row.positionen);
  if (!positionen.ok) return { ok: false, reason: "invalid_positionen" };
  const status: QuittungStatus = row.status;
  return { ok: true, value: { ...row, status, positionen: positionen.value } };
};
