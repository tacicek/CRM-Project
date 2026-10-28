# Customer/start house number: follow-up PDF diagnosis

The reported missing customer/start house number is reproducible **before the PDF renderer**. A frozen offer contains `12a` and `8B`; the pre-fix order-creation modal reads the current lead instead. If that lead has lost those numbers, the order form and saved-order source contain only the street. The receipt mapper preserves those strings, and the real PDF correctly prints the same incomplete address.

**The upstream correction is verified in both affected scenarios.** Actual outputs from the corrected modal now produce `Alte Landstrasse 12a` and `Rue du Lac 8B` in the real PDF, both when the lead numbers were removed and when the lead was absent entirely. All 12 positive/negative pipeline scenarios behave as specified; no PDF component change was needed.

This is a synthetic reproduction of the reported symptom. No particular production receipt was identified or modified in this PDF investigation.

## Reproduced source chain

The real `AuftragModal` browser harness produced the inputs in [modal-source-before.json](modal-source-before.json). They are consumed without editing by `render-address-pipeline.ts`, which runs the real `createReceiptDraftFromOrder` → `buildQuittungDraftPayload` → `generateQuittungBlob` chain, including company resolution, PDF component and renderer.

- Frozen offer: `Alte Landstrasse 12a, 8706 Meilen` and `Rue du Lac 8B, 1007 Lausanne`.
- Order modal when the lead numbers are missing: `Alte Landstrasse` / `Rue du Lac` plus postal/floor lines, without either number.
- [Resulting PDF](actual-modal-before-frozen-offer-lead-number-removed.pdf) / [PNG](actual-modal-before-frozen-offer-lead-number-removed.png): both numbers are absent in extracted text and visibly absent. There is no clipping or missing-glyph problem.
- With the lead missing entirely, the old modal produces empty addresses even though the frozen offer addresses exist. [PDF](actual-modal-before-frozen-offer-lead-missing.pdf).
- The direct offer-to-receipt route and already-complete order strings preserve both numbers in the same renderer.

## Corrected outputs

| Actual order-creation scenario | Before PDF | After PDF | Corrected preview |
| --- | --- | --- | --- |
| Frozen offer complete, current lead numbers removed | [Missing both numbers](actual-modal-before-frozen-offer-lead-number-removed.pdf) | [12a and 8B present](actual-modal-after-frozen-offer-lead-number-removed.pdf) | [PNG](actual-modal-after-frozen-offer-lead-number-removed.png) |
| Frozen offer complete, lead absent | [Addresses missing](actual-modal-before-frozen-offer-lead-missing.pdf) | [12a and 8B present](actual-modal-after-frozen-offer-lead-missing.pdf) | [PNG](actual-modal-after-frozen-offer-lead-missing.png) |

[modal-source-after.json](modal-source-after.json) contains the real corrected modal output consumed by this renderer harness. Both corrected customer/start and destination address assertions pass; extracted text and visual inspection agree. The two before cases intentionally remain negative evidence in the matrix, alongside separate historical-snapshot controls.

## Required fields and persistence boundaries

| Printed address | Renderer input | Source / behavior |
| --- | --- | --- |
| Issuer | `company.street` + `company.house_number` | Drafts use the live company; issued receipts use `company_snapshot`. |
| Customer/start | `quittung.customer_address` | Manual text, or `auftraege.from_address`, or a string assembled from the offer's selected `frozen_from_*` / lead `from_*` address. The house number must already be inside this string. |
| Destination | `quittung.customer_destination` | Corresponding order `to_address` or offer/lead destination fields. The number must already be inside this string. |
| Canonical customer's postal address | Not independently queried by this receipt flow | `customer_id` supplies the linked customer identity. A number existing only in the customer card does not automatically repair the receipt's saved service address. |

The receipt has one customer/start address string; it does not independently store and print a billing address plus a separate start address. The source order must therefore carry its complete intended service address.

Existing draft receipts load their own saved strings; fixing the source order does not silently overwrite them. Issued receipts and archived PDFs retain their captured content. The archive control verifies that `getArchivedQuittungDocument` performs only `lookup` and returns the existing document hash/URL, without generating a replacement from current data. A historical PDF missing a number will not change merely because a live source or renderer is corrected.

## Earlier verification gap

The earlier PDF suite manually supplied complete customer addresses. Its order-form test also started with an already-complete `auftraege.from_address`. It verified faithful copying and rendering, but did not cover offer → order creation with missing or changed lead data. That upstream boundary is now covered by the real modal reproduction and its actual output is passed through the real PDF generation chain.

The matrix additionally keeps incomplete historical company snapshots, incomplete saved customer addresses and partial frozen offer snapshots as negative controls. These demonstrate that the renderer cannot reconstruct absent historical data and must not be mistaken for newly introduced rendering failures.

## Reproduce

```bash
node --loader ./docs/audits/quittung-address-followup-2026-10-26/ts-loader.mjs ./docs/audits/quittung-address-followup-2026-10-26/render-address-pipeline.ts
# Strict completeness check: intentionally fails for preserved historical/negative controls.
AUDIT_REQUIRE_COMPLETE=1 node --loader ./docs/audits/quittung-address-followup-2026-10-26/ts-loader.mjs ./docs/audits/quittung-address-followup-2026-10-26/render-address-pipeline.ts
```

Normal execution asserts that all positive and negative controls behave exactly as specified. Strict completeness mode exits 1 if any scenario lacks an expected address number. Results are written to [address-pipeline-result.json](address-pipeline-result.json); the captured strict failure is in [address-completeness-red.log](address-completeness-red.log). All test identities, addresses and documents are synthetic; there are no live writes.
