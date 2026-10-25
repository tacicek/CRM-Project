import { describe, expect, it, vi } from 'vitest';
import { parseQuittungCompanySnapshot, type Quittung } from '@/types/quittung.types';
import { resolveQuittungCompany } from '@/lib/quittungDocuments';
import { getReceiptOfferAddresses, type ReceiptOfferAddressSource } from '@/lib/quittungDraft';
import { formatReceiptStreet } from '@/lib/receiptAddress';

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
