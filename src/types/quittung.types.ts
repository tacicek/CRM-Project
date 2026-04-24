// ============================================================
// Quittung (Receipt) Types
// ============================================================

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

// Predefined service line items pulled from offer
export const PREDEFINED_POSITIONEN: Omit<QuittungPosition, 'id'>[] = [
  { beschreibung: 'Umzug',                    satz: '', betrag: 0, checked: true,  is_custom: false },
  { beschreibung: 'Reinigung',                satz: '', betrag: 0, checked: false, is_custom: false },
  { beschreibung: 'Verpackungsmaterial',      satz: '', betrag: 0, checked: false, is_custom: false },
  { beschreibung: 'Möbelliftmiete',           satz: '', betrag: 0, checked: false, is_custom: false },
  { beschreibung: 'Entsorgung / Räumung',     satz: '', betrag: 0, checked: false, is_custom: false },
  { beschreibung: 'Schwertransportzuschlag',  satz: '', betrag: 0, checked: false, is_custom: false },
  { beschreibung: 'Zusatzleistung',           satz: '', betrag: 0, checked: false, is_custom: false },
  { beschreibung: 'Wegpauschale',             satz: '', betrag: 0, checked: false, is_custom: false },
];

export const CUSTOM_ROW_COUNT = 5;

/** Format CHF amount in Swiss style: CHF 1'234.50 */
export function formatChf(amount: number): string {
  return 'CHF ' + amount.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

export const STATUS_CONFIG: Record<QuittungStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  draft:  { label: 'Entwurf', color: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200' },
  signed: { label: 'Unterzeichnet', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  sent:   { label: 'Versendet', color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  paid:   { label: 'Bezahlt', color: 'text-emerald-700',  bg: 'bg-emerald-50', border: 'border-emerald-200' },
};
