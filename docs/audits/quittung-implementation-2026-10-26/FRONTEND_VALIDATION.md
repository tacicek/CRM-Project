# Quittung frontend validation — 26 October 2026

The implementation uses the real receipt form, signature component and payment dialog. Browser checks replace Supabase and document delivery with in-memory adapters: they verify UI decisions and request payloads, not actual database authorization, email delivery or PDF rendering. Database/Edge/PDF checks are recorded separately.

## Reproduce

From the repository root:

```bash
npm test -- --run src/lib/__tests__/quittungDraft.test.ts src/types/__tests__/quittung.types.test.ts
node docs/audits/quittung-implementation-2026-10-26/browser-flow.cjs
node docs/audits/quittung-implementation-2026-10-26/signature-resize.cjs
```

The browser scripts use the installed Playwright Chromium and esbuild. They use only synthetic customer/company data. No production endpoint or actual email recipient is contacted.

## Results

- Pure tests: **29 passed**, including 16 receipt draft/financial conversion cases.
- [Browser scenarios](browser-flow-results.json): **10 passed**, no browser exception.
- [Signature resizing](signature-resize-results.json): active strokes survive resize; a saved raster signature remains identical and the imperative ref returns it unchanged.
- Frontend TypeScript check passed after the generated receipt schema contract was added.
- ESLint: 0 errors in the seven owned source/test files.

Browser scenarios cover:

1. Order conversion preserves optional selection, zero VAT, discount, customer language and Unicode identity; save navigates to the real record ID.
2. Replacing an offer clears absent contact data; removing the source writes explicit null links.
3. The global finalize action captures both currently drawn signatures and freezes the customer fields.
4. First direct email action receives the canonical issued record including its number and ID; no signature is fabricated.
5. A receipt refresh does not clear a payment reference being entered.
6. Direct payment issues the receipt and calls `record_quittung_payment`.
7. An explicitly linked invoice uses `record_payment` and never calls `record_quittung_payment`.
8. An external invoice payment and its reversal update the open detail screen through receipt change notifications.
9. A failed save does not display a preview; the server error remains readable and retry succeeds.
10. An optimistic concurrency conflict does not overwrite the newer record.

## Source ownership

- `src/lib/quittungDraft.ts`: source mapping, draft hydration, validation, explicit persistence payload, lifecycle predicate.
- `src/pages/firma/QuittungDetail.tsx`: one draft plus canonical saved record, version-checked saves, finalize, invoice selection, payment actions and refresh.
- `src/pages/firma/Auftraege.tsx`: route the source order ID to receipt creation rather than copying a partial pricing payload.
- `src/components/quittung/SignaturePad.tsx`: separate saved raster presentation from active drawing strokes.
- `src/types/quittung.types.ts`: issued/payment/snapshot contract and consistent monetary rounding.

The earlier audit directory is preserved as historical evidence. The original failures are not overwritten with passing results.
