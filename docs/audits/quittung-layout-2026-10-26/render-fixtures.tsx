import React from 'react';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToFile } from '@react-pdf/renderer';
import { QuittungPDF } from '../../../src/components/quittung/QuittungPDF.tsx';
import { calculateTotals } from '../../../src/types/quittung.types.ts';
import { getReceiptOfferAddresses } from '../../../src/lib/quittungDraft.ts';

const output = fileURLToPath(new URL('.', import.meta.url));
const image = (name: string) => 'data:image/png;base64,' + fs.readFileSync(new URL(name, import.meta.url)).toString('base64');
const company = {
  company_name: 'Beispiel Umzug & Logistik GmbH',
  logo_url: image('fixture-logo.png'), primary_color: '#234E52',
  street: 'Bahnhofstrasse', house_number: '5', plz: '8001', city: 'Zürich',
  email: 'kontakt@example.invalid', phone: '+41 00 000 00 00',
  mwst_number: 'CHE-000.000.000 MWST', iban: 'CH00 0000 0000 0000 0000 0',
  bank_name: 'Beispielbank', bewertungs_url: null,
};
const texts = {
  de: ['Umzug von Meilen nach Lausanne', 'Fahrzeug und Transportversicherung', 'Verpackungsmaterial', 'Schutzdecken und Montagezubehör', 'Optionale Endreinigung'],
  fr: ['Déménagement de Meilen à Lausanne', 'Véhicule et assurance transport', 'Matériel d’emballage', 'Couvertures de protection et accessoires de montage', 'Nettoyage final facultatif'],
  en: ['Move from Meilen to Lausanne', 'Vehicle and transport insurance', 'Packing materials', 'Protective blankets and assembly supplies', 'Optional final cleaning'],
};
const positionsFor = (locale: keyof typeof texts) => texts[locale].map((description, index) => ({
  id: `item-${index}`, beschreibung: description, satz: '',
  menge: index === 0 ? 3 : 1,
  einheit: index === 0 ? (locale === 'de' ? 'Std.' : 'h') : null,
  einzelpreis: [220, 150, 75, 0, 400][index],
  betrag: [660, 150, 75, 0, 400][index], checked: index !== 4, is_custom: true,
  price_type: index === 3 ? 'inkl' : index === 4 ? 'optional' : null,
}));
const makeReceipt = (locale: keyof typeof texts = 'de') => {
  const positionen = positionsFor(locale);
  const totals = calculateTotals(positionen, 8.1, 35);
  return {
    id: '11111111-1111-4111-8111-111111111111', company_id: '22222222-2222-4222-8222-222222222222',
    language: locale, quittung_nr: 'QU-2026-0126', datum: '2026-10-26',
    customer_name: 'Işıl Çiçek',
    customer_address: 'Alte Landstrasse 12a\nc/o Beispiel Verwaltung, Haus C, 3. Obergeschoss\n8706 Meilen\nSchweiz',
    customer_destination: 'Rue du Lac 8B\n1007 Lausanne\nSuisse',
    customer_email: 'isilaudit@example.invalid', customer_phone: '+41 00 000 00 01',
    positionen, ...totals, mwst_satz: 8.1, rabatt: 35,
    status: 'issued', issued_at: '2026-10-26T09:30:00Z',
    payment_status: 'paid', paid_amount: totals.gesamttotal, payment_open_amount: 0,
    payment_date: '2026-10-26', payment_method: 'bank', payment_reference: 'BANK-2026-0126',
    betrag_noch_offen: false, notiz: 'INTERNAL-NOTE-MUST-NOT-PRINT',
    created_at: '2026-10-26T09:00:00Z', updated_at: '2026-10-26T09:30:00Z', version: 1,
  };
};
const cases = [
  { name: 'de-standard', quittung: makeReceipt('de'), company, locale: 'de' },
  { name: 'de-without-logo', quittung: makeReceipt('de'), company: { ...company, logo_url: null }, locale: 'de' },
  { name: 'fr-partial-invoice', quittung: { ...makeReceipt('fr'), rechnung_id: 'invoice-fixture', payment_status: 'partial', paid_amount: 300, payment_open_amount: 618.85 }, company, locale: 'fr' },
  { name: 'en-open-invoice', quittung: { ...makeReceipt('en'), rechnung_id: 'invoice-fixture', payment_status: 'open', paid_amount: 0, payment_open_amount: 918.85, payment_date: null, payment_method: null, payment_reference: null }, company, locale: 'en' },
  { name: 'de-signed', quittung: { ...makeReceipt('de'), status: 'signed', kunde_unterschrift: image('signature.png'), teamchef_unterschrift: image('signature.png'), kunde_signed_at: '2026-10-26T09:29:00Z', teamchef_signed_at: '2026-10-26T09:30:00Z' }, company, locale: 'de' },
  { name: 'de-worksheet', quittung: { ...makeReceipt('de'), status: 'draft', issued_at: null, payment_status: 'open', paid_amount: 0, payment_open_amount: 918.85 }, company, locale: 'de', mode: 'worksheet' },
];
const offerAddresses = getReceiptOfferAddresses({
  frozen_from_street: 'Alte Landstrasse', frozen_from_house_number: '12a',
  frozen_from_plz: '8706', frozen_from_city: 'Meilen',
  frozen_to_street: 'Rue du Lac', frozen_to_house_number: '8B',
  frozen_to_plz: '1007', frozen_to_city: 'Lausanne',
  leads: { from_street: 'CURRENT-LEAD-NOT-TO-PRINT', from_house_number: '999', to_street: 'CURRENT-DESTINATION-NOT-TO-PRINT' },
});
cases.push({ name: 'de-offer-address-pipeline', quittung: { ...makeReceipt(), customer_address: offerAddresses.from_address, customer_destination: offerAddresses.to_address }, company, locale: 'de' });
const highPositions = [{ id: 'high-total', beschreibung: 'Internationaler Spezialtransport', satz: 'Pauschal', checked: true, is_custom: true, betrag: 1234567.89 }];
const highTotals = calculateTotals(highPositions, 8.1, 0);
for (const locale of ['de', 'fr', 'en'] as const) cases.push({ name: `${locale}-high-amount`, quittung: { ...makeReceipt(locale), positionen: highPositions, ...highTotals, rabatt: 0, paid_amount: highTotals.gesamttotal }, company, locale });
const longPositions = Array.from({ length: 45 }, (_, index) => ({
  id: `long-${index + 1}`, beschreibung: `Leistung ${String(index + 1).padStart(2, '0')}: Fachgerechter Transport empfindlicher Gegenstände, Demontage und Montage mit Verpackung, Schutzmaterial und dokumentierter Übergabe am Zielort.`,
  satz: `RATE-${String(index + 1).padStart(2, '0')}`, betrag: (index + 1) * 25,
  checked: true, is_custom: true,
}));
const longTotals = calculateTotals(longPositions, 8.1, 35);
cases.push({ name: 'de-multipage', quittung: { ...makeReceipt(), positionen: longPositions, ...longTotals, paid_amount: longTotals.gesamttotal }, company, locale: 'de' });
const extreme = [{ ...longPositions[0], beschreibung: 'Spezialbehandlung mit Verpackung, Demontage, Einzelprüfung und Schutztransport. '.repeat(130), satz: 'EXTREME-ROW', betrag: 1000 }];
const extremeTotals = calculateTotals(extreme, 8.1, 0);
cases.push({ name: 'de-long-metadata', quittung: { ...makeReceipt(), customer_name: 'Işıl Çiçek, Verwaltung der internationalen Arbeitsgemeinschaft für nachhaltige Logistik und Kulturtransporte', customer_address: 'Alte Landstrasse 12a\nc/o Beispiel Verwaltung, Abteilung Internationale Koordination\nHaus C, 3. Obergeschoss, Eingang im Innenhof\nPostfach 318\n8706 Meilen\nSchweiz', positionen: extreme, ...extremeTotals, rabatt: 0, paid_amount: extremeTotals.gesamttotal }, company: { ...company, company_name: 'Beispiel Internationale Umzugs- und Spezialtransportgesellschaft mit umfassendem Logistikservice GmbH' }, locale: 'de' });

for (const fixture of cases.filter(fixture => !process.env.AUDIT_CASE || fixture.name === process.env.AUDIT_CASE)) {
  await renderToFile(<QuittungPDF {...fixture} />, `${output}/${fixture.name}.pdf`);
  console.log(`Rendered ${fixture.name}`);
}
