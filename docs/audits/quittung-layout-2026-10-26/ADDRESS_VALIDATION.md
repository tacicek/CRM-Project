# Quittung address correction — 26 October 2026

The issuer's house number was stored separately in `companies.house_number`, but the receipt path omitted it from the company SELECT, snapshot type/parser, PDF preparation schema and SQL company-snapshot builder. Consequently a number such as `12a` never reached the PDF renderer. The PDF header also rendered only the street; the layout change addresses that final layer separately.

Offer-based receipt creation had an additional source issue: it assembled addresses exclusively from the current lead and ignored the offer's `frozen_from_*` / `frozen_to_*` address fields. A changed or deleted lead could remove a house number that was still recorded on the offer. Order-based receipts already carry complete `from_address` / `to_address` strings; these remain verbatim, including house suffixes, c/o text, accents and line breaks. Customer canonical postal addresses are not substituted for service origin/destination addresses.

## Corrections

- The detail and list company queries, `ReceiptCompanySnapshot`, its parser and `quittungDocuments` now preserve `house_number`.
- `formatReceiptStreet` joins the separately stored street and number. It does not parse or rewrite authored address strings.
- `getReceiptOfferAddresses` uses each captured offer address as a whole; if that direction has no captured fields, it uses the corresponding lead address. It never combines an old frozen street with a newer lead's number.
- The new migration `20261025190708_quittung_company_house_number.sql` changes only the private snapshot builder. Newly issued receipts capture the issuer number. The already deployed lifecycle migration is unchanged.
- Existing issued snapshots and archived PDFs are not rewritten. Missing historical numbers are not filled from current company settings.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Real company snapshot parser / PDF preparation regression | 4 failed, 1 historical-preservation case passed | All address tests pass |
| Finalization SQL regression Q44 | Failed: issuer house number missing | Q44–Q46 pass: capture, freeze, no later number injection |
| Real receipt form using deployed `3008c183` caller | Failed: frozen origin address/house number missing | 2 browser scenarios pass |
| Targeted unit suites | — | 3 files, **40 tests passed** |
| Full guarded SQL suite | — | **13/13 files, 46 receipt assertions passed** |
| Existing snapshot fingerprint around helper migration | Captured before | Identical afterward |
| Frontend TypeScript / owned-file ESLint | — | Passed / 0 errors |

The browser uses the real React receipt form and save payload construction with in-memory Supabase/document adapters. It verifies captured origin `Alte Landstrasse 12a, 8706 Meilen`, destination `Rue du Lac 8B, 1007 Lausanne`, original customer name `Işıl Çiçek`, and unchanged multiline order addresses through save. It does not claim real database authorization or email delivery. SQL execution used only the verified disposable `crm-test` container; no production data was changed during implementation verification.

Evidence: [unit before](address-unit-before.log), [unit after](address-unit-after.log), [SQL before](address-sql-before.log), [SQL after](address-sql-after.log), [full SQL suite](address-full-db-suite.log), [browser before](address-browser-before.log), [browser results](address-browser-results.json), [snapshot before](address-snapshots-before-migration.log), [snapshot after](address-snapshots-after-migration.log).

## Reproduce

```bash
npm test -- --run src/lib/__tests__/quittungAddress.test.ts src/lib/__tests__/quittungDraft.test.ts src/types/__tests__/quittung.types.test.ts
node docs/audits/quittung-layout-2026-10-26/address-browser.cjs
CRM_TEST_ENV=1 bash scripts/test-db.sh
```

The guarded SQL runner requires its existing local admin-password environment and rebuilds only the dedicated disposable database. For the browser before-fix comparison, save the deployed `3008c183:src/pages/firma/QuittungDetail.tsx` to `/tmp/QuittungDetail-before-address.tsx`, then set `QUITTUNG_ADDRESS_BEFORE=1` for the browser command. No application source is overwritten.

The [production read-only probe](house-number-production-readonly.sql) is prepared for the rollout owner. Before/after receipt count and existing-snapshot fingerprint must match; afterward the builder must include `house_number`, all accessible company snapshots must carry the field, and helper execution rights must remain `anon=false`, `authenticated=true`, `service_role=true`. This probe has been validated locally; production application belongs to the coordinated rollout.
