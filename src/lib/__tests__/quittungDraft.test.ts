import { describe, expect, it } from 'vitest';
import {
  createReceiptDraftFromOrder, emptyQuittungDraft, validateQuittungDraft,
  buildQuittungDraftPayload, draftFromQuittung, isQuittungFrozen, type QuittungOrderSource,
} from '@/lib/quittungDraft';
import { calculateTotals, type Quittung } from '@/types/quittung.types';

const source = (patch: Partial<QuittungOrderSource> = {}): QuittungOrderSource => ({
  id: 'order-1', offer_id: 'offer-1', customer_id: 'customer-1',
  customer_name: 'Işıl Çiçek', customer_email: 'customer@example.invalid', customer_phone: null,
  from_address: 'Çiğdem 5', to_address: null, language: 'fr', vat_rate: 8.1,
  subtotal: 1000, pricing_type: 'fixed', items: [
    { id: 'main', description: 'Déménagement', quantity: 1, unit: 'forfait', unit_price: 1000, total: 1000, price_type: 'pauschale' },
    { id: 'optional', description: 'Emballage', quantity: 1, unit: 'forfait', unit_price: 300, total: 300, price_type: 'optional' },
    { id: 'included', description: 'Cartons', quantity: 10, unit: 'pièce', unit_price: 10, total: 100, price_type: 'inkl' },
  ], extra_services: [], ...patch,
});
const create = (patch: Partial<QuittungOrderSource> = {}) => createReceiptDraftFromOrder(source(patch), '2026-10-26', 8.1);
const amount = (draft: ReturnType<typeof create>) => calculateTotals(draft.positionen, draft.mwst_satz, draft.rabatt).gesamttotal;

describe('receipt creation from accepted order terms', () => {
  it('does not charge an unaccepted optional service or an included service', () => {
    const draft = create();
    expect(amount(draft)).toBe(1081);
    expect(draft.positionen.find(p => p.source_item_id === 'optional')).toMatchObject({ checked: false, betrag: 300, price_type: 'optional' });
    expect(draft.positionen.find(p => p.source_item_id === 'included')).toMatchObject({ checked: true, betrag: 0, price_type: 'inkl' });
  });
  it('allows explicit acceptance of an optional service', () => {
    const draft = create();
    const optional = draft.positionen.find(p => p.source_item_id === 'optional')!;
    optional.checked = true;
    expect(amount(draft)).toBe(1405.3);
  });
  it('preserves zero VAT instead of applying a default', () => {
    const draft = create({ vat_rate: 0 });
    expect(draft.mwst_satz).toBe(0);
    expect(amount(draft)).toBe(1000);
  });
  it('preserves the discounted accepted subtotal and does not discount on-site extras', () => {
    const draft = create({ subtotal: 900, extra_services: [{ id: 'extra', description: 'Montage', quantity: 2, unit: 'h', unit_price: 100 }] });
    expect(draft.rabatt).toBe(100);
    expect(amount(draft)).toBe(1189.1);
    expect(amount(create({ subtotal: 900 }))).toBe(972.9);
  });
  it('keeps an accepted offer-level surcharge as an explicit reconciliation row', () => {
    const draft = create({ subtotal: 1150 });
    expect(draft.rabatt).toBe(0);
    expect(draft.positionen.find(p => p.id.endsWith('-adjustment'))).toMatchObject({ betrag: 150, checked: true });
    expect(amount(draft)).toBe(1243.15);
  });
  it('does not infer an accepted final price from a provisional hourly subtotal', () => {
    const draft = create({ pricing_type: 'hourly', subtotal: 900 });
    expect(draft.rabatt).toBe(0);
    expect(draft.positionen).toHaveLength(3);
  });
  it('preserves the customer document language, identity, Unicode and source quantities', () => {
    const draft = create();
    expect(draft).toMatchObject({ language: 'fr', customer_name: 'Işıl Çiçek', customer_address: 'Çiğdem 5', customer_id: 'customer-1', auftrag_id: 'order-1', offer_id: 'offer-1' });
    expect(draft.positionen[0]).toMatchObject({ menge: 1, einheit: 'forfait', einzelpreis: 1000, source_item_id: 'main' });
  });
  it('does not retain previous customer data when the next source has empty fields', () => {
    const before = create();
    const after = create({ customer_name: 'B', customer_email: null, from_address: null });
    expect(before.customer_email).not.toBe('');
    expect(after).toMatchObject({ customer_name: 'B', customer_email: '', customer_address: '' });
  });
  it('preserves complete authored order addresses without reparsing house numbers or extra lines', () => {
    const address = 'Çiğdem Sokak 5/2\nc/o Işıl Çiçek, Haus C\n8000 Zürich';
    const destination = 'Rue du Lac 8B\n1007 Lausanne';
    const draft = create({ from_address: address, to_address: destination });
    expect(draft.customer_address).toBe(address);
    expect(draft.customer_destination).toBe(destination);
    expect(buildQuittungDraftPayload(draft, 'company')).toMatchObject({ customer_address: address, customer_destination: destination });
  });
});

describe('receipt validation and payload contract', () => {
  it('allows an incomplete draft but requires a customer when issuing', () => {
    const draft = emptyQuittungDraft('2026-10-26', 'de', 8.1);
    expect(validateQuittungDraft(draft, 'draft')).toBeNull();
    expect(validateQuittungDraft(draft, 'issue')).toBe('receipt.invalid.name');
  });
  it('requires an actual positive service before issuing', () => {
    const draft = { ...emptyQuittungDraft('2026-10-26', 'de', 8.1), customer_name: 'Test' };
    expect(validateQuittungDraft(draft, 'issue')).toBe('receipt.invalid.total');
  });
  it('requires a valid recipient only when sending or when a recipient was entered', () => {
    const draft = { ...create(), customer_email: '' };
    expect(validateQuittungDraft(draft, 'issue')).toBeNull();
    expect(validateQuittungDraft(draft, 'send')).toBe('receipt.invalid.email');
    expect(validateQuittungDraft({ ...draft, customer_email: 'broken' }, 'draft')).toBe('receipt.invalid.email');
  });
  it('rejects invalid calendar dates, nonfinite values, negative amounts and excessive discount', () => {
    expect(validateQuittungDraft({ ...create(), datum: '2026-02-30' }, 'draft')).toBe('receipt.invalid.date');
    expect(validateQuittungDraft({ ...create(), mwst_satz: NaN }, 'draft')).toBe('receipt.invalid.money');
    expect(validateQuittungDraft({ ...create(), rabatt: 2000 }, 'draft')).toBe('receipt.invalid.money');
    const draft = create(); draft.positionen[0].betrag = -1;
    expect(validateQuittungDraft(draft, 'issue')).toBe('receipt.invalid.items');
  });
  it('requires descriptions on charged lines and valid signature payloads', () => {
    const draft = create(); draft.positionen[0].beschreibung = ' ';
    expect(validateQuittungDraft(draft, 'issue')).toBe('receipt.invalid.items');
    expect(validateQuittungDraft({ ...create(), kunde_unterschrift: 'not-an-image' }, 'issue')).toBe('receipt.invalid.signature');
  });
  it('serializes link removal as null and never writes server-owned status metadata', () => {
    const payload = buildQuittungDraftPayload({ ...create(), offer_id: null, auftrag_id: null, rechnung_id: null }, 'company');
    expect(payload).toMatchObject({ offer_id: null, auftrag_id: null, rechnung_id: null, betrag_noch_offen: true });
    expect(JSON.parse(JSON.stringify(payload)).offer_id).toBeNull();
    for (const key of ['version', 'issued_at', 'sent_at', 'payment_status', 'payment_id', 'paid_amount', 'company_snapshot']) expect(payload).not.toHaveProperty(key);
  });
  it('rounds the financial chain consistently to cents', () => {
    const draft = create({ subtotal: null });
    draft.positionen = [{ id: '1', beschreibung: 'a', satz: '', checked: true, is_custom: true, betrag: 0.1 }, { id: '2', beschreibung: 'b', satz: '', checked: true, is_custom: true, betrag: 0.2 }];
    expect(calculateTotals(draft.positionen, 8.1, 0)).toEqual({ zwischensumme: 0.3, total: 0.3, mwst_betrag: 0.02, gesamttotal: 0.32 });
    draft.positionen.forEach(p => { p.betrag = 0.005; });
    expect(calculateTotals(draft.positionen, 0, 0).gesamttotal).toBe(0.02);
  });
  it('hydrates a separate editable copy and recognizes unsigned issued documents as frozen', () => {
    const draft = create();
    const q: Quittung = { ...draft,
      ...calculateTotals(draft.positionen, draft.mwst_satz, draft.rabatt),
      id: 'q', company_id: 'company', quittung_nr: 'QU-2026-0001', status: 'issued',
      betrag_noch_offen: true, created_at: '', updated_at: '' };
    const editable = draftFromQuittung(q);
    editable.positionen[0].betrag = 2;
    expect(q.positionen[0].betrag).toBe(1000);
    expect(isQuittungFrozen(q)).toBe(true);
    expect(isQuittungFrozen(null)).toBe(false);
  });
});
