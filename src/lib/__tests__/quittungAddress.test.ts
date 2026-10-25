import { describe, expect, it, vi } from 'vitest';
import { parseQuittungCompanySnapshot, type Quittung } from '@/types/quittung.types';
import { resolveQuittungCompany } from '@/lib/quittungDocuments';
import { getReceiptOfferAddresses, type ReceiptOfferAddressSource } from '@/lib/quittungDraft';
import { formatReceiptStreet } from '@/lib/receiptAddress';
import { getOfferAddressSnapshot, type OfferAddressSource } from '@/lib/offerAddressSnapshot';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const company = {
  company_name: 'Çiçek Umzüge', email: 'receipt@example.invalid',
  street: 'Alte Landstrasse', house_number: '12a', plz: '8706', city: 'Meilen',
};
const receipt = (patch: Partial<Quittung> = {}) => ({ issued_at: null, company_snapshot: null, ...patch }) as Quittung;

describe('receipt issuer address preservation', () => {
  it('keeps the separate house number when parsing a saved company snapshot', () => {
    expect(parseQuittungCompanySnapshot(company)).toMatchObject({ street: 'Alte Landstrasse', house_number: '12a' });
  });
  it('passes the full live issuer address to a draft PDF', () => {
    expect(resolveQuittungCompany(receipt(), company)).toMatchObject({ street: 'Alte Landstrasse', house_number: '12a' });
  });
  it('uses the frozen house number after the current company address changes', () => {
    expect(resolveQuittungCompany(receipt({ issued_at: '2026-10-26T12:00:00Z', company_snapshot: company }),
      { ...company, house_number: '99' })).toMatchObject({ house_number: '12a' });
  });
  it('does not invent a house number in a historical snapshot that never captured it', () => {
    const legacy = { company_name: company.company_name, email: company.email, street: company.street };
    expect(resolveQuittungCompany(receipt({ issued_at: '2026-10-26T12:00:00Z', company_snapshot: legacy }), company).house_number).toBeUndefined();
  });
  it('rejects a malformed number instead of silently discarding it', () => {
    expect(parseQuittungCompanySnapshot({ ...company, house_number: 12 })).toBeNull();
  });
});

describe('receipt addresses from an offer', () => {
  const offer: ReceiptOfferAddressSource = {
    frozen_from_street: 'Alte Landstrasse', frozen_from_house_number: '12a', frozen_from_plz: '8706', frozen_from_city: 'Meilen',
    frozen_to_street: 'Rue du Lac', frozen_to_house_number: '8B', frozen_to_plz: '1007', frozen_to_city: 'Lausanne',
    leads: { from_street: 'Neue Strasse', from_house_number: null, from_plz: '8000', from_city: 'Zürich' },
  };
  it('keeps both captured house numbers even when the lead was changed or removed', () => {
    const expected = { from_address: 'Alte Landstrasse 12a, 8706 Meilen', to_address: 'Rue du Lac 8B, 1007 Lausanne' };
    expect(getReceiptOfferAddresses(offer)).toEqual(expected);
    expect(getReceiptOfferAddresses({ ...offer, leads: null })).toEqual(expected);
  });
  it('uses the lead for an address without any captured offer fields', () => {
    expect(getReceiptOfferAddresses({ leads: {
      from_street: 'Çiğdem Sokak', from_house_number: '5/2', from_plz: '8000', from_city: 'Zürich',
      to_street: 'Rue de l’Église', to_house_number: '8B', to_plz: '1007', to_city: 'Lausanne',
    } })).toEqual({ from_address: 'Çiğdem Sokak 5/2, 8000 Zürich', to_address: 'Rue de l’Église 8B, 1007 Lausanne' });
  });
  it('does not append a newer lead number to an older frozen street', () => {
    expect(getReceiptOfferAddresses({ frozen_from_street: 'Old address', frozen_from_house_number: null,
      leads: { from_street: 'New address', from_house_number: '77' } }).from_address).toBe('Old address');
  });
  it('leaves absent addresses empty rather than manufacturing separators', () => {
    expect(getReceiptOfferAddresses({ leads: null })).toEqual({ from_address: null, to_address: null });
  });
  it('joins structured issuer fields without dropping Unicode or alphanumeric numbers', () => {
    expect(formatReceiptStreet('Rue de l’Église', '12a')).toBe('Rue de l’Église 12a');
    expect(formatReceiptStreet(null, null)).toBe('');
  });
});

describe('shared offer address source for orders and receipts', () => {
  const offer: OfferAddressSource = {
    frozen_from_street: 'Alte Landstrasse', frozen_from_house_number: '12a', frozen_from_plz: '8706', frozen_from_city: 'Meilen',
    frozen_from_floor: 0, frozen_from_has_lift: false,
    frozen_to_street: 'Rue du Lac', frozen_to_house_number: '8B', frozen_to_plz: '1007', frozen_to_city: 'Lausanne',
    frozen_to_floor: 2, frozen_to_has_lift: true,
    leads: { from_street: 'Alte Landstrasse', from_house_number: null, from_floor: 9, from_has_lift: true,
      to_street: 'Rue du Lac', to_house_number: null, to_floor: 4, to_has_lift: false },
  };
  it('uses the complete captured origin when the lead loses its number or changes access details', () => {
    expect(getOfferAddressSnapshot(offer, 'from')).toEqual({ street: 'Alte Landstrasse', house_number: '12a',
      plz: '8706', city: 'Meilen', floor: 0, has_lift: false });
  });
  it('keeps both captured addresses when the source lead was removed', () => {
    expect(getOfferAddressSnapshot({ ...offer, leads: null }, 'from').house_number).toBe('12a');
    expect(getOfferAddressSnapshot({ ...offer, leads: null }, 'to')).toEqual({ street: 'Rue du Lac', house_number: '8B',
      plz: '1007', city: 'Lausanne', floor: 2, has_lift: true });
  });
  it('uses the lead independently for a direction with no captured postal fields', () => {
    const mixed: OfferAddressSource = { frozen_from_street: 'Captured', frozen_from_house_number: '5/2',
      leads: { from_street: 'New street', from_house_number: '99', to_street: 'Rue de l’Église',
        to_house_number: '8B', to_plz: '1007', to_city: 'Lausanne', to_floor: 0, to_has_lift: false } };
    expect(getOfferAddressSnapshot(mixed, 'from').house_number).toBe('5/2');
    expect(getOfferAddressSnapshot(mixed, 'to')).toEqual({ street: 'Rue de l’Église', house_number: '8B',
      plz: '1007', city: 'Lausanne', floor: 0, has_lift: false });
  });
  it('does not manufacture missing frozen fields from a newer lead', () => {
    expect(getOfferAddressSnapshot({ frozen_from_street: 'Old street',
      leads: { from_street: 'New street', from_house_number: '77', from_floor: 3, from_has_lift: true } }, 'from'))
      .toEqual({ street: 'Old street', house_number: null, plz: null, city: null, floor: null, has_lift: null });
  });
  it('does not mutate the source snapshot while preparing either direction', () => {
    const before = structuredClone(offer);
    getOfferAddressSnapshot(offer, 'from'); getOfferAddressSnapshot(offer, 'to');
    expect(offer).toEqual(before);
  });
});
