# Quittung PDF layout and house-number rollout

This follow-up implements the user's request for a more professional receipt PDF and the missing address number. The previous deployment authorization continues for the same CRM feature. Working-session date: 26 October 2026 (Asia/Bangkok); deployment timestamps below are UTC.

## Release

- Application: https://crm-hirschen.ch
- Source commit: `c3915408ab7c65394d48fa618237b1900b43a4f2`, pushed to `tacicek/CRM-Project` main.
- Previous frontend: `3008c18344de51f12d6aaba8673d5cd97ec72115`.
- Coolify application ID `36`, UUID `bymhk0pd41d3vgms4iz87lqb`.
- Exact-commit deployment UUID: `uxa6zmojfzvi53wwgsgu1ldo`.
- Auto-deploy remains disabled. Only the intended source files were copied to the isolated release clone; unrelated local `.gitignore` and `translate-content` changes were excluded.

## Live result

Deployment finished at `2026-10-25T19:16:20Z`. Container
`bymhk0pd41d3vgms4iz87lqb-20261025T191307` is healthy and runs the exact source commit.
All nine public HTTP checks passed: health, both receipt routes, current index and three receipt chunks, plus both byte-identical DejaVu fonts.

Fresh Chromium sessions reached `/auth` from both receipt routes and displayed the login form in approximately 2.8 seconds, with no page errors, missing assets, failed/pending requests or API mutations. The first probe timed out while waiting for `networkidle`; its evidence is retained. The final reproducible probe uses DOMContentLoaded plus visible login, successful document response and current entry JavaScript as concrete readiness assertions.

[Status](frontend-deployment-status.jsonl), [public checks](frontend-public-smoke.json), [browser checks](frontend-browser-smoke.json), [container](frontend-container.json).

## Changes

The issuer's separate `house_number` now survives the company queries, snapshot parser, document preparation and PDF header. The new database helper captures it for newly issued receipts. Offer-based creation uses each frozen origin/destination address as a complete snapshot, falling back to the current lead only when that direction has no captured address. Authored order addresses and original Unicode names remain unchanged.

The PDF uses a clear document heading, separate customer/destination blocks, readable typography, aligned prices and a prominent total. Empty signature boxes are omitted from unsigned receipts. Ordinary signed receipts and the handwriting worksheet fit one A4 page. Continuation table headings repeat only while the item table continues, with document identity and page numbers on every page.

## Database deployment

Only `20261025190708_quittung_company_house_number.sql` was applied. SHA256:
`4d1b71a55d5db293c4fa71a5278d85608f002231aefc4be7ff74dd6819e7e0a4`.

The exact target cluster identity was checked immediately before execution. The helper replacement committed successfully with stop-on-error and bounded lock/statement timeouts. No receipt UPDATE, historical backfill or Edge runtime change was required.

[Before](schema-before.log) / [after](schema-after.log) checks:

- Receipt count remains 26.
- Existing company-snapshot fingerprint is unchanged: `ee7ce3f715441616c3198d4fccdb679a`.
- Snapshot builder's `house_number` key changed from absent to present.
- All 2 current company snapshots produced by the helper contain the new key; both company profiles also have a nonempty number ([availability check](company-number-availability.log)).
- Execution privileges remain `anon=false`, `authenticated=true`, `service_role=true`.

A validated full database archive was created before the change at `/data/crm-rollouts/quittung-layout-20261026/database-before.dump` (4,156,864 bytes; SHA256 `2d94235b4f9a41eb387b7fbd218ac1694b5436d0ef4ac04520475bdbddb2350b`; mode 0600). See [backup metadata](backup.json) and [migration output](migration.log).

## Validation

- Isolated release: 122 unit-test files, **2,235 tests passed**; application and test-infrastructure TypeScript checks passed; Vite production build passed; ESLint zero errors, one existing PaginationBar warning.
- Address-focused verification: 40 unit tests, 2 real form scenarios with controlled API adapters, and the full 13-file SQL suite with 46 receipt assertions.
- Real PDF renderer: **246/246 checks across 12 PDFs and 24 A4 pages**. DE/FR/EN, separate house numbers, Unicode names, full multiline addresses, signatures, worksheet, million-level totals and long documents checked. Text stays in print margins with no word-box collisions.
- Manual visual inspection covers standard, signed, worksheet, French, high-value and continuation/final pages.

[Address evidence](../../../docs/audits/quittung-layout-2026-10-26/ADDRESS_VALIDATION.md), [PDF evidence and samples](../../../docs/audits/quittung-layout-2026-10-26/PDF_LAYOUT_VALIDATION.md).

## Historical documents

Existing archived PDF bytes and issued company snapshots are preserved. Draft PDFs and newly generated, unarchived versions use the new layout. Already-issued snapshots that lack a house number are not silently enriched from today's company profile. An existing archive for the current version remains the source for preview, download and email. No artificial document version increment was introduced to force a restyling.

No customer test email or synthetic financial transaction was created in production. Refresh open browser tabs to load the new UI/PDF renderer.
