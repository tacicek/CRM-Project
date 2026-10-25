import type { Database, Json } from "@/integrations/supabase/types";
import { toLocale, type Locale } from "@/i18n/locale";
import { documentI18nFor } from "@/i18n/documentLocale";
import { isFreeItem } from "@/lib/offerPricing";
import { round2 } from "@/lib/offerSurcharges";
import { calculateTotals, validateQuittungPositionen, type Quittung, type QuittungPosition } from "@/types/quittung.types";

export interface QuittungDraft {
  offer_id: string | null;
  auftrag_id: string | null;
  rechnung_id: string | null;
  customer_id: string | null;
  language: Locale;
  datum: string;
  customer_name: string;
  customer_address: string;
  customer_destination: string;
  customer_email: string;
  customer_phone: string;
  positionen: QuittungPosition[];
  mwst_satz: number;
  rabatt: number;
  notiz: string;
  kunde_unterschrift: string | null;
  teamchef_unterschrift: string | null;
  kunde_signed_at: string | null;
  teamchef_signed_at: string | null;
}

export const emptyQuittungDraft = (datum: string, language: Locale, vatRate: number): QuittungDraft => ({
  offer_id: null, auftrag_id: null, rechnung_id: null, customer_id: null,
  language, datum, customer_name: '', customer_address: '', customer_destination: '',
  customer_email: '', customer_phone: '', positionen: [], mwst_satz: vatRate, rabatt: 0,
  notiz: '', kunde_unterschrift: null, teamchef_unterschrift: null,
  kunde_signed_at: null, teamchef_signed_at: null,
});

export const draftFromQuittung = (q: Quittung): QuittungDraft => ({
  offer_id: q.offer_id ?? null, auftrag_id: q.auftrag_id ?? null, rechnung_id: q.rechnung_id ?? null,
  customer_id: q.customer_id ?? null, language: toLocale(q.language), datum: q.datum,
  customer_name: q.customer_name, customer_address: q.customer_address ?? '',
  customer_destination: q.customer_destination ?? '', customer_email: q.customer_email ?? '',
  customer_phone: q.customer_phone ?? '', positionen: q.positionen.map(p => ({ ...p })),
  mwst_satz: q.mwst_satz, rabatt: q.rabatt, notiz: q.notiz ?? '',
  kunde_unterschrift: q.kunde_unterschrift ?? null, teamchef_unterschrift: q.teamchef_unterschrift ?? null,
  kunde_signed_at: q.kunde_signed_at ?? null, teamchef_signed_at: q.teamchef_signed_at ?? null,
});

export interface QuittungSourceItem {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total?: number | null;
  price_type?: string | null;
}

export interface QuittungOrderSource {
  id: string;
  offer_id: string | null;
  customer_id: string | null;
  customer_name: string;
  from_address: string | null;
  to_address: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  language: string | null;
  vat_rate: number | null;
  subtotal: number | null;
  pricing_type: string | null;
  items: QuittungSourceItem[];
  extra_services: QuittungSourceItem[];
}

/** The order's accepted net amount applies to its original items, never to on-site extras.
 * Optional rows remain visible but unselected. Included rows stay explicitly free.
 * A net amount below the billable rows is a receipt discount; a higher accepted net amount
 * gets a named reconciliation row, so an offer-level surcharge does not silently disappear.
 */
export const createReceiptDraftFromOrder = (
  source: QuittungOrderSource, datum: string, defaultVatRate: number,
): QuittungDraft => {
  const language = toLocale(source.language);
  const draft = emptyQuittungDraft(datum, language, source.vat_rate ?? defaultVatRate);
  const { t } = documentI18nFor(language);
  const mapItem = (item: QuittungSourceItem, prefix: string): QuittungPosition => ({
    id: `${prefix}-${item.id}`, source_item_id: item.id, beschreibung: item.description,
    satz: '', menge: item.quantity, einheit: item.unit, einzelpreis: item.unit_price,
    betrag: item.price_type === 'inkl' ? 0 : round2(item.total ?? item.quantity * item.unit_price),
    checked: item.price_type !== 'optional', is_custom: true, price_type: item.price_type ?? null,
  });
  const items = source.items.map(item => mapItem(item, 'order'));
  const raw = round2(items.filter((p, i) => !isFreeItem(source.items[i].price_type)).reduce((sum, p) => sum + p.betrag, 0));
  let rabatt = 0;
  if (source.pricing_type !== 'hourly' && source.subtotal !== null) {
    const adjustment = round2(source.subtotal - raw);
    if (adjustment < 0) rabatt = -adjustment;
    if (adjustment > 0) items.push({
      id: `order-${source.id}-adjustment`, beschreibung: t('receipt.sourceAdjustment'),
      satz: '', betrag: adjustment, checked: true, is_custom: true,
    });
  }
  return {
    ...draft, auftrag_id: source.id, offer_id: source.offer_id, customer_id: source.customer_id,
    customer_name: source.customer_name, customer_address: source.from_address ?? '',
    customer_destination: source.to_address ?? '', customer_email: source.customer_email ?? '',
    customer_phone: source.customer_phone ?? '', rabatt,
    positionen: [...items, ...source.extra_services.map(item => mapItem(item, 'extra'))],
  };
};

export type QuittungValidationError = 'receipt.invalid.date' | 'receipt.invalid.name' |
  'receipt.invalid.email' | 'receipt.invalid.items' | 'receipt.invalid.money' |
  'receipt.invalid.total' | 'receipt.invalid.signature';

const validDate = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(new Date(`${date}T00:00:00Z`).getTime()) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

/** Drafts may omit customer/items; issuing and sending must satisfy the complete contract. */
export const validateQuittungDraft = (draft: QuittungDraft, mode: 'draft' | 'issue' | 'send'): QuittungValidationError | null => {
  if (!validDate(draft.datum)) return 'receipt.invalid.date';
  if (mode !== 'draft' && !draft.customer_name.trim()) return 'receipt.invalid.name';
  const email = draft.customer_email.trim();
  if ((mode === 'send' || email !== '') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'receipt.invalid.email';
  if (!validateQuittungPositionen(draft.positionen).ok || draft.positionen.some(p =>
    p.betrag < 0 || (typeof p.menge === 'number' && p.menge < 0) || (typeof p.einzelpreis === 'number' && p.einzelpreis < 0) ||
    (mode !== 'draft' && p.checked && !p.beschreibung.trim()))) return 'receipt.invalid.items';
  const totals = calculateTotals(draft.positionen, draft.mwst_satz, draft.rabatt);
  if (Object.values(totals).some(value => !Number.isFinite(value)) || !Number.isFinite(draft.mwst_satz) || draft.mwst_satz < 0 || draft.mwst_satz > 100 ||
      !Number.isFinite(draft.rabatt) || draft.rabatt < 0 || draft.rabatt > totals.zwischensumme) return 'receipt.invalid.money';
  if (mode !== 'draft' && totals.gesamttotal <= 0) return 'receipt.invalid.total';
  if ([draft.kunde_unterschrift, draft.teamchef_unterschrift].some(sig => sig !== null && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig))) return 'receipt.invalid.signature';
  return null;
};

const serializePosition = (p: QuittungPosition): Json => ({
  id: p.id, beschreibung: p.beschreibung, satz: p.satz, checked: p.checked,
  betrag: round2(p.betrag), is_custom: p.is_custom, menge: p.menge ?? null,
  einheit: p.einheit ?? null, einzelpreis: p.einzelpreis ?? null,
  source_item_id: p.source_item_id ?? null, price_type: p.price_type ?? null,
});

/** Explicit nullable links: unlinking is a database update, not an omitted JSON property. */
export const buildQuittungDraftPayload = (draft: QuittungDraft, companyId: string): Database['public']['Tables']['quittungen']['Insert'] => ({
  company_id: companyId, customer_id: draft.customer_id, offer_id: draft.offer_id,
  auftrag_id: draft.auftrag_id, rechnung_id: draft.rechnung_id, language: draft.language,
  datum: draft.datum, customer_name: draft.customer_name.trim(),
  customer_address: draft.customer_address || null, customer_destination: draft.customer_destination || null,
  customer_email: draft.customer_email.trim() || null, customer_phone: draft.customer_phone || null,
  positionen: draft.positionen.map(serializePosition), mwst_satz: draft.mwst_satz,
  rabatt: round2(draft.rabatt), ...calculateTotals(draft.positionen, draft.mwst_satz, draft.rabatt),
  status: 'draft', betrag_noch_offen: true, notiz: draft.notiz || null,
  kunde_unterschrift: draft.kunde_unterschrift, teamchef_unterschrift: draft.teamchef_unterschrift,
  kunde_signed_at: draft.kunde_signed_at, teamchef_signed_at: draft.teamchef_signed_at,
});

export const isQuittungFrozen = (q: Quittung | null): boolean => q !== null && (q.status !== 'draft' || !!q.issued_at);

export const receiptToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
