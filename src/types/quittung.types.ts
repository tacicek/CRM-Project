// ============================================================
// Quittung (Receipt) Types
// ============================================================
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import type { Database } from "@/integrations/supabase/types";
import { round2 } from "@/lib/offerSurcharges";

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
  einzelpreis?: number | null;
  source_item_id?: string | null;
  price_type?: string | null;
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
  (p.einheit === null || p.einheit === undefined || typeof p.einheit === "string") &&
  (p.einzelpreis === null || p.einzelpreis === undefined || isFinitePositionNumber(p.einzelpreis));

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

export type QuittungStatus = 'draft' | 'issued' | 'signed' | 'sent' | 'paid';
export type QuittungPaymentStatus = 'open' | 'partial' | 'paid';

export interface ReceiptCompanySnapshot {
  company_name: string;
  email: string;
  logo_url?: string | null;
  primary_color?: string | null;
  phone?: string | null;
  street?: string | null;
  plz?: string | null;
  city?: string | null;
  mwst_number?: string | null;
  iban?: string | null;
  bank_name?: string | null;
  bewertungs_url?: string | null;
}

export const parseQuittungCompanySnapshot = (value: unknown): ReceiptCompanySnapshot | null => {
  if (!isPositionRecord(value) || typeof value.company_name !== 'string' || typeof value.email !== 'string') return null;
  const optional = ['logo_url', 'primary_color', 'phone', 'street', 'plz', 'city', 'mwst_number', 'iban', 'bank_name', 'bewertungs_url'] as const;
  if (optional.some(key => value[key] !== null && value[key] !== undefined && typeof value[key] !== 'string')) return null;
  return {
    company_name: value.company_name, email: value.email,
    ...Object.fromEntries(optional.map(key => [key, value[key]])),
  };
};

export interface Quittung {
  id: string;
  company_id: string;
  offer_id?: string | null;
  auftrag_id?: string | null;
  rechnung_id?: string | null;
  payment_status?: QuittungPaymentStatus;
  paid_amount?: number;
  payment_open_amount?: number;
  payment_date?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  issued_at?: string | null;
  sent_at?: string | null;
  company_snapshot?: ReceiptCompanySnapshot | null;
  version?: number;
  /** Customer language, frozen from the lead/offer. Drives the PDF + e-mail locale. */
  language: string;
  quittung_nr: string;
  datum: string; // ISO date string
  customer_name: string;
  customer_address?: string | null;
  customer_destination?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  /** Kanonischer Kunde (20260728110000). Nur fuer den Verweis auf die Kundenkarte —
   *  die customer_*-Felder daneben bleiben der eingefrorene Stand des Belegs. */
  customer_id?: string | null;
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
  /** Der Zahlungseingang, den diese Quittung bescheinigt (20260729130000).
   *  NULL heisst: noch nicht kassiert. Der Umsatz wird ueber `payments`
   *  gezaehlt, damit Rechnung und Quittung nicht doppelt zaehlen. */
  payment_id?: string | null;
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
  const zwischensumme = round2(positionen
    .filter(p => p.checked)
    .reduce((sum, p) => sum + round2(p.betrag || 0), 0));

  const total = round2(Math.max(0, zwischensumme - round2(rabatt || 0)));
  const mwst_betrag = round2(total * (mwstSatz / 100));
  const gesamttotal = round2(total + mwst_betrag);

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
  issued: { color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  signed: { color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  sent:   { color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200' },
  paid:   { color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
};

type QuittungRow = Database["public"]["Tables"]["quittungen"]["Row"];

export type QuittungMapResult =
  | { ok: true; value: Quittung }
  | { ok: false; reason: "invalid_status" | "invalid_positionen" | "invalid_payment_status" | "invalid_company_snapshot" };

/**
 * Type guard for the receipt status. The DB enforces exactly these four values
 * (`quittungen_status_check`), so an out-of-range value is a data-integrity signal —
 * never coerced to 'draft'.
 */
export const isQuittungStatus = (value: unknown): value is QuittungStatus =>
  value === "draft" || value === "issued" || value === "signed" || value === "sent" || value === "paid";

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
  const rawPaymentStatus = 'payment_status' in row ? row.payment_status : undefined;
  if (rawPaymentStatus !== undefined && rawPaymentStatus !== 'open' && rawPaymentStatus !== 'partial' && rawPaymentStatus !== 'paid') return { ok: false, reason: 'invalid_payment_status' };
  const paymentStatus: QuittungPaymentStatus | undefined = rawPaymentStatus === 'open' || rawPaymentStatus === 'partial' || rawPaymentStatus === 'paid' ? rawPaymentStatus : undefined;
  const rawSnapshot = 'company_snapshot' in row ? row.company_snapshot : null;
  const snapshot = parseQuittungCompanySnapshot(rawSnapshot);
  if (rawSnapshot !== null && rawSnapshot !== undefined && !snapshot) return { ok: false, reason: 'invalid_company_snapshot' };
  return { ok: true, value: { ...row, status, payment_status: paymentStatus, company_snapshot: snapshot, positionen: positionen.value } };
};
