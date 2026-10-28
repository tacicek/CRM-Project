# Customer origin house-number follow-up

Source commit: `41554245629a0e89aa249b22694082041dba698d`.
Coolify application: `36` / `bymhk0pd41d3vgms4iz87lqb`.
Exact-commit deployment: `bdaria3u7eqm3h10ritvlwmi`.

Frontend deployment finished successfully at `2026-10-25T19:51:22Z`. The running container uses the exact source commit and is healthy. Public health/routes, JavaScript assets and fonts passed HTTP checks; two fresh unauthenticated Chromium sessions reached the login screen without page or asset errors. These production checks do not claim an authenticated user PDF flow or an existing-record repair.

[Container](frontend-container.json), [public HTTP](frontend-public-smoke.json), [browser smoke](frontend-browser-smoke.json).

The user clarified that the missing number is in the customer/origin address. This investigation found two separate issues. They must not be conflated when reporting completion.

## Existing receipt data

The original receipt importer selected street, postal code and city but omitted the separate house number. Existing `quittungen.customer_address` strings therefore already lacked the number before PDF generation. The earlier source correction did not repair these persisted strings. The renderer faithfully prints the saved value; an existing archive faithfully retains the earlier PDF bytes.

Read-only production inspection found eight unsigned draft rows matching the old numberless formatter exactly, with a complete frozen source that predates the receipt. Strict customer-link validation narrows this to seven; the mismatched record must be excluded. Two signed receipts also match the old formatter, but require separate handling: `QU-2026-0026` has two signatures and an existing archive; `QU-2026-0002` has two signatures and its source address was frozen after receipt creation, so that source cannot prove the historical number.

No receipt, payment, signature, archive or source record was changed in production. No repair SQL was applied. The user's specific receipt number remains unconfirmed. This release does **not** claim to correct their existing PDF; the signed/archive correction remains open pending identification and a suitable revision workflow.

## New order creation

The actual offer-to-order modal independently discarded captured offer addresses and rebuilt them only from the current lead. A deleted lead prevented prefill entirely. A shared selector now supplies the complete frozen address to both Auftrag and Quittung creation, keeping each direction intact. Floor/lift values also agree between the displayed address and stored service details. Existing authored order addresses are preserved. New and edited orders retain a zero VAT rate instead of replacing it with 8.1.

The four source/test files were copied into the isolated release clone. Unrelated workspace changes were not published. No Edge Function or database deployment is needed for this source correction; automatic deployments remain disabled.

## Verification

- Full unit suite: 122 files, 2,250 tests passed.
- Application and test-infrastructure TypeScript checks passed; production Vite build passed.
- ESLint: zero errors, one existing `PaginationBar.tsx` Fast Refresh warning.
- Real modal save INSERT/UPDATE through the saved order into the receipt payload: 5/5 scenarios passed. Synthetic DB boundaries; no live writes.
- Actual PDF rendering reproduces the number loss before the fix and displays `12a` / `8B` after it. Historical incomplete-record and archive-preservation cases remain explicit negative controls.
- Independent review caught a floor/lift mismatch during implementation; the final save-payload comparison verifies consistent frozen access details. No open regression was found.

[Read-only existing-data diagnosis](../../../docs/audits/quittung-address-2026-10-26/DIAGNOSIS.md), [order source evidence](../../../docs/audits/quittung-house-number-2026-10-26/ORDER_SOURCE_VALIDATION.md), [actual PDF evidence](../../../docs/audits/quittung-address-followup-2026-10-26/ADDRESS_PIPELINE_DIAGNOSIS.md), [deployment enqueue](frontend-enqueue.json), [deployment status](frontend-deployment-status.jsonl).
