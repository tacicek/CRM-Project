import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { generateQuittungBlob, getArchivedQuittungDocument } from '../../../src/lib/quittungDocuments.tsx';
import { createReceiptDraftFromOrder, buildQuittungDraftPayload, getReceiptOfferAddresses } from '../../../src/lib/quittungDraft.ts';

const output = fileURLToPath(new URL('.', import.meta.url));
const liveCompany = {
  company_name: 'Adresse Testumzüge GmbH', email: 'office@example.invalid',
  street: 'Firmenstrasse', house_number: '5C', plz: '8001', city: 'Zürich', logo_url: null,
};
const source = {
  id: '11111111-1111-4111-8111-111111111111', offer_id: null, customer_id: '22222222-2222-4222-8222-222222222222',
  customer_name: 'Işıl Çiçek', customer_email: 'customer@example.invalid', customer_phone: null,
  from_address: 'Startstrasse 12a, 8706 Meilen', to_address: 'Zielstrasse 8B, 1007 Lausanne',
  language: 'de', vat_rate: 8.1, subtotal: 100, pricing_type: 'fixed', extra_services: [],
  items: [{ id: 'service', description: 'Umzug', quantity: 1, unit: null, unit_price: 100, total: 100, price_type: null }],
};
const frozenOffer = {
  frozen_from_street: 'Startstrasse', frozen_from_house_number: '12a', frozen_from_plz: '8706', frozen_from_city: 'Meilen',
  frozen_to_street: 'Zielstrasse', frozen_to_house_number: '8B', frozen_to_plz: '1007', frozen_to_city: 'Lausanne',
  leads: { from_street: 'Startstrasse', from_house_number: '12a', from_plz: '8706', from_city: 'Meilen', to_street: 'Zielstrasse', to_house_number: '8B', to_plz: '1007', to_city: 'Lausanne' },
};
const receiptFrom = (order = source) => ({
  ...buildQuittungDraftPayload(createReceiptDraftFromOrder(order, '2026-10-26', 8.1), '33333333-3333-4333-8333-333333333333'),
  id: '44444444-4444-4444-8444-444444444444', quittung_nr: 'QU-2026-ADDRESS', version: 1,
  created_at: '2026-10-26T09:00:00Z', updated_at: '2026-10-26T09:00:00Z', issued_at: null,
  payment_status: 'open', paid_amount: 0, payment_open_amount: 108.1,
});
const issued = (receipt, companySnapshot) => ({ ...receipt, issued_at: '2026-10-26T09:00:00Z', status: 'issued', company_snapshot: companySnapshot });
const partialOffer = { ...frozenOffer, frozen_from_house_number: null, frozen_to_house_number: null };
const historicalCompany = { ...liveCompany };
delete historicalCompany.house_number;
const cases = [
  { name: 'manual-complete', receipt: { ...receiptFrom(), customer_address: 'Kundenstrasse 44D\nc/o Beispiel Verwaltung\n8000 Zürich', customer_destination: 'Zielstrasse 8B, 1007 Lausanne' }, customerStreet: 'Kundenstrasse', customerNumber: '44D', expected: [true, true, true] },
  { name: 'offer-complete', receipt: receiptFrom({ ...source, ...getReceiptOfferAddresses(frozenOffer) }), expected: [true, true, true] },
  { name: 'offer-lead-fallback', receipt: receiptFrom({ ...source, ...getReceiptOfferAddresses({ leads: frozenOffer.leads }) }), expected: [true, true, true] },
  { name: 'order-complete', receipt: receiptFrom(), expected: [true, true, true] },
  { name: 'order-missing-number', receipt: receiptFrom({ ...source, from_address: 'Startstrasse, 8706 Meilen', to_address: 'Zielstrasse, 1007 Lausanne' }), expected: [true, false, false] },
  { name: 'offer-partial-frozen', receipt: receiptFrom({ ...source, ...getReceiptOfferAddresses(partialOffer) }), expected: [true, false, false] },
  { name: 'issued-historical-company', receipt: issued(receiptFrom(), historicalCompany), expected: [false, true, true] },
  { name: 'issued-historical-customer', receipt: issued(receiptFrom({ ...source, from_address: 'Startstrasse, 8706 Meilen', to_address: 'Zielstrasse, 1007 Lausanne' }), liveCompany), expected: [true, false, false] },
];
for (const phase of ['before', 'after']) {
  const inputPath = `${output}/modal-source-${phase}.json`;
  if (!fs.existsSync(inputPath)) continue;
  const browserResults = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  for (const row of browserResults) {
    cases.push({
      name: `actual-modal-${phase}-${row.scenario}`,
      receipt: receiptFrom({ ...source, from_address: row.orderForm.from_address || null, to_address: row.orderForm.to_address || null }),
      customerStreet: 'Alte Landstrasse', customerNumber: '12a', destinationStreet: 'Rue du Lac',
      expected: [true, phase === 'after', phase === 'after'],
    });
  }
}

const results = [];
for (const scenario of cases) {
  const blob = await generateQuittungBlob(scenario.receipt, liveCompany);
  const bytes = Buffer.from(await blob.arrayBuffer());
  const filename = `${output}/${scenario.name}.pdf`;
  fs.writeFileSync(filename, bytes);
  const text = execFileSync('pdftotext', ['-layout', filename, '-'], { encoding: 'utf8' });
  fs.writeFileSync(`${output}/${scenario.name}.txt`, text);
  const flat = text.replace(/\s+/g, ' ');
  const observed = [flat.includes('Firmenstrasse 5C'), flat.includes(`${scenario.customerStreet ?? 'Startstrasse'} ${scenario.customerNumber ?? '12a'}`), flat.includes(`${scenario.destinationStreet ?? 'Zielstrasse'} 8B`)];
  const result = {
    scenario: scenario.name, issuerNumberPresent: observed[0], customerOrStartNumberPresent: observed[1], destinationNumberPresent: observed[2],
    matchesExpectedPipelineBehavior: observed.every((value, i) => value === scenario.expected[i]),
    completeAddressAssertionsPass: observed.every(Boolean), sha256: createHash('sha256').update(bytes).digest('hex'),
    input: { issued_at: scenario.receipt.issued_at, liveCompany, company_snapshot: scenario.receipt.company_snapshot ?? null, customer_address: scenario.receipt.customer_address, customer_destination: scenario.receipt.customer_destination },
  };
  results.push(result);
  console.log(JSON.stringify({ scenario: result.scenario, issuer: observed[0], customerOrStart: observed[1], destination: observed[2], expectedBehavior: result.matchesExpectedPipelineBehavior }));
}

const oldDocument = results.find(result => result.scenario === 'issued-historical-customer');
const archiveActions = [];
globalThis.__receiptAddressAuditInvoke = async (name, { body }) => {
  archiveActions.push({ name, action: body.action });
  if (name !== 'send-quittung' || body.action !== 'lookup') throw new Error('Unexpected operation: this is a read-only archive test');
  return { data: { document: { id: '55555555-5555-4555-8555-555555555555', version: 1, sha256: oldDocument.sha256 }, url: 'https://archive.example.invalid/historical-customer.pdf' }, error: null };
};
const archived = await getArchivedQuittungDocument(cases.find(scenario => scenario.name === 'issued-historical-customer').receipt, liveCompany);
const archive = {
  actions: archiveActions, returnedExistingHash: archived.document.sha256 === oldDocument.sha256,
  usedLookupOnly: archiveActions.length === 1 && archiveActions[0].action === 'lookup',
  returnedUrl: archived.url, historicalCustomerNumberPresent: oldDocument.customerOrStartNumberPresent,
};
const summary = { pipelineBehaviorPass: results.every(result => result.matchesExpectedPipelineBehavior) && archive.returnedExistingHash && archive.usedLookupOnly,
  completeAddressScenarios: results.filter(result => result.completeAddressAssertionsPass).length, totalScenarios: results.length, results, archive,
  boundary: 'Real draft mapper, payload builder, company resolver, logo preparation, PDF component and renderer; archive network adapter is a local synthetic lookup. No live reads/writes.' };
fs.writeFileSync(`${output}/address-pipeline-result.json`, JSON.stringify(summary, null, 2) + '\n');
if (!summary.pipelineBehaviorPass || (process.env.AUDIT_REQUIRE_COMPLETE === '1' && results.some(result => !result.completeAddressAssertionsPass))) process.exitCode = 1;
