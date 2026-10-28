# Quittung PDF layout validation — 2026-10-26

The real `QuittungPDF` component was rendered with `@react-pdf/renderer`, bundled DejaVu fonts, and anonymous synthetic data. No production customer records, live changes, or email delivery were used by this PDF harness.

**Final result: 246 / 246 checks passed across 12 PDFs (24 A4 pages).** The check count fell from the intermediate 248 because the worksheet now fits one page and no longer needs a second page's geometry/footer checks; the new one-page worksheet regression was added.

## Representative outputs

| Scenario | PDF | Preview | Pages |
| --- | --- | --- | ---: |
| German, paid, full customer address with house 12a | [PDF](de-standard.pdf) | [PNG](de-standard.png) | 1 |
| Issuer without a logo | [PDF](de-without-logo.pdf) | [PNG](de-without-logo.png) | 1 |
| French, partially paid linked invoice | [PDF](fr-partial-invoice.pdf) | [PNG](fr-partial-invoice.png) | 1 |
| English, open linked invoice | [PDF](en-open-invoice.pdf) | [PNG](en-open-invoice.png) | 1 |
| Two genuine image signatures | [PDF](de-signed.pdf) | [PNG](de-signed.png) | 1 |
| Explicit worksheet with three handwriting rows | [PDF](de-worksheet.pdf) | [PNG](de-worksheet.png) | 1 |
| Frozen offer address through the real address helper | [PDF](de-offer-address-pipeline.pdf) | [PNG](de-offer-address-pipeline.png) | 1 |
| 1.2 million base amount, German | [PDF](de-high-amount.pdf) | [PNG](de-high-amount.png) | 1 |
| 1.2 million base amount, French | [PDF](fr-high-amount.pdf) | [PNG](fr-high-amount.png) | 1 |
| 1.2 million base amount, English | [PDF](en-high-amount.pdf) | [PNG](en-high-amount.png) | 1 |
| 45 long service rows | [PDF](de-multipage.pdf) | [Page 2](de-multipage-page2.png), [last page](de-multipage-page6.png) | 6 |
| Long issuer/customer/address and one 10,000-character description | [PDF](de-long-metadata.pdf) | [Page 1](de-long-metadata.png), [last page](de-long-metadata-page8.png) | 8 |

The pre-redesign synthetic baseline is retained as [baseline-paid.pdf](baseline-paid.pdf) and [baseline-paid.png](baseline-paid.png).

## Verified behavior

- Single clear title, document number and dates; aligned issuer/customer/destination blocks; subdued table borders; separate payment details and emphasized final total.
- `Bahnhofstrasse 5`, `Alte Landstrasse 12a`, `Rue du Lac 8B`, full c/o/floor/postal/country text, and the original Unicode name `Işıl Çiçek` survive rendering.
- The source-address fixture uses `getReceiptOfferAddresses`; frozen street/number/postcode/city win over a deliberately different current lead address.
- No word bounding boxes overlap; all text stays inside 40pt horizontal and 20pt vertical page margins. Monetary item values align at the same 545.28pt right edge, including large amounts.
- Every page contains the correct receipt number and localized page x/y in the footer. Each item continuation page repeats the table headings exactly once. Summary-only pages have no irrelevant table headings.
- All 45 row descriptions stay on the same page as their rate. All 130 repetitions in the extreme description survive pagination; none are truncated.
- Final unsigned receipts contain no empty signature fields. The signed receipt fits one A4 page with both signatures, Zurich timestamps, closing text and footer.
- The worksheet is visibly marked as not being proof of payment, keeps blank totals and signature lines, and fits one A4 page with three handwriting rows.
- French partial and English open invoice payment/balance labels remain correct. Internal notes do not enter the PDF.

Manual visual inspection covered the standard German receipt, French partial invoice, signed output, worksheet, French large amount, long first page, continuation item page, and final summary page.

## Issues caught during this layout pass

1. An inherited page-level line height hid the fixed footer. It was removed; text-specific line heights remain.
2. The initial redesign pushed an ordinary signed receipt onto a mostly empty second page. Modest spacing changes restored a single page without reducing receipt font sizes.
3. A global fixed table header appeared on summary-only pages. Scoping it to the wrapping item table removed the phantom headings while preserving repeated headings on actual item pages.
4. The worksheet initially placed only signatures on page 2. Worksheet-specific logo and row spacing, and omission of receipt-only closing/bank content, restored one page.

All four have explicit checks in the final generated evidence. The bounding-box test is a geometric text check; raster inspection additionally verified the visible layout, signature images and logo.

## Reproduce

From the repository root:

```bash
node --loader ./docs/audits/quittung-layout-2026-10-26/ts-loader.mjs ./docs/audits/quittung-layout-2026-10-26/render-fixtures.tsx
python3 docs/audits/quittung-layout-2026-10-26/verify-layout.py
python3 docs/audits/quittung-layout-2026-10-26/render-previews.py
```

The verifier uses Poppler `pdftotext` bounding boxes and extracted text. The preview script uses `pdftoppm` and removes this harness's stale continuation PNGs after page-count changes. Machine-readable results: [layout-verification.json](layout-verification.json).
